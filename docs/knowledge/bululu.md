# Bululú notes

The game is in `games/bululu/public/`: `game.js` (turn flow, camera, HUD, minimap,
minigame runner), `board.js` (tiles, the shortcut, cart, decor, dice, tokens),
`island.js` (one smooth heightfield: coast, meadows, plateau, Pico Pana, hill,
river, waterfalls), `flora.js` (tree types + `bake()`), `scenery.js` (neighbor
islands, lighthouse, boats, clouds), `landscape.js` (organic islets and layered
tepuis), `terrain-material.js` (procedural cliff weathering), `beach.js`
(coastal props), `atmosphere.js` (day/night lighting and sky) and `minigames/*.js`.

## Test switches

`?auto` (the AI plays you too), `?speed=3`, `?rounds=2`, `?mini=caigas`
(forces which minigame plays), `?play=atrapa` (skips the board and loops one
minigame), `?debug` (puts `players`, `board`, `MINIGAMES`, `layoutTokens` and
`fastForward` on `window`). With `?debug&auto`, `await fastForward(1200)` in the
console plays a whole game with no rendering, which is the quickest way to catch
flow bugs and check balance.

## Gotchas

- **Browser automation throttles the tab.** When an automated browser isn't
  taking screenshots, the tab gets only a few `requestAnimationFrame`s, so game
  time crawls and `dt` hits its 0.1 s cap. Don't judge AI balance from that.
  Simulate instead: `def.create({players, auto: true})` and call
  `update(1/60, input)` in a loop from the console (see plan 02).
- **Load the font before building the board.** Tiles, signs and pins are canvas
  textures drawn once, so `game.js` does a top-level
  `await document.fonts.load('64px "Luckiest Guy"')` (with a timeout) before
  building anything. `document.fonts.ready` alone resolves too early, since
  nothing in the DOM uses the font yet.
- **The board camera always looks from the front (+Z) at a 3/4 angle**, like the
  box art: `overview` / `mid` / `close` shots in `game.js`. The land rises toward
  the back (plateau, hill), so nothing in front hides the path. Tile text reads
  from +Z. Palms are never placed in a tile's camera line (`inShot` in board.js).
  The big tree on the hill fades out (`board.seeThrough`) whenever it stands
  between the camera and a pana, the camera target, or (in overview) any tile.
  Tab / "Ver tablero" hands the camera to OrbitControls.
- **Tiles sit on the terrain**: a tile's `ground` comes from `baseHeight()` (no
  river carve), so tiles over the river become bridges with stilts. The ground
  mesh is flattened along the path edges, so tiles never sink into slopes.
  Climbs between tiles become stone steps.
- **The board is a graph, not a loop**: each tile has `next[]`. The expanded map
  has 80 main tiles (27 beachfront) and 21 shortcut tiles. Tile 20 branches into
  the Atajo del cerro (tiles 80+, toll 5, rejoins at 48). The shortcut takes 22
  moves versus 28 on the main route. Indices come from nearest control points;
  derive them from `FORK`, never hardcode them in game logic. `moveSteps` asks at
  forks (the AI takes the hill when it reaches the cart sooner). The cart only
  parks beside main-loop tiles with a clear spot (`standSpot(i).bad`), never on
  bridges, and props right under it get hidden.
- **Balance check (fastForward, 10 rounds)**: a cart starting at tile 6 and moving
  at least 5 tiles away gives about one golden mango per pana per game. Starting
  it far away (tile 26) meant nobody bought one in 4 rounds.
- **¡No te caigas! timing**: jump 8, gravity 22, clearance 0.8 means a jump clears
  the log only if it starts 0.12–0.61 s before the log arrives. AI timing must stay
  inside that window (it uses 0.18–0.45, plus a mistake chance that grows over
  time). Re-roll it after every pass, because at high spin speeds there's never
  a quiet moment to re-roll in.
- A minigame module exports `{ id, title, howto, keys, icon, time, create(ctx) }`.
  `create` returns `{ scene, camera, update(dt, {x, jump}), outro(dt, winners),
  scores(), over?(), winners?() }`. The runner handles the intro, countdown,
  timer, prizes and cards.
- **Terrain is one smooth grid** (360×320 world units, ~52k vertices, smooth
  normals, vertex colors blended per vertex). Faceted per-face colors on a radial
  grid read as "diamonds"; don't go back to that. Sand comes from `landMask` (the
  distance to the coast) and the southern `beachMask`. Underwater vertices are colored as
  shallows, and the sea is 80% opaque, so the shore fades out naturally. A flat
  seafloor plane at -6.1 continues past the grid so the open sea has no edge.
- **Bake static scenery** (`flora.js` `bake()`): it merges meshes into one mesh
  per material *look* (not per material object, since `makeMango` makes fresh
  materials every call). That's about 600k triangles and ~1000 draw calls for the
  original island; the foliage/atmosphere pass measured about 897k rendered
  triangles and 386 calls in the initial board view, including shadow rendering.
  Counts depend on camera and avatars. Textured or transparent meshes (signs, the see-through tree) are
  kept as they are. Props that move or animate go in the `keep` group, never in
  `statics`.
