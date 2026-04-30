from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import auth, players, rounds, leaderboard

app = FastAPI(title="Golf Team Performance API", version="0.1.0", redirect_slashes=False)

# CORS – erlaubt lokalen Vite-Dev-Server und spätere Deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router einbinden
app.include_router(auth.router)
app.include_router(players.router)
app.include_router(rounds.router)
app.include_router(leaderboard.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
