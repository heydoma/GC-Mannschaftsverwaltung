from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.auth import CurrentUser, get_current_user, require_captain
from app.db import get_db
from app.engine.golf_engine import GolfEngine
from app.routes.players import _recalc_player_metrics
from app.tenancy import tenant_schema_name

router = APIRouter(prefix="/api/rounds", tags=["rounds"])


class RoundCreate(BaseModel):
    player_id: int
    course_id: Optional[int] = None
    played_on: date
    course_rating: float
    slope_rating: int
    hole_scores: List[int]
    is_hcp_relevant: bool = True

    @field_validator("hole_scores")
    @classmethod
    def must_be_18(cls, v):
        if len(v) != 18:
            raise ValueError("Exakt 18 Loch-Scores erforderlich.")
        return v

    @field_validator("slope_rating")
    @classmethod
    def slope_range(cls, v):
        if not (55 <= v <= 155):
            raise ValueError("Slope muss zwischen 55 und 155 liegen.")
        return v


# GET /api/rounds  (optional: ?player_id=X) – nur eigenes Team
@router.get("")
def list_rounds(
    player_id: Optional[int] = None,
    user: CurrentUser = Depends(get_current_user),
):
    if user.team_id is None:
        raise HTTPException(403, "Kein Team zugeordnet.")
    with get_db() as conn:
        with conn.cursor() as cur:
            if player_id:
                cur.execute(
                    """SELECT r.id, p.name, r.played_on, r.course_rating,
                              r.slope_rating, r.hole_scores, r.created_at,
                              c.id, c.name, r.differential, r.is_hcp_relevant,
                              r.hole_pars, r.form_differential
                       FROM rounds r
                       JOIN players p ON p.id = r.player_id
                       LEFT JOIN courses c ON c.id = r.course_id
                       WHERE r.player_id = %s AND p.team_id = %s
                       ORDER BY r.played_on DESC""",
                    (player_id, user.team_id),
                )
            else:
                cur.execute(
                    """SELECT r.id, p.name, r.played_on, r.course_rating,
                              r.slope_rating, r.hole_scores, r.created_at,
                              c.id, c.name, r.differential, r.is_hcp_relevant,
                              r.hole_pars, r.form_differential
                       FROM rounds r
                       JOIN players p ON p.id = r.player_id
                       LEFT JOIN courses c ON c.id = r.course_id
                       WHERE p.team_id = %s
                       ORDER BY r.played_on DESC""",
                    (user.team_id,),
                )
            rows = cur.fetchall()

    result = []
    for r in rows:
        diff = r[9]
        if diff is None:
            try:
                diff = GolfEngine.calc_differential(r[5], float(r[3]), r[4])
            except ValueError:
                diff = None
        result.append({
            "id": r[0], "player_name": r[1], "played_on": r[2],
            "course_rating": r[3], "slope_rating": r[4],
            "hole_scores": r[5], "total_score": sum(r[5]),
            "differential": diff, "created_at": r[6],
            "course_id": r[7], "course_name": r[8],
            "is_hcp_relevant": r[10] if r[10] is not None else True,
            "hole_pars": r[11],
            "form_differential": float(r[12]) if r[12] is not None else None,
        })
    return result


# POST /api/rounds – Spieler nur für sich selbst; Captain für alle im Team
@router.post("", status_code=201)
def create_round(body: RoundCreate, user: CurrentUser = Depends(get_current_user)):
    if user.team_id is None:
        raise HTTPException(403, "Kein Team zugeordnet.")

    with get_db() as conn:
        with conn.cursor() as cur:
            # Sicherstellen dass der Zielspieler im selben Team ist
            cur.execute(
                "SELECT keycloak_user_id FROM players WHERE id = %s AND team_id = %s",
                (body.player_id, user.team_id),
            )
            player_row = cur.fetchone()
    if player_row is None:
        raise HTTPException(404, f"Spieler {body.player_id} nicht in deinem Team.")

    # Spieler (kein Captain) darf nur für sich selbst eintragen
    if not user.is_captain:
        player_kc_id = str(player_row[0]) if player_row[0] else None
        if player_kc_id != user.user_id:
            raise HTTPException(403, "Spieler dürfen nur eigene Runden eintragen.")

    # Par-Werte vom Kurs laden (wenn vorhanden) – für Form-Differential
    hole_pars: list[int] | None = None
    if body.course_id is not None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, hole_pars FROM courses WHERE id = %s", (body.course_id,)
                )
                course_row = cur.fetchone()
        if course_row is None:
            raise HTTPException(404, "Platz nicht gefunden.")
        hole_pars = course_row[1]  # kann None sein, wenn Kurs keine Par-Daten hat

    diff = GolfEngine.calc_differential(body.hole_scores, body.course_rating, body.slope_rating)
    form_diff: float | None = None
    if hole_pars and len(hole_pars) == 18:
        form_diff = GolfEngine.calc_form_differential(body.hole_scores, hole_pars)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO rounds
                   (player_id, course_id, played_on, course_rating, slope_rating,
                    hole_scores, hole_pars, differential, form_differential, is_hcp_relevant)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (
                    body.player_id,
                    body.course_id,
                    body.played_on,
                    body.course_rating,
                    body.slope_rating,
                    body.hole_scores,
                    hole_pars,
                    diff,
                    form_diff,
                    body.is_hcp_relevant,
                ),
            )
            row = cur.fetchone()

    # Metriken des Spielers automatisch aktualisieren (WHS-Index, Weighted Rating, Momentum)
    try:
        _recalc_player_metrics(body.player_id)
    except Exception:
        pass  # Metriken-Fehler sollen die Runde nicht blockieren

    return {
        "id": row[0],
        "differential": diff,
        "form_differential": form_diff,
        "total_score": sum(body.hole_scores),
        "is_hcp_relevant": body.is_hcp_relevant,
    }


