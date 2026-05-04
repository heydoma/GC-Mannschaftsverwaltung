import pytest
from datetime import date, timedelta
from app.engine.golf_engine import GolfEngine


# ------------------------------------------------------------------ #
# 1. Score Differential
# ------------------------------------------------------------------ #
class TestCalcDifferential:
    def test_known_example(self):
        # CR 71.0, Slope 130, Score 85 → (113/130) * (85-71) = 12.169... → 12.2
        scores = [5] * 17 + [0]  # 85 total
        scores[-1] = 85 - 5 * 17  # = 0, pad letztes Loch
        scores = [5] * 16 + [5] + [0]
        # Einfacher: direkt 18 Werte die 85 ergeben
        scores = [5] * 17 + [0]
        scores[-1] = 85 - sum(scores[:-1])
        assert GolfEngine.calc_differential(scores, 71.0, 130) == 12.2

    def test_standard_formula(self):
        scores = [4] * 18  # total 72
        result = GolfEngine.calc_differential(scores, 71.0, 113)
        assert result == 1.0  # (113/113) * (72-71) = 1.0

    def test_slope_zero_raises(self):
        with pytest.raises(ValueError, match="Slope"):
            GolfEngine.calc_differential([4] * 18, 71.0, 0)

    def test_wrong_hole_count_raises(self):
        with pytest.raises(ValueError, match="18"):
            GolfEngine.calc_differential([4] * 17, 71.0, 113)

    def test_negative_differential(self):
        # Sehr gute Runde: 65 bei CR 71, Slope 113
        scores = [3] * 17 + [14]  # 65 total
        scores[-1] = 65 - sum(scores[:-1])
        result = GolfEngine.calc_differential(scores, 71.0, 113)
        assert result < 0


# ------------------------------------------------------------------ #
# 2. Form-Differential (Par-aware, Ausreißer-bereinigt)
# ------------------------------------------------------------------ #
class TestCalcFormDifferential:
    # Par-Werte für einen typischen Platz (Par 72: 10×Par4, 4×Par3, 4×Par5)
    PARS = [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 3, 4, 5, 4]  # Summe = 72

    def test_all_par_no_outlier(self):
        """17×Par + schlechtes Loch → Form-Diff ist nahezu 0."""
        scores = list(self.PARS)  # alle Par = to_par [0]*18
        result = GolfEngine.calc_form_differential(scores, self.PARS)
        assert result == 0.0

    def test_disaster_hole_trimmed(self):
        """17×Par + +10 auf Loch 18 → Form-Diff ≈ 0 (Ausreißer rausgerechnet)."""
        scores = list(self.PARS)
        scores[-1] += 10  # Loch 18: Par+10
        result = GolfEngine.calc_form_differential(scores, self.PARS)
        # Ohne Ausreißer: 17 Löcher at par, skaliert auf 18 → 0.0
        assert result == 0.0

    def test_disaster_hole_impacts_differential(self):
        """Zum Vergleich: das WHS-Differential kennt keinen Unterschied – es sieht nur den Gesamtscore."""
        pars = self.PARS
        scores_good = list(pars)          # alles Par → total = 72
        scores_disaster = list(pars)
        scores_disaster[-1] += 10        # total = 82
        diff_good = GolfEngine.calc_differential(scores_good, 71.0, 113)
        diff_bad = GolfEngine.calc_differential(scores_disaster, 71.0, 113)
        form_good = GolfEngine.calc_form_differential(scores_good, pars)
        form_disaster = GolfEngine.calc_form_differential(scores_disaster, pars)
        # HCP-Differential: sehr unterschiedlich
        assert diff_bad > diff_good + 5
        # Form-Differential: fast gleich (Ausreißer rausgerechnet)
        assert abs(form_disaster - form_good) < 1.0

    def test_consistently_good_player(self):
        """Spieler immer 1 unter Par → form_diff negativ (besser als Par)."""
        scores = [p - 1 for p in self.PARS]
        result = GolfEngine.calc_form_differential(scores, self.PARS)
        assert result < 0

    def test_consistently_bad_player(self):
        """Spieler immer 2 über Par → form_diff positiv (schlechter als Par)."""
        scores = [p + 2 for p in self.PARS]
        result = GolfEngine.calc_form_differential(scores, self.PARS)
        assert result > 0

    def test_trim_worst_zero(self):
        """trim_worst=0: kein Trimmen, Ergebnis = einfaches To-Par-Total."""
        scores = list(self.PARS)
        scores[-1] += 10
        result = GolfEngine.calc_form_differential(scores, self.PARS, trim_worst=0)
        assert result == 10.0  # 10 über Par, skaliert 18/18 = 10.0

    def test_wrong_score_count_raises(self):
        with pytest.raises(ValueError, match="18"):
            GolfEngine.calc_form_differential([4] * 17, self.PARS)

    def test_wrong_par_count_raises(self):
        with pytest.raises(ValueError, match="18"):
            GolfEngine.calc_form_differential([4] * 18, [4] * 17)

    def test_invalid_trim_raises(self):
        with pytest.raises(ValueError, match="trim_worst"):
            GolfEngine.calc_form_differential([4] * 18, self.PARS, trim_worst=18)


