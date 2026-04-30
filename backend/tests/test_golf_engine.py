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
# 2. Time-Decay Weighted Rating
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
# 3. Momentum
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
