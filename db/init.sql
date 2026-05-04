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

-- Plaetze --------------------------------------------------------
-- Spieler und Runden liegen in den jeweiligen Tenant-Schemas (tenant_{id}),
-- nicht in public. Nur courses ist global geteilt.
CREATE TABLE IF NOT EXISTS courses (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    course_rating   NUMERIC(4, 1),
    slope_rating    INTEGER CHECK (slope_rating BETWEEN 55 AND 155),
    hole_pars       INTEGER[],          -- 18-element array, optional
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team-Mitgliedschaften -----------------------------------------
-- Ein Keycloak-User kann in mehreren Teams mit unterschiedlichen Rollen sein.
CREATE TABLE IF NOT EXISTS team_memberships (
    keycloak_user_id  UUID NOT NULL,
    team_id           INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role              TEXT NOT NULL CHECK (role IN ('captain', 'player')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (keycloak_user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_memberships_user ON team_memberships (keycloak_user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team ON team_memberships (team_id);

-- Indizes --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_courses_name ON courses (name);
