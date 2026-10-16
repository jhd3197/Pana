# Procedural farm animals

`Pana/engine/farm-animals.js` adds `llaneroHorse({seed, coat})`,
`yardChicken({seed, coat})` and `hatoCow({seed, coat})`. All return native Three.js groups in metres, facing
+Z, with planted feet at ground level. They appear in Studio's `Fauna` category
as `llanero-horse`, `yard-chicken` and `hato-cow`. The catalog now has 140 entries,
including the separately authored fish and fish school; see `map-asset-rollout.md`.

Horse coats: `bay`, `palomino`, `grey`; chicken coats: `red`, `cream`; cow coats: `pinto`, `brown`.
The integer seed determines default coat, body width and animation phase.
By default these are scenery animals with grazing/pecking, blinking and tail motion.
Galope opts horses into `{locomotion:true}` to add eight leg bones and
`userData.gallop(phase,speed,jump)` for riding. The game owns its mounted character,
movement and bot pathfinding; scenery animals keep their original grazing rig.
See [Galope](galope.md).

Los Llanos places three horses, eight chickens and eight cows around its ranches
and pastures. The cows replace the old game-local box-and-sphere model.
`tracks/llanos-world.js` owns those placements and calls their ticks from its
environment update. They are outside the racing corridor, individually grounded,
and excluded from static batches. `assetCounts` includes all three catalog IDs.

## Reused code and ownership

Source: [threejs-procedural-animals](https://github.com/majidmanzarpour/threejs-procedural-animals/tree/c95ae49346aa8e140a924376cec6cf0073d99512),
revision `c95ae49346aa8e140a924376cec6cf0073d99512`, MIT.

The three math/SDF/surface-nets modules under
`engine/vendor/procedural-animals/` are unchanged upstream source. The new
factory adapts selected torso, neck and limb sculpt recipes. Its attribution
header and the vendor's full MIT notice must travel with derived copies.
The Pana rig, animation, colors, simplified details and lifecycle are local.
No upstream media or full behaviour/coat runtime was imported; no npm dependency,
Three.js upgrade or build step was added. Do not describe this as a measured
percentage of reuse.

There are three CPU-only geometry templates, one per species. Instances clone the
buffers, own their materials and skeletons, and attach an idempotent skeleton
and live-material disposer to `group.userData.dispose`. Studio/track owners still
dispose their geometries. Do not bake a whole animal or dispose a template.
Only rigid chicken wing/tail feathers are merged within their animated parent.

`tick(t)` samples absolute seconds. It assigns every animated transform from the
rest pose, including neck/head extensions. Backward scrubbing is supported.
The skin uses generous culling bounds and clears its computed bounding box after
posing so Studio's measurements match the current pose. `previewBounds` frames
the full feeding envelope. Extra factory dependencies are declared for thumbnail
invalidation.

## Validation

The focused proof checks deterministic geometry, independent instance ownership,
finite vertices/transforms, forward/backward animation, feet staying planted over
60 sampled seconds, triangle/draw budgets, actual shader rendering and one-time
skeleton texture disposal. It builds the full native Llanos track and verifies
all nineteen placements, terrain contact, road clearance and environment animation.
Screenshots cover front/side/perspective and feeding poses plus the ranch.

Measured in Chromium on this machine:

| Model | Triangles | Meshes | Initial sculpt time |
| --- | ---: | ---: | ---: |
| Horse | 21,636 | 9 | about 0.8 s |
| Chicken | 15,264 | 7 | about 0.27 s |
| Cow | 22,048 | 9 | about 0.25 s |

Subsequent instances clone the cached sculpt. These are construction measurements,
not guarantees of frame rate on all devices.

```powershell
$env:PANA_PLAYWRIGHT_PATH = '<absolute Playwright package path>'
node Pana/engine/tests/farm-animals.browser.js
$env:PANA_MAP_TEST_TRACKS = 'llanos'
node Pana/games/derrape/tests/maps.browser.js
node Pana/web/studio/tests/studio.browser.js $env:PANA_PLAYWRIGHT_PATH
npm run check
```

Proof files are in ignored `art/studio/fauna/`. The race regression completed
three laps with finite geometry, zero road protrusions and valid item rows.
The complete Studio suite passed all 137 previews, category filters, inventory
export, mobile layout and standing/seated avatar integration.

## Cheoma assessment for the next building batch

Inspected [Cheoma](https://github.com/midagedev/cheoma/tree/53b7f56b9c62cc8ff21bb87d680c22714f35ac73),
revision `53b7f56b9c62cc8ff21bb87d680c22714f35ac73`, MIT, copyright 2026 midagedev.
No Cheoma code has been imported yet.

| Priority | Source modules | Pana application | Adaptation required |
| --- | --- | --- | --- |
| First | `src/village/mud-wall-surface-plan.js`, `mud-wall-geometry.js` | Adobe garden walls, weathered hato walls and bodega courtyards | Keep seeded joints/erosion; use Pana colors, dimensions, opening and collision conventions. Dependencies are the seed/RNG helpers and Three.js. |
| First | `src/builder/podium.js`, `src/core/surface-clearance.js` | Raised stone porches, plaza steps and hillside foundations | Extract foundation/step construction, remove temple-specific decoration and use Pana terrain grounding. |
| Later | `src/temple/terrace-plan.js` | Stepped hillside courtyards and retaining walls in Páramo | Its renderer-free tier/retaining-wall/stair plan is useful; replace temple layout assumptions with local parcel data. |
| Selectively | `src/builder/roof.js` | Curved thatch shelters and tiled roof details | Reuse curve/instancing techniques after adaptation. The full module depends on Cheoma palettes, roof shells and ornament policy; its Korean silhouette is not a drop-in Venezuelan roof. |

Start with adobe walls and raised porches. Port the geometry into the existing
architecture kit, retain Cheoma's notice, verify against Pana's Three r160, then
register and place the actual factories. Do not introduce the entire village
runtime just to obtain these components.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

`engine/models/fauna/farm/` supplies the Fauna horse, chicken and cow, used in Los
Llanos. Their SDF core is MIT code in `engine/vendor/procedural-animals/`;
preserve its license and source attribution. Factories return owned native
skinned meshes with absolute-time `userData.tick(t)` and an idempotent skeleton
`userData.dispose()`. Keep animals outside static batches and racing lanes.
See `docs/knowledge/procedural-farm-animals.md` for parameters and proof.
