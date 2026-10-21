# Pana Studio

The **casas-coloniales** pack includes a house recipe editor on its six preset
pages, three plants, **Calle de las flores** and an editable 50-house collection.
**Acabado de paredes** offers clean paint, soft plaster, painted-brick accents
and exposed-brick patches, with a separate finish lock. The controls reuse the live
inspector and export/import versioned JSON. See [colonial-houses.md](colonial-houses.md)
for generation, placement and validation; this feature does not create map rooms.

Run `.\dev.ps1 studio` from the repository root. It opens `/studio/library`, reuses a healthy Pana server and does
not kill a running game. `-NoBrowser` prints the address without opening a tab;
`-Port` selects a server port. If another application occupies that port, the
normal port fallback applies. `-NoAutoPort` makes that conflict explicit.

## Library and extension contract

`engine/models/catalog.js` aggregates shared model metadata; category manifests
under `models/fauna/`, `models/vegetation/` and `models/props/catalog/` are the
registration points. `web/studio/catalog.js` composes these with specialized
scene/character/game adapters in `web/studio/catalog/`, currently 182 resources
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
defined in individual `/engine/models/vegetation/` modules
(`/engine/models/vegetation/index.js` exports them all). They
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

## Pages and working sets

Studio now has real browser routes served by the existing static server:

- `/studio/library`: searchable metadata; no Three.js, renderer or models at startup.
- `/studio/assets/:id`: a dedicated preview, source, declared dependencies, consumer links and related assets from the same source.
- `/studio/workspace`: a user-picked set of resources stored under `pana:studio:workset:v1` in localStorage. Blocked storage falls back to the session.
- `/studio/settings` and `/studio/guide`: separate lightweight pages.

`/studio` and old `/studio.html#barrel` links normalize to canonical routes;
`track-playa` still resolves to `track-bululu`. Unknown IDs show a missing-resource
page without building another model. Unknown server paths remain 404s.
`routes.js` owns URL parsing and pure filtering; `studio.js` owns navigation and
the library; `inspector.js` loads only when an asset is opened. Back/Forward,
modified clicks/new tabs, direct refresh, filter query parameters and return links
from settings are supported. Leaving an item releases its live preview and tour.

Search is accent-insensitive and includes name, ID, source, factory, game, pack
and tags. Game, pack and category filters combine. Game consumers are catalog
metadata, not a promise that every resource occurs in every map in that game.
The default compact list can switch to a thumbnail grid. **Añadir a selección**
and **Añadir resultados** curate a work set without constructing models or
placing anything in a map. Exports contain only the current filtered results,
with canonical item URLs and any measured metrics; they never contain images.
The item page copies a direct link or an agent brief with source, consumers,
preview options and declared dependencies. Editing geometry remains a code task;
the character editor is still available at `/personaje`.

Racing metadata is shared from `car-definitions.js` and `track-definitions.js`.
The existing `CARS` and `TRACKS` exports retain the same builders and game data.
`tracks.js` re-exports `makeTrack` from `track-runtime.js`; Studio dynamically
imports that runtime and only the selected track definition. Keep metadata free
of renderer/geometry imports. Maps still construct their own scenery dependencies;
this does not provide per-placement scene streaming or a visual level editor.

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
to ordinary props, mobile layout and no automatic thumbnail generation. Screenshots and route
metrics go to ignored `art/studio/tours/`.

The tour suite checks all eight routes and a 390×844 expanded viewer, including
direct circuit pages without catalog generation. Camera stability assertions allow
1e-8 metres for OrbitControls' spherical-coordinate roundoff.
Optional `PANA_QA_PROFILE` stores an isolated browser profile
under an ignored artifact directory for faster subsequent test runs.

## Thumbnail cache

`thumbnails.js` prepares real 320×240 WebP previews only after **Preparar
miniaturas** is pressed. The queue contains exactly those filtered IDs; it never
appends the rest of the catalog. Route/filter changes cancel pending work; an
already running synchronous constructor may finish. Pause/resume and retry are
available in the status bar. The queue yields between jobs and defers during
interaction, hidden tabs, preview construction and tour playback. Opening a live
asset does not also build its thumbnail.

