# Pana Studio

Run `Pana/dev.ps1 studio` from the repository root (or `./dev.ps1 studio`
inside `Pana/`). It opens `/studio.html`, reuses a healthy Pana server and does
not kill a running game. `-NoBrowser` prints the address without opening a tab;
`-Port` selects a server port. If another application occupies that port, the
normal port fallback applies. `-NoAutoPort` makes that conflict explicit.

## Library and extension contract

`engine/models/catalog.js` aggregates shared model metadata; category manifests
under `models/fauna/`, `models/vegetation/` and `models/props/catalog/` are the
registration points. `web/studio/catalog.js` composes these with specialized
scene/character/game adapters in `web/studio/catalog/`, currently 171 resources
including twenty-four vegetation models, nine Pana landmarks (`Emblemas`),
ten Pueblo models, seven jungle structures (`Selva`), eight Páramo structures
and five thermal landmarks (`Termales`) used by Chi Chi, plus ten Llanos and
ten Desierto models, eleven `Vida llanera` props, nine `Costa` objects, plus ten `Fauna` entries (horse, chicken,
cow, fish, school, crab, macaw, ibis, vulture and natural capybara).
See `model-inventory.md` for the full current registry, active uncataloged models,
map assemblies, dormant factories and priorities; `coastal-props.md` for the beach and harbor pack,
`shared-props.md`, `pueblo-paramo-props.md`, `llanos-desert-props.md` and
`procedural-farm-animals.md`.
It derives props from `PLAZA_PROPS`, recipes/stations from Cocina's definitions,
vehicles from `CARS`, and circuits from `TRACKS`. Other shared factories have
explicit entries. This is a development asset catalog, not player inventory or
a visual level editor. New exported functions are not automatically registered.

Galope's `galope` map calls `createCourse()` and exposes its actual 482 m route
to the existing camera tour, including both wadeable esteros and all three jumps.

The additional vegetation IDs are `araguaney`, `bamboo`, `fern`, `monstera`,
`heliconia`, `cactus` (Cardón), `mangrove` (Mangle), `papaya` (Lechosa), `agave`,
`waterLily` (Nenúfar), `hibiscus` (Cayena), and `reeds` (Juncos). Their seeded constructors are
defined in individual `/engine/models/vegetation/` modules; `/engine/flora.js`
is only a compatibility barrel. They
are all used by Derrape's Selva circuit, so `usedBy` lists Derrape.
`tracks/selva-flora.js` owns habitat placement. Registering a future plant still
does not change map placement or collision rules automatically.
`jungleGiant` and `tropicalBush` now appear in Selva; `frailejon` and
`mountainPine` appear in Páramo. Papaya and hibiscus also decorate the original
Bululú harbor. See `map-asset-rollout.md` for the map audit and remaining unused
models. The Isla preview now calls the actual `createBoard` constructor, so its
vegetation, props, paths and fish are visible alongside its terrain.

Each entry has a unique stable `id`, Spanish `name`, `category`, browser `source`
URL, `factory` and `usedBy`. Shared definitions also carry preview options and a
`pack` identifier. Studio adds asynchronous `build()` using `catalog/objects.js`;
shared metadata has no functions or renderer imports. Optional fields include
`description`, `tags`, `dimensions` and a `game` link. Build returns:

```js
{ group, update: (elapsedSeconds, deltaSeconds) => {}, dispose: () => {}, bounds }
```

Only `group` is mandatory. `bounds` is an optional THREE.Box3 for camera framing;
large maps use playable bounds rather than background hills/ocean. Reuse the
existing constructor, never paste geometry into the catalog. Shared resources
live under `engine/models/`; assets with one game consumer can stay in that game.
Read [models/README.md](../../Pana/engine/models/README.md) for extension and layer rules. Origin,
scale, orientation, collision contracts and lifecycle belong to the source.

Circuit definitions can provide `previewBounds: [[minX,minY,minZ],[maxX,maxY,maxZ]]`
to include meaningful surrounding scenery. Plaza uses this to show its street
network and hill; tracks without the field retain their route-based framing.
Shared object factories can supply the same two-vector array in
`group.userData.previewBounds`; the catalog converts it to a runtime Box3.
Thermal props use this to frame solid models and their visible steam, independently
of the conservative GPU culling bounds needed by displaced billboard geometry.

The live inspector uses one WebGL context, releases previews on selection, and ignores
stale asynchronous builds. It copies materials before enabling wireframe so
cached game materials are not mutated. Factories with owned skeletons/textures
must supply `dispose`; detach shared carried props before disposing a character.
For the kitchen preview, `createKitchenScene({labelsRoot:null})` avoids attaching
game HUD labels. Camera presets reserve the current asset's space.

