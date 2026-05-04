# Multi-Tenancy

## Überblick

Das System verwendet **Schema-per-Tenant-Isolation** in PostgreSQL.
Jedes Team bekommt ein dediziertes Schema `tenant_{team_id}` mit eigenen
`players`- und `rounds`-Tabellen. Kein Team kann auf Daten eines anderen Teams zugreifen.

## Wie ein Request zum richtigen Schema kommt

```
Request eingehend
      │
      ▼
tenant_auth_middleware (main.py)
  1. Host-Header → resolve_tenant_by_host()
  2. Fallback: team_id-Claim im JWT → resolve_tenant_by_team_id()
  3. Kein Treffer → 404
      │
      ▼
TenantContext wird als ContextVar gesetzt
  (team_id, schema_name, realm, host, tenant_slug)
      │
      ▼
get_db() in jedem Endpoint-Handler
  SET LOCAL search_path TO tenant_{id}, public
  SELECT set_config('app.tenant_id', ...)
  SELECT set_config('app.user_role', ...)
  SELECT set_config('app.current_user_id', ...)
      │
      ▼
Alle Queries ohne Schema-Prefix → landen automatisch in tenant_{id}
PostgreSQL RLS-Policies greifen zusätzlich als zweite Schutzschicht
```

## ContextVars (context.py)

`TenantContext` und `AuthContext` werden als `ContextVar` gespeichert –
das ist asyncio-sicher (kein Überlaufen zwischen parallelen Requests).

```python
# Wird von der Middleware gesetzt:
TenantContext(team_id=3, schema_name="tenant_3", realm="golf-team-manager", ...)

# Wird von get_db() gelesen und in PostgreSQL-Session-Config übertragen
```

Nach dem Response werden beide Vars per `ContextVar.reset(token)` zurückgesetzt.

## Tenant-Schema-Initialisierung (tenancy.py)

`ensure_tenant_schema(team_id, team_name, host, realm)`:
- Legt `tenant_{id}`-Schema an (idempotent)
- Erstellt `players`- und `rounds`-Tabellen mit Indizes
- Migriert einmalig Daten aus `public.players` / `public.rounds` (falls vorhanden)
- Aktiviert RLS mit `ENABLE` und `FORCE ROW LEVEL SECURITY`
- Erstellt oder ersetzt alle RLS-Policies

Wird beim Start via `bootstrap_tenant_schemas()` für alle Teams aufgerufen.

## Row Level Security (RLS)

Auch wenn `search_path` korrekt gesetzt ist, prüfen RLS-Policies
die PostgreSQL-Session-Config als zweite Verteidigungslinie:

```sql
-- players: nur lesen wenn team_id passt
USING (team_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)

-- players: schreiben nur als captain
USING (team_id = app.tenant_id AND current_setting('app.user_role') = 'captain')

-- rounds: eintragen als captain oder eigener Spieler
WITH CHECK (
    EXISTS (SELECT 1 FROM {schema}.players p
            WHERE p.id = rounds.player_id
              AND p.team_id = app.tenant_id
              AND (app.user_role = 'captain'
                   OR p.keycloak_user_id::text = app.current_user_id))
)
```

## Middleware-Ausnahmen

Folgende Pfade benötigen **keine** Tenant-Auflösung:

| Pfad | Grund |
|---|---|
| `GET /api/health` | Health-Check, kein Datenzugriff |
| `POST /api/auth/register-team` | Legt erst das Team an – kein Tenant existiert noch |
| `GET /api/auth/teams` | Admin-Endpoint für alle Teams, tenant-unabhängig |

## Neues Team anlegen

```
POST /api/auth/register-team
  1. INSERT INTO public.teams → team_id
  2. ensure_tenant_schema(team_id) → Schema + RLS + Slug
  3. Keycloak: Captain-User anlegen (team_id-Attribut + captain-Rolle)
  4. INSERT INTO tenant_{id}.players (Captain-Spielereintrag)
```

Bei Fehler in Schritt 3 oder 4: Rollback (Team-DELETE + Keycloak-DELETE).