- **The sun/moon's shadow box follows the camera target** (`board.follow`), ±60
  units. The island is too big for one fixed shadow map.
- **Foliage now uses smooth normals and vertex colors.** `bake()` must retain
  the color attribute and distinguish vertex-colored, flat/smooth and shadow
  settings in its material key. Bululú's curved palms now live in shared
  `/engine/models/vegetation/` (the game's `flora.js` re-exports it for compatibility); the
  old shared-props palm has been removed. Derrape and minigame stages
  also use the same improved foliage.
- **Sky controls:** Día / Noche / Ciclo in the pause menu's Ajustes tab (Esc), or `L`, saved under
  `pana.bululu.sky`. `?sky=day|night|cycle` overrides the saved preference for
  testing. A cycle takes 600 seconds of board simulation and pauses in
  minigames. Transitions ease through dawn/dusk; changing mode doesn't restart
  the game. Keep `boardCam.far` beyond the 1050-unit sky dome (currently 1800):
  the former 700-unit far plane clipped the old 900-unit sky and stars.
- **Clouds stay outside the camera's orbit.** Their 470–570-unit ring prevents
  transparent billboards from crossing in front of the board. Composite the
  texture's alpha silhouette first, then shade the whole cloud, or every puff
  develops a dark ring. OrbitControls allows a maximum distance of 360 units.
- **Scenic views:** the `Explorar isla…` menu enters free look at the beach,
  waterfall, harbor, or whole island. `Volver` / Tab returns to the active player.
  `MAP_BOUNDS` in `island.js` supplies minimap bounds; expand it with the terrain.
- **Offshore props use the terrain's own height function.** `createIslet` and
  `createTepui` return `{group, heightAt}`. Their forests are instanced and must
  stay outside `bake()`, which merges ordinary meshes only. Angular noise on a
  closed cliff must sample periodic coordinates (sin/cos), not the raw angle,
  or the 0/2π seam opens into visible cracks. The rock shader uses world-space
  grain, sediment bands and streaks without downloaded textures.
- **Expanded-map verification:** all 101 tiles are reachable, above sea level,
  within minimap bounds, and have no unintended crossing edges. The initial
  cart spot (7) is clear; 76 main tiles had safe non-bridge cart destinations.
  Two auto rounds completed through both minigames. The initial view measured
  about 1.52M rendered triangles and 347 draw calls (including shadow passes);
  these are scene counts, not a frame-rate benchmark. Harbor props reserve space
  before vegetation placement, and the pier finds its shoreline from `groundAt`.
- **Moving the cart on a big board**: it now goes 8–24 steps ahead of the panas
  on average (`moveStand` uses `stepsTo`). Picking any tile ≥ 7 away often put it
  just behind everyone, a whole lap off: 1 mango per game and 40–50 unspent
  coins. With "ahead" it's 6–7 mangos per game.
- **Two dice**: a sum of 2–12, doubles give +5 monedas, and a gold counter sprite
  counts down the steps.
- **Minigame order** comes from `rules.minigameBag`: each minigame once per
  pass, shuffled, never the same twice in a row. `?mini=` still forces one.
- **¡Caída! tuning** (simulated, 4 AIs, 40 games): a plain shuffled deck gives a
  caída about 1 card in 13, far too rare for 30 s. Nudging the next card to match
  30% of the time and dealing every 1.15 s down to 0.7 s gives about 7 caídas a
  game. A card counts as a match once 60% through its flip. A match always stays
  up at least 1.05 s, so AI reaction (0.30–0.62 s, ~0.08 s faster by the end) fits
  inside it. Scores may go negative, or spamming Space would cost nothing at 0.
  The rank is painted big on the felt under each spot: the cards' corner numbers
  are unreadable at a party-game camera distance.
- **Spanish cards** live in `/engine/models/props/spanish-cards.js`, shared with
  Caída.
- **¡Un, dos, tres, momia! tuning** (simulated, 150 games): AI reactions must be
  timed from when she *starts* turning, not from the current state's clock. The
  turn → watch hand-off resets `stateT`, and an AI that re-reacts there runs
  straight into a catch. Freezing takes ~0.1 s (velocity eases at 20/s), the
  grace is 0.4 s, AI reacts in 0.12–0.26 s with a 10% chance of being late.
  Speed 1.8 over an 18.5-unit causeway, counts 0.8–2.2 s and looks of 1.4–2.4 s
  give ~19 s games. No fake turn right after another: two in a row let the
  whole field sprint home in 7 s.
- **¡Coleo!** scrolls the world, not the camera: everything has a forward
  distance `s` drawn at `z = -(s - anchor)`, and fences, palms and grass recycle
  every 240 m. That's why `sunnyStage` takes `decor: false` (its fixed palms
  would ride along). The bull is `hatoCow({locomotion: true})`: the farm rig now
  builds running legs for cows as well as horses, keeping the udder and belly
  on the body. The rider is `/engine/models/fauna/farm/llanero-rider.js`.
