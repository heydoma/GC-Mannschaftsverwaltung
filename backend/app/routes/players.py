import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.auth import CurrentUser, get_current_user, require_captain
from app.auth.admin import add_to_team, create_user, delete_user, get_user_by_email, get_user_realm_roles, set_user_realm_role
from app.engine.golf_engine import GolfEngine
from app.db import get_db

router = APIRouter(prefix="/api/players", tags=["players"])


class PlayerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    role: str = Field("player", pattern="^(player|captain)$")


class PlayerRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(player|captain)$")


class PlayerAnalyzeResult(BaseModel):
    player_id: int
    current_whs_index: Optional[float]
    weighted_rating: Optional[float]
    momentum_score: Optional[float]


# GET /api/players/check-email – prüft ob Email bereits in Keycloak existiert
@router.get("/check-email")
def check_email(email: str, captain: CurrentUser = Depends(require_captain)):
    """Gibt {exists: true/false} zurück – kein Passwort nötig wenn exists=true."""
    existing = get_user_by_email(email)
    return {"exists": existing is not None}


# GET /api/players – alle Spieler des eigenen Teams
@router.get("")
def list_players(user: CurrentUser = Depends(get_current_user)):
    if user.team_id is None:
        raise HTTPException(403, "Kein Team zugeordnet.")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, email, current_rating, keycloak_user_id, created_at,
                          current_whs_index
                   FROM players WHERE team_id = %s ORDER BY name""",
                (user.team_id,),
            )
            rows = cur.fetchall()
    result = []
    for r in rows:
        kc_id = str(r[4]) if r[4] else None
        role = None
        if kc_id:
            try:
                roles = get_user_realm_roles(kc_id)
                role = "captain" if "captain" in roles else "player" if "player" in roles else None
            except Exception:
                role = None
        result.append({
            "id": r[0], "name": r[1], "email": r[2],
            "current_rating": r[3],
            "keycloak_user_id": kc_id,
            "created_at": r[5],
            "role": role,
            "current_whs_index": float(r[6]) if r[6] is not None else None,
        })
    return result


# POST /api/players – Captain legt Spieler an (Keycloak + DB)
@router.post("", status_code=201)
def create_player(body: PlayerCreate, captain: CurrentUser = Depends(require_captain)):
    if captain.team_id is None:
        raise HTTPException(403, "Captain hat kein Team.")

    # Existierenden Keycloak-User prüfen (z.B. Spieler bereits in anderem Team)
    existing = get_user_by_email(body.email)
    if existing:
        kc_user_id = existing["id"]
        add_to_team(kc_user_id, captain.team_id, body.role)
        temp_password = None  # User hat bereits ein Passwort
    else:
        # Neuer User: Passwort aus Request oder zufällig generieren
        temp_password = body.password or secrets.token_urlsafe(12)
        kc_user_id = create_user(
            email=body.email,
            name=body.name,
            password=temp_password,
            team_id=captain.team_id,
            role=body.role,
        )

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO players (team_id, keycloak_user_id, name, email)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (keycloak_user_id) DO UPDATE
                         SET name = EXCLUDED.name, email = EXCLUDED.email
                       RETURNING id, name, email, created_at""",
                    (captain.team_id, kc_user_id, body.name.strip(), body.email.lower()),
                )
                row = cur.fetchone()
    except Exception as e:
        if not existing:
            delete_user(kc_user_id)
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Spieler '{body.name}' oder E-Mail existiert bereits.")
        raise

    response = {"id": row[0], "name": row[1], "email": row[2], "created_at": row[3]}
    if temp_password:
        response["temporary_password"] = temp_password
        response["message"] = "Passwort einmalig anzeigen und an Spieler weitergeben."
    else:
        response["message"] = "Bestehender Account wurde diesem Team hinzugefügt."
    return response


# DELETE /api/players/{player_id} – Captain only, eigenes Team
@router.delete("/{player_id}", status_code=204)
def remove_player(player_id: int, captain: CurrentUser = Depends(require_captain)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """DELETE FROM players
                   WHERE id = %s AND team_id = %s
                   RETURNING keycloak_user_id""",
                (player_id, captain.team_id),
            )
            row = cur.fetchone()
    if row is None:
        raise HTTPException(404, f"Spieler {player_id} nicht gefunden.")
    kc_id = row[0]
    if not kc_id:
        return

    kc_id_str = str(kc_id)

    # team_memberships für dieses Team entfernen
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM public.team_memberships WHERE keycloak_user_id = %s AND team_id = %s",
                (kc_id_str, captain.team_id),
            )
            # Prüfen ob der User noch in anderen Teams ist
            cur.execute(
                "SELECT COUNT(*) FROM public.team_memberships WHERE keycloak_user_id = %s",
                (kc_id_str,),
            )
            remaining = cur.fetchone()[0]

    # Keycloak-Account nur löschen wenn keine anderen Teams mehr
    if remaining == 0:
        delete_user(kc_id_str)


