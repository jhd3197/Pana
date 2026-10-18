# Derrape — scenery from the circuit artwork

The illustrated circuit cards are visual references. The playable route, terrain,
road clearance and existing render budgets remain the placement constraints.
Search the model inventory first: houses, churches, bridges, boats, market stalls,
windmills and lookout furniture already have canonical factories.

## Circuit-life models

| Model / Studio ID | Factory | Native placement |
| --- | --- | --- |
| Glorieta musical / `plaza-bandstand` | `props/plaza-bandstand.js` → `plazaBandstand` | Plaza Pana's raised Mirador terrace; replaces the closed house pavilion |
| Patio de cosecha de sal / `salt-harvester` | `props/salt-harvester.js` → `saltHarvester` | Salinas, (-15, 345), on a terrain-supported foundation |
| Astillero de peñeros / `boat-repair-yard` | `props/boat-yard.js` → `boatRepairYard` | Plaza's waterfront quay at (577, 340), facing the bridge, and Bululú's coastal village at (-185, -33) |
| Cauchera del circuito / `tire-workshop` | `props/tire-workshop.js` → `tireWorkshop` | Two Estadio pit garages, (-200, 220) and (-182, 220) |
| Flamenco de las salinas / `flamingo` | `fauna/birds/flamingo.js` → `flamingo` | Twelve birds along three pink pond banks, including a group of eight |

Factory paths are relative to `Pana/engine/models/`. Every factory returns a
ground-origin group, +Y up and +Z forward. The four prop definitions live in
`props/catalog/circuit-life.js`; the bird is in `fauna/catalog.js`. The same
factories render in Studio and the maps. Boat yards reuse `fishingBoat`; the salt
station reuses `saltPile`. Neither embeds a second implementation of those models.

The pavilion and workshops use `architecture-kit.finish` to batch their static
geometry. They add no textures or downloaded assets. Standalone model counts:

| ID | Triangles | Draw calls |
| --- | ---: | ---: |
| `plaza-bandstand` | 4,650 | 6 |
| `salt-harvester` | 3,367 | 10 |
| `boat-repair-yard` | 7,490 | 18 |
| `tire-workshop` | 3,568 | 6 |
| `flamingo` | 2,440 | 5 |

Flamingos have static standing/feeding poses. The map instances each pose once
across its placements, rather than drawing twelve separate models. Feet use
`world.groundAt`, which samples the actual terrain triangles; bird sites require
8–50 cm of water, road clearance, and distance from sluice channels. Do not use
the analytical pond radius alone: irregular rims and triangulated banks disagree
with it. The colony has `detailLevel=1`, so Baja hides it; landmarks remain visible.
The additions create no network messages or synchronized simulation state.

## Placement proof

`reference-scenery.browser.js` builds all five real catalog models, checks finite
geometry and ground origins, renders previews, and builds all four native maps.
It ray-tests the added geometry against three driving lanes every four metres,
checks actual support below each placement, verifies bird depth/grounding and
quality behavior, and captures native-context plus ordinary race-camera views.

Support rays start slightly above the contact point. Starting below an apron or
terrace falsely reports the lower terrain as the supporting surface. The proof
also finds an unobstructed view along the route; a fixed distance before the
nearest spline point can leave a roadside landmark behind the camera.

Screenshots and metrics are ignored under `art/derrape-scenery/`. Existing Plaza,
water-world, map and lifetime suites remain the regression checks; do not raise
their budgets to accommodate extra scenery. Plaza's dedicated geometry suite
measures 1,271 draw calls and 4,429,452 triangles against its existing 1,300-call
and 4.6-million-triangle ceilings, with no floating buildings or blocked streets.
These are geometry/render-count checks, not a measured frame-rate or
slow-connection benchmark.

## Remaining scenery ideas

The five implemented models above are priorities 1–5. These are candidates,
not claims of shipped content. Reuse existing furniture, boats, plants, houses
and structural helpers when building an assembly or a new visual variant.

