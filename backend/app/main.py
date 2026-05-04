import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.context import reset_auth_context, reset_tenant_context, set_auth_context, set_tenant_context
from app.tenancy import ALLOW_TEAM_ID_FALLBACK, bootstrap_tenant_schemas, normalize_host, resolve_tenant_by_host, resolve_tenant_by_team_id, get_team_membership
from app.auth.keycloak import decode_access_token
from app.routes import auth, players, rounds, leaderboard, courses, matchdays

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# CORS: In Production aus Env-Var lesen, lokal Dev-Server erlauben
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = (
    [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
    if _allowed_origins_env
    else ["http://localhost:5173", "http://localhost:4173"]
)

@asynccontextmanager
async def lifespan(_: FastAPI):
    bootstrap_tenant_schemas()
    yield


app = FastAPI(
    title="Golf Team Performance API",
    version="0.1.0",
    redirect_slashes=False,
    lifespan=lifespan,
    # Swagger/ReDoc in Production deaktivieren
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router einbinden
app.include_router(auth.router)
app.include_router(players.router)
app.include_router(rounds.router)
app.include_router(leaderboard.router)
app.include_router(courses.router)
app.include_router(matchdays.router)


@app.middleware("http")
async def tenant_auth_middleware(request: Request, call_next):
    # OPTIONS-Preflight direkt durchleiten – CORSMiddleware muss die Antwort setzen,
    # bevor wir irgendeinen Tenant-Check machen (sonst fehlen CORS-Header im Preflight).
    if request.method == "OPTIONS":
        return await call_next(request)

    tenant_token = None
    auth_token = None
    try:
        TENANT_EXEMPT = {"/api/health", "/api/auth/register-team", "/api/auth/teams", "/api/auth/my-teams"}
        if request.url.path.startswith("/api") and request.url.path not in TENANT_EXEMPT:
            authorization = request.headers.get("authorization", "")
            token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else None

            # Tenant-Auflösung: 1) Host 2) X-Active-Team Header 3) team_id aus JWT (Fallback)
            host = normalize_host(
                request.headers.get("x-forwarded-host")
                or request.headers.get("host")
                or request.url.hostname
            )
            tenant = resolve_tenant_by_host(host) if host else None

            active_team_header = request.headers.get("x-active-team")
            if tenant is None and active_team_header:
                try:
                    tenant = resolve_tenant_by_team_id(int(active_team_header))
                except (TypeError, ValueError):
                    tenant = None

            if tenant is None and token and ALLOW_TEAM_ID_FALLBACK:
                payload = decode_access_token(token)
                team_id_raw = payload.get("team_id")
                try:
                    tenant = resolve_tenant_by_team_id(int(team_id_raw)) if team_id_raw is not None else None
                except (TypeError, ValueError):
                    tenant = None

            if tenant is None:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={"detail": "Mandant nicht gefunden."},
                )

            tenant_token = set_tenant_context(tenant)

            if token:
                payload = decode_access_token(token, realm=tenant.realm)
                user_sub = payload["sub"]
                jwt_roles = payload.get("realm_access", {}).get("roles", [])

                # Admins: JWT-Rollen gelten global, keine Mitgliedschaftsprüfung
                if "admin" in jwt_roles:
                    effective_roles = jwt_roles
                else:
                    # Per-Team Rolle AUSSCHLIESSLICH aus team_memberships lesen
                    membership = get_team_membership(user_sub, tenant.team_id)
                    if not membership:
                        return JSONResponse(
                            status_code=status.HTTP_403_FORBIDDEN,
                            content={"detail": "Kein Zugriff auf dieses Team."},
                        )
                    effective_roles = [membership["role"]]

                primary_role = (
                    "captain" if "captain" in effective_roles
                    else "player" if "player" in effective_roles
                    else ""
                )

                auth_token = set_auth_context(
                    {
                        "user_id": user_sub,
                        "email": payload.get("email"),
                        "name": payload.get("name") or payload.get("preferred_username"),
                        "team_id": tenant.team_id,
                        "roles": effective_roles,
                        "primary_role": primary_role,
                    }
                )

        response = await call_next(request)
        return response
    finally:
        if auth_token is not None:
            reset_auth_context(auth_token)
        if tenant_token is not None:
            reset_tenant_context(tenant_token)


@app.get("/api/health")
def health():
    return {"status": "ok"}
