# frontend/src Multitenancy

## Prinzip
- Frontend sendet nur Bearer Token.
- Backend filtert nach `team_id` im Token.

## UI
- Users sehen nur Daten ihres Teams.
- System-Admin kann Teams anlegen.