# DELETE /api/rounds/{round_id} – Captain only, eigenes Team
@router.delete("/{round_id}", status_code=204)
def delete_round(round_id: int, captain: CurrentUser = Depends(require_captain)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """DELETE FROM rounds
                   WHERE id = %s
                     AND player_id IN (SELECT id FROM players WHERE team_id = %s)
                   RETURNING id""",
                (round_id, captain.team_id),
            )
            if cur.fetchone() is None:
                raise HTTPException(404, f"Runde {round_id} nicht gefunden.")


class RoundTransfer(BaseModel):
    """Payload für den Cross-Team Runden-Transfer."""
    target_team_ids: List[int]
    played_on: date
    course_id: Optional[int] = None
    course_rating: float
    slope_rating: int
    hole_scores: List[int]
    is_hcp_relevant: bool = True

    @field_validator("hole_scores")
    @classmethod
    def must_be_18(cls, v):
        if len(v) != 18:
            raise ValueError("Exakt 18 Loch-Scores erforderlich.")
        return v

    @field_validator("slope_rating")
    @classmethod
    def slope_range(cls, v):
        if not (55 <= v <= 155):
            raise ValueError("Slope muss zwischen 55 und 155 liegen.")
        return v


# POST /api/rounds/transfer – Runde in andere Teams des Spielers übertragen
@router.post("/transfer", status_code=200)
def transfer_round(body: RoundTransfer, user: CurrentUser = Depends(get_current_user)):
    """Überträgt eine Runde in weitere Teams des eingeloggten Spielers.

    Für jedes target_team_id:
    - Sucht den Spieler-Eintrag anhand der Keycloak-User-ID im Ziel-Schema
    - Legt die Runde dort an (kein Duplikat-Check – liegt beim Client)
    - Aktualisiert die Metriken im Ziel-Schema
    Gibt pro Team {team_id, success, round_id? / error?} zurück.
    """
    if not body.target_team_ids:
        raise HTTPException(400, "Keine Ziel-Teams angegeben.")

    # Par-Werte vom Kurs laden (einmalig, gleich für alle Ziel-Teams)
    hole_pars: list[int] | None = None
    if body.course_id is not None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT hole_pars FROM courses WHERE id = %s", (body.course_id,)
                )
                course_row = cur.fetchone()
        if course_row:
            hole_pars = course_row[0]

    diff = GolfEngine.calc_differential(body.hole_scores, body.course_rating, body.slope_rating)
    form_diff: float | None = None
    if hole_pars and len(hole_pars) == 18:
        form_diff = GolfEngine.calc_form_differential(body.hole_scores, hole_pars)

    results = []

    for team_id in body.target_team_ids:
        schema = tenant_schema_name(team_id)
        player_id: Optional[int] = None
        try:
            with get_db(schema_override=schema) as conn:
                with conn.cursor() as cur:
                    # Spieler via keycloak_user_id im Ziel-Team finden
                    cur.execute(
                        "SELECT id FROM players WHERE keycloak_user_id = %s AND team_id = %s",
                        (user.user_id, team_id),
                    )
                    player_row = cur.fetchone()
                    if player_row is None:
                        results.append({
                            "team_id": team_id, "success": False,
                            "error": "Spieler nicht in diesem Team.",
                        })
                        continue

                    player_id = player_row[0]
                    cur.execute(
                        """INSERT INTO rounds
                           (player_id, course_id, played_on, course_rating, slope_rating,
                            hole_scores, hole_pars, differential, form_differential, is_hcp_relevant)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                        (player_id, body.course_id, body.played_on, body.course_rating,
                         body.slope_rating, body.hole_scores, hole_pars,
                         diff, form_diff, body.is_hcp_relevant),
                    )
                    new_round_id = cur.fetchone()[0]

            # Metriken im Ziel-Schema aktualisieren
            try:
                _recalc_player_metrics(player_id, schema_name=schema)
            except Exception:
                pass  # Metriken-Fehler blockieren nicht den Transfer

            results.append({"team_id": team_id, "success": True, "round_id": new_round_id})

        except Exception as e:
            results.append({"team_id": team_id, "success": False, "error": str(e)})

    return {"results": results}
