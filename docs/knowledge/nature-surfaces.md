# Procedural grass and tree surfaces

## Plaza flowering crowns and petals

`tracks/plaza-bloom.js` opts only the existing `festive-araguaney` and
`festive-apamate` instanced crowns into a cosmetic 180-second bloom cycle.
`nature-material.js` blends their authored flower colors toward green in
rest-space patches. The foliage tag plus explicit mesh opt-in exclude bark,
fruit, other plant species and buildings; original green leaves keep their
colors. It changes no geometry, opacity or shadow silhouette, and retains the
factory wind hook. This is a stylized flowering cycle, not a calendar or a
four-season climate applied to Venezuela.

Petals originate at those same instance placements. One instanced draw holds
36 quads per tree on Alta, 12 on Media, none on Baja; interleaved seeds preserve
every emitter when reducing the count. Baja also bypasses the bloom tint.
Shaders handle drift, tumble, fall/reset, near-camera and distance fades. No
textures, tree clones or per-frame vertex-buffer uploads are needed. Bounds
include the emitter heights and drift so loading, Studio framing and frustum
culling see the field's real extent. Petals fade above the base rather than
accumulating on the road; they have no collision or gameplay effect.

The field's registered scenery tick writes absolute race time to the live crown
and petal materials, including Studio-owned clones. Pause/rewind/replay therefore
do not integrate a second clock. New tracks own new fields, and the existing
track teardown releases geometry and an idempotent material disposer. The
first-load graph stays unchanged because only Plaza imports this effect.

Concept references: the patchwise crown coloring in `sakura-fantasy`'s
`src/world/trees.js` and instanced fallers in `src/fx/fx.js`, commit
`3d367e92331b70118cfaa728dc7b8bc4bb4da009`. The implementation uses Pana's own
geometry, palette, shaders and r160 pipeline; no upstream assets are imported.
`tests/bloom.browser.js` checks rendered transition/rewind pixels, falling
petals, low-tier bypass, static buffers, stable shader count, clone ownership,
live split/mirror cameras and disposal on track replacement.

## Páramo snowfall and settled coverage

`public/race-world.js#createSnow` draws seeded, camera-facing snow quads in one
instanced draw, with wind/flutter and fades at the volume boundary and near the
lens. The shader uses each draw's `cameraPosition`, so split-screen players each
see flakes around their own camera. Only absolute race time changes; vertex and
instance buffers stay static. Quality selects 280/700/1,400 flakes. Páramo's
ordinary rain lines are disabled, but the Aguacero item can still enable them.

Páramo's nature materials share `group.userData.snowAmount`. Coverage starts at
0.28 and approaches 0.72 with a 45-second exponential time constant, derived
from absolute race time. Rewinding/replaying resets it deterministically; pause
does not advance it. This is cosmetic coverage, not snow depth or a traction
change. The shader favors higher elevations and upward-facing normals, with
broad noise breaking up the boundary. Media/Alta show it; Baja keeps the authored
surface colors while retaining falling flakes.

Existing nature tags admit grass/leaves/bark and exclude untagged fruit/trim in
mixed batches. `paramo.js` additionally opts terrain, rocks and the cabin's
opaque surfaces in through `userData.snowSurface`. Roads, water, avatars,
cable-car machinery and signs are outside that opt-in. Materials with no nature
attribute compile a constant zero tag rather than requiring a new vertex buffer.
Snow changes color/roughness in existing draws, with no textures or triangles.
It is a normal/altitude mask, not a roof-occlusion or physical deposition model.

The material's clone contract preserves the snow shader and gives Studio its
own uniform. Studio previews the initial settled state; live accumulation is
owned by the race. `tests/snow-loading.browser.js` verifies rendered coverage,
return to authored low-quality pixels, stable shader count, clone independence,
time rewind, quality counts, split/mirror, mobile layout and track replacement.

Concept references: `billpwchan/sakura-fantasy`'s `src/fx/fx.js` and
`src/core/shared.js` at `3d367e92331b70118cfaa728dc7b8bc4bb4da009`.
The Pana shaders retain its procedural surfaces and Three.js r160 pipeline.

Carreritas's thirteen circuits opt into seeded surface detail at the end of
`track-runtime.js` construction. Studio's circuit previews use the same build.
Other games and standalone model previews keep their existing materials.
Ground and trees use procedural surface shading, with nearby 3D grass tufts
layered over the ground. Tree shapes come from `venezuelan-trees.md`.

`tracks/nature-material.js` owns `natureStyle(id, seed = 73)` and
`applyNatureMaterials(group, id, seed)`. A recipe contains its seed, coordinate
offset, patch frequency, blade frequency and dry-grass strength. Same map and
seed reproduce the same pattern. Different seeds produce independent variants;
the browser proof exercises 50. Estadio uses tighter turf, Llanos broader dry
patches, and Selva/Delta less straw color. Existing authored palettes remain the
base. Recipes currently come from code, not a Studio editor or saved player data.

