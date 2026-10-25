# Garage and race loading

## Staged GPU preparation

`public/prepare-race.js` loads on race entry, keeping the garage's static graph
at its existing cap. It decodes and uploads textures needed by the starting
camera(s) or their sun-shadow casters, yields after an upload batch exceeds 6 ms,
compiles the scene's shader variants, and warms visible geometry in batches of
48 renderable objects. The final complete frame precedes the countdown. Progress
labels describe those real stages; image failures retain the renderer fallback.

Warming an entire circuit's offscreen forest increased cold loading in the
initial experiment. Only the starting views and shadow casters belong on this
critical path. A renderer-scoped WeakMap reuses preparation of unchanged objects
on replay; material versions, replaced geometry and shadow-quality changes
invalidate it. This does not promise that an individual large upload fits 6 ms
or remove CPU stalls during world/car construction.

Partial draws use layer masks rather than visibility: a mesh can parent another
mesh, and hiding the parent would skip its children. Preserve hidden ancestors,
restore masks/culling/scissor/shadow flags in `finally`, and restore everything
before yielding. Cancellation can dispose racers or begin another load during
any yield. Recheck cancellation after image decoding and shader compilation.
The shared `engine/game-load.js` and garage preparation remain unchanged.

The approach was informed by `billpwchan/sakura-fantasy`'s `src/main.js`
warmup (reference commit `3d367e92331b70118cfaa728dc7b8bc4bb4da009`), adapted
to Pana's Three.js r160, cancellation, split views and existing quality controls.
No upstream renderer-private APIs or asset dependencies are used.

`tests/snow-loading.browser.js` exercises real GPU preparation, cancellation,
renderer failure, hidden objects, distant geometry exclusion and replay reuse.
`tests/loading.browser.js` retains the full menu/retry/map lifecycle proof.

An isolated local comparison used headless Chromium, 1280 × 800, Baja and the
same snow-enabled Páramo scene, replacing only the preparation function with
the former compile-and-single-render sequence. Cold total loading was 6.48 s
for the single draw and 6.91 s for staged preparation; replay was 2.87 s and
3.09 s. The final render-call CPU duration fell from 337 ms to 10 ms (replay:
290 ms to 8 ms). These are single-run diagnostics of a smoother reveal, not
GPU-completion timings, sustained FPS, or a total-loading speedup. The upload
batches still contain occasional long tasks, and scene construction remains
the largest uninterrupted work.

## Benchmark: before/after on one machine

`npm run bench -- --base <ref> [--maps a,b] [--throttle 4] [--drive 40]`
(`tests/bench.proof.js`) serves the base commit from a temporary worktree
and the working tree side by side, then per map measures the time to the
first race frame; at route fractions 0, .33 and .62 with an 8-car grid the
draw calls, triangles, GPU time (timer query) and CPU submit time, in
alternating rounds so background load hits both; an autopilot drive's p95,
worst frame and freezes over 50 ms (optionally with the CPU throttled);
and scenery-only screenshots (cars and HUD hidden, since base and head may
pick different rivals) compared per pixel. Results and side-by-side look
sheets go to `art/bench/<time>/`.

Quote draws, triangles and freezes as the portable numbers; milliseconds
compare only within one run. The machine here usually carries other load:
always compare base and head from the same run, never across runs.

## First-lap hitches: vessels are built behind the cover

On gate maps every racer's lancha or avioneta used to be built on the
approach to its gate (`lanchaFor`/`planeFor`). Each vessel sculpts a whole
new pana and compiles its shaders: 300–490 ms per racer on a Ryzen 9 7950X,
so lap 1 of Chuao froze once per racer on the climb to the waterfall, then
ran smoothly. `gatesApi.prebuild(c)` now builds them during loading; the
start sequence keeps them in the scene (at their hidden 0.001 scale) while
`prepareRace` warms them, then compiles again after restoring solid
materials. Cars turn translucent at GO (start grace), which clones every
material: those variants are compiled during loading too, by flagging every
car as a ghost for the warm-up.

These stalls are invisible to `renderer.info` (no new programs, geometry or
textures that frame). Drive real autopilot laps (`?debug&auto`) and log
frame intervals per lap; a CPU profile of the long frames showing
`onFirstUse`/`getProgramInfoLog` marks a lazy shader compile, and
`buildCharacter` under a frame marks lazy construction. After the change,
Chuao laps 1–3 have no frame over 50 ms (before: five 300–490 ms freezes on
lap 1); a ~100 ms frame remains during the countdown.

