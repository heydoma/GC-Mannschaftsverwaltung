# backend/app/routes Rounds

## GET /api/rounds
- Optional mit `player_id`.
- Filtert nach `team_id`.

## POST /api/rounds
- Player darf nur eigene Runden.
- Captain darf fuer Team.

## DELETE /api/rounds/{id} (captain)
- Loescht Runde im eigenen Team.
