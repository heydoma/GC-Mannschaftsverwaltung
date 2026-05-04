"""Keycloak Admin REST API Client – User-Anlage, Rollen, Attribute."""
import os
import time
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

from app.context import get_tenant_context

load_dotenv()

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8180")
REALM = os.getenv("KEYCLOAK_REALM", "golf-team-manager")
CLIENT_ID = os.getenv("KEYCLOAK_BACKEND_CLIENT_ID", "golf-backend")
CLIENT_SECRET = os.getenv("KEYCLOAK_BACKEND_CLIENT_SECRET", "")

_token_cache: dict[str, dict] = {}


class KeycloakError(HTTPException):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(status_code, f"Keycloak: {message}")


def _realm_for_admin() -> str:
    tenant = get_tenant_context()
    return tenant.realm if tenant and tenant.realm else REALM


def _admin_base(realm: Optional[str] = None) -> str:
    active_realm = realm or _realm_for_admin()
    return f"{KEYCLOAK_URL}/admin/realms/{active_realm}"


def _token_url(realm: Optional[str] = None) -> str:
    active_realm = realm or _realm_for_admin()
    return f"{KEYCLOAK_URL}/realms/{active_realm}/protocol/openid-connect/token"


def _get_admin_token(realm: Optional[str] = None) -> str:
    active_realm = realm or _realm_for_admin()
    now = time.time()
    cache = _token_cache.get(active_realm)
    if cache and cache.get("token") and cache.get("expires_at", 0.0) > now + 30:
        return cache["token"]

    resp = httpx.post(
        _token_url(active_realm),
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
    _token_cache[active_realm] = {
        "token": data["access_token"],
        "expires_at": now + int(data.get("expires_in", 60)),
    }
    return _token_cache[active_realm]["token"]


def _headers(realm: Optional[str] = None) -> dict:
    active_realm = realm or _realm_for_admin()
    return {"Authorization": f"Bearer {_get_admin_token(active_realm)}", "Content-Type": "application/json"}


def _get_realm_role(role_name: str, realm: Optional[str] = None) -> dict:
    admin_base = _admin_base(realm)
    resp = httpx.get(f"{admin_base}/roles/{role_name}", headers=_headers(realm), timeout=5.0)
    if resp.status_code != 200:
        raise KeycloakError(f"Rolle '{role_name}' nicht gefunden")
    return resp.json()


def get_user_by_email(email: str) -> Optional[dict]:
    """Sucht einen existierenden Keycloak-User per E-Mail. Gibt User-Dict oder None zurück."""
    realm = _realm_for_admin()
    resp = httpx.get(
        f"{_admin_base(realm)}/users",
        headers=_headers(realm),
        params={"email": email.lower(), "exact": "true"},
        timeout=5.0,
    )
    if resp.status_code != 200:
        raise KeycloakError(f"User-Suche fehlgeschlagen: {resp.text}")
    users = resp.json()
    return users[0] if users else None


def create_user(
    *, email: str, name: str, password: str, team_id: int, role: str,
) -> str:
    """Legt User in Keycloak an, setzt team_id-Attribut + Realm-Rolle. Liefert die Keycloak-User-ID."""
    from app.db import get_db  # lokaler Import verhindert zirkuläre Abhängigkeit
    realm = _realm_for_admin()
    admin_base = _admin_base(realm)
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
    resp = httpx.post(f"{admin_base}/users", headers=_headers(realm), json=payload, timeout=10.0)
    if resp.status_code == 409:
        raise HTTPException(409, f"E-Mail '{email}' existiert bereits in Keycloak.")
    if resp.status_code != 201:
        raise KeycloakError(f"User-Anlage fehlgeschlagen ({resp.status_code}): {resp.text}")

    location = resp.headers.get("Location", "")
    user_id = location.rstrip("/").rsplit("/", 1)[-1]

    # 2) Rolle zuweisen
    role_info = _get_realm_role(role, realm)
    role_resp = httpx.post(
        f"{admin_base}/users/{user_id}/role-mappings/realm",
        headers=_headers(realm),
        json=[{"id": role_info["id"], "name": role_info["name"]}],
        timeout=5.0,
    )
    if role_resp.status_code not in (204, 200):
        delete_user(user_id)
        raise KeycloakError(f"Rollen-Zuweisung fehlgeschlagen: {role_resp.text}")

    # 3) Team-Mitgliedschaft in DB speichern
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO public.team_memberships (keycloak_user_id, team_id, role) "
                    "VALUES (%s, %s, %s) ON CONFLICT (keycloak_user_id, team_id) DO UPDATE SET role = EXCLUDED.role",
                    (user_id, team_id, role),
                )
    except Exception:
        pass  # DB-Fehler hier nicht kritisch – Fallback auf JWT-Rollen greift

    return user_id


