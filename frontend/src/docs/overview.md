# frontend/src Overview

## Zweck
Zentrale UI-Schicht: Layout, Routing, Styles und Seiten.

## Struktur
- `App.tsx`: Layout und Routes.
- `index.css`: Theme und globale Styles.
- `pages/`: Screens.
- `lib/`: Auth und API.
- `components/`: UI-Bausteine.

## Rollen-Logik
- Sichtbarkeit und Zugriff werden im Router per Guards gesteuert.
