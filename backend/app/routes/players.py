from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.db import get_db

router = APIRouter(prefix="/api/players", tags=["players"])


class PlayerCreate(BaseModel):
    name: str
    current_rating: Optional[float] = None


# GET /api/players
@router.get("")
def list_players():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, current_rating, created_at FROM players ORDER BY name"
            )
            rows = cur.fetchall()
    return [
        {"id": r[0], "name": r[1], "current_rating": r[2], "created_at": r[3]}
        for r in rows
    ]


# POST /api/players
@router.post("", status_code=201)
def create_player(body: PlayerCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO players (name, current_rating)
                    VALUES (%s, %s)
                    RETURNING id, name, current_rating, created_at
                    """,
                    (body.name.strip(), body.current_rating),
                )
                row = cur.fetchone()
            except Exception as e:
                if "unique" in str(e).lower():
                    raise HTTPException(409, f"Spieler '{body.name}' existiert bereits.")
                raise
    return {"id": row[0], "name": row[1], "current_rating": row[2], "created_at": row[3]}


# DELETE /api/players/{player_id}
@router.delete("/{player_id}", status_code=204)
def delete_player(player_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM players WHERE id = %s RETURNING id", (player_id,))
            if cur.fetchone() is None:
                raise HTTPException(404, f"Spieler {player_id} nicht gefunden.")
