# backend/app/routes Overview

## Zweck
REST Endpoints fuer Auth, Players, Rounds und Leaderboard.

## Endpoints
### Auth
- `POST /api/auth/register-team` (admin): legt Team + Captain an.
- `GET /api/auth/me`: Profil, Rollen, Team.
- `GET /api/auth/teams` (admin): Liste aller Teams.

### Players
- `GET /api/players`: Spieler des eigenen Teams.
- `POST /api/players` (captain): Spieler anlegen.
- `DELETE /api/players/{id}` (captain): Spieler loeschen.

### Rounds
- `GET /api/rounds`: Runden des eigenen Teams.
- `POST /api/rounds`: Runde anlegen (player/captain mit Checks).
- `DELETE /api/rounds/{id}` (captain): Runde loeschen.

### Leaderboard
- `GET /api/leaderboard`: Aggregation pro Team.

## Mandanten-Checks
- Alle Queries filtern auf `team_id`.
- Rollenchecks verhindern unberechtigte Aktionen.
