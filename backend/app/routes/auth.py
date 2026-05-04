from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app.context import reset_tenant_context, set_tenant_context
from app.auth import CurrentUser, get_current_user, require_admin
from app.auth.admin import add_to_team, create_user, delete_user, get_user_by_email
from app.auth.keycloak import decode_access_token, KEYCLOAK_REALM
from app.db import get_db
from app.tenancy import drop_tenant_schema, ensure_tenant_schema, resolve_tenant_by_team_id

_bearer = HTTPBearer(auto_error=False)

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

    # 2) Captain anlegen oder existierenden User dem Team hinzufügen
    try:
        existing = get_user_by_email(body.captain_email)
        if existing:
            kc_user_id = existing["id"]
            add_to_team(kc_user_id, team_id, "captain")
        else:
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
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (keycloak_user_id) DO UPDATE
                         SET name = EXCLUDED.name, email = EXCLUDED.email
                       RETURNING id""",
                    (team_id, kc_user_id, body.captain_name.strip(), body.captain_email.lower()),
                )
                player_id = cur.fetchone()[0]
    except Exception:
        # Rollback: nur wenn der User neu angelegt wurde (existierende User nicht löschen!)
        if tenant_token is not None:
            reset_tenant_context(tenant_token)
        if not existing:
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


@router.delete("/teams/{team_id}", status_code=204)
def delete_team(team_id: int, _: CurrentUser = Depends(require_admin)):
    """Admin: löscht eine Mannschaft vollständig (Schema CASCADE + DB-Einträge)."""
    # 1) Existenz prüfen
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM public.teams WHERE id = %s", (team_id,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Mannschaft nicht gefunden.")

    # 2) Tenant-Schema mit allen Tabellen löschen (players, rounds, matchdays …)
    drop_tenant_schema(team_id)

    # 3) Team aus DB löschen – cascadiert automatisch auf public.tenants + public.team_memberships
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM public.teams WHERE id = %s", (team_id,))

    return Response(status_code=204)


@router.get("/my-teams")
def my_teams(creds: HTTPAuthorizationCredentials = Depends(_bearer)):
    """Gibt alle Teams des eingeloggten Users zurück – kein Tenant-Kontext nötig.
    Admins erhalten alle Teams mit role='admin'."""
    if not creds:
        raise HTTPException(401, "Nicht authentifiziert.")
    payload = decode_access_token(creds.credentials, realm=KEYCLOAK_REALM)
    user_sub = payload["sub"]
    jwt_roles = payload.get("realm_access", {}).get("roles", [])

    with get_db() as conn:
        with conn.cursor() as cur:
            if "admin" in jwt_roles:
                # Admins sehen alle Teams – tatsächliche Membership-Rolle wo vorhanden,
                # sonst 'admin' als Fallback (voller Zugriff ohne expliziten Eintrag)
                cur.execute(
                    """SELECT t.id, t.name, COALESCE(tm.role, 'admin') AS role
                       FROM public.teams t
                       LEFT JOIN public.team_memberships tm
                         ON tm.team_id = t.id AND tm.keycloak_user_id = %s
                       ORDER BY t.id ASC""",
                    (user_sub,),
                )
                rows = cur.fetchall()
                return [{"team_id": r[0], "team_name": r[1], "role": r[2]} for r in rows]
            else:
                cur.execute(
                    """SELECT tm.team_id, t.name, tm.role
                       FROM public.team_memberships tm
                       JOIN public.teams t ON t.id = tm.team_id
                       WHERE tm.keycloak_user_id = %s
                       ORDER BY tm.created_at ASC""",
                    (user_sub,),
                )
                rows = cur.fetchall()
                return [{"team_id": r[0], "team_name": r[1], "role": r[2]} for r in rows]


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
