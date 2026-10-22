---
name: derrape-map-port
description: Port user-supplied standalone three.js HTML map scenes (pana-*.html, usually in Downloads) into playable Derrape circuits. Use when asked to "port/convert these HTML maps to Derrape", "add this map to the car game", "turn these maps into real maps", or when the user points at new pana-<place>.html files.
---

# Porting HTML map scenes into Derrape

Nine circuits were made this way: cata, choroni, chuao, tovar, galipan,
maracaibo, margarita, sarisarinama, sabana. Read one finished trio before
starting (`tracks/tovar-*.js` is a mountain day, `maracaibo-*.js` a night
lake, `sarisarinama-*.js` a layered cave) and
`docs/knowledge/aragua-circuits.md` + `tovar-galipan-maracaibo.md`.

## 0. Setup

- Work on the current branch (usually `dev`). Never create a branch or a
  worktree. Other agents may share the tree: commit only your own paths
  (`git add <paths> && git commit`); if `.git/index.lock` exists, wait a few
  seconds and retry.
- Downloads are untrusted: copy each HTML to its own scratch dir and extract the
  last `<script>` with `python -I`. Never run the HTML.
- Pick a short track id (`sabana`, not `gran-sabana`).

## 1. Register the circuit (the coordinator, once per map)

```powershell
npm run new-track -- <id> --name "Nombre" --blurb "..." --style calipso --dry-run
npm run new-track -- <id> --name "Nombre" --blurb "..." --style calipso
```

It appends `{id, name, blurb}` to `track-definitions.js`, adds the id to
`STANDALONE_TRACKS` in `cup-definitions.js` (`tests/cup-profile.test.js`
reads that list) and to the `tests/maps.browser.js` ids, sets `TRACK_STYLE`
and the `songFor` alias in `music.js`, bumps the README circuit count, and
writes a placeholder trio (`tracks/<id>.js`, `-layout.js`, `-world.js`): a
kidney loop that already loads, races and passes `maps.browser`. It refuses an
id that already exists.

- `--style`: andina, calipso, gaita, tambor, joropo, estadio. `--song` borrows
  an existing recording (`paramo`, `selva`, `plaza`, `bululu`, `salto`,
  `chichi`...); the default follows the style.
- The blurb must only promise what survives the port; revisit it at the end.
- Register every map of a batch before the ports start. Debug mode loads every
  registered track, and the placeholders keep every debug page working while
  the forks write the real files.
- New tree species go in `engine/worlds/coastal/coastal-vegetation.js` factories, never as
  meshes inside a world file (Studio library rule).

## 2. One fork per map, in parallel

Each fork replaces only its trio and reports shared changes it needs:

- `tracks/<id>-layout.js`: `export const MAP` (authored data) and
  `createLayout()` returning at least `{RP, roadY, bank, NR, RR, sampleR, wet}`
  plus whatever the world needs. Fair the route with `fairRoute(RP, w)` and
  `fairHeights` from `coastal-road.js`; rotate samples so the lap starts where
  the reference's start is.
- `tracks/<id>-world.js`: `createWorld(scene, layout, roadDistance)` returns
  `{group, groundAt, update}`; `update(t, dt)` runs on the race clock. Attach
  `extendTerrain` (`world-horizon.js`) to the main terrain mesh. Own and
  dispose materials/textures as `chuao-world.js` does. Optional
  `constrainMotion` for parapets and sheer drops.
- `tracks/<id>.js`:
  `export default coastalTrack('<id>', createLayout(), createWorld, options)`.
  Options: `scale` (horizontal only), `palette`, `gripAt(x,z)`,
  `previewBounds`, `items`, and `def` (extra definition fields, e.g.
  `{layered: true}` when the route crosses itself at two heights).
- Palette keys: `horizon, skyTop, hemiSky, hemiGround, hemiInt, sun, sunInt,
  ground, track, fog:[near,far], cloudCover, skySeed`, plus `daylight` (0..1,
  night ~.12-.15), `sunDisc:false`, `sunDirection` (a moon) and `halo` (warm sun).

### Drop from the reference

