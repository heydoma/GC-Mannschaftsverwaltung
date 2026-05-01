# backend/app/routes Multitenancy

## Prinzip
- Jeder Query filtert `team_id`.
- Keine Cross-Team Zugriffe.

## Beispiele
- Players: `WHERE team_id = %s`.
- Rounds: Join mit players + `team_id`.