Rival vessels do not sculpt a pana at all: `cardStandIn(car)` re-hangs the
car's driver card under a frame that undoes the car's seat transform, and
the lancha/avioneta builders seat it through their optional `pana` option.
Only the player's vessel builds a real pana (Chuao: 8 → 5 panas in the
scene, ~300 ms less loading per rival on gate maps).

## First load and the frame loop

Opening Carreritas loads 153 modules, down from 287: maps load on demand
(`tracks.js` `loadTrack`, see `carreritas-tracks.md`). `tests/conventions.test.js`
caps every game's first load at 160 static modules (`tests/import-graph.js`).

`frame()` runs fixed 1/60 s physics steps with `updateRace(STEP, false)` and
then `presentRace(dt)` once for the time they covered: poses, camera, scenery
ticks, HUD and minimap. `physicsFrame` consumes up to 250 ms of elapsed time
in fixed steps and retains the fractional remainder. The former five-step
cutoff discarded time below 12 FPS, slowing a struggling player's car.
Frames from 4 through 144 FPS now cover the same simulation duration;
longer stalls remain capped to avoid unbounded work after tab suspension.
Online races bypass local slow-motion as before. HUD text is
written only when it changes (`setText`). The minimap strokes its route once
into an offscreen canvas (`route-map.js`). Car physics live in `drive.js`
(`createDriver`), sky, sun and weather in `race-world.js`, and other panas'
pose buffers in `remote-cars.js`.

`DrivingSpring` substeps suspension/head motion at no more than 1/60 s so
presenting a 250 ms frame cannot destabilize the former Euler springs.
`frame-timing.test.js` compares simulation duration and spring motion across
rates; `slow-frame.browser.js` injects 125 ms deltas into the real animation
loop and checks driving and bounded suspension. It is a timing regression,
not a measurement of device FPS.

## Shared quality now controls race detail

Grass, canopy and bark surfaces also follow these tiers. The seeded shaders
reuse existing draws, bypass detail on Baja, and filter fine patterns by pixel
footprint. See [nature-surfaces.md](nature-surfaces.md) for geometry tags, material
ownership and Studio cloning.

The game-local `quality.js` listens to the existing shared settings. Alta uses
2048-square sun shadows, 1,400 weather streaks and all optional race detail;
Media uses 1024-square shadows, 700 streaks and road wear; Baja disables shadows,
uses 280 streaks and hides optional road wear/pennants. Weather CPU iteration
and splash frequency scale with the active streak count. Gameplay surfaces,
colliders, item positions, physics ticks and the 20 Hz pose cadence do not change.

Quality updates apply live and after map loading. Replacing shadow size releases
the old render target. Race-specific code does not alter global quality semantics
for other games. This is not automatic internet-quality detection or an FPS
guarantee. The prior hardware measurements below describe the previous revision.

### Forest quality

`forestQuality` in the coastal forest helper keeps one forest tier attached
to the scene. Nítida preserves the authored near/middle/far geometry.
Equilibrada uses the middle model for roadside trees; Rápida uses distant
silhouettes throughout, with trunks retained outside dense distant stands.
Fronds, conifers and species that cannot survive clustering retain their
existing silhouette exceptions. All tiers keep the same tree transforms.
Rápida also uses cells at least 240 world metres wide to reduce draw calls.
This covers coastal vegetation, library forest recipes and background forests;
individually authored landmark trees remain outside this policy.

Tiers are built on first selection and cached for later switches. Only the
active tier participates in scene traversal. Nature materials register a
preparation callback for newly created tiers, reusing the track's shader and
snow uniforms. Map teardown disposes inactive geometries explicitly while the
normal teardown releases active geometry; model-library materials remain shared.
Each tier's InstancedMeshes also emit their disposal event to release instance
matrix buffers, including those in the active tier.
The forest-quality browser suite checks tree transforms, geometry/draw reduction,
live restoration, material coverage and all-tier disposal on map replacement.

For a subset selected through `PANA_MAP_TEST_TRACKS` or `PANA_TOUR_TEST_TRACKS`,
point `PANA_PASS_CACHE` at a temporary file. The normal suite fingerprint does
not include those environment selectors; a partial run must not cache a full
map or Studio tour pass.

Road aggregate is generated in the existing road shader. Quality uses a uniform
to scale or disable it without recompiling. No new texture is fetched or allocated.

