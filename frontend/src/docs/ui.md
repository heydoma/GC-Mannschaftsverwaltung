# frontend/src UI

## Theme
- Farben und Typografie in `index.css`.
- Dark Mode per `dark` Class.

## Layout
- `Shell` (in `App.tsx`): Sidebar-Navigation + Content-Bereich.
- Sidebar enthält: Logo, Nav-Links, Team-Switcher (bei mehreren Teams), User-Info, Abmelden.
- Mobile: Sidebar als Overlay (Hamburger-Menü).

## Multi-Team Support

### Team-Picker (`TeamPicker` in `App.tsx`)
Erscheint nach dem Login, wenn der User mehr als einem Team angehört und noch kein aktives Team gewählt hat.
Zeigt alle Teams mit Rolle (⚑ Captain / 🏌️ Spieler) als Karten zur Auswahl.

### Team-Switcher (Sidebar)
Sichtbar, wenn `teams.length > 1`. Einfaches `<select>` mit allen Teams.
Beim Wechsel wird `X-Active-Team` Header in allen folgenden API-Requests gesetzt.

### Auth-Context (`src/lib/auth.tsx`)

| Wert | Typ | Bedeutung |
|---|---|---|
| `teams` | `TeamMembership[]` | Alle Teams des eingeloggten Users |
| `activeTeamId` | `number \| null` | Aktuell gewähltes Team |
| `switchTeam(id)` | Funktion | Wechselt Team (State + localStorage + api.ts) |

Das aktive Team wird in `localStorage` gespeichert und beim nächsten Login wiederhergestellt.

## Seiten

| Pfad | Seite | Sichtbar für |
|---|---|---|
| `/login` | LoginPage | alle (nicht eingeloggt) |
| `/dashboard` | DashboardPage | alle eingeloggten |
| `/score` | ScoreEntryPage | alle eingeloggten |
| `/lineup` | LineupPage | Captain: bearbeiten; Spieler: read-only (nur published) |
| `/admin` | AdminPage | captain |
| `/system` | SystemAdminPage | admin |

## Leaderboard (DashboardPage)

Spalten: `#` · Form-Icon (🔥 heiß / ❄️ kalt / → neutral) · Name · HCP · Weighted Rating

- **Form-Icon** basiert auf den letzten 3 Runden vs. langfristiger Durchschnitt
- **HCP** = WHS-Index (mind. 3 Runden, sonst `—`)
- **Weighted Rating** = interner Score, bestimmt die Reihenfolge

## Spieltage (LineupPage)

- Captain: Combobox zur Spieltag-Auswahl, Anlegen neuer Spieltage, DnD-Aufstellung, Speichern, Veröffentlichen
- Spieler: sieht nur veröffentlichte Spieltage, read-only Liste mit Starter/Ersatz-Anzeige

## SideSheets / Dialoge
- Werden via `React.createPortal` in `document.body` gerendert → kein Stacking-Context-Problem mit der Sidebar.
