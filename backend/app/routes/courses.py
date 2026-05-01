from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import CurrentUser, get_current_user, require_admin
from app.db import get_db

router = APIRouter(prefix="/api/courses", tags=["courses"])


class CourseCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)


@router.get("")
def list_courses(_: CurrentUser = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, created_at
                   FROM courses
                   ORDER BY name"""
            )
            rows = cur.fetchall()
    return [{"id": r[0], "name": r[1], "created_at": r[2]} for r in rows]


@router.post("", status_code=201)
def create_course(body: CourseCreate, _: CurrentUser = Depends(require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    "INSERT INTO courses (name) VALUES (%s) RETURNING id, name, created_at",
                    (body.name.strip(),),
                )
                row = cur.fetchone()
            except Exception as e:
                if "unique" in str(e).lower():
                    raise HTTPException(409, "Platz existiert bereits.")
                raise
    return {"id": row[0], "name": row[1], "created_at": row[2]}


@router.put("/{course_id}")
def update_course(course_id: int, body: CourseCreate, _: CurrentUser = Depends(require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """UPDATE courses
                       SET name = %s
                       WHERE id = %s
                       RETURNING id, name, created_at""",
                    (body.name.strip(), course_id),
                )
                row = cur.fetchone()
            except Exception as e:
                if "unique" in str(e).lower():
                    raise HTTPException(409, "Platz existiert bereits.")
                raise
    if row is None:
        raise HTTPException(404, "Platz nicht gefunden.")
    return {"id": row[0], "name": row[1], "created_at": row[2]}
