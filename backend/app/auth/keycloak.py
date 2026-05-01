"""Keycloak JWT-Validierung und FastAPI-Auth-Dependencies."""
import os
import time
from dataclasses import dataclass
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError

load_dotenv()

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8180")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "golf-team-manager")
ISSUER = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"
JWKS_URL = f"{ISSUER}/protocol/openid-connect/certs"

bearer_scheme = HTTPBearer(auto_error=True)

# JWKS Cache (1h TTL)
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL = 3600.0


def _fetch_jwks() -> dict:
    now = time.time()
    if _jwks_cache["keys"] is None or (now - _jwks_cache["fetched_at"]) > _JWKS_TTL:
        resp = httpx.get(JWKS_URL, timeout=5.0)
        resp.raise_for_status()
        _jwks_cache["keys"] = resp.json()
        _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys"]


def _get_signing_key(token: str) -> dict:
    headers = jwt.get_unverified_header(token)
    kid = headers.get("kid")
    jwks = _fetch_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    # Cache leeren falls Key rotiert wurde
    _jwks_cache["keys"] = None
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Signing key not found")


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


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    """Validiert das Bearer-Token gegen Keycloak und liefert den User-Kontext."""
    token = creds.credentials
    try:
        key = _get_signing_key(token)
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=ISSUER,
            options={"verify_aud": False},
        )
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")

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


def require_captain(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_captain:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Captain-Rolle erforderlich.")
    return user


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin-Rolle erforderlich.")
    return user
