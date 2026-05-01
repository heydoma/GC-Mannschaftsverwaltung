"""Keycloak Admin REST API Client – User-Anlage, Rollen, Attribute."""
import os
import time
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8180")
REALM = os.getenv("KEYCLOAK_REALM", "golf-team-manager")
CLIENT_ID = os.getenv("KEYCLOAK_BACKEND_CLIENT_ID", "golf-backend")
CLIENT_SECRET = os.getenv("KEYCLOAK_BACKEND_CLIENT_SECRET", "")

ADMIN_BASE = f"{KEYCLOAK_URL}/admin/realms/{REALM}"
TOKEN_URL = f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token"

_token_cache: dict = {"token": None, "expires_at": 0.0}


class KeycloakError(HTTPException):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(status_code, f"Keycloak: {message}")


def _get_admin_token() -> str:
    now = time.time()
    if _token_cache["token"] and _token_cache["expires_at"] > now + 30:
        return _token_cache["token"]

    resp = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        timeout=5.0,
    )
    if resp.status_code != 200:
        raise KeycloakError(f"Service-Account Login fehlgeschlagen: {resp.text}")
    data = resp.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + int(data.get("expires_in", 60))
    return _token_cache["token"]


def _headers() -> dict:
    return {"Authorization": f"Bearer {_get_admin_token()}", "Content-Type": "application/json"}


def _get_realm_role(role_name: str) -> dict:
    resp = httpx.get(f"{ADMIN_BASE}/roles/{role_name}", headers=_headers(), timeout=5.0)
    if resp.status_code != 200:
        raise KeycloakError(f"Rolle '{role_name}' nicht gefunden")
    return resp.json()


def create_user(
    *, email: str, name: str, password: str, team_id: int, role: str,
) -> str:
    """Legt User in Keycloak an, setzt team_id-Attribut + Realm-Rolle. Liefert die Keycloak-User-ID."""
    ensure_user_profile_unmanaged()
    # 1) User anlegen
    parts = name.strip().split(" ", 1)
    first = parts[0]
    last = parts[1] if len(parts) > 1 else ""
    payload = {
        "username": email.lower(),
        "email": email.lower(),
        "firstName": first,
        "lastName": last,
        "emailVerified": True,
        "enabled": True,
        "attributes": {"team_id": [str(team_id)]},
        "credentials": [
            {"type": "password", "value": password, "temporary": role == "player"}
        ],
    }
    resp = httpx.post(f"{ADMIN_BASE}/users", headers=_headers(), json=payload, timeout=10.0)
    if resp.status_code == 409:
        raise HTTPException(409, f"E-Mail '{email}' existiert bereits in Keycloak.")
    if resp.status_code != 201:
        raise KeycloakError(f"User-Anlage fehlgeschlagen ({resp.status_code}): {resp.text}")

    location = resp.headers.get("Location", "")
    user_id = location.rstrip("/").rsplit("/", 1)[-1]

    # 2) Rolle zuweisen
    role_info = _get_realm_role(role)
    role_resp = httpx.post(
        f"{ADMIN_BASE}/users/{user_id}/role-mappings/realm",
        headers=_headers(),
        json=[{"id": role_info["id"], "name": role_info["name"]}],
        timeout=5.0,
    )
    if role_resp.status_code not in (204, 200):
        # Cleanup: User wieder löschen, sonst hängt er ohne Rolle
        delete_user(user_id)
        raise KeycloakError(f"Rollen-Zuweisung fehlgeschlagen: {role_resp.text}")

    return user_id


def delete_user(user_id: str) -> None:
    httpx.delete(f"{ADMIN_BASE}/users/{user_id}", headers=_headers(), timeout=5.0)


def set_team_id(user_id: str, team_id: int) -> None:
    """Aktualisiert das team_id-Attribut eines Users."""
    resp = httpx.put(
        f"{ADMIN_BASE}/users/{user_id}",
        headers=_headers(),
        json={"attributes": {"team_id": [str(team_id)]}},
        timeout=5.0,
    )
    if resp.status_code != 204:
        raise KeycloakError(f"Attribut-Update fehlgeschlagen: {resp.text}")


def get_user_realm_roles(user_id: str) -> List[str]:
    resp = httpx.get(
        f"{ADMIN_BASE}/users/{user_id}/role-mappings/realm",
        headers=_headers(),
        timeout=5.0,
    )
    if resp.status_code != 200:
        raise KeycloakError(f"Rollen-Lesen fehlgeschlagen: {resp.text}")
    roles = resp.json() or []
    return [r.get("name") for r in roles if r.get("name")]


def set_user_realm_role(user_id: str, role: str) -> None:
    """Setzt die Realm-Rolle auf genau eine der erlaubten Rollen."""
    if role not in ("player", "captain"):
        raise KeycloakError("Ungueltige Rolle", status_code=400)

    current = get_user_realm_roles(user_id)
    to_remove = [r for r in ("player", "captain") if r in current]
    if to_remove:
        roles = [_get_realm_role(r) for r in to_remove]
        resp = httpx.request(
            "DELETE",
            f"{ADMIN_BASE}/users/{user_id}/role-mappings/realm",
            headers=_headers(),
            json=[{"id": r["id"], "name": r["name"]} for r in roles],
            timeout=5.0,
        )
        if resp.status_code not in (204, 200):
            raise KeycloakError(f"Rollen-Entfernen fehlgeschlagen: {resp.text}")

    role_info = _get_realm_role(role)
    add_resp = httpx.post(
        f"{ADMIN_BASE}/users/{user_id}/role-mappings/realm",
        headers=_headers(),
        json=[{"id": role_info["id"], "name": role_info["name"]}],
        timeout=5.0,
    )
    if add_resp.status_code not in (204, 200):
        raise KeycloakError(f"Rollen-Zuweisung fehlgeschlagen: {add_resp.text}")


_setup_done = False


def ensure_user_profile_unmanaged() -> None:
    """Stellt sicher, dass der Realm Custom-Attribute (z.B. team_id) erlaubt.

    Keycloak 25 blockt unbekannte User-Attribute per Default. Wir setzen
    'unmanagedAttributePolicy=ENABLED' am User-Profil. Idempotent.
    """
    global _setup_done
    if _setup_done:
        return
    try:
        resp = httpx.get(f"{ADMIN_BASE}/users/profile", headers=_headers(), timeout=5.0)
        if resp.status_code != 200:
            raise KeycloakError(f"User-Profile nicht lesbar ({resp.status_code}): {resp.text}")
        profile = resp.json()
        if profile.get("unmanagedAttributePolicy") == "ENABLED":
            _setup_done = True
            return
        profile["unmanagedAttributePolicy"] = "ENABLED"
        put = httpx.put(
            f"{ADMIN_BASE}/users/profile",
            headers=_headers(),
            json=profile,
            timeout=5.0,
        )
        if put.status_code not in (200, 204):
            raise KeycloakError(f"User-Profile-Update fehlgeschlagen: {put.text}")
        _setup_done = True
    except httpx.HTTPError as e:
        raise KeycloakError(f"Setup nicht erreichbar: {e}")
