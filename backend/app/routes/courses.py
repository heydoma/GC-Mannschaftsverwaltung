from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.auth import CurrentUser, get_current_user, require_admin
from app.db import get_db

router = APIRouter(prefix="/api/courses", tags=["courses"])


class CourseCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    course_rating: Optional[float] = None
    slope_rating: Optional[int] = None
    hole_pars: Optional[List[int]] = None

    @field_validator("slope_rating")
    @classmethod
    def slope_range(cls, v):
        if v is not None and not (55 <= v <= 155):
            raise ValueError("Slope muss zwischen 55 und 155 liegen.")
        return v

    @field_validator("hole_pars")
    @classmethod
    def pars_length(cls, v):
        if v is not None and len(v) != 18:
            raise ValueError("Exakt 18 Par-Werte erforderlich.")
        return v


def _row_to_dict(r) -> dict:
    return {
        "id": r[0],
        "name": r[1],
        "course_rating": float(r[2]) if r[2] is not None else None,
        "slope_rating": r[3],
        "hole_pars": r[4],
        "created_at": r[5],
    }


@router.get("")
def list_courses(_: CurrentUser = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, course_rating, slope_rating, hole_pars, created_at
                   FROM courses
                   ORDER BY name"""
            )
            rows = cur.fetchall()
    return [_row_to_dict(r) for r in rows]


@router.post("", status_code=201)
def create_course(body: CourseCreate, _: CurrentUser = Depends(require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """INSERT INTO courses (name, course_rating, slope_rating, hole_pars)
                       VALUES (%s, %s, %s, %s)
                       RETURNING id, name, course_rating, slope_rating, hole_pars, created_at""",
                    (body.name.strip(), body.course_rating, body.slope_rating, body.hole_pars),
                )
                row = cur.fetchone()
            except Exception as e:
                if "unique" in str(e).lower():
                    raise HTTPException(409, "Platz existiert bereits.")
                raise
    return _row_to_dict(row)


@router.put("/{course_id}")
def update_course(course_id: int, body: CourseCreate, _: CurrentUser = Depends(require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """UPDATE courses
                       SET name = %s, course_rating = %s, slope_rating = %s, hole_pars = %s
                       WHERE id = %s
                       RETURNING id, name, course_rating, slope_rating, hole_pars, created_at""",
                    (body.name.strip(), body.course_rating, body.slope_rating,
                     body.hole_pars, course_id),
                )
                row = cur.fetchone()
            except Exception as e:
                if "unique" in str(e).lower():
                    raise HTTPException(409, "Platz existiert bereits.")
                raise
    if row is None:
        raise HTTPException(404, "Platz nicht gefunden.")
    return _row_to_dict(row)
