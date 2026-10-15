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
  Circuit previews expose their existing track runtime as `route` for Studio's
  `track-tour.js`: user-started playback follows the start line, road and ramps.
  Preserve pause/scrub/copy-point behavior, restore overview on exit, and reset
  tour state on asset changes. Keep this camera tool separate from race state.
  See the circuit walkthrough section in the Studio knowledge note for proof.
  Thumbnail images live only in browser IndexedDB. Declare extra factory
  dependencies in the catalog for cache invalidation, and run the studio cache
  browser suite when changing its generation or persistence behavior.
  The vegetation catalog has twenty-two models. New plant factories live in
  individual files in `engine/models/vegetation/`; keep their seeds
  deterministic and their ground origin at y=0. Registration does not place
  plants into maps; list actual consumers in `usedBy`.
  Pana landmarks (statues, arch, fountains, kiosk) live in `engine/models/props/monuments.js`
  under the Studio category `Emblemas`. Reuse `capybaraForm` for any new
  four-legged capybara shape. Jungle ruins, bridges and the waterfall live in
  `engine/models/props/jungle.js` (Studio category `Selva`).
  `capybaraForm` clones a cached continuous sculpt; preserve geometry ownership.
  Shared water motion lives in `engine/models/effects/water-details.js` and uses absolute time
  so pausing, scrubbing and thumbnail capture agree. Bridge spans accept 4–40 m;
  hollow logs accept 3–20 m. Keep their passages empty and ground origins stable.
  Pueblo 011–020 lives in `engine/models/props/pueblo.js`; Páramo structures 052–060
  live in `engine/models/props/mountain.js`. Both use `engine/models/core/architecture-kit.js`.
  Frailejón (051) and mountain pine (057) are exported by their vegetation modules and
  stay in Vegetación. Several Pueblo and Páramo models now appear in Derrape;
  keep Studio consumer metadata aligned with actual placements.
  Mountain bridges span 6–40 m, guardrails 2–30 m; their long axis is X.
  Cliff end profiles must match across seeds. The clock and cable car use
  absolute-time `userData.tick(t)`; dispose owned sign textures when released.
  Llanos 041–050 and Desierto 061–070 live in `engine/models/props/ranch.js` and
  `engine/models/props/desert.js`, with construction details in `models/core/rural-kit.js`.
  Their Studio categories each contain ten models. The giant cardón reuses the
  existing cactus sculpt; keep the smaller Cardón entry in Vegetación.
  Gates span 3–24 m and expose `userData.setOpen(0..1)`; fences span 2–30 m
  along X. Rock arches span 4–28 m. Keep gate, stable, arch, tire and well
  openings usable. The wind pump and puddle use absolute-time ticks; keep the
  water shader outside static batches. The rebuilt Llanos and Desierto circuits
  each use all ten models from their respective pack. Their game-local
  `*-layout.js` modules own routes and terrain; `*-world.js` owns placements.
  `country-details.js` supplies swept bridge decks, road shoulders and grasses.
  `engine/models/fauna/farm/` supplies the Fauna horse, chicken and cow, used in Los
  Llanos. Their SDF core is MIT code in `engine/vendor/procedural-animals/`;
  preserve its license and source attribution. Factories return owned native
  skinned meshes with absolute-time `userData.tick(t)` and an idempotent skeleton
  `userData.dispose()`. Keep animals outside static batches and racing lanes.
  See `../docs/knowledge/procedural-farm-animals.md` for parameters and proof.
  `engine/models/fauna/` supplies the Fauna macaw, scarlet ibis, soaring vulture and
  natural capybara. Each species has its own module; the shared flight rig and
  `models/animation/orbit-bird.js` are separate. `capybaraForm` lives in
  `models/fauna/capybara/shape.js`, independent of monuments. Selva uses one macaw/one capybara; Llanos four ibis/three
  capybaras; Desierto two vultures. Keep flight roots outside static batches,
  preserve +Z tangent heading and absolute-time ticks, and reuse `capybaraForm`.
  Fauna now has ten entries (nine animals plus a fish school). The current source
  inventory, uncataloged/legacy ledger and priorities live in
  `../docs/knowledge/model-inventory.md`; regenerate it with
  `scripts/audit-inventory.browser.js` after updating `scripts/inventory-notes.js`.
  `engine/models/fauna/aquatic/` supplies Pana-authored fish and schools to both islands.
  Keep their whole swimming envelope below waves and above the seabed, and pass
  path clearance to `placeReefSchools` in `engine/placement/reef-schools.js`. Do not bake animated fish. The Studio
  island preview uses the full Bululú board, including scenery and paths.
  `engine/models/props/coastal.js` adds nine `Costa` models. The Fauna crab lives in
  `models/fauna/beach-crab.js`; terrain grounding in `engine/placement/beach-crab.js`.
  All ten appear in the Bululú circuit; eight types also appear on the board
  island. Keep buoys/crabs outside static batches and tick absolute time.
  Boat origins are at the keel: placements sit 0.32 m below mean water.
  Reserve land furniture before scattering plants; keep dock cargo on its
  actual deck height. See `../docs/knowledge/coastal-props.md` for coverage/proof.
  See `../docs/knowledge/map-asset-rollout.md` for actual map coverage and the
  remaining Studio-only models. New Plaza garden props must stay outside player
  movement bounds; the race town supplies separate road-safe positions.
  Llanos' connected water uses the terrain's grid and signed bed depth to avoid
  coplanar pond seams; keep both bridge channels below the racing road.
  See `../docs/knowledge/llanos-desert-props.md` for parameters and proof.
  Chi Chi's five thermal landmarks live in `engine/models/props/thermal.js` and the
  Studio category `Termales`. `models/effects/thermal-steam.js` uses instanced camera-facing
  quads, seeded phases and absolute time. Keep its shader culling bounds broad;
  `group.userData.previewBounds` supplies a tighter Studio framing box. Tick the
  live shader material because Studio clones materials. Own ripple/steam material
  disposal, and do not bake animated roots into static batches.
  `engine/models/effects/water-surface.js` supplies animated oceans, directional rivers, canals
  and ponds to Derrape and Studio. Its depth textures use actual sampled terrain;
  update the live shader material and dispose cloned uniform textures too.
  Environment owners compose `waterAnimator(group)` with their existing update;
  scenery water is already collected by the track runtime. Keep animated water
  outside static batches and preserve pond surface height inside a wrapper group.
