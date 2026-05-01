# backend/app Overview

## Zweck
Kernpaket der FastAPI-App: Routing, Auth, DB-Zugriff und Engine.

## Struktur
- `main.py`: App-Setup und Router-Registrierung.
- `db.py`: DB-Connection Helper.
- `auth/`: Token-Validierung und Role-Guards.
- `routes/`: REST Endpoints.
- `engine/`: Berechnungslogik.

## Request-Lifecycle
- Router ruft Endpoint.
- Auth-Dependency validiert Token.
- Rollencheck erlaubt/verbietet Zugriff.
- SQL-Query mit `team_id` Filter.
- Response wird serialisiert.

## Erweiterung
- Neuer Endpoint in `routes/`.
- Optionaler Role-Guard in Signatur.
- SQL mit `team_id` filtern.
- Frontend-API in `frontend/src/lib/api.ts` ergaenzen.
