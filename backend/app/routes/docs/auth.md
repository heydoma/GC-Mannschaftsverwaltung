# Auth-Endpoints (`/api/auth`)

## POST /api/auth/register-team
**Rolle:** admin | **Tenant-Middleware:** ausgenommen

Legt ein neues Team mit erstem Captain an. Transaktionaler Flow mit Rollback:

```
1. INSERT public.teams (name) → team_id
2. ensure_tenant_schema(team_id) → Schema tenant_{id} + RLS
3. Keycloak: Captain-User anlegen (team_id-Attribut, captain-Rolle, permanentes Passwort)
4. INSERT tenant_{id}.players (Captain-Eintrag)
```

Bei Fehler in Schritt 3 oder 4:
- Keycloak-User wird gelöscht
- Team-Zeile wird gelöscht
- Schema bleibt (idempotentes Re-Anlegen beim nächsten Versuch)

**Request-Body:**
```json
{ "team_name": "...", "captain_name": "...", "captain_email": "...", "password": "..." }
```

**Response (201):**
```json
{ "team_id": 3, "player_id": 1, "keycloak_user_id": "uuid", "message": "..." }
```

---

## GET /api/auth/me
**Rolle:** eingeloggt | **Tenant-Middleware:** aktiv

Liefert Profil des eingeloggten Users plus verknüpften Player-Eintrag:
```json
{
  "user_id": "uuid", "email": "...", "name": "...",
  "team_id": 3, "team_name": "...",
  "roles": ["captain"], "is_captain": true,
  "player": { "id": 1, "name": "..." }
}
```
`player` ist `null` wenn kein DB-Eintrag verknüpft ist.

---

## GET /api/auth/teams
**Rolle:** admin | **Tenant-Middleware:** ausgenommen

Listet alle Teams aus `public.teams` (kein Tenant-Filter, systemweit).
```json
[{ "id": 3, "name": "GC Beispiel", "created_at": "..." }]
```

---

## Validierungen

| Feld | Regel |
|---|---|
| `team_name` | 2–100 Zeichen |
| `captain_name` | 2–100 Zeichen |
| `captain_email` | gültiges E-Mail-Format |
| `password` | 8–100 Zeichen |
