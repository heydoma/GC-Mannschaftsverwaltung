# frontend/src/pages Access

## Regeln
- `/admin` nur fuer Captains.
- `/system` nur fuer Admins.
- Alle anderen Seiten fuer eingeloggte User.

## Umsetzung
- Route-Guards in `App.tsx`.
- Nav zeigt nur erlaubte Eintraege.
