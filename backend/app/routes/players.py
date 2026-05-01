import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.auth import CurrentUser, get_current_user, require_captain
from app.auth.admin import create_user, delete_user, get_user_realm_roles, set_user_realm_role
from app.engine.golf_engine import GolfEngine
from app.db import get_db

router = APIRouter(prefix="/api/players", tags=["players"])


class PlayerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    role: str = Field("player", pattern="^(player|captain)$")


class PlayerRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(player|captain)$")


class PlayerAnalyzeResult(BaseModel):
    player_id: int
    current_whs_index: Optional[float]
    weighted_rating: Optional[float]
    momentum_score: Optional[float]


# GET /api/players – alle Spieler des eigenen Teams
@router.get("")
def list_players(user: CurrentUser = Depends(get_current_user)):
    if user.team_id is None:
        raise HTTPException(403, "Kein Team zugeordnet.")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, email, current_rating, keycloak_user_id, created_at
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
        })
    return result


# POST /api/players – Captain legt Spieler an (Keycloak + DB)
@router.post("", status_code=201)
def create_player(body: PlayerCreate, captain: CurrentUser = Depends(require_captain)):
    if captain.team_id is None:
        raise HTTPException(403, "Captain hat kein Team.")
    temp_password = body.password
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
                       RETURNING id, name, email, created_at""",
                    (captain.team_id, kc_user_id, body.name.strip(), body.email.lower()),
                )
                row = cur.fetchone()
    except Exception as e:
        delete_user(kc_user_id)
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Spieler '{body.name}' oder E-Mail existiert bereits.")
        raise
    return {
        "id": row[0], "name": row[1], "email": row[2], "created_at": row[3],
        "temporary_password": temp_password,
        "message": "Passwort einmalig anzeigen und an Spieler weitergeben.",
    }


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
    if kc_id:
        delete_user(str(kc_id))


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

        target_roles = get_user_realm_roles(target_kc_id)
        if "captain" in target_roles:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT keycloak_user_id
                           FROM players
                           WHERE team_id = %s
                             AND keycloak_user_id IS NOT NULL""",
                        (captain.team_id,),
                    )
                    team_ids = [str(r[0]) for r in cur.fetchall()]
            captain_count = 0
            for kc_user_id in team_ids:
                try:
                    roles = get_user_realm_roles(kc_user_id)
                except Exception:
                    continue
                if "captain" in roles:
                    captain_count += 1
            if captain_count <= 1:
                raise HTTPException(409, "Letzter Captain kann nicht entfernt werden.")

    set_user_realm_role(target_kc_id, body.role)
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


def _recalc_player_metrics(player_id: int) -> dict:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, played_on, differential, hole_scores, course_rating, slope_rating
                   FROM rounds
                   WHERE player_id = %s
                   ORDER BY played_on ASC""",
                (player_id,),
            )
            rows = cur.fetchall()

    rounds = []
    diffs = []
    for round_id, played_on, differential, hole_scores, course_rating, slope_rating in rows:
        if differential is None and hole_scores is not None and slope_rating is not None:
            try:
                differential = GolfEngine.calc_differential(
                    hole_scores,
                    float(course_rating),
                    slope_rating,
                )
                with get_db() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE rounds SET differential = %s WHERE id = %s",
                            (differential, round_id),
                        )
            except ValueError:
                differential = None

        if differential is None:
            continue
        rounds.append({"played_on": played_on, "differential": float(differential)})
        diffs.append(float(differential))

    whs_index = GolfEngine.calc_whs_index(diffs[-20:])
    weighted_rating = GolfEngine.calc_weighted_rating(rounds)
    momentum_data = GolfEngine.calc_momentum(diffs[-20:])
    momentum_score = momentum_data["momentum"]

    with get_db() as conn:
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
