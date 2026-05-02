from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from app.context import reset_auth_context, reset_tenant_context, set_auth_context, set_tenant_context
from app.tenancy import ALLOW_TEAM_ID_FALLBACK, bootstrap_tenant_schemas, normalize_host, resolve_tenant_by_host, resolve_tenant_by_team_id
from app.auth.keycloak import decode_access_token
from app.routes import auth, players, rounds, leaderboard, courses

app = FastAPI(title="Golf Team Performance API", version="0.1.0", redirect_slashes=False)

# CORS – erlaubt lokalen Vite-Dev-Server und spätere Deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router einbinden
app.include_router(auth.router)
app.include_router(players.router)
app.include_router(rounds.router)
app.include_router(leaderboard.router)
app.include_router(courses.router)


@app.on_event("startup")
def startup_bootstrap_tenants():
    bootstrap_tenant_schemas()


@app.middleware("http")
async def tenant_auth_middleware(request: Request, call_next):
    tenant_token = None
    auth_token = None
    try:
        if request.url.path.startswith("/api") and request.url.path not in {"/api/health", "/api/auth/register-team"}:
            host = normalize_host(
                request.headers.get("x-forwarded-host")
                or request.headers.get("host")
                or request.url.hostname
            )
            tenant = resolve_tenant_by_host(host) if host else None

            authorization = request.headers.get("authorization", "")
            token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else None

            if tenant is None and token and ALLOW_TEAM_ID_FALLBACK:
                payload = decode_access_token(token)
                team_id_raw = payload.get("team_id")
                try:
                    tenant = resolve_tenant_by_team_id(int(team_id_raw)) if team_id_raw is not None else None
                except (TypeError, ValueError):
                    tenant = None

            if tenant is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandant nicht gefunden.")

            if tenant is not None:
                tenant_token = set_tenant_context(tenant)

                if token:
                    payload = decode_access_token(token, realm=tenant.realm)
                    payload_team_id = payload.get("team_id")
                    try:
                        payload_team_id_int = int(payload_team_id) if payload_team_id is not None else None
                    except (TypeError, ValueError):
                        payload_team_id_int = None
                    if payload_team_id_int != tenant.team_id:
                        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token passt nicht zum Mandanten.")

                    auth_token = set_auth_context(
                        {
                            "user_id": payload["sub"],
                            "email": payload.get("email"),
                            "name": payload.get("name") or payload.get("preferred_username"),
                            "team_id": payload_team_id_int,
                            "roles": payload.get("realm_access", {}).get("roles", []),
                            "primary_role": (
                                "captain"
                                if "captain" in payload.get("realm_access", {}).get("roles", [])
                                else "player"
                                if "player" in payload.get("realm_access", {}).get("roles", [])
                                else ""
                            ),
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
