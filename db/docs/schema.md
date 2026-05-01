# db Schema

## Tabellen
### teams
- `id` SERIAL
- `name` TEXT
- `created_at` TIMESTAMPTZ

### players
- `id` SERIAL
- `team_id` INTEGER (FK)
- `keycloak_user_id` UUID
- `name`, `email`, `current_rating`

### rounds
- `id` SERIAL
- `player_id` INTEGER (FK)
- `played_on`, `course_rating`, `slope_rating`, `hole_scores`

## Indizes
- `idx_players_team`
- `idx_players_keycloak`
- `idx_rounds_player_played`
