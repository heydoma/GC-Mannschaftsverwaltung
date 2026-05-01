# Backend Overview

## Zweck
Das Backend stellt die FastAPI-API bereit, validiert Keycloak-Tokens und liest/schreibt Daten in Postgres.

## Laufzeit
- Startpunkt ist `app/main.py`.
- CORS erlaubt lokale Vite-Entwicklung.

## Hauptfluss
1) Request kommt an einem Endpoint an.
2) `get_current_user` validiert das JWT und baut `CurrentUser`.
3) Role-Guards (`require_captain`, `require_admin`) blocken unberechtigte Requests.
4) SQL-Query filtert mit `team_id`.

## Auth und Mandanten
- `team_id` wird als Claim im Token erwartet.
- Rollen kommen aus `realm_access.roles` (admin/captain/player).

## Datenzugriff
- `app/db.py` kapselt die Verbindung.
- Alle Queries muessen `team_id` filtern.

## Tests
- Tests liegen in `backend/tests`.
- Engine-Logik wird mit pytest geprueft.

## Konfiguration
- Keycloak-URL, Realm und Clients kommen aus Umgebungsvariablen.
