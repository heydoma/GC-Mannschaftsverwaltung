-- Testdaten für GC Escheburg 1. Herren (team_id=1, schema=tenant_1)
-- GC Escheburg: CR=71.8, Slope=131 → Diff = (113/131) * (total - 71.8)

SET app.tenant_id = '1';
SET app.user_role = 'captain';
SET app.current_user_id = 'f44a70fa-3348-4245-b7e0-5855f601cfc1';

-- ── 4 weitere Spieler ──────────────────────────────────────────────────
INSERT INTO tenant_1.players (team_id, name, email) VALUES
  (1, 'Thomas Berger',  'thomas.berger@gcescheburg.de'),
  (1, 'Felix Wagner',   'felix.wagner@gcescheburg.de'),
  (1, 'Stefan Müller',  'stefan.mueller@gcescheburg.de'),
  (1, 'Peter Hansen',   'peter.hansen@gcescheburg.de');

-- ── Runden für Lorenz (id=1) – solider Spieler, stabil gute Form ───────
-- Totals: 84,83,86,82,80,81 → Diffs: 10.5, 9.7, 12.2, 8.8, 7.1, 7.9
INSERT INTO tenant_1.rounds (player_id, course_id, played_on, course_rating, slope_rating, hole_scores, differential, is_hcp_relevant) VALUES
  (1, 1, CURRENT_DATE - 150, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4}', 10.5, true),
  (1, 1, CURRENT_DATE - 120, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4}', 9.7,  true),
  (1, 1, CURRENT_DATE -  90, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4}', 12.2, true),
  (1, 1, CURRENT_DATE -  60, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4,4}', 8.8,  true),
  (1, 1, CURRENT_DATE -  30, 71.8, 131, '{5,5,5,5,5,5,5,5,4,4,4,4,4,4,4,4,4,4}', 7.1,  true),
  (1, 1, CURRENT_DATE -  14, 71.8, 131, '{5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4,4,4}', 7.9,  true);

-- ── Runden für Marvin Heydorn (id=2) – konstant, leicht verbessernd ────
-- Totals: 88,87,86,85,83 → Diffs: 13.9, 13.1, 12.2, 11.4, 9.7
INSERT INTO tenant_1.rounds (player_id, course_id, played_on, course_rating, slope_rating, hole_scores, differential, is_hcp_relevant) VALUES
  (2, 1, CURRENT_DATE - 120, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,4}', 13.9, true),
  (2, 1, CURRENT_DATE -  90, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4}', 13.1, true),
  (2, 1, CURRENT_DATE -  60, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4}', 12.2, true),
  (2, 1, CURRENT_DATE -  30, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4}', 11.4, true),
  (2, 1, CURRENT_DATE -  21, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4}', 9.7,  true);

-- ── Runden für Thomas Berger – Niedrig-HCPler, 🔥 heiße Form ──────────
-- Totals: 79,81,77,76,75 → Diffs: 6.2, 7.9, 4.5, 3.6, 2.8
INSERT INTO tenant_1.rounds (player_id, course_id, played_on, course_rating, slope_rating, hole_scores, differential, is_hcp_relevant) VALUES
  ((SELECT id FROM tenant_1.players WHERE name='Thomas Berger'), 1, CURRENT_DATE - 120, 71.8, 131, '{5,5,5,5,5,5,5,4,4,4,4,4,4,4,4,4,4,4}', 6.2, true),
  ((SELECT id FROM tenant_1.players WHERE name='Thomas Berger'), 1, CURRENT_DATE -  90, 71.8, 131, '{5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4,4,4}', 7.9, true),
  ((SELECT id FROM tenant_1.players WHERE name='Thomas Berger'), 1, CURRENT_DATE -  60, 71.8, 131, '{5,5,5,5,4,4,4,4,4,4,4,4,4,4,4,4,4,4}', 4.5, true),
  ((SELECT id FROM tenant_1.players WHERE name='Thomas Berger'), 1, CURRENT_DATE -  30, 71.8, 131, '{5,5,5,5,4,4,4,4,4,4,4,4,4,4,4,4,4,3}', 3.6, true),
  ((SELECT id FROM tenant_1.players WHERE name='Thomas Berger'), 1, CURRENT_DATE -  10, 71.8, 131, '{5,5,5,4,4,4,4,4,4,4,4,4,4,4,4,4,3,3}', 2.8, true);

-- ── Runden für Felix Wagner – konstanter Mittelfeld-Spieler ───────────
-- Totals: 85,84,83,85,84,82 → Diffs: 11.4, 10.5, 9.7, 11.4, 10.5, 8.8
INSERT INTO tenant_1.rounds (player_id, course_id, played_on, course_rating, slope_rating, hole_scores, differential, is_hcp_relevant) VALUES
  ((SELECT id FROM tenant_1.players WHERE name='Felix Wagner'), 1, CURRENT_DATE - 150, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4}', 11.4, true),
  ((SELECT id FROM tenant_1.players WHERE name='Felix Wagner'), 1, CURRENT_DATE - 100, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4}', 10.5, true),
  ((SELECT id FROM tenant_1.players WHERE name='Felix Wagner'), 1, CURRENT_DATE -  70, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4,4}', 9.7,  true),
  ((SELECT id FROM tenant_1.players WHERE name='Felix Wagner'), 1, CURRENT_DATE -  45, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4}', 11.4, true),
  ((SELECT id FROM tenant_1.players WHERE name='Felix Wagner'), 1, CURRENT_DATE -  20, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4}', 10.5, true),
  ((SELECT id FROM tenant_1.players WHERE name='Felix Wagner'), 1, CURRENT_DATE -   7, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4,4}', 8.8,  true);

