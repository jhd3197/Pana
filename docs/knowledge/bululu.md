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
  `/engine/flora.js` (the game's `flora.js` re-exports it for compatibility); the
  shared `/engine/props.js` palm still serves the other games.
- **Sky controls:** Día / Noche / Ciclo, or `L`, saved under
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
