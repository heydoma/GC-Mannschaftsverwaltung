# Backend Multitenancy

## Ziel
Saubere Trennung von Daten pro Team ueber `team_id`.

## Umsetzung
- `team_id` als Keycloak Claim.
- `CurrentUser.team_id` wird in Queries genutzt.
- Alle Endpoints filtern `team_id`.

## Vorteile
- Einfacher Betrieb in einem Realm.
- Klar nachvollziehbare Mandanten-Trennung.
