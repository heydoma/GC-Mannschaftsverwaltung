import math
import statistics
from datetime import date
from typing import Optional


class GolfEngine:
    """Kern-Analytics-Engine: WHS-Differential, Time-Decay-Rating, Momentum, Consistency."""

    LAMBDA_DAYS: float = 0.02  # Halbwertszeit ~35 Tage – später feinjustierbar

    # ------------------------------------------------------------------
    # 1. Score Differential (WHS-Standard)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_differential(
        hole_scores: list[int],
        course_rating: float,
        slope: int,
    ) -> float:
        if slope == 0:
            raise ValueError("Slope darf nicht 0 sein.")
        if len(hole_scores) != 18:
            raise ValueError(
                f"Exakt 18 Loch-Scores erwartet, {len(hole_scores)} erhalten."
            )
        total = sum(hole_scores)
        return round((113 / slope) * (total - course_rating), 1)

    # ------------------------------------------------------------------
    # 2. Exponential Time-Decay Weighted Rating
    # ------------------------------------------------------------------
    @staticmethod
    def calc_weighted_rating(
        rounds_data: list[dict],  # [{"differential": float, "played_on": date}]
        lambda_days: float = LAMBDA_DAYS,
    ) -> Optional[float]:
        if not rounds_data:
            return None
        today = date.today()
        weights = [
            math.exp(-lambda_days * max((today - r["played_on"]).days, 0))
            for r in rounds_data
        ]
        total_w = sum(weights)
        if total_w == 0:
            return None
        normalized = [w / total_w for w in weights]
        weighted = sum(n * r["differential"] for n, r in zip(normalized, rounds_data))
        return round(weighted, 2)

    # ------------------------------------------------------------------
    # 3. Momentum (Form-Analyse)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_momentum(differentials: list[float]) -> dict:
        if not differentials:
            return {"avg_all": None, "avg_last3": None, "momentum": None, "form_icon": "—"}

        avg_all = statistics.mean(differentials)

        if len(differentials) < 3:
            return {
                "avg_all": round(avg_all, 2),
                "avg_last3": None,
                "momentum": None,
                "form_icon": "—",
            }

        avg_last3 = statistics.mean(differentials[-3:])
        momentum = avg_all - avg_last3  # positiv = Verbesserung (niedrigeres Diff)

        form_icon = "🔥" if momentum > 2.0 else ("❄️" if momentum < -2.0 else "→")

        return {
            "avg_all": round(avg_all, 2),
            "avg_last3": round(avg_last3, 2),
            "momentum": round(momentum, 2),
            "form_icon": form_icon,
        }

    # ------------------------------------------------------------------
    # 4. Consistency-Index (Standardabweichung der Differentiale)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_consistency(differentials: list[float]) -> Optional[float]:
        if len(differentials) < 2:
            return None
        return round(statistics.stdev(differentials), 2)
