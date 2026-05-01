# Frontend Overview

## Zweck
React UI mit Routing, Keycloak-Login und Admin-Workflows.

## Laufzeit
- Vite Dev Server.
- Einstieg ueber `src/main.tsx`.

## Routing
- `/login`: Login.
- `/dashboard`: Leaderboard.
- `/score`: Score Entry.
- `/admin`: Captain only.
- `/system`: Admin only.

## Auth und Rollen
- Keycloak init in `src/lib/auth.tsx`.
- Rollen steuern Sichtbarkeit und Route-Guards.

## API
- Requests laufen ueber `src/lib/api.ts` mit Bearer Token.

## Konfiguration
- `.env`: `VITE_API_URL`, `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`.
