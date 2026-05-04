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
            # Runden aller Spieler des Teams
            cur.execute(
                """
                SELECT
                    p.id, p.name,
                    r.played_on, r.course_rating, r.slope_rating, r.hole_scores,
                    r.differential, r.is_hcp_relevant, r.form_differential
                FROM players p
                LEFT JOIN rounds r ON r.player_id = p.id
                WHERE p.team_id = %s
                ORDER BY p.id, r.played_on ASC
                """,
                (user.team_id,),
            )
            round_rows = cur.fetchall()

            # Matchday-Teilnahmen pro Spieler (Starter + Reserve)
            cur.execute(
                """
                SELECT player_id, COUNT(*) AS matchday_count
                FROM (
                    SELECT unnest(starters) AS player_id FROM matchdays
                    UNION ALL
                    SELECT unnest(reserves) AS player_id FROM matchdays
                ) appearances
                GROUP BY player_id
                """
            )
            matchday_counts: dict[int, int] = {
                row[0]: row[1] for row in cur.fetchall()
            }

    # Spieler gruppieren
    players: dict[int, dict] = {}
    for row in round_rows:
        pid, name, played_on, cr, slope, hole_scores, differential, is_hcp_relevant, form_differential = row
        if pid not in players:
            players[pid] = {"id": pid, "name": name, "rounds": [], "hcp_diffs": [], "form_diffs": []}
        if played_on is not None:
            diff = differential
            if diff is None:
                try:
                    diff = GolfEngine.calc_differential(hole_scores, float(cr), slope)
                except ValueError:
                    diff = None
            if diff is not None:
                fd = float(form_differential) if form_differential is not None else None
                players[pid]["rounds"].append({
                    "differential": float(diff),
                    "form_differential": fd,
                    "played_on": played_on,
                })
                if is_hcp_relevant is not False:
                    players[pid]["hcp_diffs"].append(float(diff))
            if form_differential is not None:
                players[pid]["form_diffs"].append(float(form_differential))

    leaderboard = []
    for p in players.values():
        rounds = p["rounds"]
        diffs = [r["differential"] for r in rounds]
        hcp_diffs = p["hcp_diffs"]
        form_diffs = p["form_diffs"]

        # Momentum: form_diffs verwenden wenn ≥3 Runden mit Par-Daten, sonst HCP-Fallback
        momentum_source = form_diffs[-20:] if len(form_diffs) >= 3 else diffs[-20:]
        form_rating = GolfEngine.calc_form_rating(rounds)
        momentum_data = GolfEngine.calc_momentum(momentum_source)
        consistency = GolfEngine.calc_consistency(diffs)
        whs_index = GolfEngine.calc_whs_index(hcp_diffs[-20:])
        ranking_score = GolfEngine.calc_ranking_score(form_rating, whs_index)

        leaderboard.append({
            "rank": 0,  # wird unten gesetzt
            "id": p["id"],
            "name": p["name"],
            "rounds_count": len(rounds),
            "matchdays_count": matchday_counts.get(p["id"], 0),
            "avg_differential": round(statistics.mean(diffs), 2) if diffs else None,
            "last3_avg": momentum_data["avg_last3"],
            "momentum": momentum_data["momentum"],
            "form_icon": momentum_data["form_icon"],
            "consistency": consistency,
            "current_whs_index": whs_index,
            "_ranking_score": ranking_score,  # intern, wird nach dem Sortieren entfernt
        })

    # Sortierung nach Ranking-Score (ASC = besser), Spieler ohne Score ans Ende
    leaderboard.sort(
        key=lambda x: (x["_ranking_score"] is None, x["_ranking_score"] or 0)
    )
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
        del entry["_ranking_score"]

    return leaderboard