The October 2026 profile found three costs on the menu's critical path: all eight
thumbnail cars were constructed/rendered synchronously before the first garage
frame, every selection rebuilt the driver, and track selection constructed the
entire environment even though the garage never displays it.

Driver construction spent most of its time in `action-outfits.js` raycasting
each garment's triangles at 1,353 depth-grid samples. `cloth-front.js` now
rasterizes triangles into that identical grid, visiting only covered samples.
The reference browser test compares every sample for hoodie, tropical and sport
in both game and studio quality. Maximum observed error was below 6e-16. Keep
this equivalence test if changing cloth fitting; changing density is unnecessary.

The garage displays its first car immediately, without waiting for fonts, other
cars or a map. All eight buttons are available immediately. Thumbnails borrow
the bounded garage car cache, restore each model's parent, and draw one per
paint when the player is idle. They pause during interaction, loading, racing
and hidden-tab time. Race cars remain separate because their pieces detach.
The garage uses a 1024-square shadow map for its small turntable.

Track browsing caches route mathematics and updates text only. Loading builds
the chosen environment through `T.buildSteps()`, then creates racers one at a
time, compiles shaders and renders the first frame before starting the countdown.
`T.build()` consumes the same stages synchronously for Studio and geometry tools.
Only the current built map is retained. Replay reuses it, including after browsing
another map and coming back. Cancelled partial builds are discarded on retry;
a generation counter prevents an old load from entering the race after cancel.

`startRace()` returns a promise. Tests must await it, or wait for the `count`
state after clicking Play. Use `?debug&manual` to step simulation explicitly;
do not replace requestAnimationFrame, which the loading UI also needs.

Local Chromium measurements (1440 × 900; not a device-independent guarantee):
the original startup wait was about 18 seconds; the revised first-render
submission mark was about 1.9–2.1 seconds (browser readiness observed within
roughly 2–4 seconds). Warm car construction fell from roughly 830 ms to 170–190
ms. Thirty-two selections of cached cars took about 1.1 ms total in JavaScript;
24 track selections took 61 ms without constructing any scenery. Full loading
still includes geometry uploads and shader compilation, so CPU construction
timings must not be presented as total time to the first playable frame.

Regression commands, against `npm start`, using optional `PANA_PLAYWRIGHT_PATH`
and `PANA_BROWSER_PATH` for an external test runtime:

```powershell
node Pana/engine/tests/cloth-front.browser.js
node Pana/games/carreritas/tests/loading.browser.js
node Pana/games/carreritas/tests/items.browser.js
node Pana/games/carreritas/tests/maps.browser.js
npm run check
```

The loading suite covers actual orbit input, all eight thumbnails, rapid car and
track selection, cancellation before/partway through construction, replay reuse,
retry after cancellation, and recovery from constructor failure. Screenshots and timings are saved in ignored
`art/performance/` (or `PANA_TEST_ARTIFACTS`).

### Repeated Grand Prix resource ownership

Canvas signs/start banners/chevrons and individual car flags own textures;
geometry disposal alone does not release those GPU allocations. Collect
callbacks before traversed children can detach, retain owned car materials even
when parts break off, and release maps as well as materials. `ownedMap` marks
per-instance flag materials; cached vehicle plates/roundels stay shared.

Compare the same warmed garage after evicting the last race world: different
finish cameras upload different subsets of retained terrain. The lifetime suite
runs three real Agua cups, including split/mirror, then compares geometry,
texture, document/window listener and interval counts. It also cancels loading.

### Full-grid car rendering

Hardware profiling of the new worlds found rendering, rather than the roughly
1 ms gameplay update, dominated eight-car frames. `racer-render.js` combines
opaque sibling parts after painting, before the race records resource ownership.
Equivalent solid-color trim stores its exact linear colors per vertex. The
primary body paint retains its material color for customization and inspection.
Every pivot and the entire animated pana hierarchy remain separate; transparent
glass, mapped materials, custom shaders, partial draw ranges and morphs retain
their original rendering. Garage and shared vehicle constructors are unchanged.

The pixel comparison in `racer-render.browser.js` covers all eight cars in a
steered/suspended pose, verifies unchanged triangles and precise world bounds,
and exercises a detachable part. Original meshes fall from 225–259 to 173–184
(including hidden wardrobe geometry); mean pixel-channel differences stay below
0.002 out of 255. Batched materials belong to the racer and must be disposed
alongside its geometries, including after ghost-material clones are released.

