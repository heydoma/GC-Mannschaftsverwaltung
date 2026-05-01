-- Add WHS fields to players and rounds

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS current_whs_index NUMERIC(4, 1),
  ADD COLUMN IF NOT EXISTS weighted_rating NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS momentum_score NUMERIC(6, 2);

ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS differential NUMERIC(6, 1);

-- Backfill stored differentials where possible
UPDATE rounds
SET differential = round((113.0 / slope_rating) * ((SELECT sum(x) FROM unnest(hole_scores) AS x) - course_rating), 1)
WHERE differential IS NULL
  AND hole_scores IS NOT NULL
  AND slope_rating IS NOT NULL
  AND course_rating IS NOT NULL;
