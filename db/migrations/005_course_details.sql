-- Add course master data: course rating, slope and par per hole
-- All columns nullable so existing courses keep working.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS course_rating  NUMERIC(4, 1),
  ADD COLUMN IF NOT EXISTS slope_rating   INTEGER CHECK (slope_rating BETWEEN 55 AND 155),
  ADD COLUMN IF NOT EXISTS hole_pars      INTEGER[];
