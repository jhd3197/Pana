# Road and ground polish for the generic circuits

The thirteen circuits that use the generic road (`buildRibbon`, no
`authoredRoad`) borrow the reference-ported maps' surfaces. The nine
`coastalTrack` maps are unchanged.

## Roads

`tracks/road-material.js` holds `ROAD_STYLES`, keyed by track id: asphalt
(Estadio, Plaza; Chichi and Páramo with a double yellow centre line), earth
(Desierto, Selva, Llanos, Salto, Delta: ruts, crown, pebbles, dusty edges,
grass tufts on Llanos and Delta), sand (Bululú, Salinas: ripples, two soft
tyre tracks) and neutral grain (Cuevas, Puerto keep their vertex tints).
`roadTexture()` paints one tile on a canvas; `buildRibbon` gives it UVs that
run continuously across the lap seam and disposes it with the road. The
texture paints the edge lines, so race-details no longer adds edge blocks;
brake marks and shoulders take a darker or paler shade of the style.

The module is folded into `road-material.js` rather than a new file: Derrape's
first load sits at the 160-module cap. For the same reason the library
`reflectorPost()` lives in `engine/models/props/wood-sign.js` (Studio entry
`reflector-post`). Reflector posts line Chichi and Páramo every 18 m outside
the rails where the verge is level; `vergePosts` on Desierto, Llanos, Cuevas
and Salinas use the same model. Posts batch one per material: per-cell batches
broke Chichi's draw-call budget.

## Ground and forest

`tracks/ground-paint.js` adds broad tone, straw patches, bank moss and a worn
verge, opt-in through `terrain()` in `world-kit.js`; each map hands the painter
in from its lazily loaded file. The horizon takes only the broad noise.

`tracks/library-forest.js` plants a map's `def.forest` recipe after its
scenery, using an occupancy grid to keep clear of landmarks, paths, plazas and
water. `background-forest.js` falls back to its old planting without a recipe.
New trees go only to the far zone (beyond 70 m): Plaza's start view was already
at its driving-view cap, and Estadio, Chichi and Páramo are within ~150k
triangles of their overview budgets. A visible roadside band needs either a
cheaper near-tree model or larger budgets.

| Map | Forest | Triangles before → after |
|---|---|---|
| Estadio | 1,800 mango, ceiba, palm, araguaney | 1.26M → 1.34M |
| Desierto | 60 cardones | 1.19M → 1.45M |
| Llanos | 2,800 moriche, samán, araguaney, mango | 3.11M → 3.30M |
| Chichi | 1,800 ceiba, mango | 4.74M → 4.82M |
| Selva | 1,600 far hills | 5.40M → 5.38M |
| Páramo | 260 frailejón, fir | 2.22M → 2.24M |
| Bululú | 324 palms, mangroves on far cays | 1.17M → 1.17M |
| Plaza | ground paint only | unchanged |

`coastal-vegetation.js` adds samán, araguaney and frailejón species and
`cellSize` / `whole` options without changing the reference-ported maps.