# ------------------------------------------------------------------ #
# 3. Time-Decay Weighted Rating (Legacy)
# ------------------------------------------------------------------ #
class TestCalcWeightedRating:
    def test_single_round_returns_its_differential(self):
        rounds = [{"differential": 10.0, "played_on": date.today()}]
        assert GolfEngine.calc_weighted_rating(rounds) == 10.0

    def test_recent_round_has_more_weight(self):
        today = date.today()
        rounds = [
            {"differential": 20.0, "played_on": today - timedelta(days=60)},  # alt, schlecht
            {"differential": 5.0, "played_on": today},  # neu, gut
        ]
        result = GolfEngine.calc_weighted_rating(rounds)
        assert result < 12.5  # Muss näher an 5.0 als an 20.0 sein

    def test_empty_returns_none(self):
        assert GolfEngine.calc_weighted_rating([]) is None

    def test_weights_normalized(self):
        # Beide Runden gleich alt → Schnitt
        today = date.today()
        rounds = [
            {"differential": 10.0, "played_on": today},
            {"differential": 20.0, "played_on": today},
        ]
        result = GolfEngine.calc_weighted_rating(rounds)
        assert result == 15.0


# ------------------------------------------------------------------ #
# 4. Form-Rating (zeitfenster-basiert, form_differential-aware)
# ------------------------------------------------------------------ #
class TestCalcFormRating:
    # Hilfsfunktion: activity_weight=0 um Aktivitäts-Bonus in anderen Tests herauszuhalten
    @staticmethod
    def _r(differential, form_differential, played_on):
        return {"differential": differential, "form_differential": form_differential, "played_on": played_on}

    def test_empty_returns_none(self):
        assert GolfEngine.calc_form_rating([]) is None

    def test_all_rounds_too_old_returns_none(self):
        """Runden die älter als max_age_days sind werden ignoriert."""
        old = date.today() - timedelta(days=400)
        rounds = [self._r(10.0, None, old)]
        assert GolfEngine.calc_form_rating(rounds, max_age_days=365) is None

    def test_recent_round_included(self):
        today = date.today()
        rounds = [self._r(12.0, None, today)]
        # activity_weight=0: Bonus deaktiviert um Score-Berechnung isoliert zu testen
        assert GolfEngine.calc_form_rating(rounds, activity_weight=0.0) == 12.0

    def test_prefers_form_differential_over_hcp_differential(self):
        """Wenn form_differential vorhanden, wird dieses bevorzugt."""
        today = date.today()
        rounds = [self._r(18.0, 5.0, today)]
        result = GolfEngine.calc_form_rating(rounds, activity_weight=0.0)
        assert result == 5.0  # form_diff (5.0) statt HCP-diff (18.0)

    def test_falls_back_to_hcp_differential_when_no_form_diff(self):
        """Ohne form_differential wird das HCP-Differential genutzt."""
        today = date.today()
        rounds = [self._r(14.0, None, today)]
        assert GolfEngine.calc_form_rating(rounds, activity_weight=0.0) == 14.0

    def test_recent_rounds_dominate_old_rounds(self):
        """Schnellerer Decay (λ=0.04): aktuelle Runden dominieren stark."""
        today = date.today()
        rounds = [
            self._r(20.0, 20.0, today - timedelta(days=60)),
            self._r(5.0,  5.0,  today),
        ]
        # activity_weight=0 um nur den Decay-Effekt zu testen
        result = GolfEngine.calc_form_rating(rounds, activity_weight=0.0)
        assert result < 7.0  # λ=0.04, 60 Tage: aktuell dominiert stark

    def test_old_round_cut_off_by_time_window(self):
        """Runde knapp außerhalb des Fensters fließt nicht ein."""
        today = date.today()
        rounds = [
            self._r(30.0, 30.0, today - timedelta(days=366)),
            self._r(5.0,  5.0,  today),
        ]
        result = GolfEngine.calc_form_rating(rounds, max_age_days=365, activity_weight=0.0)
        assert result == 5.0

    def test_round_exactly_at_boundary_included(self):
        """Runde exakt an der Grenze (max_age_days) wird noch berücksichtigt."""
        today = date.today()
        rounds = [
            self._r(10.0, 10.0, today - timedelta(days=365)),
            self._r(10.0, 10.0, today),
        ]
        assert GolfEngine.calc_form_rating(rounds, max_age_days=365) is not None

    def test_mixed_form_and_hcp_differentials(self):
        """Runden mit und ohne form_differential im selben Fenster."""
        today = date.today()
        rounds = [
            self._r(20.0, None, today),  # kein Par → HCP-Differential
            self._r(20.0, 5.0,  today),  # Par vorhanden → form_differential
        ]
        result = GolfEngine.calc_form_rating(rounds, activity_weight=0.0)
        assert result == 12.5  # Schnitt aus 20.0 und 5.0

    # -- Aktivitäts-Bonus Tests --

    def test_activity_bonus_reduces_rating(self):
        """Mehr Runden → niedrigeres Rating (besserer Rang)."""
        today = date.today()
        one_round  = [self._r(10.0, 10.0, today)]
        ten_rounds = [self._r(10.0, 10.0, today)] * 10
        result_one = GolfEngine.calc_form_rating(one_round)
        result_ten = GolfEngine.calc_form_rating(ten_rounds)
        assert result_ten < result_one

    def test_active_player_beats_inactive_with_same_score(self):
        """Spieler mit gleichen Scores aber mehr Runden rankt besser."""
        today = date.today()
        inactive = [self._r(8.0, 8.0, today)]  # 1 gute Runde
        active   = [self._r(8.0, 8.0, today)] * 15  # 15 gleich gute Runden
        assert GolfEngine.calc_form_rating(active) < GolfEngine.calc_form_rating(inactive)

    def test_active_player_can_beat_slightly_better_inactive(self):
        """Wer oft spielt (10.0) kann einen kaum aktiven Spieler (8.0) überholen."""
        today = date.today()
        # Spieler A: 1 Runde, sehr gut
        player_a = [self._r(8.0, 8.0, today)]
        # Spieler B: 20 Runden, etwas schlechter – aber viel aktiver
        player_b = [self._r(10.0, 10.0, today)] * 20
        rating_a = GolfEngine.calc_form_rating(player_a)
        rating_b = GolfEngine.calc_form_rating(player_b)
        # Aktivitätsbonus für B: log(21) ≈ 3.04 → 10.0 - 3.04 = 6.96 < 8.0 - 0.69 = 7.31
        assert rating_b < rating_a

    def test_activity_weight_zero_disables_bonus(self):
        """activity_weight=0 deaktiviert den Aktivitäts-Bonus komplett."""
        today = date.today()
        rounds = [self._r(10.0, 10.0, today)] * 10
        result = GolfEngine.calc_form_rating(rounds, activity_weight=0.0)
        assert result == 10.0

    def test_activity_bonus_works_for_negative_ratings(self):
        """Auch bei negativem Rating (unter Par) ist mehr Aktivität besser."""
        today = date.today()
        one_round  = [self._r(-2.0, -2.0, today)]
        ten_rounds = [self._r(-2.0, -2.0, today)] * 10
        # Beide unter Par – wer mehr spielt soll trotzdem besser ranken
        assert GolfEngine.calc_form_rating(ten_rounds) < GolfEngine.calc_form_rating(one_round)


