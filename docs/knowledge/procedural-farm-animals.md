# Procedural farm animals

`Pana/engine/farm-animals.js` adds `llaneroHorse({seed, coat})`,
`yardChicken({seed, coat})` and `hatoCow({seed, coat})`. All return native Three.js groups in metres, facing
+Z, with planted feet at ground level. They appear in Studio's `Fauna` category
as `llanero-horse`, `yard-chicken` and `hato-cow`. The catalog now has 140 entries,
including the separately authored fish and fish school; see `map-asset-rollout.md`.

Horse coats: `bay`, `palomino`, `grey`; chicken coats: `red`, `cream`; cow coats: `pinto`, `brown`.
The integer seed determines default coat, body width and animation phase.
By default these are scenery animals with grazing/pecking, blinking and tail motion.
Galope and Coleo's riders opt horses into `{locomotion:true}`: three bones per leg
(hoof included), three on the mane, three on the tail, and
`userData.gallop(phase,speed,jump,climb)`, a pure function of its arguments. The cow's
`locomotion` keeps its older two-bone sine legs. The game owns its mounted character,
movement and bot pathfinding; scenery animals keep their original grazing rig.
See [Galope](galope.md).

### Horse gait

`engine/models/animation/quadruped-gait.js` holds the math, without Three.js.
`llanero-rider.js` advances the phase at `speed / stride` (radians, 2π a stride), so
a stance toe is still relative to the ground; any other rate slides the feet. Gallop's
touchdown offsets are `0, .12, .35, .47`: at duty .25 the commonly quoted `.40, .53`
open a second airborne gap between the hinds and fronts.

The sculpt's legs are nearly straight at rest, so a long stride cannot reach the
ground from standing height. Each gait lowers the body (`crouch`), swings shoulder and
pelvis with the leg (`slide`) and lifts the heel on a planted toe. Raising `reach` or
the bob needs more of these; the "stance feet stay planted" unit test fails when a
foot goes out of reach. It sweeps speeds in .25 m/s steps because the worst fit is
mid-blend (around 5 m/s), not at a table speed.

The riders' speed is rate-limited at 12 m/s², which lets the gait run down when the
race zeroes `speed`. Past the finish `game.js` carries the difference as a run-out
(`r.runOut`) so the feet do not slide during it.

The mounted tail lives inside the skin, two draws fewer than the rigid tube and tuft.
Leg weights stay off the belly (the ribcage used to follow whichever leg was nearest).

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
node Pana/games/carreritas/tests/maps.browser.js
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
architecture kit, retain Cheoma's notice, verify against Pana's Three r186, then
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

## Sculpted farm collection

`fauna/capybara/chiguire.js` exports `chiguire` and `chiguireFamily`;
`fauna/farm/cochino.js` exports `cochino`; `fauna/farm/pato.js` exports `pato`.
All use `core/soft-sculpt.js`, a MarchingCubes surface from blended ellipsoids,
with vertex colours and a small articulated head. They are separate from the
horse/cow locomotion rig. Studio registers the three factories in the Fauna
catalog under the conuco pack. Keep their absolute-time `userData.tick(t)`
callbacks alive; the duck also accepts whether it is afloat. Do not bake live
animals into static surroundings.

The authored collection can contain strings double-encoded as UTF-8. Normalize
those strings before extracting JSON metadata, especially the Spanish damage
key: a malformed key silently falls back to default combat damage. Keep pure
catalog metadata separate from model factories so server rules never load Three.
