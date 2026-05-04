# backend/app – Architektur

## Komponenten

```
HTTP Request
     │
     ▼
tenant_auth_middleware          (main.py)
  ├─ Tenant-Auflösung           (tenancy.py)
  ├─ TenantContext setzen       (context.py)
  └─ AuthContext setzen         (context.py)
     │
     ▼
FastAPI Router / Endpoint       (routes/)
  ├─ get_db()                   (db.py)
  │    ├─ search_path → tenant_{id}, public
  │    └─ app.tenant_id / app.user_role (PostgreSQL session config)
  ├─ get_current_user           (auth/keycloak.py)
  └─ require_captain / require_admin
     │
     ▼
PostgreSQL (Schema-Isolation + RLS)
```

## Multi-Tenancy: Schema-per-Tenant

Jedes Team bekommt ein eigenes PostgreSQL-Schema `tenant_{team_id}`.
Darin liegen `players`, `rounds` und `matchdays` – vollständig isoliert von anderen Teams.

**Tenant-Auflösung** (Reihenfolge):
1. **Host-Header** (`x-forwarded-host` › `host` › URL-Hostname) → Lookup in `public.tenants.host`
2. **`X-Active-Team` Header** (Integer Team-ID) → direkte Auflösung; ermöglicht Multi-Team-User
3. **team_id-Claim im JWT** (Fallback, wenn `ALLOW_TEAM_ID_FALLBACK=true`) → Lookup in `public.tenants.team_id`
4. Kein Treffer → `404 Mandant nicht gefunden`

**Per-Team Rollenzuweisung:**
Nach Tenant-Auflösung wird die effektive Rolle des Users aus `public.team_memberships` gelesen (statt global aus dem JWT).
Das erlaubt einem Account, in Team A Captain und in Team B Spieler zu sein.
Admins sind davon ausgenommen – ihre JWT-Rollen gelten global.

**Tenant-Registry** (`public.tenants`):

| Spalte | Bedeutung |
|---|---|
| `team_id` | FK auf `public.teams.id` |
| `schema_name` | PostgreSQL-Schema, z.B. `tenant_3` |
| `tenant_slug` | Kurzkennung, z.B. `tnnt_abc12345` |
| `host` | Hostname für Host-basierte Auflösung |
| `realm` | Keycloak-Realm (Standard: `golf-team-manager`) |

## Datenbankzugriff: `get_db()`

```python
with get_db() as conn:
    # search_path ist automatisch auf tenant_{id} gesetzt
    # app.tenant_id, app.user_role, app.current_user_id sind als
    # PostgreSQL session config gesetzt (für RLS-Policies)
    cur.execute("SELECT * FROM players")  # → tenant_{id}.players
```

`get_db()` liest `TenantContext` und `AuthContext` aus den `ContextVar`s
und setzt alles lokal für die aktuelle Transaktion (`SET LOCAL`).

## Row Level Security (RLS)

Jede Tenant-Tabelle ist mit RLS geschützt:

| Policy | Bedingung |
|---|---|
| `tenant_players_select` | `team_id = app.tenant_id` |
| `tenant_players_write` | `team_id = app.tenant_id AND app.user_role = 'captain'` |
| `tenant_rounds_select` | Spieler-FK muss zu `app.tenant_id` gehören |
| `tenant_rounds_insert` | Captain oder eigener Spieler-Eintrag |
| `tenant_rounds_write` | Captain-only für UPDATE/DELETE |

RLS ist zweite Verteidigungslinie – die Applikationsschicht prüft `team_id` bereits in den Queries.

## Öffentliche Tabellen (`public`-Schema)

| Tabelle | Inhalt |
|---|---|
| `public.teams` | Alle Teams (Name, ID) |
| `public.tenants` | Tenant-Registry (Schema, Host, Realm) |
| `public.courses` | Golfplätze (teamübergreifend) |
| `public.team_memberships` | n:m User↔Team mit per-Team Rolle (`captain`/`player`) |
| `public.players` | Veraltet (Migrationsbasis, leer lassen nach Migration) |
| `public.rounds` | Veraltet (Migrationsbasis) |

## Multi-Team: `public.team_memberships`

```sql
CREATE TABLE public.team_memberships (
    keycloak_user_id  UUID NOT NULL,
    team_id           INTEGER NOT NULL REFERENCES teams(id),
    role              TEXT NOT NULL CHECK (role IN ('captain', 'player')),
    PRIMARY KEY (keycloak_user_id, team_id)
);
```

Ein Keycloak-Account kann mehreren Teams mit unterschiedlichen Rollen angehören.
- `create_user()` in `admin.py` schreibt automatisch in diese Tabelle
- `add_to_team()` fügt einen existierenden Account einem weiteren Team hinzu
- Die Middleware liest die Zeile passend zum aufgelösten Tenant und überschreibt die JWT-Rollen

## Spieltage (`matchdays`)

Pro Tenant-Schema existiert die Tabelle `matchdays`:

| Spalte | Typ | Bedeutung |
|---|---|---|
| `id` | SERIAL | PK |
| `label` | TEXT | Anzeigename (z.B. „Spieltag 1") |
| `match_date` | DATE | Datum des Spieltags |
| `starters` | INTEGER[] | Player-IDs der Startaufstellung |
| `reserves` | INTEGER[] | Player-IDs der Ersatzspieler |
| `published` | BOOLEAN | false = nur Captain sichtbar, true = alle Spieler |

Captains können Spieltage anlegen, per Drag & Drop bearbeiten und veröffentlichen.
Spieler sehen nur veröffentlichte Spieltage im Read-only-Modus.

## Fehlerstrategie

| Code | Bedeutung |
|---|---|
| 401 | Ungültiges / abgelaufenes Token oder Token passt nicht zum Mandanten |
| 403 | Fehlende Rolle (captain / admin) |
| 404 | Mandant nicht gefunden oder Ressource nicht vorhanden |
| 409 | Duplikat / Constraint-Verletzung |
| 502 | Keycloak Admin API nicht erreichbar |
