-- ============================================================
-- Golf Team Performance Tool – Initial Schema (MVP)
-- Erstellt beim ersten Start des Postgres-Containers automatisch.
-- ============================================================

-- Mannschaften ---------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spieler --------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
    id                SERIAL PRIMARY KEY,
    team_id           INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    keycloak_user_id  UUID UNIQUE,
    name              TEXT NOT NULL,
    email             TEXT,
    current_rating    NUMERIC(4, 1),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, name)
);

-- Runden ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS rounds (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    played_on       DATE NOT NULL,
    course_rating   NUMERIC(4, 1) NOT NULL,
    slope_rating    INTEGER NOT NULL CHECK (slope_rating BETWEEN 55 AND 155),
    hole_scores     INTEGER[] NOT NULL CHECK (array_length(hole_scores, 1) = 18),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indizes --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_players_team
    ON players (team_id);

CREATE INDEX IF NOT EXISTS idx_players_keycloak
    ON players (keycloak_user_id);

CREATE INDEX IF NOT EXISTS idx_rounds_player_played
    ON rounds (player_id, played_on DESC);
