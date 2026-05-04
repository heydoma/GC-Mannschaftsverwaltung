from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import CurrentUser, get_current_user, require_captain
from app.db import get_db

router = APIRouter(prefix="/api/matchdays", tags=["matchdays"])


class MatchdayCreate(BaseModel):
    label: str
    match_date: Optional[date] = None
    starters: List[int] = []
    reserves: List[int] = []


class MatchdayUpdate(BaseModel):
    label: Optional[str] = None
    match_date: Optional[date] = None
    starters: Optional[List[int]] = None
    reserves: Optional[List[int]] = None


def _row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "label": row[1],
        "match_date": row[2].isoformat() if row[2] else None,
        "starters": row[3] or [],
        "reserves": row[4] or [],
        "published": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
    }


# GET /api/matchdays – Captain: alle; Spieler: nur veröffentlichte
@router.get("")
def list_matchdays(user: CurrentUser = Depends(get_current_user)):
    if user.team_id is None:
        raise HTTPException(403, "Kein Team zugeordnet.")
    with get_db() as conn:
        with conn.cursor() as cur:
            if user.is_captain:
                cur.execute(
                    "SELECT id, label, match_date, starters, reserves, published, created_at "
                    "FROM matchdays ORDER BY match_date DESC NULLS LAST, created_at DESC"
                )
            else:
                cur.execute(
                    "SELECT id, label, match_date, starters, reserves, published, created_at "
                    "FROM matchdays WHERE published = true "
                    "ORDER BY match_date DESC NULLS LAST, created_at DESC"
                )
            rows = cur.fetchall()
    return [_row_to_dict(r) for r in rows]


# POST /api/matchdays – Captain only
@router.post("", status_code=201)
def create_matchday(body: MatchdayCreate, captain: CurrentUser = Depends(require_captain)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO matchdays (label, match_date, starters, reserves) "
                "VALUES (%s, %s, %s, %s) RETURNING id, label, match_date, starters, reserves, published, created_at",
                (body.label, body.match_date, body.starters, body.reserves),
            )
            row = cur.fetchone()
    return _row_to_dict(row)


# PUT /api/matchdays/{id} – Aufstellung + Label aktualisieren (Captain only)
@router.put("/{matchday_id}")
def update_matchday(matchday_id: int, body: MatchdayUpdate, captain: CurrentUser = Depends(require_captain)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM matchdays WHERE id = %s", (matchday_id,)
            )
            if cur.fetchone() is None:
                raise HTTPException(404, f"Spieltag {matchday_id} nicht gefunden.")
            updates = []
            values = []
            if body.label is not None:
                updates.append("label = %s")
                values.append(body.label)
            if body.match_date is not None:
                updates.append("match_date = %s")
                values.append(body.match_date)
            if body.starters is not None:
                updates.append("starters = %s")
                values.append(body.starters)
            if body.reserves is not None:
                updates.append("reserves = %s")
                values.append(body.reserves)
            if not updates:
                raise HTTPException(400, "Keine Felder zum Aktualisieren.")
            values.append(matchday_id)
            cur.execute(
                f"UPDATE matchdays SET {', '.join(updates)} WHERE id = %s "
                "RETURNING id, label, match_date, starters, reserves, published, created_at",
                values,
            )
            row = cur.fetchone()
    return _row_to_dict(row)


# PATCH /api/matchdays/{id}/publish – Veröffentlichen / Zurückziehen (Captain only)
@router.patch("/{matchday_id}/publish")
def toggle_publish(matchday_id: int, captain: CurrentUser = Depends(require_captain)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE matchdays SET published = NOT published WHERE id = %s "
                "RETURNING id, label, match_date, starters, reserves, published, created_at",
                (matchday_id,),
            )
            row = cur.fetchone()
    if row is None:
        raise HTTPException(404, f"Spieltag {matchday_id} nicht gefunden.")
    return _row_to_dict(row)


# DELETE /api/matchdays/{id} – Captain only
@router.delete("/{matchday_id}", status_code=204)
def delete_matchday(matchday_id: int, captain: CurrentUser = Depends(require_captain)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM matchdays WHERE id = %s RETURNING id", (matchday_id,)
            )
            if cur.fetchone() is None:
                raise HTTPException(404, f"Spieltag {matchday_id} nicht gefunden.")