def add_to_team(keycloak_user_id: str, team_id: int, role: str) -> None:
    """Fügt einen existierenden Keycloak-User einem weiteren Team hinzu (DB-Mitgliedschaft + Rolle)."""
    from app.db import get_db
    # Rolle in Keycloak aktualisieren wenn nötig (Realm-Rolle auf höchste setzen)
    realm = _realm_for_admin()
    current_roles = get_user_realm_roles(keycloak_user_id)
    if role == "captain" and "captain" not in current_roles:
        role_info = _get_realm_role("captain", realm)
        httpx.post(
            f"{_admin_base(realm)}/users/{keycloak_user_id}/role-mappings/realm",
            headers=_headers(realm),
            json=[{"id": role_info["id"], "name": role_info["name"]}],
            timeout=5.0,
        )
    # Mitgliedschaft in DB
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public.team_memberships (keycloak_user_id, team_id, role) "
                "VALUES (%s, %s, %s) ON CONFLICT (keycloak_user_id, team_id) DO UPDATE SET role = EXCLUDED.role",
                (keycloak_user_id, team_id, role),
            )


def delete_user(user_id: str) -> None:
    realm = _realm_for_admin()
    httpx.delete(f"{_admin_base(realm)}/users/{user_id}", headers=_headers(realm), timeout=5.0)


def set_team_id(user_id: str, team_id: int) -> None:
    """Aktualisiert das team_id-Attribut eines Users."""
    realm = _realm_for_admin()
    resp = httpx.put(
        f"{_admin_base(realm)}/users/{user_id}",
        headers=_headers(realm),
        json={"attributes": {"team_id": [str(team_id)]}},
        timeout=5.0,
    )
    if resp.status_code != 204:
        raise KeycloakError(f"Attribut-Update fehlgeschlagen: {resp.text}")


def get_user_realm_roles(user_id: str) -> List[str]:
    realm = _realm_for_admin()
    resp = httpx.get(
        f"{_admin_base(realm)}/users/{user_id}/role-mappings/realm",
        headers=_headers(realm),
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

    realm = _realm_for_admin()
    admin_base = _admin_base(realm)
    current = get_user_realm_roles(user_id)
    to_remove = [r for r in ("player", "captain") if r in current]
    if to_remove:
        roles = [_get_realm_role(r, realm) for r in to_remove]
        resp = httpx.request(
            "DELETE",
            f"{admin_base}/users/{user_id}/role-mappings/realm",
            headers=_headers(realm),
            json=[{"id": r["id"], "name": r["name"]} for r in roles],
            timeout=5.0,
        )
        if resp.status_code not in (204, 200):
            raise KeycloakError(f"Rollen-Entfernen fehlgeschlagen: {resp.text}")

    role_info = _get_realm_role(role, realm)
    add_resp = httpx.post(
        f"{admin_base}/users/{user_id}/role-mappings/realm",
        headers=_headers(realm),
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
        realm = _realm_for_admin()
        admin_base = _admin_base(realm)
        resp = httpx.get(f"{admin_base}/users/profile", headers=_headers(realm), timeout=5.0)
        if resp.status_code != 200:
            raise KeycloakError(f"User-Profile nicht lesbar ({resp.status_code}): {resp.text}")
        profile = resp.json()
        if profile.get("unmanagedAttributePolicy") == "ENABLED":
            _setup_done = True
            return
        profile["unmanagedAttributePolicy"] = "ENABLED"
        put = httpx.put(
            f"{admin_base}/users/profile",
            headers=_headers(realm),
            json=profile,
            timeout=5.0,
        )
        if put.status_code not in (200, 204):
            raise KeycloakError(f"User-Profile-Update fehlgeschlagen: {put.text}")
        _setup_done = True
    except httpx.HTTPError as e:
        raise KeycloakError(f"Setup nicht erreichbar: {e}")
