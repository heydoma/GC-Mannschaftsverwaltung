import math
import statistics
from datetime import date
from typing import Dict, List, Optional


class GolfEngine:
    """Kern-Analytics-Engine: WHS-Differential, Time-Decay-Rating, Momentum, Consistency."""

    LAMBDA_DAYS: float = 0.02      # Halbwertszeit ~35 Tage – später feinjustierbar
    ACTIVITY_WEIGHT: float = 1.0   # Gewichtung des Aktivitäts-Bonus (1 = ~2.4 Schläge Vorteil bei 10 Runden vs 1 Runde)
    FORM_WEIGHT: float = 0.65      # Anteil Form-Rating am Ranking-Score (Rest = WHS-Index als Potential-Anker)

    # ------------------------------------------------------------------
    # 1. Score Differential (WHS-Standard)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_differential(
        hole_scores: List[int],
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
    # 2. Form-Differential (Par-aware, Ausreißer-bereinigt)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_form_differential(
        hole_scores: List[int],
        hole_pars: List[int],
        trim_worst: int = 1,
    ) -> float:
        """Berechnet ein Form-Differential unabhängig vom WHS-Differential.

        Idee: Das HCP-Differential interessiert sich nicht für Par – es vergleicht
        nur den Gesamtscore mit dem Course Rating. Für die Formanalyse ist Par
        aber entscheidend: Wer 17 Löcher auf Par spielt und ein Katastrophen-Loch
        (+10) hat, war in guter Form – auch wenn das Differential schlecht aussieht.

        Methode:
        - To-Par pro Loch berechnen (score - par)
        - Die `trim_worst` schlechtesten Löcher (höchstes To-Par) entfernen
        - Summe der verbleibenden Löcher auf 18 hochrechnen
        - Niedrigerer Wert = bessere Form (gleiche Richtung wie Differential)

        Gibt das to-par-äquivalent für 18 Löcher zurück (keine Slope-Normierung,
        da reine Form-Metrik, nicht HCP-relevant).
        """
        if len(hole_scores) != 18:
            raise ValueError(
                f"Exakt 18 Loch-Scores erwartet, {len(hole_scores)} erhalten."
            )
        if len(hole_pars) != 18:
            raise ValueError(
                f"Exakt 18 Par-Werte erwartet, {len(hole_pars)} erhalten."
            )
        if not (0 <= trim_worst < 18):
            raise ValueError("trim_worst muss zwischen 0 und 17 liegen.")

        to_par = [score - par for score, par in zip(hole_scores, hole_pars)]
        # Schlechteste(s) Loch/Löcher entfernen (höchstes To-Par zuerst)
        trimmed = sorted(to_par)[: 18 - trim_worst]
        remaining = 18 - trim_worst
        scaled = sum(trimmed) * 18 / remaining
        return round(scaled, 2)

    # ------------------------------------------------------------------
    # 4. Form-Rating (Ranglisten-Rating, zeitfenster-basiert)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_form_rating(
        rounds_data: List[Dict],  # [{"differential": float, "form_differential": float|None, "played_on": date}]
        max_age_days: int = 365,
        lambda_days: float = 0.04,
        activity_weight: float = ACTIVITY_WEIGHT,
    ) -> Optional[float]:
        """Berechnet das Form-Rating für die Rangliste.

        Drei Komponenten:
        1. Zeitfenster: nur Runden der letzten max_age_days (Standard: 1 Jahr).
           Kein Limit auf Rundenanzahl – wer täglich spielt, bekommt alle Runden gewichtet.
        2. Zeit-Decay (λ=0.04, Halbwertszeit ~17 Tage): aktuellere Runden zählen mehr.
           Bevorzugt form_differential (par-aware) wenn vorhanden, Fallback auf HCP-Differential.
        3. Aktivitäts-Bonus: Wer viel spielt bekommt einen logarithmischen Abzug auf
           das Rating – aktive Spieler ranken besser als jemand der 1x pro Halbjahr spielt,
           selbst wenn diese eine Runde gut war. Logarithmisch skaliert damit der
           Unterschied zwischen 1 und 10 Runden stärker wiegt als zwischen 30 und 40.
           Formel: bonus = activity_weight × log(n_rounds + 1)

        Niedrigerer Wert = bessere aktuelle Form / höherer Rang.
        """
        if not rounds_data:
            return None

        today = date.today()
        # Nur Runden innerhalb des Zeitfensters berücksichtigen
        recent = [
            r for r in rounds_data
            if (today - r["played_on"]).days <= max_age_days
        ]
        if not recent:
            return None

        # Pro Runde: form_differential bevorzugen (par-aware), Fallback auf HCP-Differential
        scores = [
            r["form_differential"] if r.get("form_differential") is not None
            else r["differential"]
            for r in recent
        ]

        weights = [
            math.exp(-lambda_days * (today - r["played_on"]).days)
            for r in recent
        ]
        total_w = sum(weights)
        if total_w == 0:
            return None
        normalized = [w / total_w for w in weights]
        weighted = sum(n * s for n, s in zip(normalized, scores))

        # Aktivitäts-Bonus: log(n+1) wächst von 0 (0 Runden) bis ~4 (52 Runden/Jahr)
        # Additiv statt multiplikativ → funktioniert korrekt auch bei negativen Ratings
        activity_bonus = activity_weight * math.log(len(recent) + 1)
        return round(weighted - activity_bonus, 2)

    # ------------------------------------------------------------------
    # 5. Ranking-Score (Form-Rating + WHS-Index Blend)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_ranking_score(
        form_rating: Optional[float],
        whs_index: Optional[float],
        form_weight: float = FORM_WEIGHT,
    ) -> Optional[float]:
        """Kombiniert Form-Rating und WHS-Index zu einem Ranking-Score.

        Problem: Reines Form-Rating kann einen guten Spieler (niedriger HCP)
        zu weit nach unten drücken wenn er ein paar schlechte Runden hatte –
        auch wenn seine schlechten Runden noch besser sind als die guten Runden
        eines schwächeren Spielers.

        Lösung: Blend aus aktuellem Form-Rating und WHS-Index als Potential-Anker:
            ranking_score = form_weight × form_rating + (1 - form_weight) × whs_index

        Beide Metriken sind strichbasiert (niedriger = besser), daher direkt kombinierbar.
        Standard: 65% Form (aktuell) + 35% WHS (langfristiges Potential).

        Grenzfälle:
        - Kein form_rating (noch keine Runde im Zeitfenster) → nur WHS-Index
        - Kein whs_index (weniger als 3 Runden) → nur form_rating
        - Beides None → None (kein Rang möglich)
        """
        if form_rating is None and whs_index is None:
            return None
        if form_rating is None:
            return whs_index
        if whs_index is None:
            return form_rating
        return round(form_weight * form_rating + (1.0 - form_weight) * whs_index, 2)

    # ------------------------------------------------------------------
    # 6. Exponential Time-Decay Weighted Rating (Legacy)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_weighted_rating(
        rounds_data: List[Dict],  # [{"differential": float, "played_on": date}]
        lambda_days: float = LAMBDA_DAYS,
    ) -> Optional[float]:
        """Ursprüngliche Weighted-Rating-Berechnung (alle Runden, HCP-Differential).
        Für Abwärtskompatibilität erhalten; für neue Berechnungen calc_form_rating verwenden.
        """
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
    # 6. Momentum (Form-Analyse)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_momentum(differentials: List[float]) -> Dict:
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
    # 7. Consistency-Index (Standardabweichung der Differentiale)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_consistency(differentials: List[float]) -> Optional[float]:
        if len(differentials) < 2:
            return None
        return round(statistics.stdev(differentials), 2)

    # ------------------------------------------------------------------
    # 8. WHS Index (beste Differentiale)
    # ------------------------------------------------------------------
    @staticmethod
    def calc_whs_index(differentials: List[float]) -> Optional[float]:
        count = len(differentials)
        if count < 3:
            return None

        sorted_diffs = sorted(differentials)

        if count == 3:
            value = sorted_diffs[0] - 2.0
        elif count == 4:
            value = sorted_diffs[0] - 1.0
        elif count == 5:
            value = sorted_diffs[0]
        elif count == 6:
            value = statistics.mean(sorted_diffs[:2]) - 1.0
        elif 7 <= count <= 8:
            value = statistics.mean(sorted_diffs[:2])
        elif 9 <= count <= 11:
            value = statistics.mean(sorted_diffs[:3])
        elif 12 <= count <= 14:
            value = statistics.mean(sorted_diffs[:4])
        elif 15 <= count <= 16:
            value = statistics.mean(sorted_diffs[:5])
        elif 17 <= count <= 18:
            value = statistics.mean(sorted_diffs[:6])
        elif count == 19:
            value = statistics.mean(sorted_diffs[:7])
        else:
            value = statistics.mean(sorted_diffs[:8])

        return round(value, 1)
