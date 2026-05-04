import statistics
from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, get_current_user
from app.db import get_db
from app.engine.golf_engine import GolfEngine

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("")
def get_leaderboard(user: CurrentUser = Depends(get_current_user)):
    if user.team_id is None:
        raise HTTPException(403, "Kein Team zugeordnet.")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.id, p.name,
                    r.played_on, r.course_rating, r.slope_rating, r.hole_scores,
                    r.differential, r.is_hcp_relevant
                FROM players p
                LEFT JOIN rounds r ON r.player_id = p.id
                WHERE p.team_id = %s
                ORDER BY p.id, r.played_on ASC
                """,
                (user.team_id,),
            )
            rows = cur.fetchall()

    # Spieler gruppieren
    players: dict[int, dict] = {}
    for row in rows:
        pid, name, played_on, cr, slope, hole_scores, differential, is_hcp_relevant = row
        if pid not in players:
            players[pid] = {"id": pid, "name": name, "rounds": [], "hcp_diffs": []}
        if played_on is not None:
            diff = differential
            if diff is None:
                try:
                    diff = GolfEngine.calc_differential(hole_scores, float(cr), slope)
                except ValueError:
                    diff = None
            if diff is not None:
                players[pid]["rounds"].append({"differential": float(diff), "played_on": played_on})
                if is_hcp_relevant is not False:
                    players[pid]["hcp_diffs"].append(float(diff))

    leaderboard = []
    for p in players.values():
        rounds = p["rounds"]
        diffs = [r["differential"] for r in rounds]
        hcp_diffs = p["hcp_diffs"]

        weighted_rating = GolfEngine.calc_weighted_rating(rounds)
        momentum_data = GolfEngine.calc_momentum(diffs[-20:])
        consistency = GolfEngine.calc_consistency(diffs)
        whs_index = GolfEngine.calc_whs_index(hcp_diffs[-20:])

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
            "current_whs_index": whs_index,
        })

    # Sortierung: mit Rating zuerst (ASC), Spieler ohne Runden ans Ende
    leaderboard.sort(
        key=lambda x: (x["weighted_rating"] is None, x["weighted_rating"] or 0)
    )
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1

    return leaderboard
