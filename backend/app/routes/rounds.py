from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.auth import CurrentUser, get_current_user, require_captain
from app.db import get_db
from app.engine.golf_engine import GolfEngine

router = APIRouter(prefix="/api/rounds", tags=["rounds"])


class RoundCreate(BaseModel):
    player_id: int
    played_on: date
    course_rating: float
    slope_rating: int
    hole_scores: list[int]

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
                              r.slope_rating, r.hole_scores, r.created_at
                       FROM rounds r
                       JOIN players p ON p.id = r.player_id
                       WHERE r.player_id = %s AND p.team_id = %s
                       ORDER BY r.played_on DESC""",
                    (player_id, user.team_id),
                )
            else:
                cur.execute(
                    """SELECT r.id, p.name, r.played_on, r.course_rating,
                              r.slope_rating, r.hole_scores, r.created_at
                       FROM rounds r
                       JOIN players p ON p.id = r.player_id
                       WHERE p.team_id = %s
                       ORDER BY r.played_on DESC""",
                    (user.team_id,),
                )
            rows = cur.fetchall()

    result = []
    for r in rows:
        try:
            diff = GolfEngine.calc_differential(r[5], float(r[3]), r[4])
        except ValueError:
            diff = None
        result.append({
            "id": r[0], "player_name": r[1], "played_on": r[2],
            "course_rating": r[3], "slope_rating": r[4],
            "hole_scores": r[5], "total_score": sum(r[5]),
            "differential": diff, "created_at": r[6],
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

    diff = GolfEngine.calc_differential(body.hole_scores, body.course_rating, body.slope_rating)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO rounds (player_id, played_on, course_rating, slope_rating, hole_scores)
                   VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                (body.player_id, body.played_on, body.course_rating,
                 body.slope_rating, body.hole_scores),
            )
            row = cur.fetchone()
    return {"id": row[0], "differential": diff, "total_score": sum(body.hole_scores)}


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
