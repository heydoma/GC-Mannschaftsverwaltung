# backend/app Architecture

## Komponenten
- Auth: Token-Validierung und Role-Guards.
- Routes: REST Endpoints und DB Queries.
- Engine: Berechnungslogik.
- DB: Connection Helper.

## Ablauf pro Request
1) Incoming Request trifft Route.
2) Auth-Dependency validiert JWT.
3) Role-Guard prueft Berechtigung.
4) SQL-Query filtert `team_id`.
5) Response wird serialisiert.

## Fehlerstrategie
- 401: Invalid Token.
- 403: Fehlende Rolle.
- 404: Resource nicht gefunden.
- 409: Duplicate/Constraint.
- 502: Keycloak Admin Fehler.
