# Cosmos, Mérida, Arrecife, Volcán, Nubes and Dulce

The six user-supplied HTML scenes are native Carreritas circuits, registered as
standalone races without changing saved Grand Prix editions. Each has a layout,
world and track definition in `Pana/games/carreritas/public/tracks/`. The layout
retains the reference's route chapters and terrain data. The world retains its
landmarks and animations, but no demo traffic, renderer, audio, camera controls,
UI or frame loop. Music borrows existing recordings through the usual aliases.

`reference-world.js` adapts their sampled routes through `coastalTrack` and owns
reference-created materials/textures. Texture constructors also record unused
prototype textures so leaving a map releases those too. Scenery randomness starts
from the map seed on every build. Mérida uses shared ceibas, pines, tree ferns and
frailejones via `coastalVegetation`; flush these after collecting owned resources
so shared library materials survive map replacement.

## Road and terrain contracts

Fair the sampled XZ route before building the ribbon, terrain or props. These
ports use a 16-sample fairing window and the shared height relaxation. The road
is at least 16 source metres wide. Horizontal scale is 1.3 except Volcán's 1.9:
the latter keeps its tightest reference hairpin above the 15 m minimum radius.
Do not scale heights with XZ. Cosmos and Volcán default to one adventure lap.

Spirals use layered projection. `track-runtime.js` passes the caller's height
through both `paramOf` and `offsetOf` when adding crossfall; dropping that hint
can select another deck even when the original height query was correct.
Bank interpolation follows cumulative horizontal distance. The physical surface
includes the ribbon's 12 cm offset. `reference-support.browser.js` independently
raycasts the authored road at the centre and both edges around each lap.

Land-only nearest-road rasters omit Mérida's water segment. They cannot reserve
the full corridor at its slipway endpoints: the shore originally rose through
the lane by about 40 cm. The adapter caps nearby terrain vertices below **every**
road sample, including water and bridge approaches, with a full-cell margin.
The same final height array feeds terrain meshes and ground queries.

Mérida's lake segment uses the existing boat transform gates. Gate fractions are
computed in horizontal arc length from the tagged `w` samples, not normalized
reference indices. The racing corridor stays bounded by the buoys; this is not
an open-water shortcut. Nubes retains the two-turn spiral and its distinct decks;
its stone needle has a 30 m base radius to keep the faired inside lane clear.
The waterfall approach bows east before returning to the island, adding an
opposing bend to the otherwise almost entirely clockwise reference route.

Measured runtime geometry after adaptation:

| Circuit | Lap | Minimum radius | Maximum grade |
|---|---:|---:|---:|
| Cosmos | 5.018 km | 53.05 m | 0.116 |
| Mérida | 3.237 km | 15.31 m | 0.138 |
| Arrecife | 2.872 km | 44.47 m | 0.083 |
| Volcán | 4.874 km | 15.85 m | 0.115 |
| Nubes | 3.314 km | 30.97 m | 0.098 |
| Dulce | 2.712 km | 47.31 m | 0.088 |

Each completes the existing three-lap bot race with working item rows and no
sampled lane obstructions. The independent visible-road support check measures
at most 4.2 cm difference across the dry lanes; Mérida's water run is checked as
a boat segment. Cosmos and Mérida rebuild with identical geometry signatures.

## Rendering and verification

Reference shaders use the current `colorspace_fragment` chunk and textures use
`SRGBColorSpace`. Carreritas owns the sun, fog and renderer. The custom sky meshes
preserve the authored worlds; Arrecife's sky shader uses underwater colours below
its actual waterline. Volcán's ambient light is lifted to keep the next bend
readable without removing the dusk atmosphere.

`reference-circuits.browser.js` selects and drives every circuit with two real
clients. `reference-support.browser.js` checks visible/physical road agreement,
geometry budgets, the Mérida crossing and deterministic rebuilds. The four
`maps*.browser.js` partitions share the existing route, grade, lane clearance,
item and three-lap assertions; adding maps must not silently omit a partition.
Driver screenshots and menu art come from the real game through `shots.js`.
These software-WebGL checks do not establish physical-device frame rates.

For visual redesigns, keep using `carreritas-map-improvements.md`: Bululú's road
composition and Puerto's layered-road lessons apply, but their palette, camera
height and banking angles are not a universal recipe.

## Fast effect quality

Cosmos, Nubes, Volcán and Arrecife opt into `referenceDetail`. Rápida bypasses
Cosmos's layered sky/planet noise, reduces cloud-sea and lava noise to one
sample, replaces lava cellular noise with a cheap pattern, and disables reef
caustics. These are uniform switches; Nítida restores the original shaders.
The adapter supplies uniforms once per material, including shared materials.

Decorative Points draw 10% / 50% / 100% of their seeded buffers across
Rápida / Equilibrada / Nítida. Their CPU position updates skip inactive entries.
Sprite effects retain one in eight / one in two / all sprites. Identity parent
masks preserve local transforms and prevent animated visibility from overriding
quality. Only scenery updates are capped at 15 / 30 / unrestricted Hz; roads,
physics, multiplayer, cars and race presentation retain their existing cadence.
Absolute race time keeps animation phase consistent and resets correctly on replay.

The reference-quality suite checks live restoration, unchanged road geometry and
player position, particle/sprite reductions, decorative clock rates and repeated
Cosmos loading. Reference-support and reference-circuits retain road and real
two-client proof. These reductions are not measured FPS on a player's device.
