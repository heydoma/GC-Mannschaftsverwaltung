-- Migration 006: Par-Daten und Form-Differential zu Runden hinzufügen
--
-- hole_pars: Die Par-Werte der 18 Löcher (vom Kurs übernommen, nullable).
--            Ermöglicht lochgenaue Form-Analyse unabhängig vom WHS-Differential.
-- form_differential: Ausreißer-bereinigtes To-Par-Ergebnis (schlechtestes Loch
--            herausgerechnet, skaliert auf 18 Löcher).
--            Niedrigerer Wert = bessere Form, losgelöst vom HCP-Differential.

ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS hole_pars         INTEGER[],
  ADD COLUMN IF NOT EXISTS form_differential NUMERIC(5, 2);
