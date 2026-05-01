# frontend/src Routing

## Routen
- `/login` -> LoginPage
- `/dashboard` -> DashboardPage
- `/score` -> ScoreEntryPage
- `/admin` -> AdminPage (captain)
- `/system` -> SystemAdminPage (admin)

## Guards
- `RequireAuth` blockt nicht eingeloggte Nutzer.
- `RequireCaptain` fuer Captain-only Bereiche.
- `RequireAdmin` fuer Admin-only Bereiche.

## Navigation
- Die Bottom-Nav zeigt nur Routen, die der User sehen darf.
