# backend/app – Übersicht

## Zweck
Kernpaket der FastAPI-Anwendung: Multi-Tenant-Routing, Keycloak-Auth, DB-Zugriff per Schema-Isolation und Golf-Engine.

## Struktur

| Datei / Ordner | Aufgabe |
|---|---|
| `main.py` | App-Setup, CORS, Lifespan-Bootstrap, HTTP-Middleware |
| `context.py` | Request-scoped `ContextVar`s für Tenant und Auth |
| `tenancy.py` | Tenant-Auflösung, Schema-Initialisierung, RLS-Setup |
| `db.py` | Connection-Pool, `get_db()` Context-Manager mit `search_path` |
| `auth/` | JWT-Validierung (Keycloak JWKS), Role-Guards, Admin-API |
| `routes/` | REST-Endpoints (auth, players, rounds, leaderboard, courses) |
| `engine/` | Golf-Berechnungen (Differential, WHS-Index, Momentum) |

## Startup
Beim Start führt der `lifespan`-Handler `bootstrap_tenant_schemas()` aus:
für jedes Team in `public.teams` wird sichergestellt, dass das zugehörige
Tenant-Schema (`tenant_{id}`) mit Tabellen, Indizes und RLS-Policies existiert.

## Request-Lifecycle
1. HTTP-Middleware (`tenant_auth_middleware`) löst Mandant auf und setzt `TenantContext` + `AuthContext` als `ContextVar`.
2. `get_db()` liest diese Vars und setzt `SET LOCAL search_path TO tenant_{id}, public` sowie PostgreSQL-Session-Configs für RLS.
3. Der Endpoint-Handler läuft – alle Queries landen automatisch im richtigen Tenant-Schema.
4. Auth-Dependency (`get_current_user`) liest aus dem bereits befüllten `AuthContext`, kein zweites Token-Decode nötig.
5. Role-Guard (`require_captain` / `require_admin`) prüft Berechtigung.
6. Nach dem Response werden beide `ContextVar`s per Token-Reset geleert.

## Erweiterung
- **Neuer Endpoint**: Datei in `routes/`, Router in `main.py` einbinden.
- **Tenant-Queries**: `get_db()` verwenden – `search_path` ist automatisch gesetzt.
- **Neue Tabelle pro Tenant**: In `tenancy.py → ensure_tenant_schema` mit `sql.SQL` anlegen und RLS-Policy ergänzen.
- **Frontend**: API-Aufrufe in `frontend/src/lib/api.ts` ergänzen.
