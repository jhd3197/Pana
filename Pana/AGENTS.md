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
- Pana Studio at `/studio.html` catalogs existing props, maps, vehicles and
  characters. Register new resources in `web/studio/catalog.js` using their real
  constructors; do not duplicate models in the preview. See
  `../docs/knowledge/pana-studio.md` for the registration and agent workflow.
  Thumbnail images live only in browser IndexedDB. Declare extra factory
  dependencies in the catalog for cache invalidation, and run the studio cache
  browser suite when changing its generation or persistence behavior.
  The vegetation catalog has twenty-two models. New plant factories live in
  `engine/flora-species.js` and are re-exported by `flora.js`; keep their seeds
  deterministic and their ground origin at y=0. Registration does not place
  plants into maps; list actual consumers in `usedBy`.
  Pana landmarks (statues, arch, fountains, kiosk) live in `engine/landmarks.js`
  under the Studio category `Emblemas`. Reuse `capybaraForm` for any new
  four-legged capybara shape. Jungle ruins, bridges and the waterfall live in
  `engine/jungle-props.js` (Studio category `Selva`).
  `capybaraForm` clones a cached continuous sculpt; preserve geometry ownership.
  Shared water motion lives in `engine/water-details.js` and uses absolute time
  so pausing, scrubbing and thumbnail capture agree. Bridge spans accept 4–40 m;
  hollow logs accept 3–20 m. Keep their passages empty and ground origins stable.
  Pueblo 011–020 lives in `engine/pueblo-props.js`; Páramo structures 052–060
  live in `engine/mountain-props.js`. Both use `engine/architecture-kit.js`.
  Frailejón (051) and mountain pine (057) are re-exported by `flora.js` and
  stay in Vegetación. All twenty new models are Studio-only until placed by a
  game. Mountain bridges span 6–40 m, guardrails 2–30 m; their long axis is X.
  Cliff end profiles must match across seeds. The clock and cable car use
  absolute-time `userData.tick(t)`; dispose owned sign textures when released.
- The character sculpt lives in `engine/soft-character/`; `engine/character.js`
  adapts it to saved avatars and gameplay. The full editor stays at
  `/personaje.html`; its old model module URLs only re-export shared sources.
  Games use the lighter sampling profile and must call `character.dispose()`
  when removing a character (detach shared carried props first).
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
  the shared courtyard into a pueblo. Its game-local `tracks/plaza-layout.js`
  owns the street grid and hill; `plaza-town.js` builds blocks independently of
  the racing line. Keep streets and buildings clear as well as the race lanes.
  Selva's `selva-world.js` builds the river valley and shared forest assets;
  `selva-temple.js` sweeps a hollow tunnel along the road. Keep the terrain
  below its driving surface and test the chase camera through both portals.
  `selva-flora.js` composes sixteen shared species by habitat, including all
  twelve additional Studio plants. Keep its footprint clearance, water height,
  and sampled terrain grounding; do not duplicate plant geometry in the map.
  Selva opts into off-road drag through `offroad.js`. Its `selva-driving.js`
  constrains motion against trunks, steep banks and tunnel masonry, while grass
  leaves steering to the driver. Keep the interior ridge's tunnel-exit sightline
  tests and reset environment motion callbacks when rebuilding a track.
  The race island uses expanded geography
  with normal-sized assets. Keep those options opt-in for the original games.
- Characters stand on articulated legs by default. Pass `{ seated: true }` for
  vehicle drivers, `{ chef: true }` for cooking attire, and `walk` / `carry` /
  `run` in `update()` to animate the shared rig.
- Derrape's local race uses two item slots, coin trails and breakable wooden
  crates. Inventory/defense/speed rules live in `games/derrape/public/item-rules.js`;
  `fragments.js` owns reusable prop bursts. See `../docs/knowledge/derrape-items.md`
  for controls, ownership and regression commands. Keep these game-local until
  another game actually needs them. Garage cards render the real vehicle models.
  Garage previews reuse a bounded cache of eight cars and render progressively;
  track browsing selects route metadata without building scenery. `startRace()`
  is asynchronous: await it in browser tests. `?debug&manual` stops only the game
  loop so deterministic tests can still paint loading steps. Keep the last map
  for replay, and preserve cancellation between `buildSteps()` stages.
- Keep dependencies minimal. `ws` on the server; Three.js from CDN on the client.

## Dev workflow (Windows)

```powershell
.\dev.ps1          # start the server (auto-installs deps, resolves busy ports)
.\dev.ps1 check    # syntax-check every .js in server/, web/, games/
.\dev.ps1 setup    # first-run: npm install
.\dev.ps1 studio   # open Pana Studio; reuse the running server
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
