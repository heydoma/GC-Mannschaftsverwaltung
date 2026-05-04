# auth – Übersicht

## Dateien

| Datei | Aufgabe |
|---|---|
| `keycloak.py` | JWT-Validierung via JWKS, `get_current_user`, Role-Guards |
| `admin.py` | Keycloak Admin REST API: User anlegen, löschen, Rollen setzen |

## Token-Validierung (`keycloak.py`)

`get_current_user` wird als FastAPI-Dependency in Endpoints verwendet:
1. Prüft ob `AuthContext` schon von der Middleware gesetzt wurde → direkter Return (kein zweites Decode)
2. Sonst: Bearer Token lesen → `decode_access_token(token, realm)` → `CurrentUser` bauen

`decode_access_token`:
- Liest `kid` aus dem Token-Header
- Sucht Signing-Key im JWKS-Cache (TTL 3600 s, pro Realm-URL)
- Validiert Signatur + Issuer mit `python-jose`
- Realm kommt aus dem `TenantContext` (Fallback: `KEYCLOAK_REALM`-Env)

## CurrentUser

```python
@dataclass
class CurrentUser:
    user_id: str       # Keycloak sub (UUID)
    email: str | None
    name: str | None
    team_id: int | None
    roles: list[str]   # aus realm_access.roles

    is_captain: bool   # "captain" in roles
    is_player: bool    # "player" in roles
    is_admin: bool     # "admin" in roles
```

## Role-Guards

```python
require_captain(user)   # 403 wenn nicht captain
require_admin(user)     # 403 wenn nicht admin
```

Guards geben `CurrentUser` zurück – direkt als Dependency nutzbar:
```python
@router.post("/")
def create_player(body: PlayerCreate, captain: CurrentUser = Depends(require_captain)):
    ...
```

## Rollen

| Rolle | Befugnisse |
|---|---|
| `admin` | Teams anlegen, alle Teams einsehen (`/api/auth/teams`) |
| `captain` | Spieler anlegen/löschen, Runden für alle im Team, Rollen ändern |
| `player` | Nur eigene Runden eintragen |

Ein User kann mehrere Rollen haben. `primary_role` (captain › player) wird
für RLS-Policies verwendet.
