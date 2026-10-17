# Garage and race loading

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
node Pana/games/derrape/tests/loading.browser.js
node Pana/games/derrape/tests/items.browser.js
node Pana/games/derrape/tests/maps.browser.js
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
