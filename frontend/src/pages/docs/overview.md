# frontend/src/pages Overview

## Seiten
- `LoginPage`: Login (oeffentlich).
- `DashboardPage`: Leaderboard (auth).
- `ScoreEntryPage`: Runde erfassen (auth).
- `AdminPage`: Captain-Verwaltung.
- `SystemAdminPage`: Admin-only Mandanten.

## Rollen
- `AdminPage` nur fuer `captain`.
- `SystemAdminPage` nur fuer `admin`.

## Routing
- Pfade werden in `App.tsx` definiert.
