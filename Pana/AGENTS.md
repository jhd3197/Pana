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
- Escondidas uses a host-simulated round: clients send input/actions inside `v`,
  and the oldest connected client broadcasts snapshots at 20 Hz. The server relay
  is unchanged. See `../docs/knowledge/escondidas.md` for role and recovery rules.
- Cocina also uses a host simulation at 20 Hz (`cocina-v1`). Host migration
  restores the last kitchen snapshot, including orders and active food. See
  `../docs/knowledge/cocina.md`. Plaza scenery and the original hunt layout now
  live in `engine/plaza.js` and `engine/plaza-layout.js`; cooking has its own
  station layout and collision rules. Existing Escondidas paths re-export them.
- Derrape's eight circuits include Plaza Pana and Isla Bululú. All trees come
  from `engine/flora.js`; the obsolete `props.js` palm has been removed.
  `createPlazaEnvironment()` provides scenery without lights, while
  `createIslandEnvironment()` shares Bululú's vegetation, harbor, sea and
  landmarks. Island terrain/scenery/beach modules now live in `engine/`;
  old Bululú paths re-export them. Keep gameplay in the games, and pass route
  clearance to the shared environment instead of copying its assets.
  Race routes are 1.09–2.11 km with bends in both directions. Plaza extends
  the shared courtyard into a pueblo; the race island uses expanded geography
  with normal-sized assets. Keep those options opt-in for the original games.
- Characters stand on articulated legs by default. Pass `{ seated: true }` for
  vehicle drivers, `{ chef: true }` for cooking attire, and `walk` / `carry` /
  `run` in `update()` to animate the shared rig.
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
