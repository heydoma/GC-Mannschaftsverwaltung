# backend/app/routes Players

## GET /api/players
- Liefert Spieler des eigenen Teams.

## POST /api/players (captain)
- Legt Spieler an und erzeugt temporaeres Passwort.

## DELETE /api/players/{id} (captain)
- Loescht Spieler und zugehoerige Runden.

## Mandanten-Check
- `team_id` Filter in allen Queries.
