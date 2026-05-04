# Rounds-Endpoints (`/api/rounds`)

Alle Endpoints laufen mit aktivem Tenant-Kontext – Queries landen automatisch
in `tenant_{id}.rounds` (JOIN mit `tenant_{id}.players`).

## GET /api/rounds
**Rolle:** eingeloggt | Optional: `?player_id=X`

Liefert Runden des eigenen Teams, optional gefiltert auf einen Spieler.
`differential` wird on-the-fly berechnet wenn der gespeicherte Wert `null` ist.

Response-Felder pro Runde:
- `id`, `player_name`, `played_on`, `course_rating`, `slope_rating`
- `hole_scores` (Array mit 18 Werten), `total_score` (Summe)
- `differential`, `course_id`, `course_name`, `created_at`

## POST /api/rounds
**Rolle:** player (nur eigene) / captain (alle im Team)

Berechtigungsprüfung:
1. Spieler muss im eigenen Team sein (`team_id`-Check)
2. Player: `keycloak_user_id` des Spielers muss mit eigenem `user_id` übereinstimmen
3. Captain: darf für beliebigen Spieler im Team eintragen

`differential` wird serverseitig aus `hole_scores`, `course_rating` und `slope_rating` berechnet.

**Request-Body:**
```json
{
  "player_id": 1,
  "course_id": 5,
  "played_on": "2025-06-15",
  "course_rating": 72.1,
  "slope_rating": 125,
  "hole_scores": [4,3,5,4,4,3,5,4,4, 5,4,4,3,5,4,4,3,5]
}
```

**Validierung:**
- Exakt 18 `hole_scores` (Pydantic-Validator)
- `slope_rating` zwischen 55 und 155

## DELETE /api/rounds/{id}
**Rolle:** captain

Löscht Runde im eigenen Team.
Prüft über Subquery: `player_id IN (SELECT id FROM players WHERE team_id = %s)`
