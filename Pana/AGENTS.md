# AGENTS.md — how to work in Pana

Pana is a hub of free multiplayer browser games, built largely by AI coding agents.
Follow these rules so every agent (and game) stays compatible with the others.

This file lives in `Pana/Pana/` — the app directory. The repo root (`Pana/`) stays
clean: only `README.md` and `.gitignore` belong there. Everything else lives here.

## Architecture

- `server/` is the only backend (`pana-server`, an npm workspace). It serves the hub
  (`web/`), every game (`games/<name>/public/`), shared code (`/engine/*`), the JSON
  API (`/api/*`) and the WebSocket relay (`/ws`). Read `docs/ARCHITECTURE.md` before changing routing,
  the WS protocol, or the room model.
- `web/` is the hub frontend: game list, live rooms, and "Tu pana" (name + character
  creator). Static, no build step.
- Games live in `games/<name>/`: `game.json` (hub metadata) + `public/` (the client,
  Three.js via CDN import map). A game appears on the hub automatically once
  `public/index.html` exists. No build step. Ever.
- `engine/` holds code shared between games, served at `/engine/*`. Only extract
  something into `engine/` when a second page needs it — don't abstract early.
- Players are panas: every game should use the player's character
  (`/engine/avatar.js` + `/engine/character.js`) instead of a faceless placeholder.
- Browser is the only platform target. Friends join by opening a link; nothing to
  install, nothing to sign up for.

## Conventions

- Default port is **8461** (env `PANA_PORT`). Never hardcode a different default.
- Game names are Spanish words: `derrape`, `bululú`, `trompo`. Lowercase folder names.
- Player-facing strings are in Spanish (Venezuelan flavor welcome); code, comments and
  commit messages in English.
- URLs: hub at `/`, games at `/g/<name>/`, API at `/api/*`, WebSocket at `/ws`.
- Multiplayer model: clients simulate their own entity and broadcast state at ~20 Hz;
  the server relays. Rooms are ephemeral (`${game}:${code}`), max 8 players.
- Keep dependencies minimal. `ws` on the server; Three.js from CDN on the client.

## Dev workflow (Windows)

```powershell
.\dev.ps1          # start the server (auto-installs deps, resolves busy ports)
.\dev.ps1 check    # syntax-check every .js in server/, web/, games/
.\dev.ps1 setup    # first-run: npm install
```

## When you finish a task

- Run `.\dev.ps1 check` (or `npm run check`) and make sure it passes.
- Verify multiplayer changes with a real two-client test, not just a page load.
- If you learned something non-obvious (a netcode trap, a physics tuning value, a
  deployment gotcha), write a short field note in `docs/knowledge/` so the next agent
  doesn't rediscover it.
- Bigger pieces of work start as a numbered plan in `docs/plans/` (Torre-style:
  `NN_kebab-name.md`, scope + files + proof). Update its status when done.
- Update this file if you change anything it documents.
