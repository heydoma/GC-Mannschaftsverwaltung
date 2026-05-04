# Auth – Token-Flow

## Vollständiger Ablauf pro Request

```
Frontend
  └─ Authorization: Bearer <access_token>
        │
        ▼
tenant_auth_middleware (main.py)
  1. Tenant auflösen (Host oder team_id-Claim)
  2. Token dekodieren mit realm des Tenants:
       decode_access_token(token, realm=tenant.realm)
  3. team_id im Token == team_id des Tenants? → sonst 401
  4. AuthContext als ContextVar setzen:
       { user_id, email, name, team_id, roles, primary_role }
        │
        ▼
Endpoint-Handler
  └─ get_current_user(request, creds)
       → liest AuthContext aus ContextVar (kein zweites Token-Decode)
       → gibt CurrentUser zurück
        │
        ▼
Role-Guard (optional)
  └─ require_captain(user) / require_admin(user)
```

## JWT-Validierung (`auth/keycloak.py`)

- JWKS wird von `{KEYCLOAK_URL}/realms/{realm}/protocol/openid-connect/certs` geladen
- Cache pro Realm-URL, TTL 3600 Sekunden
- Bei unbekanntem `kid` (Key-Rotation): Cache wird geleert und Key neu geholt
- Algorithmus: `RS256`, Audience-Prüfung deaktiviert (`verify_aud=False`)

**Realm-per-Tenant**: Der Realm wird aus `public.tenants.realm` gelesen.
Jeder Mandant kann einen eigenen Keycloak-Realm haben.
Fallback: `KEYCLOAK_REALM`-Umgebungsvariable (`golf-team-manager`).

## Token-Claims

| Claim | Bedeutung |
|---|---|
| `sub` | Keycloak-User-ID (UUID als String) |
| `email` | E-Mail-Adresse |
| `name` / `preferred_username` | Anzeigename |
| `realm_access.roles` | Liste der Realm-Rollen (`admin`, `captain`, `player`) |
| `team_id` | Custom-Attribut, gesetzt beim User-Anlegen |

## primary_role

Die Middleware leitet aus `realm_access.roles` eine `primary_role` ab:
- `captain` hat Vorrang vor `player`
- Wird als `app.user_role` in die PostgreSQL-Session-Config geschrieben (für RLS)

## Fehlerbilder

| Fehler | HTTP-Code |
|---|---|
| Abgelaufenes / ungültiges Token | 401 |
| Falscher Issuer (Realm-Mismatch) | 401 |
| `team_id` im Token ≠ aufgelöster Mandant | 401 |
| Fehlende Rolle (captain / admin) | 403 |
| JWKS nicht erreichbar | 401 |