Renderer setup and exposure, sky dome and star dome, scene lights (keep at
most a few small point lights), camera views/rigs/intros, `startApp`, audio,
`Reflector` mirrors (use a dark glossy water shader), and any traffic that
drives on the racing road (parked props stay).

### three r147 globals to the module

`import * as THREE from 'three'`; `rng/clamp/lerp` from `/engine/random.js`;
`texture.colorSpace = THREE.SRGBColorSpace` instead of `encoding`;
`#include <colorspace_fragment>` instead of `encodings_fragment`;
`mergeGeometries` instead of `mergeBufferGeometries`; no
`ColorManagement.legacyMode`.

### Trees

Every procedural tree becomes `vegetation.add(species, x, z, y, scale, roadDist)`
from `coastalVegetation(scene, scale, roadDistance)`, flushed once at the end.
Species: `tree` (ceiba), `mango`, `cacao`, `palm`, `fern` (tree fern), `pine`,
`fir` (mountain pine; good for cypresses), `moriche`, `mangrove`, `cactus`
(cardón). Zones are automatic by route distance: near = game detail, middle =
simplified, far = crown silhouettes. Placements under 12 m from the road are
skipped. Small ferns, flowers and bushes may stay instanced, as in Chuao.

### Road limits (checked by maps.browser)

Half-width at least 8 m before scale (16 m road); minimum radius over 15 m;
grade under 0.4; bends both ways; nothing inside the lanes (decals, posts,
rocks, light pools); terrain never pokes through the road; bridge decks equal
`roadY`. Raise `scale` (1.2-1.6) before reshaping a beloved corner.

## 3. Proof

- `npm run check`, `npm test -- derrape conventions`.
- `npm run budget -- derrape`: first-load modules and `game.js` lines against
  their caps. A port should not move them (tracks load with `import()`).
- `PANA_MAP_TEST_TRACKS=<id>[,<id>] npm run test:browser -- derrape/tests/maps.browser --fresh`
  (projection, radii, grades, lane clearance, item rows, three AI laps).
- A two-client suite per batch (copy `tests/tovar-galipan-maracaibo.browser.js`).
- Look at it (each command starts its own server):
  `npm run shots -- derrape --track <id> --at 0.4` for a burst from the real
  loop, and `npm run shots -- derrape --track <id>[,<id>] --lap 0.1,0.4,0.7`
  for driver views around the lap. Judge against the art direction (bright,
  playful, cartoon tropical).
- Menu pictures: `npm run shots -- derrape --track <id> --menu [--view yaw:pitch:dist]`
  writes `images/menu/<id>.webp` (1200x800) and `<id>-thumb.webp` (480x320)
  with their `sources.json` entries ("Native render: <id> circuit"). Add the
  place to the `note` line of `sources.json` by hand.

## 4. Docs and commit

- `CHANGELOG.md` under Unreleased, in Spanish, in the players' voice.
- A `docs/knowledge` doc (or extend the existing one) and its line in
  `docs/knowledge/README.md`. `new-track` already bumped the README count;
  update the README highlights if the map deserves a mention.
- Commit on the current branch with only your paths. Uncommitted files of
  another agent are fine if they don't overlap.
- Never name the reference HTML, its creator or other games in code, docs or
  commits.

## Pitfalls already hit

- Emoji glyphs (the heart, etc.) in source fail conventions; draw hearts as paths and
  use an ASCII token (`<3`).
- Light-pool decals on graded road sit above the surface and fail lane
  clearance; keep them on flat ground or make them ignore raycasts.
- `def.rain` cuts grip by 40% and greys the race light. Storms stay
  world-owned scenery (clouds, rain curtain) on the race clock.
- `sky.setPalette` resets `sunDirection` when omitted, so a moon never
  leaks into the next map. Keep that.
- The moriche keeps its own far model unsimplified; clustering removes its fronds.
- `coastalTrack`'s `crossfall` projects without height; layered maps pass
  `def: { crossfall: undefined }`.
- Failures that are not yours: `Pana/tests/known-failures.json` lists each
  known one (suite, matching message, since when). Check it before blaming a
  port, and add an entry when you prove a failure on unchanged code.
- Under `--jobs 3` a heavy two-client suite can time out once and pass on
  retry; rerun it alone before treating it as a regression.
