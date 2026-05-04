# Keycloak Admin API (`auth/admin.py`)

## Zweck
User-Anlage, Rollen-Verwaltung und Attribut-Pflege über die Keycloak Admin REST API.
Wird ausschließlich serverseitig verwendet – das Client Secret verlässt nie das Backend.

## Admin-Token (Service Account)

```
POST {KEYCLOAK_URL}/realms/{realm}/protocol/openid-connect/token
  grant_type=client_credentials
  client_id=golf-backend
  client_secret=...
```

Token wird pro Realm gecacht. Ablauf: `expires_in - 30 Sekunden` Puffer.
Der aktive Realm wird aus dem `TenantContext` gelesen (Fallback: `KEYCLOAK_REALM`-Env-Var).

## User anlegen (`create_user`)

1. `ensure_user_profile_unmanaged()` – setzt `unmanagedAttributePolicy=ENABLED` im Realm-Profil,
   damit das Custom-Attribut `team_id` gespeichert werden kann (Keycloak 25+, idempotent)
2. `POST /admin/realms/{realm}/users` mit:
   - `username` + `email` (lowercase)
   - `firstName`, `lastName` (aus `name` geparst)
   - `attributes.team_id` (als String-Array)
   - `credentials`: Passwort temporär für `player`, permanent für `captain`
3. Realm-Rolle zuweisen (`POST .../role-mappings/realm`)
4. Bei Fehler in Schritt 3: User sofort wieder löschen (kein Zombie-User ohne Rolle)

## Rollen verwalten (`set_user_realm_role`)

- Liest aktuelle Rollen des Users
- Entfernt alle `player`/`captain`-Rollen
- Weist die neue Zielrolle zu
- Atomar – kein Zwischenzustand mit zwei Rollen

## Weitere Funktionen

| Funktion | Beschreibung |
|---|---|
| `delete_user(user_id)` | Löscht User aus Keycloak (Rollback bei DB-Fehler) |
| `set_team_id(user_id, team_id)` | Aktualisiert `team_id`-Attribut |
| `get_user_realm_roles(user_id)` | Liefert aktuelle Realm-Rollen als String-Liste |

## Fehler

| Situation | Verhalten |
|---|---|
| E-Mail doppelt in Keycloak | `HTTP 409` |
| Keycloak nicht erreichbar | `HTTP 502 KeycloakError` |
| Rolle nicht gefunden | `HTTP 502 KeycloakError` |
| Rollen-Zuweisung fehlgeschlagen | User wird gelöscht, `HTTP 502` |
