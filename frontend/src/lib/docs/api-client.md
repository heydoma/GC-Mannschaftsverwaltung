# frontend/src/lib API Client

## Request Flow
- Token Refresh vor jedem Request.
- `Authorization: Bearer` Header.
- JSON-Fehler werden als Error geworfen.

## Endpoints
- `/players`, `/rounds`, `/leaderboard`, `/auth/*`.

## Fehlerbehandlung
- Nicht-OK Responses -> Error mit `detail`.
