# Bululú notes

The game is in `games/bululu/public/`: `game.js` (turn flow, camera, HUD, minigame
runner), `board.js` (tiles, the shortcut, cart, decor, die, tokens), `island.js`
(landform: heightmap, plateau, hill, river, cliffs, shallows) and `minigames/*.js`.

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
- **The board is a graph, not a loop**: each tile has `next[]`. Tile 19 branches
  into the Atajo del cerro (tiles 30+, toll 5, rejoins at 7). `moveSteps` asks at
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
