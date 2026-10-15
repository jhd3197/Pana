# Pana Studio

Run `Pana/dev.ps1 studio` from the repository root (or `./dev.ps1 studio`
inside `Pana/`). It opens `/studio.html`, reuses a healthy Pana server and does
not kill a running game. `-NoBrowser` prints the address without opening a tab;
`-Port` selects a server port. If another application occupies that port, the
normal port fallback applies. `-NoAutoPort` makes that conflict explicit.

## Library and extension contract

`web/studio/catalog.js` is the curated registration point, currently 90 resources
including twenty vegetation species, nine Pana landmarks (category `Emblemas`)
and seven jungle structures (category `Selva`); see `shared-props.md`.
It derives props from `PLAZA_PROPS`, recipes/stations from Cocina's definitions,
vehicles from `CARS`, and circuits from `TRACKS`. Other shared factories have
explicit entries. This is a development asset catalog, not player inventory or
a visual level editor. New exported functions are not automatically registered.

The additional vegetation IDs are `araguaney`, `bamboo`, `fern`, `monstera`,
`heliconia`, `cactus` (Cardón), `mangrove` (Mangle), `papaya` (Lechosa), `agave`,
`waterLily` (Nenúfar), `hibiscus` (Cayena), and `reeds` (Juncos). Their seeded constructors are
re-exported from `/engine/flora.js`; `flora-species.js` owns the geometry. They
are all used by Derrape's Selva circuit, so `usedBy` lists Pana Studio and Derrape.
`tracks/selva-flora.js` owns habitat placement. Registering a future plant still
does not change map placement or collision rules automatically.
The additional `jungleGiant` and `tropicalBush` entries are currently Studio-only;
their catalog `usedBy` must not imply they have already been placed in Derrape.

Each entry has a unique stable `id`, Spanish `name`, `category`, browser `source`
URL, `factory`, `usedBy`, and asynchronous `build()`. Optional fields include
`description`, `tags`, `dimensions` and a `game` link. Build returns:

```js
{ group, update: (elapsedSeconds, deltaSeconds) => {}, dispose: () => {}, bounds }
```

Only `group` is mandatory. `bounds` is an optional THREE.Box3 for camera framing;
large maps use playable bounds rather than background hills/ocean. Reuse the
existing constructor, never paste geometry into the catalog. Shared resources
live under `engine/`; assets with one game consumer can stay in that game. Origin,
scale, orientation, collision contracts and lifecycle belong to the source.

Circuit definitions can provide `previewBounds: [[minX,minY,minZ],[maxX,maxY,maxZ]]`
to include meaningful surrounding scenery. Plaza uses this to show its street
network and hill; tracks without the field retain their route-based framing.

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

The character proportions suite verifies stable camera/body size across wardrobe
changes. Cocina and Escondidas browser suites use real two-client sessions for
movement, gameplay, host departure and mobile behavior; they also smoke test
Derrape, Bululú and hub artwork. Preview screenshots are in ignored `art/studio/`.

`web/studio/tests/cache.browser.js` covers a complete cold pass, zero thumbnail
builds on a warm reload, startup gating and keyboard isolation, shared-source
invalidation and retry, settings persistence/clear/rebuild, disabled storage,
real controls, grid/list sizing, sort order, render-on-demand and mobile overflow.
It uses the same CLI arguments as the other browser tests.
