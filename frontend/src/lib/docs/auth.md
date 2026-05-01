# frontend/src/lib Auth

## Init
- Keycloak wird einmal in `AuthProvider` initialisiert.
- `check-sso` versucht silent login.

## Token Refresh
- `onTokenExpired` triggert `updateToken`.

## User Context
- `AuthUser` enthaelt `roles`, `teamId`, `isCaptain`, `isAdmin`.
