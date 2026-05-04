# Players-Endpoints (`/api/players`)

Alle Endpoints laufen mit aktivem Tenant-Kontext – Queries landen automatisch
in `tenant_{id}.players`.

## GET /api/players
**Rolle:** eingeloggt

Liefert alle Spieler des eigenen Teams inkl. aktueller Keycloak-Rolle.
Die Rolle wird per Admin-API aus Keycloak gelesen (einzeln pro Spieler).

```json
[{ "id": 1, "name": "...", "email": "...", "current_rating": 18.4,
   "keycloak_user_id": "uuid", "created_at": "...", "role": "captain" }]
```

## POST /api/players
**Rolle:** captain

Legt Spieler an (Keycloak + DB). Bei DB-Fehler wird der Keycloak-User sofort gelöscht.

- Passwort für `player` ist temporär (Keycloak erzwingt Änderung beim ersten Login)
- Passwort für `captain` ist permanent

```json
{ "name": "...", "email": "...", "password": "...", "role": "player" }
```

Response enthält `temporary_password` – einmalig anzeigen und an Spieler weitergeben.

## DELETE /api/players/{id}
**Rolle:** captain

Löscht Spieler aus DB und Keycloak. `ON DELETE CASCADE` entfernt zugehörige Runden automatisch.
Nur Spieler des eigenen Teams löschbar (`AND team_id = %s` in DELETE-Query).

## PATCH /api/players/{id}/role
**Rolle:** captain

Ändert Keycloak-Rolle zu `player` oder `captain`.

Schutzregeln:
- Captain kann eigene Rolle nicht entfernen
- Letztes Captain-Konto im Team ist gesperrt (zählt Captains über Keycloak)

## POST /api/players/{id}/analyze
**Rolle:** captain

Berechnet WHS-Index, gewichtetes Rating und Momentum neu und speichert das Ergebnis.
Fehlende `differential`-Werte werden dabei aus `hole_scores` nachberechnet.
