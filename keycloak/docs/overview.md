# keycloak Overview

## Zweck
Realm-Export fuer Keycloak Setup.

## Realm
- Realm: `golf-team-manager`.
- Rollen: `admin`, `captain`, `player`.

## Clients
- `golf-frontend`: public client mit PKCE.
- `golf-backend`: service account fuer Admin API.

## Mapper
- `team_id` wird als Claim ins JWT gemappt.

## Dateien
- `realm-export.json` wird beim Container-Start importiert.
