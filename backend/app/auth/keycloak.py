"""Keycloak JWT-Validierung und FastAPI-Auth-Dependencies."""
import os
import time
from dataclasses import dataclass
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi import Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError

from app.context import get_auth_context, get_tenant_context, set_auth_context

load_dotenv()

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8180")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "golf-team-manager")
ISSUER = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"
JWKS_URL = f"{ISSUER}/protocol/openid-connect/certs"

bearer_scheme = HTTPBearer(auto_error=True)

_jwks_cache: dict[str, dict] = {}
_JWKS_TTL = 3600.0


def _issuer_for_realm(realm: str) -> str:
    return f"{KEYCLOAK_URL}/realms/{realm}"


def _jwks_url_for_realm(realm: str) -> str:
    return f"{_issuer_for_realm(realm)}/protocol/openid-connect/certs"


def _fetch_jwks(jwks_url: str) -> dict:
    now = time.time()
    cache = _jwks_cache.get(jwks_url)
    if cache is None or cache.get("keys") is None or (now - cache.get("fetched_at", 0.0)) > _JWKS_TTL:
        resp = httpx.get(jwks_url, timeout=5.0)
        resp.raise_for_status()
        cache = {"keys": resp.json(), "fetched_at": now}
        _jwks_cache[jwks_url] = cache
    return cache["keys"]


def _get_signing_key(token: str, jwks_url: str) -> dict:
    headers = jwt.get_unverified_header(token)
    kid = headers.get("kid")
    jwks = _fetch_jwks(jwks_url)
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    # Cache leeren falls Key rotiert wurde
    _jwks_cache.pop(jwks_url, None)
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Signing key not found")


def decode_access_token(token: str, realm: Optional[str] = None) -> dict:
    realm = realm or KEYCLOAK_REALM
    issuer = _issuer_for_realm(realm)
    jwks_url = _jwks_url_for_realm(realm)
    try:
        key = _get_signing_key(token, jwks_url)
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"verify_aud": False},
        )
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")


@dataclass
class CurrentUser:
    user_id: str
    email: Optional[str]
    name: Optional[str]
    team_id: Optional[int]
    roles: List[str]

    @property
    def is_captain(self) -> bool:
        return "captain" in self.roles

    @property
    def is_player(self) -> bool:
        return "player" in self.roles

    @property
    def is_admin(self) -> bool:
        return "admin" in self.roles


def _current_user_from_payload(payload: dict) -> CurrentUser:
    realm_roles = payload.get("realm_access", {}).get("roles", [])
    team_id_raw = payload.get("team_id")
    try:
        team_id = int(team_id_raw) if team_id_raw is not None else None
    except (TypeError, ValueError):
        team_id = None

    return CurrentUser(
        user_id=payload["sub"],
        email=payload.get("email"),
        name=payload.get("name") or payload.get("preferred_username"),
        team_id=team_id,
        roles=realm_roles,
    )


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    """Validiert das Bearer-Token gegen Keycloak und liefert den User-Kontext."""
    cached = request.state.__dict__.get("current_user")
    if isinstance(cached, CurrentUser):
        return cached

    cached_auth = get_auth_context()
    if cached_auth and cached_auth.get("user_id"):
        return CurrentUser(
            user_id=str(cached_auth["user_id"]),
            email=cached_auth.get("email"),
            name=cached_auth.get("name"),
            team_id=cached_auth.get("team_id"),
            roles=list(cached_auth.get("roles") or []),
        )

    token = creds.credentials
    tenant = get_tenant_context()
    payload = decode_access_token(token, realm=tenant.realm if tenant and tenant.realm else KEYCLOAK_REALM)
    current_user = _current_user_from_payload(payload)
    request.state.current_user = current_user
    set_auth_context({
        "user_id": current_user.user_id,
        "email": current_user.email,
        "name": current_user.name,
        "team_id": current_user.team_id,
        "roles": current_user.roles,
        "primary_role": "captain" if current_user.is_captain else "player" if current_user.is_player else "",
    })
    return current_user


def require_captain(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_captain:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Captain-Rolle erforderlich.")
    return user


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin-Rolle erforderlich.")
    return user