`water-performance.proof.js` explicitly requires a hardware renderer and records
the renderer, viewport, quality, loading time, p50/p95 RAF intervals, CPU update
and render time, draw calls and live resources. Its smaller viewport remains a
desktop GPU measurement. The physical Android benchmark was waived by the user;
mobile layout/touch tests must not be described as measured phone frame rates.

The four water worlds use 190 m spatial vegetation cells. Profiling found their
95–120 m cells spent more CPU submitting small batches than they saved in GPU
work on the reference desktop. The larger bounded cells retain the same seeds,
placements and plant counts; they submit some extra off-screen triangles but
fewer draw calls. Keep the 1.8M whole-environment triangle limit and ray tests.

### Rival drivers: cards, trims and shadows

The shared pana is sculpted for Studio close-ups: 31 meshes and ~39k
triangles, 83 % of a racer, with centimetre catchlights and creases that
each cost a draw and a shadow draw. A knockout test (hide one category,
time the frame) showed cars, not trees, dominate the start grid: Selva went
from 2,185 to 896 draws and 22 to 9 ms CPU with the cars hidden.

- `trimDriver` (every racer): hides parts under 6 cm, lets only parts of
  25 cm or more cast shadows, swaps MeshPhysicalMaterial for an equivalent
  MeshStandardMaterial. −340 to −420 draws at an 8-car grid.
- `driver-cards.js` (rivals only, loaded with `import()` so the impostor
  baker stays out of the first load): the seated pose is baked as a 128 px
  impostor riding the seat. The real pana returns within
  `DRIVER_CARD_FROM` (14 m) of any camera, and the rig is not animated
  while carded. The player's own pana is never carded, which keeps the
  cockpit view possible. −160 to −280 draws, CPU −10 to −25 %.
- `trimShadows`: a rival's six largest pieces cast shadows, the player's car
  twelve (its own shadow is always in view). −160 to −200 draws at the grid
  for rivals, 40 → 12 shadow draws for the player; shadows look the same.
- `farCar` (rivals): the body, cabin and wheels merged into one
  vertex-coloured mesh on the tumble's inner group, shown once every camera
  is more than `CAR_FAR_FROM` (35 m) away and the racer is on wheels. A
  rival's ~20 visible parts become one draw and one shadow caster; the card,
  detachables, danglers, flag and glass stay separate. 0.5/255 per channel
  from the real car at 40 m.

### Static props: instances, merges and colour batches

Draws attributed by named group (main pass, `onBeforeRender` counts) found
the props: Llanos' shortcut planks were 126 draws, bend boards up to 57,
barrels/crates ~20, and baked props kept one draw per paint colour.

- `plankRoad` merges with `bake` (driving reads the analytic `plankAt`).
- `chevrons` keeps a named marker per sign (`bend-chevron-board`,
  `userData.s`) and draws posts and boards as three instanced meshes.
- Breakables move through Object3D proxies drawn by `proxyInstances`
  (exported from items.js, as the coins).
