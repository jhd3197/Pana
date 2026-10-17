# Colonial house maker

The six `colonial-*` house presets in Pana Studio share one factory at
`Pana/engine/models/props/colonial-house.js`. Search the **casas-coloniales** pack,
or open `/studio/assets/colonial-balcony`. The same pack includes three individual
plants, `/studio/assets/colonial-street`, a ten-house street with pavement and
a slight grade, and `/studio/assets/colonial-collection`, an editable 50-house
inspection yard. These entries currently list **Pana Studio** as their consumer;
existing game maps retain their established scenery.

## Recipes and controls

`colonial-house-definitions.js` contains plain family/palette/preset metadata.
`colonial-house-spec.js` is renderer-free: `createHouseSpec(options)` resolves a
seed and inputs into a versioned JSON recipe. `readHouseSpec(data)` validates a
saved recipe against its canonical inputs. `rerollHouse(spec, seed, locks)` keeps
selected structure, palette and/or planting categories. Plant and palette streams
do not change the building's openings or footprint.

Supported families: `casa-baja`, `casa-larga`, `casa-esquina`, `casa-balcon`,
`casa-portal`, `casa-remate`. The balcony family has two floors; the long house
and porch have one; the other families allow one or two. Widths are 5.8–12 units
(9–12 for long houses), depth 4.5–8, floor height 3.6–4.4. Unsupported dimensions,
seeds, families and recipe versions fail before mesh construction. Seeds are
unsigned 32-bit integers. Version 2 adds independent `windowStyle`, `roof` and
`layout` choices; structure locks retain all three. Version 3 adds `wallFinish`
and `finishSeed`. Version 2 recipes are validated and migrate to `lisa` so saved
houses keep their appearance. Version 1 imports retain the original straight
grille, gabled tiles, classic layout and clean paint.

| Parameter | Choices |
| --- | --- |
| `windowStyle` | `reja` straight bars; `reja-curva` projecting grille and scrolls; `postigos` hinged shutters and divided glazing; `arco` arched glazing and fanlight; `doble` wider divided opening; `celosia` wooden louvers |
| `roof` | `tejas` gabled tiles; `cuatro-aguas` four tiled slopes; `azotea` terrace with parapet |
| `layout` | `clasica` repeated bays; `lateral` entrance on the right; `amplia` fewer, wider openings |
| `wallFinish` | `lisa` clean paint; `cal` soft plaster variation; `ladrillo-pintado` faint painted masonry accents; `ladrillo-visto` small exposed terracotta brick patches |

These are authored extensions of the reference language. The terrace and some
window combinations are additional variants, not claims that every option appears
in the supplied images. Arch panes/bars follow the curved opening. Shutters hinge
outward instead of spreading along the wall into neighboring frames. Hipped and
flat roofs use a closed soffit; balcony posts meet the selected roof's underside.

```js
import { createHouseSpec } from '/engine/models/props/colonial-house-spec.js';
import { colonialHouse } from '/engine/models/props/colonial-house.js';

const spec = createHouseSpec({
  seed: 22, family: 'casa-balcon', width: 7.2, depth: 5.8,
  palette: 'azul', planting: 'balcon', windowStyle: 'reja-curva', roof: 'tejas',
  wallFinish: 'ladrillo-visto', finishSeed: 47,
});
const house = colonialHouse({ spec, detail: 'game' });
```

The inspector's **Creador de casas** controls appear for these presets and the collection.
**Aplicar cambios** commits edited fields; **Otra casa** rerolls the current
resolved recipe, honoring the **Fijar** checkboxes. **Acabado de paredes** selects
the finish; the **Acabado** checkbox retains both its style and finish seed.
Lock structure, colors and plants to reroll only the wall treatment. **Copiar receta**,
**Guardar JSON** and **Cargar receta** exchange the complete versioned recipe.
Inputs not yet applied do not replace the visible model. The default catalog
thumbnail and asset URL remain the preset; use the JSON to save a custom house.

**Generar 50 casas** uses the collection seed and deliberately covers the six
window designs, three roofs, three layouts and all four wall finishes. Every house has a different
family/window/roof/layout/floor combination, independent of paint or dimensions.
Choose an individual entry in **Ver o editar**; applying edits updates that entry
in memory. Return to **Todas** to copy/save the entire collection. In individual
view, copy/save exports just the selected house. Import accepts either format and
rejects invalid or oversized collections before replacing the preview.

`createHouseBatch(seed, count = 50)` supports 1–50 recipes. `saveHouseBatch(houses)`
and `readHouseBatch(data)` exchange a validated `{type:'colonial-house-batch',
version:3,houses:[...]}` document; the reader also accepts saved version-2 batches.
`createColonialHouseCollection({houses})` lays
these out at fixed 16×14-unit spacing, with low detail for the overview. Individual
editing uses game detail. This yard demonstrates variations, not a road generator.

## Geometry, placement and ownership