- The character sculpt lives in `engine/models/characters/pana/`; `engine/character.js`
  re-exports `models/characters/pana/avatar-model.js`, which adapts it to saved
  avatars and gameplay. The full editor stays at
  `/personaje.html`; its old model module URLs only re-export shared sources.
  Games use the lighter sampling profile and must call `character.dispose()`
  when removing a character (detach shared carried props first).
- Pause menus and settings are shared: `engine/ui.js` (`createGameMenu`) plus
  `engine/settings.js` (`pana:settings`: sound, volume, resolution, hints).
  Every game and the hub use them. Do not write a per-game pause overlay, sound
  toggle or invite flow, and do not handle Escape in a game. Mark keyboard
  reminders with `data-pana-hint`. See `../docs/knowledge/pana-ui.md`.
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
- Derrape's eight circuits include Plaza Pana, Isla Bululú and Chi Chi. Playa
  is now a sector of the Los Roques-inspired race island; legacy `playa` IDs
  resolve to `bululu`. All trees come
  from `engine/models/vegetation/`; `engine/flora.js` is a compatibility barrel.
  `createPlazaEnvironment()` provides scenery without lights, while
  `createIslandEnvironment()` shares Bululú's vegetation, harbor, sea and
  landmarks. Island terrain/scenery/beach modules now live in `engine/`;
  old Bululú paths re-export them. Keep gameplay in the games, and pass route
  clearance to the shared environment instead of copying its assets.
  Race routes are 1.14–4.88 km with bends in both directions. Plaza extends
  the shared courtyard into a pueblo. Its game-local `tracks/plaza-layout.js`
  owns the street grid and hill; `plaza-town.js` builds blocks independently of
  the racing line. Keep streets and buildings clear as well as the race lanes.
  `plaza-waterfront.js` adds Casas Botes and the Maracaibo-inspired bridge.
  The race island has its own light coastal terrain; the original Bululú
  board world stays independent. `world-kit.js` batches static landmarks and
  spatially instances shared flora. Do not pass instances through `bake()`.
  Páramo and Chi Chi use elevated, continuous roads over carved terrain;
  keep waterways below the road and inspect actual chase-camera views.
  Chi Chi now spans 195 m of elevation, with springs, mountainside switchbacks,
  forest, a dive village and river bridges. Its thermal shelf and bridge channels
  use the optional post-carve terrain cut. Wet grip is opt-in through `def.gripAt`
  and `roadGripAt()`; preserve dry defaults and normal road confinement elsewhere.
  Bululú's `bululu-tide.js` shares one absolute-time wash front between visible
  geometry and `def.waterAt(x,z,time,T)`. Use race time for grip, drag and tire
  spray; preserve at least 9.5 m of dry center at peak tide. This is an opt-in
  flooded edge, not a moving collision wall. Track cleanup collects disposers
  before invoking them because character disposal detaches scene children.
  See `../docs/knowledge/venezuela-circuits.md` for construction and validation.
  Selva's `selva-world.js` builds the river valley and shared forest assets;
  `selva-temple.js` sweeps a hollow tunnel along the road. Keep the terrain
  below its driving surface and test the chase camera through both portals.
  `selva-flora.js` composes eighteen shared species by habitat, including the
  giant jungle tree and tropical bush. Keep its footprint clearance, water height,
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
- For library structure or registry changes, run
  `node engine/tests/model-architecture.test.js` and the corresponding browser
  suite. Preserve compatibility export identity and selective thumbnail invalidation.
- Update this file if you change anything it documents.