| Priority | Idea | Suggested setting |
| --- | --- | --- |
| 6 | Ice-cream cart with umbrella | Plaza, Bululú |
| 7 | Fish-auction canopy with baskets and scales | Plaza waterfront, Delta |
| 8 | Raised salt-worker boardwalk | Salinas pond banks |
| 9 | Ceramic fountain with patterned basin | Plaza civic square; variant of existing fountain |
| 10 | Shaded café terrace | Plaza; assemble existing tables and seating |
| 11 | Laundry courtyard | Plaza and Bululú residential blocks |
| 12 | Coastal navigation beacon | Bululú and Plaza harbor |
| 13 | Cargo handcart | Quays, markets and salt yards |
| 14 | Fruit-delivery truck | Plaza market, Llanos farm stands |
| 15 | Water-pump work station | Salinas sluices, Llanos |
| 16 | Street mural wall | Plaza, Estadio entrances |
| 17 | Shaded domino spectators' corner | Plaza, Bululú; reuse table-game props |
| 18 | Kite garden | Bululú headland, Estadio grounds |
| 19 | Fish-drying racks | Delta and coastal villages |
| 20 | Salt-loading truck | Salinas work yard |
| 21 | Flower nursery | Plaza outskirts; assemble existing plant models |
| 22 | Coastal picnic pergola | Bululú viewpoint |
| 23 | Mechanic's tow truck | Estadio pits, roadside service areas |
| 24 | Small open-air cinema | Plaza neighborhood square |
| 25 | Lagoon observation blind | Salinas, Llanos |
| 26 | Mangrove research station | Delta |
| 27 | Mountain roadside food terrace | Páramo; reuse stalls and seating |
| 28 | Jungle trailhead camp | Selva, Salto del Tepuy |
| 29 | Pottery kiln yard | Plaza artisan district |
| 30 | Harbor travel-ticket booth | Plaza waterfront, Bululú |

## Festive roadside (`tracks/festive.js`)

Eleven circuits (all but Selva and Salinas) call `festive(group, T, theme)` from
their `scenery`. It only decides placement. Everything it places is a Studio
library model:

- Trees and shrubs use the low variants: `araguaney({detail:'low', bloom})`,
  where bloom `pink` is the Studio "Apamate" and `coral` is "Bucare en flor",
  plus `palm`, `hibiscus`, `heliconia` and `trinitaria` with `detail:'low'`,
  and `bromeliad`, `agave`, `gardenRosette`, `mossRock` and `lajaRock`. Low
  variants cost 15–25 % of the full model (an araguaney goes from 9.7 k to
  1.4 k triangles). When a model is too heavy for roadside use, add a
  `detail:'low'` path to that model. Never add a one-off look-alike.
- Fiesta props live in `engine/models/props/fiesta.js`: balloon bunches,
  feather flags, bunting, a checkered banner and a hot-air balloon. Each is one
  or two vertex-coloured meshes, with cloth on the shared plant wind. Stands
  are the library `iceCreamCart`, or `beachShade` on Bululú, capped at 5 per
  track because a cart is 7.7 k triangles.
- Flocks use `engine/models/animation/bird-flock.js`. It instances any
  flight-rig bird (`scarletMacaw`, `scarletIbis`, `soaringVulture`, created
  with `detail:'low'`). Each child, the body and each wing, merges into one
  vertex-coloured instanced mesh, so a species costs 3 draws. Morphos use
  `morphoField`, which costs 2 draws. Both have `detailLevel = 1`, so Baja
  hides them.
- Each model is instanced through `instancePlacements` with `cellSize`
  Infinity, or 1400 m on Chi Chi and Puerto. Only trees and stands cast
  shadows. One spatial cell per mesh adds up fast: mossRock is 3 meshes, so
  scatter it with 500 m cells, not the old 110–220 m boulder cells.
- `clear()` already enforces `HW + 5 + r`. Theme bands are metres beyond that.
  Placement skips gaps, water, ground below `minY`, ground more than `maxDrop`
  from the road (tunnels, bridges, cliffs), and existing
  `userData.footprintRadius`. Plaza passes its house footprints as `avoid`.
- The only geometry `festive.js` builds itself is the distant horizon: one
  merged mesh of hills, rounded peaks or tepuy mesas past the playable area. Its
  ring sits at `max(1.25 × route reach + 150, 0.72 × fog far)`. Nearer hills
  read as blobs, and cones read as pyramids. `meadow(x, z, base)` varies grass
  colour in broad warm and deep patches for the terrain colour functions.
- Palettes set `halo` (`engine/sky.js`, default 0) for the golden glow around
  the sun. Horizons stay pale aqua or cream. A peach horizon under a blue
  zenith blends to lavender-grey.
- Races keep `NoToneMapping`. ACES at 0.86–1.0 dulled the display-referred
  vertex colours without softening anything the palettes don't already handle.