@router.patch("/{player_id}/role")
def update_player_role(
    player_id: int,
    body: PlayerRoleUpdate,
    captain: CurrentUser = Depends(require_captain),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT keycloak_user_id
                   FROM players
                   WHERE id = %s AND team_id = %s""",
                (player_id, captain.team_id),
            )
            row = cur.fetchone()
    if row is None:
        raise HTTPException(404, f"Spieler {player_id} nicht gefunden.")
    kc_id = row[0]
    if kc_id is None:
        raise HTTPException(409, "Kein Keycloak-User verknuepft.")

    target_kc_id = str(kc_id)
    if body.role == "player":
        if target_kc_id == captain.user_id:
            raise HTTPException(403, "Du kannst deine eigene Captain-Rolle nicht entfernen.")
        # Sicherstellen dass mindestens ein Captain im Team bleibt
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT COUNT(*) FROM public.team_memberships
                       WHERE team_id = %s AND role = 'captain'
                         AND keycloak_user_id != %s""",
                    (captain.team_id, target_kc_id),
                )
                remaining_captains = cur.fetchone()[0]
        if remaining_captains == 0:
            raise HTTPException(409, "Letzter Captain kann nicht entfernt werden.")

    # Per-Team Rolle in team_memberships aktualisieren
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE public.team_memberships SET role = %s
                   WHERE keycloak_user_id = %s AND team_id = %s""",
                (body.role, target_kc_id, captain.team_id),
            )

    # Keycloak-Realm-Rolle anpassen: höchste Rolle über ALLE Teams des Users
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role FROM public.team_memberships WHERE keycloak_user_id = %s",
                (target_kc_id,),
            )
            all_roles = [r[0] for r in cur.fetchall()]
    highest = "captain" if "captain" in all_roles else "player"
    set_user_realm_role(target_kc_id, highest)

    return {"id": player_id, "role": body.role}


@router.post("/{player_id}/analyze", response_model=PlayerAnalyzeResult)
def analyze_player(
    player_id: int,
    captain: CurrentUser = Depends(require_captain),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id
                   FROM players
                   WHERE id = %s AND team_id = %s""",
                (player_id, captain.team_id),
            )
            if cur.fetchone() is None:
                raise HTTPException(404, f"Spieler {player_id} nicht gefunden.")

    metrics = _recalc_player_metrics(player_id)
    return {
        "player_id": player_id,
        "current_whs_index": metrics["current_whs_index"],
        "weighted_rating": metrics["weighted_rating"],
        "momentum_score": metrics["momentum_score"],
    }


def _recalc_player_metrics(player_id: int, schema_name: Optional[str] = None) -> dict:
    """Berechnet WHS-Index, Weighted Rating und Momentum für einen Spieler neu.

    schema_name: Falls gesetzt (z.B. 'tenant_2'), werden alle Queries direkt in diesem
    Schema ausgeführt. Damit können Cross-Team Transfers Metriken im Ziel-Schema
    aktualisieren, ohne den aktiven TenantContext zu ändern.
    """
    with get_db(schema_override=schema_name) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, played_on, differential, hole_scores, course_rating,
                          slope_rating, is_hcp_relevant, form_differential
                   FROM rounds
                   WHERE player_id = %s
                   ORDER BY played_on ASC""",
                (player_id,),
            )
            rows = cur.fetchall()

    all_rounds = []   # alle Runden → Ranking / Weighted Rating
    all_diffs = []    # HCP-Differentials für Fallback-Momentum
    hcp_diffs = []    # nur HCP-relevante → WHS-Index
    form_diffs = []   # Form-Differentials (par-aware, Ausreißer bereinigt)

    for round_id, played_on, differential, hole_scores, course_rating, slope_rating, is_hcp_relevant, form_differential in rows:
        if differential is None and hole_scores is not None and slope_rating is not None:
            try:
                differential = GolfEngine.calc_differential(
                    hole_scores,
                    float(course_rating),
                    slope_rating,
                )
                with get_db(schema_override=schema_name) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE rounds SET differential = %s WHERE id = %s",
                            (differential, round_id),
                        )
            except ValueError:
                differential = None

        if differential is None:
            continue

        d = float(differential)
        fd = float(form_differential) if form_differential is not None else None
        all_rounds.append({"played_on": played_on, "differential": d, "form_differential": fd})
        all_diffs.append(d)
        if is_hcp_relevant is not False:   # True or NULL → HCP relevant
            hcp_diffs.append(d)
        if form_differential is not None:
            form_diffs.append(float(form_differential))

    # Momentum: form_diffs verwenden wenn ≥3 Runden mit Par-Daten vorliegen,
    # sonst Fallback auf HCP-Differentials (rückwärtskompatibel)
    momentum_source = form_diffs[-20:] if len(form_diffs) >= 3 else all_diffs[-20:]
    whs_index = GolfEngine.calc_whs_index(hcp_diffs[-20:])
    weighted_rating = GolfEngine.calc_form_rating(all_rounds)
    momentum_data = GolfEngine.calc_momentum(momentum_source)
    momentum_score = momentum_data["momentum"]

    with get_db(schema_override=schema_name) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE players
                   SET current_whs_index = %s,
                       weighted_rating = %s,
                       momentum_score = %s
                   WHERE id = %s""",
                (whs_index, weighted_rating, momentum_score, player_id),
            )

    return {
        "current_whs_index": whs_index,
        "weighted_rating": weighted_rating,
        "momentum_score": momentum_score,
    }
