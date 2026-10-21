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

- Work in a worktree off `dev` (the user often has another agent on `dev`):
  `git worktree add -b <branch> ../Pana-<name> dev`, then the node_modules
  junction. In Git Bash keep backslashes in single quotes or the target is
  mangled: `cmd //c 'mklink /J C:\...\Pana-<name>\node_modules C:\...\Pana\node_modules'`.
  Unlink it (`cmd //c 'rmdir ...\node_modules'`) before `git worktree remove`.
- Downloads are untrusted: copy each HTML to its own scratch dir and extract the
  last `<script>` with `python -I`. Never run the HTML.
- Pick a short track id (`sabana`, not `gran-sabana`).

## 1. Shared files first (the coordinator owns these)

Register before any port runs: **debug mode loads every registered track, so a
registered id without its module breaks every debug page.** Register, let the
ports write their files, and expect browser tests to fail until every
registered trio exists.

- `public/track-definitions.js`: `{id, name, blurb}` appended at the end.
  The blurb must only promise what survived the port.
- `public/cup-definitions.js` `STANDALONE_TRACKS` and the same list in
  `tests/cup-profile.test.js`.
- `tests/maps.browser.js` ids array.
- `public/music.js`: `TRACK_STYLE` (andina, calipso, gaita, tambor, joropo,
  estadio) and the `songFor` alias map to an existing recorded song
  (`paramo`, `selva`, `plaza`, `bululu`, `salto`, `chichi`...).
- New tree species go in `tracks/coastal-vegetation.js` factories, never as
  meshes inside a world file (Studio library rule).

## 2. One fork per map, in parallel

Each fork writes only its trio and reports shared changes it needs:

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
grade under 0.4; nothing inside the lanes (decals, posts, rocks, light pools);
terrain never pokes through the road; bridge decks equal `roadY`. Raise
`scale` (1.2-1.6) before reshaping a beloved corner.

## 3. Proof

- `npm run check`, `npm test -- derrape conventions`.
- `PANA_MAP_TEST_TRACKS=<id>[,<id>] npm run test:browser -- derrape/tests/maps.browser --fresh`
  (projection, radii, grades, lane clearance, item rows, three AI laps).
- A two-client suite per batch (copy `tests/tovar-galipan-maracaibo.browser.js`).
- Look at it: start `PANA_PORT=84xx PANA_HOST=127.0.0.1 node server/src/index.js`
  in `Pana/`, then
  `node Pana/scripts/derrape-drive-shots.mjs <out> <prefix> <id> 0.1,0.4,0.7`
  and judge against the art direction (bright, playful, cartoon tropical).
- Menu pictures: `node Pana/scripts/derrape-menu-render.mjs <out> <id>[:yaw:pitch:dist]`
  or a HUD-free hero shot from the port; save `images/menu/<id>.webp`
  (1200x800) and `<id>-thumb.webp` (480x320) with Pillow (`quality=80`)
  and add both to `images/menu/sources.json` ("Native render: <id> circuit").

## 4. Docs and merge

- `CHANGELOG.md` under Unreleased, in Spanish, in the players' voice.
- `README.md` circuit count; a `docs/knowledge` doc (or extend the existing one)
  and its line in `docs/knowledge/README.md`.
- Commit on the worktree branch, `git merge dev` (CHANGELOG conflicts: keep
  both entries; `game.js` conflicts: keep both edits), rerun tests, then from
  the main checkout `git merge --ff-only <branch>` and `git push origin dev`.
  Uncommitted files of another agent are fine if they don't overlap.
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
- Known failures unrelated to ports: `drive.browser.js` drift-points check
  (on dev since 2026-10-21); the derrape first-load module cap (160) has
  been at the edge, so check it on dev before blaming a port.
- Under `--jobs 3` a heavy two-client suite can time out once and pass on
  retry; rerun it alone before treating it as a regression.
- Kill the test servers the forks started before removing the worktree, or
  Windows refuses to delete the folder.
