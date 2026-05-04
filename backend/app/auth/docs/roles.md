# Rollen & Berechtigungen

## Keycloak Realm-Rollen

| Rolle | Vergabe | Befugnisse |
|---|---|---|
| `admin` | Manuell in Keycloak | Teams registrieren, alle Teams einsehen |
| `captain` | Beim Team-Anlegen (permanent) oder per `/api/players/{id}/role` | Spieler verwalten, alle Runden im Team, Rollen-Änderungen |
| `player` | Standard bei User-Anlage durch Captain | Nur eigene Runden eintragen |

## Rollen-Hierarchie

Ein User kann `captain` und `player` gleichzeitig haben – die `primary_role`
entscheidet bei RLS-Checks:
- `captain` hat Vorrang
- Wird als `app.user_role` in die PostgreSQL-Session-Config geschrieben

## Guards in FastAPI

```python
# Liest aus AuthContext (ContextVar), kein extra DB/Keycloak-Aufruf
user = Depends(get_current_user)   # jeder eingeloggte User

# Wirft 403 wenn Bedingung nicht erfüllt
captain = Depends(require_captain)
admin   = Depends(require_admin)
```

## Captain-Schutz

- Ein Captain kann sich nicht selbst zum Player degradieren
- Das letzte Captain-Konto im Team kann nicht entfernt werden
  (Prüfung über Keycloak-Rollenliste aller Team-User)

## Rollen-Änderung

`PATCH /api/players/{id}/role` (captain only):
1. Prüft ob Ziel-User im eigenen Team ist
2. Holt aktuelle Rollen aus Keycloak
3. Entfernt alle `player`/`captain`-Rollen
4. Setzt neue Zielrolle – atomar, kein Zwischenzustand
