-- ============================================================
-- Golf Team Performance Tool – Initial Schema (MVP)
-- Erstellt beim ersten Start des Postgres-Containers automatisch.
-- ============================================================

-- Mannschaften ---------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    tenant_slug     TEXT UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mandanten-Registry ---------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    team_id         INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    team_name       TEXT NOT NULL,
    tenant_slug     TEXT NOT NULL UNIQUE,
    schema_name     TEXT NOT NULL UNIQUE,
    host            TEXT UNIQUE,
    realm           TEXT,
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
    current_whs_index NUMERIC(4, 1),
    weighted_rating   NUMERIC(6, 2),
    momentum_score    NUMERIC(6, 2),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, name)
);

-- Plaetze --------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Runden ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS rounds (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    course_id       INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    played_on       DATE NOT NULL,
    course_rating   NUMERIC(4, 1) NOT NULL,
    slope_rating    INTEGER NOT NULL CHECK (slope_rating BETWEEN 55 AND 155),
    hole_scores     INTEGER[] NOT NULL CHECK (array_length(hole_scores, 1) = 18),
    differential    NUMERIC(6, 1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indizes --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_players_team
    ON players (team_id);

CREATE INDEX IF NOT EXISTS idx_players_keycloak
    ON players (keycloak_user_id);

CREATE INDEX IF NOT EXISTS idx_rounds_player_played
    ON rounds (player_id, played_on DESC);

CREATE INDEX IF NOT EXISTS idx_rounds_course
    ON rounds (course_id);
