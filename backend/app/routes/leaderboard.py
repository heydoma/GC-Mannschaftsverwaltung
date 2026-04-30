import statistics
from fastapi import APIRouter

from app.db import get_db
from app.engine.golf_engine import GolfEngine

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("")
def get_leaderboard():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.id, p.name,
                    r.played_on, r.course_rating, r.slope_rating, r.hole_scores
                FROM players p
                LEFT JOIN rounds r ON r.player_id = p.id
                ORDER BY p.id, r.played_on ASC
                """
            )
            rows = cur.fetchall()

    # Spieler gruppieren
    players: dict[int, dict] = {}
    for row in rows:
        pid, name, played_on, cr, slope, hole_scores = row
        if pid not in players:
            players[pid] = {"id": pid, "name": name, "rounds": []}
        if played_on is not None:
            try:
                diff = GolfEngine.calc_differential(hole_scores, float(cr), slope)
                players[pid]["rounds"].append({"differential": diff, "played_on": played_on})
            except ValueError:
                pass

    leaderboard = []
    for p in players.values():
        rounds = p["rounds"]
        diffs = [r["differential"] for r in rounds]

        weighted_rating = GolfEngine.calc_weighted_rating(rounds)
        momentum_data = GolfEngine.calc_momentum(diffs)
        consistency = GolfEngine.calc_consistency(diffs)

        leaderboard.append({
            "rank": 0,  # wird unten gesetzt
            "id": p["id"],
            "name": p["name"],
            "rounds_count": len(rounds),
            "weighted_rating": weighted_rating,
            "avg_differential": round(statistics.mean(diffs), 2) if diffs else None,
            "last3_avg": momentum_data["avg_last3"],
            "momentum": momentum_data["momentum"],
            "form_icon": momentum_data["form_icon"],
            "consistency": consistency,
        })

    # Sortierung: mit Rating zuerst (ASC), Spieler ohne Runden ans Ende
    leaderboard.sort(
        key=lambda x: (x["weighted_rating"] is None, x["weighted_rating"] or 0)
    )
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1

    return leaderboard