- **¡Coleo! balance** (simulated, 100 games): pushing overlapping horses only
  sideways froze the riders in their starting left-to-right row, and the end
  seats won 2–3× as often. Near the bull, the horse farther from its line now
  drops back instead, so riders cut behind each other. Tail window 2.5–3.9 m
  behind and ±0.65 m across, bull swerving at 3.4 m/s every 1–1.9 s, a new bull
  18 m ahead: about 8 tumbles a game. `stats()` reports grabs, misses, bulls and
  time anyone was in reach.
- **¡Embuste!** (from the full game, `docs/knowledge/embuste.md`): one of the
  four panas is secretly a mummy, picked at random and possibly you. 19 s of
  cranking winches (a real crank lights that pana's lantern; a mummy's crank
  puffs sand 28% of the time, 63% when cranked within 0.28 s of the last), 8 s
  to vote with ← → and Space, then the verdict. AI panas vote for whoever they
  saw puff most, with a little noise; an AI mummy cranks a bit slower and votes
  for a random pana. Catching the mummy pays every pana 50, plus 50 for voting
  it; an uncaught mummy takes 100. Live chips stay at 0 until the verdict so
  the scores can't give the mummy away. `stats()` reports the mummy, its sand
  and the votes.
- **Aim minigames** export `input: 'aim'`: `minigameInput()` returns
  `{aim: {x, y}, pull, fire}` with `aim` in NDC. The mouse moves the reticle and
  a press pulls; WASD / arrows steer it (0.8 NDC/s, rising to 2.3 over 0.45 s)
  and Space pulls and releases; on touch a drag moves it 3× the finger (a
  finger would hide an absolute reticle) and lifting fires. The pointer
  handlers sit on the canvas only between `bindAim(true)` and the outro, so
  the minimap and board never see them; `mini-aim` on the body hides the
  cursor and the touch buttons, and on phones moves the cards to a slim row
  at the top (at the bottom they covered the wall). A module can return
  `reticles()` and the runner draws one per pana in `#reticles`.
  `setPointerCapture` throws on synthetic events: it's in a try.
- **¡Chinazo!** (`minigames/chinazo-sim.js` + `chinazo.js`): the stone lands
  where the reticle was when it left, 0.25–0.42 s later, and hits the nearest
  thing under that spot *then*, so everything is tested in screen space with
  the sim's own copy of the camera. Tuning (`tests/chinazo.test.js`, 200 runs):
  the plan's AI (0.25–0.5 s to pick, firing within 1.5 radii) let a simulated
  decent human (perfect lead, 0.2 s) win 97%: the game is a reaction race
  for scarce iguanas. What worked: bots pick in 0.22–0.34 s, fire within 0.7
  hitbox radii (at 1.5 most stones missed even a still iguana), track the
  lead point with feed-forward, skip an iguana someone's stone is already
  flying at, and leave one to a pana whose reticle is clearly closer. Seats:
  four home spots made the outer seats win ~30% and the inner ~19% (two
  rivals each); two panas per screen half evens it out; the wall spans the
  whole patio and sunbathers appear on both sides; shooters act in a fresh
  order every frame. Result: 24–26% per seat, the decent human ~35%. Iguanas
  are drawn 2.2× life size with a 1.3× hitbox. The falling iguana rustles
  the leaves 0.5 s before it drops (0.6 s on screen); the AI ignores it.
- **2D minigames** export `input: '2d'`: `minigameInput()` adds `z` (W/S, ↑/↓),
  W stops being jump for them, and the body gets `mini-2d`, which swaps the
  left/jump/right touch row for the kit's `.pk-dpad` plus an action button.
- **¡Choque de carritos!** steers screen-relative (the d-pad points where the
  kart should go, and it turns toward that), not like a car: with a fixed top-down
  camera, relative steering fights the d-pad. The karts are
  `/engine/models/vehicles/cars.js` `CAR_BUILDERS` at 0.72 scale; Derrape's
  `cars.js` joins them to its stats. A kart that drops credits whoever drove
  into it in the last 3 s. Simulated: ~17 knockouts per 45 s game.

- **River minigames** (¡Remada!, ¡Raudal!, ¡Remolino!): their rules live in
  `minigames/river-sims.js` (pure, no THREE) so `tests/river-minigames.test.js`
  plays 200 all-AI rounds each for plan 52's balance rule (every seat wins
  15–35%; nobody-scores runs fail the test). The modules only draw the sims.
  Paddling is Curiara's model (`/engine/paddle.js`): a stroke is `x` reaching
  ±1 (`axisStroke`), so A/D taps alternate. Canoes are
  `/engine/models/vehicles/curiara.js`; `river-stage.js` adds water, banks and
  actors. ¡Remada!: 120 m, AIs finish in ~22–30 s. ¡Raudal!: four parallel
  rapids share one seeded pattern (rocks, mangos, a ledge every 5th row); a
  jump counts .08–.45 s before the ledge, rocks cost a mango and .9 s of stun.
  ¡Remolino!: canoes point outward on their own; the eye grows 1.6→6.5 m and
  the pull 1.2→6.8 m/s, so even good rhythm drifts in by the end. Starting
  in pairs and a swirl of 3.4/r made AIs meet and shove; spaced evenly they
  never touched. ¡Toninas! (2v2 fruit) waits for team support in the runner.
