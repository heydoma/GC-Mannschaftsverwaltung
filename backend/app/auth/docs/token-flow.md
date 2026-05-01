# backend/app/auth Token Flow

## Ablauf
1) Frontend leitet User zu Keycloak.
2) Keycloak liefert Access Token.
3) Backend validiert Signatur per JWKS.
4) Claims werden in `CurrentUser` uebernommen.

## Claims
- `sub`: User-ID.
- `email`, `name`.
- `realm_access.roles`.
- `team_id`.

## Fehlerbilder
- Abgelaufenes Token -> 401.
- Falscher Issuer -> 401.
- Fehlende Rolle -> 403.
