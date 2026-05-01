# backend/app/routes Guards

## Guards
- `require_captain`: nur fuer Captains.
- `require_admin`: nur fuer System-Admin.

## Nutzung
- Guard als Dependency in Endpoint-Signatur.
- Danach ist `CurrentUser` sicher.