# ------------------------------------------------------------------ #
# 5. Momentum
# ------------------------------------------------------------------ #
class TestCalcMomentum:
    def test_hot_form(self):
        # Historisch schlecht, zuletzt sehr gut → Momentum > 2
        diffs = [18.0, 17.0, 16.0, 15.0, 5.0, 4.0, 3.0]
        result = GolfEngine.calc_momentum(diffs)
        assert result["form_icon"] == "🔥"
        assert result["momentum"] > 2.0

    def test_cold_form(self):
        # Historisch gut, zuletzt sehr schlecht → Momentum < -2
        diffs = [5.0, 4.0, 5.0, 4.0, 18.0, 19.0, 20.0]
        result = GolfEngine.calc_momentum(diffs)
        assert result["form_icon"] == "❄️"
        assert result["momentum"] < -2.0

    def test_neutral_form(self):
        diffs = [10.0, 10.0, 10.0, 10.0]
        result = GolfEngine.calc_momentum(diffs)
        assert result["form_icon"] == "→"
        assert result["momentum"] == 0.0

    def test_less_than_3_rounds(self):
        result = GolfEngine.calc_momentum([10.0, 12.0])
        assert result["momentum"] is None
        assert result["form_icon"] == "—"

    def test_empty_list(self):
        result = GolfEngine.calc_momentum([])
        assert result["avg_all"] is None


