# Routes – Übersicht

## Alle Endpoints

### Auth (`/api/auth`)

| Methode | Pfad | Rolle | Tenant-Middleware |
|---|---|---|---|
| `POST` | `/api/auth/register-team` | admin | ❌ ausgenommen |
| `GET` | `/api/auth/me` | eingeloggt | ✅ |
| `GET` | `/api/auth/teams` | admin | ❌ ausgenommen |
| `GET` | `/api/auth/my-teams` | eingeloggt | ❌ ausgenommen |

`/api/auth/my-teams` liest `public.team_memberships` für den eingeloggten User und gibt alle Teams mit Rolle zurück. Kein `X-Active-Team` Header nötig.

### Players (`/api/players`)

| Methode | Pfad | Rolle |
|---|---|---|
| `GET` | `/api/players` | eingeloggt |
| `POST` | `/api/players` | captain |
| `DELETE` | `/api/players/{id}` | captain |
| `PATCH` | `/api/players/{id}/role` | captain |
| `POST` | `/api/players/{id}/analyze` | captain |

### Rounds (`/api/rounds`)

| Methode | Pfad | Rolle |
|---|---|---|
| `GET` | `/api/rounds` | eingeloggt |
| `GET` | `/api/rounds?player_id=X` | eingeloggt |
| `POST` | `/api/rounds` | player (nur eigene) / captain (alle) |
| `DELETE` | `/api/rounds/{id}` | captain |

### Leaderboard (`/api/leaderboard`)

| Methode | Pfad | Rolle |
|---|---|---|
| `GET` | `/api/leaderboard` | eingeloggt |

### Courses (`/api/courses`)

| Methode | Pfad | Rolle |
|---|---|---|
| `GET` | `/api/courses` | eingeloggt |
| `POST` | `/api/courses` | admin |
| `PUT` | `/api/courses/{id}` | admin |

### Matchdays (`/api/matchdays`)

| Methode | Pfad | Rolle |
|---|---|---|
| `GET` | `/api/matchdays` | eingeloggt (Spieler sehen nur published) |
| `POST` | `/api/matchdays` | captain |
| `PUT` | `/api/matchdays/{id}` | captain |
| `DELETE` | `/api/matchdays/{id}` | captain |
| `POST` | `/api/matchdays/{id}/publish` | captain |

### System

| Methode | Pfad | Auth |
|---|---|---|
| `GET` | `/api/health` | keine |

## Tenant-Isolation in Queries

Alle Endpoints verwenden `get_db()` – der `search_path` ist automatisch
auf das Tenant-Schema gesetzt. SQL ohne Schema-Prefix findet automatisch
die richtigen Tabellen:

```python
with get_db() as conn:
    cur.execute("SELECT * FROM players WHERE team_id = %s", (user.team_id,))
    # → liest aus tenant_{id}.players, nicht public.players
```

`courses` und `team_memberships` liegen in `public` – werden über den
`search_path`-Fallback (`..., public`) gefunden.

## Tenant-Auflösung (Request-Flow)

```
Request
  │
  ├─ X-Forwarded-Host / Host → public.tenants.host
  ├─ X-Active-Team: {id}     → public.tenants.team_id   ← Multi-Team
  └─ JWT team_id (Fallback)  → public.tenants.team_id
        │
        ↓
  Mitgliedschaft prüfen in public.team_memberships
  → effektive Rolle für diesen Tenant setzen
```

## Erweiterung

1. Neue Datei in `routes/`, Router in `main.py` einbinden
2. `get_db()` für Datenbankzugriff verwenden
3. `user.team_id` in WHERE-Klauseln einbauen (defense-in-depth neben RLS)
4. Guard (`require_captain` / `require_admin`) als Dependency hinzufügen