The list supports accent-insensitive search by name, game, ID and source,
category filters, deep links (`/studio.html#barrel`), JSON inventory export,
copying the repo path, and copying an agent brief. The on-page guide explains
how to ask any coding agent for a new asset. The catalog is code managed;
preview controls do not write source files or place objects in maps.

## Technical inventory and local thumbnails

The inventory has thumbnail/list views, sorting by name or triangle count,
source IDs, and actual visible-mesh metrics. The inspector reports complete mesh
bounds, vertex/triangle/mesh/material/texture counts and the live viewport's draw
calls (including its grid). Map camera framing can use playable bounds instead;
the reported dimensions still include all visible terrain/background geometry.
Perspective, front, side and top cameras, a world-unit grid, wireframe and optional
animation are inspection controls. `/` focuses search and `F` frames the model.
Static previews render on demand, avoiding continuous GPU work on large maps.

## Circuit walkthroughs

Each of the eight circuit previews includes **Recorrer pista**. It plays one
lap from the actual starting line, using the same `makeTrack` route, elevation
and ramps as the race. Other maps and props do not show the tour controls.
`build()` returns the existing track runtime as `route`; this is live preview
data, not a second map or exported inventory field.

The player supports pause/resume, a position slider, 0.5×/1×/2×/4× speed,
**Vista general**, **Ampliar visor** and **Copiar punto**. Paused tours allow
normal orbit inspection; resuming returns to the road camera. Copying a point
pauses the tour and includes the circuit, lap percentage, metres from the
starting line, road/camera coordinates and source link for feedback. With the
canvas focused, Space toggles playback and Left/Right moves five seconds along
the 1× timeline. The displayed timeline is at 1×, like a video timeline.

`track-tour.js` owns this Studio-only behavior. Playback is always user-started,
including with reduced motion enabled. Hidden tabs pause; changing assets clears
the tour and expanded viewer. Map animation runs during playback and freezes
with the paused view. Overview restores normal camera framing.
Tour motion and scenery share the scrubbed 1× timeline, so seeking/replaying a
point also restores its water and animal poses. The track's horizon/fog palette
is applied during the tour and the Studio atmosphere is restored on exit.
Thumbnail work defers during playback. No car physics, multiplayer or race state
is involved.

Run `node Pana/web/studio/tests/track-tour.browser.js <playwright-package>` against
the running server. It checks every route, road clearance, start/finish seam,
UI playback/pause/scrub/copy/repeat, orbit, keyboard, visibility handling, switching
to ordinary props, mobile layout and warm thumbnail reuse. Screenshots and route
metrics go to ignored `art/studio/tours/`.

The October 2026 rollout passed all eight routes and the interaction suite above,
including a 390×844 expanded viewer, full-catalog thumbnail preparation and a warm
reload with zero regenerated thumbnails. Camera stability assertions allow
1e-8 metres for OrbitControls' spherical-coordinate roundoff. `npm run check`
passed 176 files. Optional `PANA_QA_PROFILE` stores an isolated browser profile
under an ignored artifact directory for faster subsequent test runs.

## Thumbnail cache

`thumbnails.js` generates one real 320×240 WebP preview at a time, with a separate
reused renderer. The queue yields between builds, prioritizes selected/filtered
assets and defers while the document is hidden. Startup keeps the inventory
inert and visually hidden until every thumbnail is prepared, source validation
has finished, and the selected live preview has settled. A full-screen loader
shows real counts and rotating Spanish messages, without a minimum artificial
wait. Visible thumbnail images are decoded before revealing the inventory.
Model construction is synchronous on the main thread, so complex assets can
briefly pause progress updates on the first pass.

Later visits read images and metrics from IndexedDB `pana-studio-previews`, store
`assets`. `cache-store.js` shares persistence with `/studio/settings.html`; that
page reads counts, size and generation date without loading Three.js or models.
Settings can clear storage or rebuild it by returning through startup, preserving
the selected asset. Cache maintenance is absent from the inventory. No images
are written into the repository, exported JSON or server filesystem. Storage
failure falls back to session memory; settings explains unavailable storage.

`startup.js` is independent of Three.js and dynamically loads the inspector, so
module/GPU initialization failures show a retry action. Resource/source failures
keep the gate closed and list diagnostics; users may explicitly open available
previews or retry. Successful cached images survive a retry. Keep the hidden
app in layout so the camera and thumbnail sizing work before reveal. Studio's
wordmark uses the existing Luckiest Guy brand font, with plain UI typography
for the tools.