- `bake(root, { tint: true })` lets plain standard materials that differ
  only in colour share a batch, with each mesh's linear colour in its
  vertices; Carreritas' `finish` uses it. Scenery shots with it on and off
  match to the pixel (Llanos' hacienda yard 61 → 26 draws, arepera 39 → 22).
- Estadio's ~26 parked cars use `farGrove`: real within 45 m of the route,
  baked cards beyond. The smooth cars are ~35k triangles each without a
  driver, which had taken Estadio's overview from 1.23 M to 2.69 M.

### Loading: where the seconds go

CPU profiles of a race load (track build + `startRace`) on the reference
desktop: Plaza 8.3 s, Selva 6.1 s, Llanos 5.5 s. Shader compiles that block
the main thread were ~0.3 s once the driver's cache is warm; the rest is
JavaScript building geometry:

- `bake()` (static-batch.js) was 2.2 s of Plaza and 1.1 s of Selva, mostly
  copies (clone, `toNonIndexed`, per-vertex `applyMatrix4`). It now unindexes
  and transforms each mesh in one pass with the same arithmetic (Float32 data
  through its own monomorphic loop) and still merges with `mergeGeometries`.
  The output matches the old path byte for byte on all 420 Studio models
  with and without `tint`. Plaza's track build 5.4 → 4.1 s, Selva 3.1 → 2.5 s.
- The eight racers' panas were ~1 s of every load; see the cloth fitting
  caches in character-reference.md.
- A worker cannot help without a build step: module workers do not see the
  page's import map (Chrome 153 and 156), so every model's `'three'` import
  fails inside one.

### Sun shadows: still scenery cached

The sun's shadow box (±40 m) follows the player, so three.js redrew every
tree, house and rock into the shadow map each frame: 0.6–3.1 M triangles
and 60–100 draws, 43 % of Chuao's triangles at the start. `shadow-cache.js`
wraps `renderer.shadowMap.render`:

- The light and its target step on an 8 m grid (moving both keeps the
  sun's direction). Coverage ahead of the car shrinks by at most ~6 m.
- Shadow-casting meshes under `race.trackGroup` (not skinned, no custom
  depth material) render into a cached depth target only when the box
  steps a cell or one of them changes; about one frame in ten at speed.
- Every frame the cached depth is blitted into the real shadow map (inside
  the shadow pass's own `clear`) and only the other casters are drawn over
  it: cars, breakables, animals.
- Each still caster's visibility, geometry, instance version and world
  matrix are compared every frame. A moved one is drawn every frame from
  then on; a shown or hidden one rebuilds the cache when it is inside the
  shadow frustum, and after four flips it is treated as moving.

Screenshots against plain three.js shadows at the same snapped centre match
exactly. Chuao's start 7.20 → 4.43 M triangles, Selva 3.75 → 2.83 M.

### Final reference measurement

Source `bb7b838`, Windows, Ryzen 9 7950X, RTX 4090 via ANGLE/D3D11,
installed Chrome 155.0.8059.80 in a normal window. Eight simulated racers,
seed 1453678317, camera fractions 0 / .40 / .62, 30 warmup frames followed by
120 measured frames per view. The accumulator consumes actual elapsed time,
including extra physics ticks on slow frames. No other task browser suite ran
during this measurement. Raw data (local, untracked): `art/grand-prix/hardware-window.json`. Earlier headless timings are diagnostic history.

Desktop is 1280 × 800, DPR 1, quality Alta. Ranges span the three views:

| Circuit | First playable frame | p50 frame (ms) | p95 frame (ms) | Mean FPS by view | Maximum draws |
| --- | ---: | ---: | ---: | ---: | ---: |
| Salinas | 3.33 s | 13.9–20.8 | 20.9–27.8 | 51.0–59.6 | 1,188 |
| Delta | 2.47 s | 20.8 | 20.9–27.8 | 52.5–54.0 | 1,316 |
| Cuevas | 2.11 s | 13.9–14.0 | 20.9–27.6 | 56.5–60.2 | 1,098 |
| Salto | 2.23 s | 20.7–20.8 | 21.0–27.8 | 48.5–55.2 | 1,331 |

The 844 × 390 Baja viewport ran on the same desktop GPU: p50 about 20.8 ms,
p95 20.9–27.9 ms, 41.7–55.6 mean FPS by view and 2.73–3.11 s loading. It is
not physical-phone performance. Across both profiles, the maximum submitted
draws were 1,418, uploaded geometries 1,382 and textures 85. These are live GPU
resource counts rather than browser heap estimates. Repeated-transition
retention is established separately by the three-cup lifetime proof.

All declared geometry/draw/effect/resource limits pass. The initial sustained
60 FPS desktop goal is **not met consistently**, especially in dense views.
Keep that performance target open; do not call these measurements locked 60 FPS
or present the phone waiver as waiving the desktop target. A trial removing
tiny shadow casters did not improve timings reliably and was not retained.

## Mountain worlds: cells and cloud banks (Tovar, Sarisariñama)

`tracks/scenery-batch.js` holds two helpers for the hand-built mountain
worlds. `cellInstances` splits each scenery kind into one InstancedMesh per
200 m cell, so the frustum skips what is behind the car; a single map-wide
batch (or `frustumCulled = false`) is never culled. `billboardCloud` draws a
whole bank of fog, mist, sea-of-clouds or spray cards in one draw: hundreds
of Sprites were one draw and one material update each. Every card in a bank
shares one colour, so the unsorted blend matches the sorted sprites; drift,
orbit and spray run in the vertex shader on `uniforms.uT`. Hydrangea heads
and window flowers are a 20-face icosahedron instead of a sphere.
Measured on the same machine against the sprite and per-kind version:
Tovar triangles fell from 2.9–4.5M to 1.2–2.9M per view and its 117 ms
freeze while driving went away; Sarisariñama dropped 11–17 % of its
triangles and up to 60 draws; the scenery-only screenshots differ in under
2.5 % of pixels. The four cave PointLights stay: GPU time did not point at
them and the cave reads by their colour.
