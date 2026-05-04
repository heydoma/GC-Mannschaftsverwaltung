-- Archiv-Tabelle für Runden gelöschter Mandanten
-- Zweck: Daten für zukünftige ML-Auswertungen erhalten,
--        auch wenn das Team-Schema gelöscht wurde.

CREATE TABLE IF NOT EXISTS public.rounds_archive (
    id                SERIAL PRIMARY KEY,
    original_round_id INTEGER,                          -- ursprüngliche Round-ID im Tenant-Schema
    team_id           INTEGER,                          -- kein FK – Team existiert nicht mehr
    team_name         TEXT NOT NULL,
    player_name       TEXT NOT NULL,
    played_on         DATE NOT NULL,
    course_id         INTEGER REFERENCES public.courses(id) ON DELETE SET NULL,
    course_rating     NUMERIC(4, 1) NOT NULL,
    slope_rating      INTEGER NOT NULL,
    hole_scores       INTEGER[] NOT NULL,
    hole_pars         INTEGER[],
    differential      NUMERIC(6, 1),
    form_differential NUMERIC(5, 2),
    is_hcp_relevant   BOOLEAN NOT NULL DEFAULT true,
    archived_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rounds_archive_team
    ON public.rounds_archive (team_id);

CREATE INDEX IF NOT EXISTS idx_rounds_archive_player
    ON public.rounds_archive (team_id, player_name);

CREATE INDEX IF NOT EXISTS idx_rounds_archive_played_on
    ON public.rounds_archive (played_on DESC);
