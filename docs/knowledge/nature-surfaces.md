# Procedural grass and tree surfaces

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