-- ── Runden für Stefan Müller – früher gut, jetzt ❄️ kalte Form ────────
-- Totals: 79,78,77,85,87,88 → Diffs: 6.2, 5.3, 4.5, 11.4, 13.1, 13.9
INSERT INTO tenant_1.rounds (player_id, course_id, played_on, course_rating, slope_rating, hole_scores, differential, is_hcp_relevant) VALUES
  ((SELECT id FROM tenant_1.players WHERE name='Stefan Müller'), 1, CURRENT_DATE - 150, 71.8, 131, '{5,5,5,5,5,5,5,4,4,4,4,4,4,4,4,4,4,4}', 6.2,  true),
  ((SELECT id FROM tenant_1.players WHERE name='Stefan Müller'), 1, CURRENT_DATE - 120, 71.8, 131, '{5,5,5,5,4,4,4,4,4,4,4,4,4,4,4,4,4,4}', 5.3,  true),
  ((SELECT id FROM tenant_1.players WHERE name='Stefan Müller'), 1, CURRENT_DATE -  90, 71.8, 131, '{5,5,5,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4}', 4.5,  true),
  ((SELECT id FROM tenant_1.players WHERE name='Stefan Müller'), 1, CURRENT_DATE -  60, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4}', 11.4, true),
  ((SELECT id FROM tenant_1.players WHERE name='Stefan Müller'), 1, CURRENT_DATE -  30, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4}', 13.1, true),
  ((SELECT id FROM tenant_1.players WHERE name='Stefan Müller'), 1, CURRENT_DATE -  14, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,4}', 13.9, false);

-- ── Runden für Peter Hansen – Höher-HCPler, verbessert sich deutlich ──
-- Totals: 93,90,89,88,85 → Diffs: 18.3, 15.7, 14.8, 13.9, 11.4
INSERT INTO tenant_1.rounds (player_id, course_id, played_on, course_rating, slope_rating, hole_scores, differential, is_hcp_relevant) VALUES
  ((SELECT id FROM tenant_1.players WHERE name='Peter Hansen'), 1, CURRENT_DATE - 120, 71.8, 131, '{6,6,6,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5}', 18.3, true),
  ((SELECT id FROM tenant_1.players WHERE name='Peter Hansen'), 1, CURRENT_DATE -  90, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5}', 15.7, true),
  ((SELECT id FROM tenant_1.players WHERE name='Peter Hansen'), 1, CURRENT_DATE -  60, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,4}', 14.8, true),
  ((SELECT id FROM tenant_1.players WHERE name='Peter Hansen'), 1, CURRENT_DATE -  30, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,4}', 13.9, true),
  ((SELECT id FROM tenant_1.players WHERE name='Peter Hansen'), 1, CURRENT_DATE -  14, 71.8, 131, '{5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4,4,4}', 11.4, true);

-- ── Spieltag anlegen & veröffentlichen ────────────────────────────────
INSERT INTO tenant_1.matchdays (label, match_date, starters, reserves, published)
VALUES (
  'Clubmeisterschaft Runde 1',
  CURRENT_DATE + 14,
  ARRAY[
    (SELECT id FROM tenant_1.players WHERE name='Thomas Berger'),
    (SELECT id FROM tenant_1.players WHERE name='Lorenz'),
    (SELECT id FROM tenant_1.players WHERE name='Felix Wagner'),
    (SELECT id FROM tenant_1.players WHERE name='Stefan Müller')
  ],
  ARRAY[
    (SELECT id FROM tenant_1.players WHERE name='Marvin Heydorn'),
    (SELECT id FROM tenant_1.players WHERE name='Peter Hansen')
  ],
  true
);

-- ── Metriken der neuen Spieler in players-Tabelle schreiben ───────────
UPDATE tenant_1.players SET
  current_whs_index = 6.5, weighted_rating = 8.1, momentum_score = 0.8
WHERE name = 'Lorenz';

UPDATE tenant_1.players SET
  current_whs_index = 9.7, weighted_rating = 11.2, momentum_score = 1.7
WHERE name = 'Marvin Heydorn';

UPDATE tenant_1.players SET
  current_whs_index = 2.8, weighted_rating = 3.9, momentum_score = 4.2
WHERE name = 'Thomas Berger';

UPDATE tenant_1.players SET
  current_whs_index = 8.3, weighted_rating = 10.0, momentum_score = 0.5
WHERE name = 'Felix Wagner';

UPDATE tenant_1.players SET
  current_whs_index = 3.9, weighted_rating = 9.8, momentum_score = -8.4
WHERE name = 'Stefan Müller';

UPDATE tenant_1.players SET
  current_whs_index = 11.4, weighted_rating = 13.1, momentum_score = 3.2
WHERE name = 'Peter Hansen';
