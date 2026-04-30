import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.auth import CurrentUser, get_current_user, require_captain
from app.auth.admin import create_user, delete_user
from app.db import get_db

router = APIRouter(prefix="/api/players", tags=["players"])


class PlayerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr


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
    return [
        {
            "id": r[0], "name": r[1], "email": r[2],
            "current_rating": r[3],
            "keycloak_user_id": str(r[4]) if r[4] else None,
            "created_at": r[5],
        }
        for r in rows
    ]


# POST /api/players – Captain legt Spieler an (Keycloak + DB)
@router.post("", status_code=201)
def create_player(body: PlayerCreate, captain: CurrentUser = Depends(require_captain)):
    if captain.team_id is None:
        raise HTTPException(403, "Captain hat kein Team.")
    temp_password = secrets.token_urlsafe(12)
    kc_user_id = create_user(
        email=body.email,
        name=body.name,
        password=temp_password,
        team_id=captain.team_id,
        role="player",
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
