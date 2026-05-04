# Frontend Routing

## Routen

| Pfad | Komponente | Guard |
|---|---|---|
| `/login` | `LoginPage` | nur nicht-eingeloggt |
| `/dashboard` | `DashboardPage` | eingeloggt |
| `/score` | `ScoreEntryPage` | eingeloggt |
| `/lineup` | `LineupPage` | eingeloggt (Role-abhängige Ansicht) |
| `/admin` | `AdminPage` | `captain` |
| `/system` | `SystemAdminPage` | `admin` |

## App-Lifecycle (vor dem Routing)

```
keycloak.init()
  ├─ nicht eingeloggt → LoginPage
  └─ eingeloggt
       ├─ getMyTeams()
       │    └─ 1 Team → activeTeamId automatisch setzen
       │    └─ >1 Team, kein localStorage-Wert → TeamPicker anzeigen
       │    └─ >1 Team, gültiger localStorage-Wert → direkt weiter
       └─ Shell / Router
```

## Guards

- **Auth-Guard**: Alle Routen außer `/login` erfordern `authenticated`.
- **Captain-Guard** (`require_captain` im Backend / `user.role === 'captain'` im Frontend): `/admin`.
- **Admin-Guard**: `/system`.
- **LineupPage**: Kein Route-Guard, aber interne Logik: Captain sieht Edit-Modus, Spieler sieht Read-only-Modus.

## X-Active-Team Header

Jeder API-Request (außer `/api/auth/my-teams`, `/api/auth/teams`, `/api/auth/register-team`) enthält:
```
X-Active-Team: {activeTeamId}
```
Gesetzt in `src/lib/api.ts` über die `activeTeamId`-Modulvariable, die von `auth.tsx` via `setActiveTeamId()` aktualisiert wird.

## Navigation
- Sidebar zeigt nur erlaubte Bereiche je nach Rolle.
- Team-Switcher erscheint in der Sidebar wenn `teams.length > 1`.
