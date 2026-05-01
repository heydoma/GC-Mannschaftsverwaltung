# backend/app/routes Auth

## POST /api/auth/register-team (admin)
Legt Team und Captain an.

## GET /api/auth/me
Liefert User-Profil, Rollen und Teamdaten.

## GET /api/auth/teams (admin)
Listet alle Teams fuer System-Admin.

## Validierungen
- Team-Name min 2 Zeichen.
- Password min 8 Zeichen.
