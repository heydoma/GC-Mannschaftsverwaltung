# frontend/src/lib Overview

## Zweck
Auth, API-Client und Shared Types.

## Auth
- `auth.tsx` initialisiert Keycloak.
- Token Refresh bei Ablauf.
- `AuthUser` enthaelt Rollen und `teamId`.

## API
- `api.ts` sendet Requests mit Bearer Token.
- Zentraler Error-Handler fuer JSON-Fehler.

## Weitere Dateien
- `keycloak.ts`: Client-Konfiguration.
- `types.ts`: DTOs und UI-Typen.
- `utils.ts`: Hilfsfunktionen.