## Marking geometry without splitting batches

`engine/models/core/nature-surface.js` marks an owned geometry with one scalar
`natureSurface` attribute, stored as a normalized byte. The shader decodes it
into values 0–1 for grass coverage, 2 for foliage and 3 for bark. Grass coverage
derives from authored green vertex colors; sandy, rocky,
snowy and concrete regions remain unmarked. A slope filter prevents grass on
cliff faces. Explicit plant tags avoid relying on green color to identify leaves
after they share a material with other objects.

`static-batch.js` preserves the attribute and fills missing values with zero
only in batches containing tagged geometry. This is necessary: the same white,
vertex-colored material can contain both tree crowns and plaster/stone. Material
tags would either texture the plaster or require extra draws. Instancing retains
the tag and the shader includes each instance matrix, so repeated prototypes get
different world-space patterns. Rest positions keep detail attached during wind.
The canopy/plant helpers and tree factories mark leaves and wood; small rings,
fruit and architectural parts retain their authored finishes.

The surface shader changes color in the existing draw; it allocates no texture
and adds no triangles. Tagged geometry adds one byte per vertex, and each map owns a
bounded set of replacement materials. Original cached materials stay unchanged.
The map's idempotent disposer releases its replacements. Fine details and broad
patches use pixel-footprint filtering; distant surface marks never become noisy dots.

## Nearby 3D grass

`tracks/grass-field.js` scatters deterministic clusters along the circuit, using
the existing `savannaGrass({detail:'ground'})` factory. The lightweight variant
has seven broad, bent blades and 21 triangles; the original full savanna model
retains its geometry. Tufts are about 0.55–1.1 m high, scaled/rotated per placement,
with darker roots, brighter tips and a small wind bend.

Each map has at most 1,800 tufts (1,000 on the four water worlds), in one instanced
draw without alpha textures or grass shadow casting. This adds at most 37,800
triangles. Medium draws a shuffled third, Low hides the field completely. The
vertex shader shrinks tufts smoothly between 45 and 95 m from each camera,
including split-screen and Studio, without rebuilding geometry every frame.

Terrain builders expose `userData.grassGrid`. `grassAt()` interpolates the same
two triangles used by the mesh, including its byte coverage. Five support samples
keep tufts from floating on slopes; placements reserve roads/shortcuts and reject
water, weak grass coverage and low overlying scenery such as paving/foundations.
Coverage rays partition large static batches into temporary 24 m CPU cells;
raycasting the entire neighborhood for every tuft substantially slows loading.
These proxies borrow positions, never enter the scene and are released after use.
Grass itself is decorative and has no raycast/collision response.

Only nonempty fields enter `T.animated`: the race calls its registered tick
functions directly. Studio clones the field material; its updater reads the live
mesh material so preview wind follows the clone. Grass owns its material and
ordinary map disposal releases its geometry.

## Quality and cloning

The existing `applyRaceQuality` writes `material.userData.natureDetail.value`:

| Setting | Value | Surface detail |
| --- | --- | --- |
| Rápida / baja | 0 | Original flat colors; procedural shading bypassed |
| Equilibrada / media | 1 | Broad surface variation and one third of the 3D tufts |
| Nítida / alta | 2 | All nearby tufts, larger ground marks, finer leaves and bark fissures |

This changes live and after track replacement through the existing shared
settings subscription. It does not automatically select quality from FPS. Routes,
colliders, tree placements, vehicle handling and networking are unaffected.

Three's standard `Material.clone()` loses `onBeforeCompile`. `NatureMaterial`
therefore implements `copy()` and retains the original cliff/wind shader hook,
recipe and independent detail uniform. Studio can safely clone it before
wireframe controls or release. Quality is a uniform, so toggling tiers reuses
compiled programs. Preserve that contract when adding another surface pattern.

## Proof

`npm run test:browser -- carreritas/tests/nature.browser` checks rendered tier
differences, return to low pixels, fixed surface-shader geometry/draw/texture/program
counts across tiers, reduced/hidden tuft counts, mixed tagged/untagged batches, instanced trees, Studio
cloning, original wind hooks, idempotent disposal, 50 distinct recipes, five real
environments, grounded roadside placements and live race quality through map
replacement. Salt flats explicitly have zero grass coverage or tufts. Ignored screenshots and metrics are in
`art/nature-surfaces/`. Rendering counts are not an FPS measurement.

Also run all Carreritas suites, model architecture/library, Studio cache and
`.\dev.ps1 check` after changes to shared tags or batching.
