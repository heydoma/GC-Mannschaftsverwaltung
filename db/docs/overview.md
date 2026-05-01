# db Overview

## Zweck
Initiales Postgres-Schema fuer Teams, Spieler und Runden.

## Tabellen
- `teams`: Mandantenbasis.
- `players`: Spieler pro Team.
- `rounds`: Runden pro Spieler.

## Indizes
- `players(team_id)`
- `players(keycloak_user_id)`
- `rounds(player_id, played_on)`

## Mandanten-Logik
- `team_id` referenziert `teams.id`.
- Alle Queries muessen `team_id` filtern.

## Dateien
- `init.sql` wird beim DB-Start ausgefuehrt.
