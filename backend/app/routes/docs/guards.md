# Auth-Guards

## Verfügbare Guards

| Guard | Bedingung | HTTP-Fehler |
|---|---|---|
| `get_current_user` | Beliebiger eingeloggter User | 401 bei fehlendem/ungültigem Token |
| `require_captain` | User hat Rolle `captain` | 403 |
| `require_admin` | User hat Rolle `admin` | 403 |

## Wie `get_current_user` funktioniert

```python
def get_current_user(request, creds) -> CurrentUser:
    # 1. Prüfe request.state.current_user (im Request schon gecacht)
    # 2. Prüfe AuthContext (ContextVar, von Middleware gesetzt)
    #    → kein zweites Token-Decode nötig
    # 3. Fallback: Token dekodieren, AuthContext setzen, cachen
```

Die Middleware setzt `AuthContext` bereits für alle Requests mit Tenant-Kontext.
`get_current_user` liest davon ab – ein Token wird pro Request maximal einmal dekodiert.

## Nutzung in Endpoints

```python
# Jeder eingeloggte User
@router.get("")
def list_players(user: CurrentUser = Depends(get_current_user)):
    ...

# Nur Captain – liefert direkt den CurrentUser zurück
@router.post("")
def create_player(body: PlayerCreate, captain: CurrentUser = Depends(require_captain)):
    captain.team_id  # sicher verfügbar

# Nur Admin
@router.post("/register-team")
def register_team(body: RegisterTeam, _: CurrentUser = Depends(require_admin)):
    ...
```
