from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.context import reset_tenant_context, set_tenant_context
from app.auth import CurrentUser, get_current_user, require_admin
from app.auth.admin import create_user, delete_user
from app.db import get_db
from app.tenancy import ensure_tenant_schema, resolve_tenant_by_team_id

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterTeam(BaseModel):
    team_name: str = Field(..., min_length=2, max_length=100)
    captain_name: str = Field(..., min_length=2, max_length=100)
    captain_email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)


@router.post("/register-team", status_code=201)
def register_team(body: RegisterTeam, _: CurrentUser = Depends(require_admin)):
    """Admin: legt Mannschaft + Captain (Keycloak + DB) an."""
    tenant_token = None
    # 1) Team in DB anlegen
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO teams (name) VALUES (%s) RETURNING id",
                (body.team_name.strip(),),
            )
            team_id = cur.fetchone()[0]

    ensure_tenant_schema(team_id, team_name=body.team_name.strip())
    tenant = resolve_tenant_by_team_id(team_id)
    if tenant is None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM teams WHERE id = %s", (team_id,))
        raise HTTPException(500, "Mandant konnte nicht initialisiert werden.")

    # 2) Captain in Keycloak anlegen
    try:
        kc_user_id = create_user(
            email=body.captain_email,
            name=body.captain_name,
            password=body.password,
            team_id=team_id,
            role="captain",
        )
    except HTTPException:
        # Rollback: Team wieder löschen
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM teams WHERE id = %s", (team_id,))
        raise

    # 3) Player-Eintrag für den Captain (damit er auch eigene Runden eintragen kann)
    try:
        tenant_token = set_tenant_context(tenant)
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO players (team_id, keycloak_user_id, name, email)
                       VALUES (%s, %s, %s, %s) RETURNING id""",
                    (team_id, kc_user_id, body.captain_name.strip(), body.captain_email.lower()),
                )
                player_id = cur.fetchone()[0]
    except Exception:
        # Rollback Keycloak + Team
        if tenant_token is not None:
            reset_tenant_context(tenant_token)
        delete_user(kc_user_id)
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM teams WHERE id = %s", (team_id,))
        raise
    finally:
        if tenant_token is not None:
            reset_tenant_context(tenant_token)

    return {
        "team_id": team_id,
        "player_id": player_id,
        "keycloak_user_id": kc_user_id,
        "message": "Mannschaft erfolgreich angelegt. Du kannst dich jetzt einloggen.",
    }


@router.get("/teams")
def list_teams(_: CurrentUser = Depends(require_admin)):
    """Admin-Übersicht aller Teams."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, created_at
                   FROM teams
                   ORDER BY created_at DESC"""
            )
            rows = cur.fetchall()
    return [
        {"id": r[0], "name": r[1], "created_at": r[2]}
        for r in rows
    ]


@router.get("/me")
def whoami(user: CurrentUser = Depends(get_current_user)):
    """Liefert Profil + verknüpften Player-Eintrag des aktuellen Users."""
    if user.team_id is None:
        raise HTTPException(403, "Kein Team zugeordnet. Bitte Captain kontaktieren.")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name FROM players
                   WHERE keycloak_user_id = %s AND team_id = %s""",
                (user.user_id, user.team_id),
            )
            row = cur.fetchone()
            cur.execute("SELECT name FROM teams WHERE id = %s", (user.team_id,))
            team_row = cur.fetchone()

    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "team_id": user.team_id,
        "team_name": team_row[0] if team_row else None,
        "roles": user.roles,
        "is_captain": user.is_captain,
        "player": {"id": row[0], "name": row[1]} if row else None,
    }