# ------------------------------------------------------------------ #
# 4. Consistency-Index
# ------------------------------------------------------------------ #
class TestCalcConsistency:
    def test_consistent_player(self):
        diffs = [10.0, 10.0, 10.0, 10.0]
        assert GolfEngine.calc_consistency(diffs) == 0.0

    def test_inconsistent_player(self):
        diffs = [5.0, 25.0, 5.0, 25.0]
        result = GolfEngine.calc_consistency(diffs)
        assert result > 5.0

    def test_single_round_returns_none(self):
        assert GolfEngine.calc_consistency([10.0]) is None

    def test_empty_returns_none(self):
        assert GolfEngine.calc_consistency([]) is None



# ------------------------------------------------------------------ #
# 7. calc_ranking_score
# ------------------------------------------------------------------ #
class TestCalcRankingScore:
    """Testet den Blend aus Form-Rating und WHS-Index.

    Stefan-Müller-Problem: Spieler mit HCP 3.9 darf nicht unter einem Spieler
    mit HCP 11.4 landen, nur weil er ein paar schlechte Runden hatte.
    """

    def test_stefan_beats_peter(self):
        """Stefan (HCP 3.9, schlechte Form ~9.0) bleibt über Peter (HCP 11.4, gute Form ~7.0)."""
        # 65% Form + 35% WHS
        stefan = GolfEngine.calc_ranking_score(form_rating=9.0, whs_index=3.9)
        peter  = GolfEngine.calc_ranking_score(form_rating=7.0, whs_index=11.4)
        # Stefan: 0.65*9.0 + 0.35*3.9 = 5.85 + 1.365 = 7.215
        # Peter:  0.65*7.0 + 0.35*11.4 = 4.55 + 3.99  = 8.54
        assert stefan is not None and peter is not None
        assert stefan < peter, f"Stefan ({stefan}) sollte besser als Peter ({peter}) ranken"

    def test_genuinely_better_form_wins(self):
        """Wenn Peter wirklich viel besser spielt, darf er Stefan überholen."""
        stefan = GolfEngine.calc_ranking_score(form_rating=12.0, whs_index=3.9)
        peter  = GolfEngine.calc_ranking_score(form_rating=3.0, whs_index=11.4)
        # Stefan: 0.65*12.0 + 0.35*3.9 = 7.8 + 1.365 = 9.165
        # Peter:  0.65*3.0  + 0.35*11.4 = 1.95 + 3.99 = 5.94
        assert stefan is not None and peter is not None
        assert peter < stefan, "Peter mit stark besserer Form darf vorne sein"

    def test_formula_default_weights(self):
        """Explizite Formel-Prüfung mit Standard-Gewichten (65/35)."""
        score = GolfEngine.calc_ranking_score(form_rating=10.0, whs_index=5.0)
        expected = round(0.65 * 10.0 + 0.35 * 5.0, 2)  # 8.25
        assert score == expected

    def test_custom_form_weight(self):
        """Eigene Gewichtung wird korrekt angewendet."""
        score = GolfEngine.calc_ranking_score(form_rating=10.0, whs_index=5.0, form_weight=0.5)
        assert score == round(0.5 * 10.0 + 0.5 * 5.0, 2)  # 7.5

    def test_no_form_rating_falls_back_to_whs(self):
        """Kein Form-Rating (keine Runden im 1-Jahres-Fenster) → nur WHS-Index."""
        assert GolfEngine.calc_ranking_score(form_rating=None, whs_index=8.5) == 8.5

    def test_no_whs_index_falls_back_to_form(self):
        """Kein WHS-Index (weniger als 3 Runden) → nur Form-Rating."""
        assert GolfEngine.calc_ranking_score(form_rating=12.3, whs_index=None) == 12.3

    def test_both_none_returns_none(self):
        """Wenn beides fehlt, kann kein Rang berechnet werden."""
        assert GolfEngine.calc_ranking_score(form_rating=None, whs_index=None) is None
