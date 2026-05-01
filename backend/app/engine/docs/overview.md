# backend/app/engine Overview

## Zweck
Berechnet Golf-spezifische Kennzahlen wie Differential, Rating, Momentum und Konstanz.

## Kernfunktionen
- `calc_differential`: aus Scores, Course Rating und Slope.
- `calc_weighted_rating`: gewichtet vergangene Runden.
- `calc_momentum`: Trend aus den letzten Runden.
- `calc_consistency`: Streuung der Differentials.

## Eingaben
- `hole_scores`: genau 18 Scores.
- `course_rating`: float.
- `slope_rating`: 55 bis 155.

## Fehlerhandling
- Unvollstaendige Daten werfen `ValueError`.

## Tests
- Tests liegen in `backend/tests/test_golf_engine.py`.