Images and metrics persist in IndexedDB `pana-studio-previews`, store `assets`.
Only requested records are read and validated; removed IDs are pruned using keys
without loading all image blobs. Storage failure uses session memory. Settings
can clear storage and return to the previous route. Preparing a requested set on
a warm visit reuses verified images. No images enter the repository or exports.

`startup.js` only gates shell initialization, with a retry for module failures.
Asset/module/GPU failures are shown on that item's page, with a retry and working
navigation. Thumbnail/source failures stay local to their IDs and never block
the library or other resources.

`fingerprints.js` hashes each requested source, explicit dependencies and local
imports/re-exports/literal dynamic imports. Source reads are shared within one
queue session. Studio adapter files are hashed without recursively loading every
unrelated constructor they describe; source and explicit dependencies cover the
actual model. Declare dependencies for runtime imports whose paths are computed.
The render recipe/catalog/import map invalidate all requested thumbnails; ordinary
source changes invalidate consumers only. Reload after source edits so ES module
code and fingerprints agree. Regeneration reloads for the same reason.

This design follows useful ideas reviewed in the local `universal-modder` repo:
structured searchable metadata (`um/kb.py`), a single source of truth, narrow
verification before widening, and a reusable context/verification note. It does
not depend on that toolkit or import its game-specific tooling.

Agent workflow: read `AGENTS.md`, inspect the closest existing asset, extend
its source, register the entry, inspect its actual 3D preview and affected games,
run `npm run check`, and record any non-obvious conventions here.

Mango, Mango dorado, Ceiba, Arbusto and Casita de isla use the shared refined
factories described in `shared-props.md`. The casita implementation is in
`engine/island-house.js`, re-exported by `flora.js`; foliage and fruit reuse
`botanical-shapes.js`. Source fingerprints follow these imports/re-exports,
so model edits refresh dependent thumbnails on reload without manual cache clearing.

## One character source

`engine/models/characters/pana/` owns the approved capybara sculpt, smooth connected
garments, exposed-body topology, expressions and eyewear. `/personaje`
retains the full editor; its UI files in `web/character/` import the sculpt
from there, and there is no second implementation. The editor and games use the same
surfaces and rig. `engine/models/characters/pana/avatar-model.js` adapts that model to saved avatar data
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

`web/studio/tests/cache.browser.js` covers real routes, direct reload, browser
history, missing IDs, no eager renderer/map imports, scoped cold/warm generation,
shared-source invalidation, partial failure/retry, saved selections, filtered
exports, settings return/clear, blocked storage and mobile overflow. It uses the
same CLI arguments as the other Studio browser tests. The architecture browser
suite also verifies racing metadata consistency and runtime re-export identity.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Pana Studio at `/studio/library` catalogs existing props, maps, vehicles and
characters. Register new resources in `web/studio/catalog.js` using their real
constructors; do not duplicate models in the preview. See
`docs/knowledge/pana-studio.md` for the registration and agent workflow.
Each asset has a real `/studio/assets/:id` page; `/studio/workspace` stores a
local working set. Keep library metadata independent of renderer imports and
load `inspector.js` only for an item. Thumbnail queues are explicit filtered
sets, never a full-catalog startup gate. Preserve legacy hash links and history.
Racing metadata lives in `car-definitions.js` / `track-definitions.js`;
`tracks.js` re-exports the shared `track-runtime.js` constructor. Studio loads
only the selected track definition. Preserve these compatibility exports.
Circuit previews expose their existing track runtime as `route` for Studio's
`track-tour.js`: user-started playback follows the start line, road and ramps.
Preserve pause/scrub/copy-point behavior, restore overview on exit, and reset
tour state on asset changes. Keep this camera tool separate from race state.
See the circuit walkthrough section in the Studio knowledge note for proof.
Thumbnail images live only in browser IndexedDB. Declare extra factory
dependencies in the catalog for cache invalidation, and run the studio cache
browser suite when changing its generation or persistence behavior.

## Shared party maps

`arena-puerto`, `arena-hato` and `arena-ruinas` preview Puerto Coco, Hato del Sol
and Ruinas del Mango through the real `engine/worlds/arenas.js` hunt variant. They list
Escondidas, Pintura, Billar and Caída as consumers. See
[shared-arenas.md](shared-arenas.md) for collision, table clearance and lifecycle.

Browser checks must return through `#back-library` before using `#search` to
select another resource. Legacy hash links open the dedicated asset page,
where the library's search controls are hidden.
