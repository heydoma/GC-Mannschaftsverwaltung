-- ============================================================
-- Golf Team Performance Tool – Initial Schema (MVP)
-- Erstellt beim ersten Start des Postgres-Containers automatisch.
-- ============================================================

-- Spieler --------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    current_rating  NUMERIC(4, 1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
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
CREATE INDEX IF NOT EXISTS idx_rounds_player_played
    ON rounds (player_id, played_on DESC);
