# backend/app/auth Overview

## Zweck
Keycloak-Integration fuer Authentifizierung und Rollen-Checks.

## Token-Validierung
1) Bearer Token wird gelesen.
2) JWKS-Key wird aus Keycloak geladen (Cache).
3) JWT wird verifiziert (Issuer, Signatur).
4) `CurrentUser` wird aufgebaut.

## Rollen und Claims
- Rollen: `admin`, `captain`, `player`.
- `team_id` kommt als Claim aus dem Token.
- Guards: `require_captain`, `require_admin`.

## Keycloak Admin API
- `admin.py` verwendet Service-Account des Backend-Clients.
- Erstellt User, setzt `team_id` und Rollen.

## Fehlerfaelle
- Ungueltige Tokens -> 401.
- Fehlende Rollen -> 403.
- Keycloak Admin API Fehler -> 502.