Factories return owned geometry in a native THREE.Group, y=0, front +Z. Materials
use the shared cache. `pueblo.js` forwards explicit `family`/`spec` calls to this
builder; existing `colonialHouse({seed,color})` calls retain their legacy geometry
and footprint. The original `house` and island `casita` are unchanged.

Facades use actual wall holes with recessed wooden panels and layered frames,
sills and grilles. Door and window heads align. Balcony upper doors leave a solid
central wall for the lantern, and each planter rests on a small rail shelf.
The porch recess is structural. Lanterns use emissive material, not point lights.
Static parts merge into five material batches on the six reference presets.

`userData.houseSpec` includes the shell `footprint`, conservative full-detail
`envelope`, `entrance`, faces and opening rectangles. `partyWalls` suppresses
openings on selected left/right/rear faces; it is not a complete zero-gap rowhouse
solver. Keep the projection envelope clear when placing neighbors. Games own
collision/navigation and must explicitly translate this metadata into their
existing rules. Doors are closed scenery, not playable entrances.

`detail:'low'` reduces tile rows, leaf and louver counts while retaining the
same recipe and placement metadata. The reference models are about 11k–34k
triangles before wall decoration at game detail and 6k–27k at low detail. Wall
finishes add a few thousand triangles per house without extra material batches.
The seed-103 50-house overview measures about 814k triangles, 223 meshes and five
materials; it is an inspection scene, not a mobile game budget. Do not stretch
the models nonuniformly to fill lots; generate their dimensions directly. The
street assembly in `engine/colonial-street.js` uses uniform scale and
terrain-supported plinths.

## Stylized wall finishes

`colonial-house-finish.js` decorates the main plaster walls on all four faces.
Soft, seeded color variation uses a lightly subdivided surface with vertex colors.
Sparse brick clusters use shallow geometry, staggered courses, small chipped
corners and a plaster/mortar edge. Most of the wall keeps its principal paint
color. Frames, doors, balconies, trim and the base course keep their clean finish.

Decorations occupy solid-wall rectangles with a margin around the opening and
its frame. This also keeps overlays out of arched reveals. The finish seed has
its own stream per face/floor: changing finish or palette cannot move the shell,
windows or plants. Low detail reduces plaster subdivisions but preserves brick
placement and the recipe. Slightly separated layers avoid coplanar flicker.

Use the existing vertex-color material/bake path. Do not replace this with
per-house texture canvases or shader hooks: that would change texture ownership,
material cloning and static batching. All four finishes use the same material
and draw-call counts as clean houses, with zero textures. The two-floor comparison
adds about 2.5k triangles for plaster or 4.7k with bricks at game detail.

## Architectural planting

`gardenRosette`, `trailingVine` and `trinitaria` have independent vegetation files.
They reuse botanical leaf/stem geometry and static material batching. The
`house-garden.js` assembly keeps pots separate from foliage, reserves the entrance,
and places plants at sill, balcony and wall anchors. Entrance pots reserve every
ground-floor door, including the long house's second entrance. `trailingVine` has a grounded
preview and explicitly reports its upper attachment in `userData.attachment`.
Subtract that attachment when mounting it on a planter.

Architectural foliage is static in this first version. Ordinary plant wind uses
local vertex height; baking an elevated balcony vine into world coordinates would
move its attachment and amplify sway. Add attachment-relative deformation before
animating these plants. Leaf planes on hanging vines face outward so they remain
readable from the street, instead of showing only their thin edges.

## Verification

- `node --test Pana/engine/tests/colonial-house.test.js`: 360 family/seed recipes,
  spacing, dimension validation, JSON round trips, locks, 50 distinct architectural
  combinations and independent cosmetics.
- `node Pana/engine/tests/colonial-house.browser.js`: real geometry, recessed doors,
  determinism, ownership, quality tiers, six reference renders, six window
  closeups, 24 variations and a 50-house contact sheet with placement envelopes.
- `node Pana/web/studio/tests/house-maker.browser.js`: actual controls, locks,
  clipboard/import/download validation, 50-house editing and batch round trip,
  navigation, mobile overflow and street clearances.
- `node Pana/engine/tests/colonial-finish.browser.js`: four finishes in yellow/blue,
  actual decoration bounds against opening frames, deterministic owned geometry,
  unchanged material/draw-call counts and a 6k-triangle decoration allowance.
- Existing model architecture/library, Pueblo settlement and Studio cache suites.
- `.\dev.ps1 check` for syntax, unit tests and conventions.

Playwright is installed with the repository. Use `PANA_TEST_URL` for a fresh test
server; `npm run test:browser -- colonial-finish colonial-house house-maker`
runs the focused suites. Screenshots and measured metrics live under ignored
`art/studio/colonial-houses/`. The older settlement suite is scoped to the numbered
`pueblo`/`mountain` packs: later circuit-life models share their UI categories but
are covered by their own model/library checks.