`fingerprints.js` hashes local source text and follows local static imports,
re-exports and literal dynamic imports. Each asset may declare `dependencies`
for constructors outside its primary source (circuits include `tracks.js`).
`previewOptions` records factory inputs. Catalog/render-recipe/import-map changes
invalidate the full set; other source changes invalidate dependent assets.
Reload after editing source. Regenerate also reloads if it detects changed source,
because an already imported ES module cannot be replaced within the page.
Old versions overwrite the same asset key; removed IDs are pruned. Failures are
reported per resource and can be retried. This is a browser cache per origin,
not a shared asset database; another browser or port warms its own cache.

Agent workflow: read `Pana/AGENTS.md`, inspect the closest existing asset, extend
its source, register the entry, inspect its actual 3D preview and affected games,
run `npm run check`, and record any non-obvious conventions here.

Mango, Mango dorado, Ceiba, Arbusto and Casita de isla use the shared refined
factories described in `shared-props.md`. The casita implementation is in
`engine/island-house.js`, re-exported by `flora.js`; foliage and fruit reuse
`botanical-shapes.js`. Source fingerprints follow these imports/re-exports,
so model edits refresh dependent thumbnails on reload without manual cache clearing.

## One character source

`engine/soft-character/` owns the approved capybara sculpt, smooth connected
garments, exposed-body topology, expressions and eyewear. `/personaje.html`
retains the full editor. Old `web/character/*.js` model URLs are re-exports only;
do not edit a second implementation there. The editor and games use the same
surfaces and rig. `engine/character.js` adapts that model to saved avatar data
and the established `buildCharacter()` game API.

The game adapter places a 0.60 conversion scale on an inner group, so game-owned
root scaling does not destroy proportions. A seated character bends its legs
forward and offsets the inner group to the seat; manual arm/neck poses are
preserved for steering and celebrations. Walk/carry inputs animate the shared
rig; `open` and `dizzy` retain their gameplay effects. Named body/neck/head/arm
pivots and the carry attachment remain available. Games call `dispose()` on
removal. The character has independently owned geometry/materials/skeletons.

`quality:'game'` reduces implicit-field resolution, surface sampling, garment
subdivision and tiny curve tessellation. It changes detail rather than design.
`quality:'studio'` keeps the full reference quality. These construction profiles
are scoped synchronously and restored with `finally`; no per-frame rebuilding.
The expensive apron depth grid is cached once per profile because avatar colors
do not alter the torso shape. Bounded body/garment caches keep CPU templates;
each instance clones geometry so colors, bones and disposal remain independent.
Both profiles have the corrected extended-arm
bind pose, avoiding underarm webbing.

Old hat types remain supported; `nada` clothing migrates to the default franela.
Chef hats, sports bands, round glasses and wristbands now have saved avatar IDs.
The editor's **Usar en los juegos** action explicitly writes its combination to
the existing `pana:avatar` localStorage key. Games read it when opened/reloaded;
it does not overwrite an active multiplayer actor mid-session.

Static scenery can include character statues. `flora.bake()` now freezes visible
skin/morph poses before merging, strips animation attributes, and preserves UVs
for bump-mapped surfaces. Merging animated bind poses or hidden clothes creates
bad geometry and incompatible morph arrays; do not restore the old traversal.

## Verification

`web/studio/tests/studio.browser.js` opens every registered preview, checks unique
IDs, source links, filters, empty results, inventory export and mobile overflow,
then saves a mixed wardrobe and checks the standing/seated game adapter.
Run with the same optional Playwright package and browser executable arguments
as `web/character/tests/proportions.browser.js`.
Large map constructors can block the main thread during the click itself, so
the suite gives both the click and preview-ready wait 90 seconds. Increasing
only the latter does not prevent a 30-second Playwright click timeout.

The character proportions suite verifies stable camera/body size across wardrobe
changes. Cocina and Escondidas browser suites use real two-client sessions for
movement, gameplay, host departure and mobile behavior; they also smoke test
Derrape, Bululú and hub artwork. Preview screenshots are in ignored `art/studio/`.

`web/studio/tests/cache.browser.js` covers a complete cold pass, zero thumbnail
builds on a warm reload, startup gating and keyboard isolation, shared-source
invalidation and retry, settings persistence/clear/rebuild, disabled storage,
real controls, grid/list sizing, sort order, render-on-demand and mobile overflow.
It uses the same CLI arguments as the other browser tests.
