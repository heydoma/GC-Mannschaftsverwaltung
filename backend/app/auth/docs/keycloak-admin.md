# backend/app/auth Keycloak Admin

## Zweck
User-Anlage und Rollen-Zuweisung ueber die Keycloak Admin REST API.

## Flow
1) Service-Account Token holen (`client_credentials`).
2) User anlegen mit `team_id` Attribut.
3) Realm-Rolle zuweisen.

## Fehler
- 409 bei doppelter E-Mail.
- 5xx wenn Keycloak nicht erreichbar ist.

## Sicherheit
- Client Secret niemals ins Frontend.
- Token wird gecached und bei Ablauf erneuert.
