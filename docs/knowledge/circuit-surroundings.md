# Complete circuit surroundings

The October 2026 pass addresses visible world edges and empty surroundings in
Carreritas. It preserves the eight racing routes, elevations, widths and handling.
It builds on the earlier living-sky and varied-house work.

## Continuous land and water

`Pana/engine/worlds/coastal/world-horizon.js` attaches one coarse landscape
mesh to each original terrain mesh. The first ring copies the exact grid boundary
positions, colors and normals. Eight further rings reach 3,800 m beyond that
boundary, past the racing fog distance. Llanos has low rolling savanna; Estadio
and Plaza have gentle surrounding hills; the other regions retain their own
terrain functions. This is real terrain, not a fog wall or a vertical skirt.

`heightAt()` locates the radial strip and interpolates its actual triangles in
at most sixteen checks. `world-kit.terrain().groundAt`, Plaza and Selva use this
outside their original grids. Returning the original analytic height there is
incorrect: the coarse mesh differs around banks and hills. A regression first
caught this as a 2.72 m Llanos water-depth error. Water now samples the same
triangles as placements; independent ray tests agree to floating-point precision.

Coastal water keeps its original near grid and depth-map domain. A far apron uses
the same material and world-space waves. Plaza's apron extends only into its lake
quadrant. Llanos' single signed-depth water mesh continues beyond the old rectangle
and closes against the actual banks before its own boundary. Its extended vertices
are still on the original five-metre grid. No overlapping pond surfaces were added.

Keep Studio `previewBounds` focused on the authored area; never fit the whole
backdrop. Estadio's bounds include its expanded venue. The sky remains scene-owned.

## Authored surroundings

- Plaza: two connected outer residential lanes replace cut-off arterial roads;
  51 extra homes, 26 planted courtyards, 187 additional trees including twelve
  palms on the eastern bridge approach. Curved lane clearance is sampled from
  the actual lane curves. House grounding and existing street tests remain intact.
- Llanos: four pastures, 216 additional fence sections, gates, harvest rows and
  bales, 297 additional trees/palms and fifty reed clumps along the river. The
  existing ranches, fauna and their reserved space remain intact. It remains an
  open savanna with grouped woodland and morichal, rather than a forest circuit.
- Estadio: perimeter walls and railings, two entry openings, entrance signage,
  a connected concourse and parking access, 130 bays, 27 parked garage vehicles,
  four planted infields, 162 additional trees, seating/concessions and two extra
  grandstands (eight total).

The game-local `landscape-kit.js` drapes soil, paths and planting beds over the
placement surface and keeps them outside racing lanes. Polygon offset prevents
flicker from distant overview cameras; parking paint has a stronger offset than
the ground below it. These overlays do not change driving collision heights.

`ceiba({detail:'distant'})` reuses the canonical tree's shape and palette with
fewer trunk segments, smaller crown tessellation and no leaf sprigs. Near models
retain the full default. Trees/fences are spatially instanced outside static
batches. Parked vehicles reuse `CARS` factories, remove/dispose their drivers and
consolidate opaque trim into vertex colors before instancing. This cuts Estadio's
tested starting view from 528 to 424 submissions without changing its geometry.

## Validation and budgets

Run from the app directory, with `PANA_PLAYWRIGHT_PATH` pointing to Playwright:

- `games/carreritas/tests/surroundings.browser.js`: all eight real map factories,
  exact seams, outward ray coverage, placement-vs-mesh heights, closed river ends,
  shader errors, render budgets, overviews and three road-camera views per map.
  `PANA_SURROUNDINGS_BASELINE=1` captures a baseline without continuity assertions.
- `games/carreritas/tests/maps.browser.js`: actual three-lap races, pickups, route
  projection, slopes, obstacle rays and grounded cars across all eight circuits.
- `games/carreritas/tests/plaza.browser.js <playwright-path>`: foundations, streets,
  road clearance, town budgets and actual historic/uphill/downhill race views.
- `games/carreritas/tests/water.browser.js`: actual river depths, bridge channels,
  coastal tide/handling, shader clocks, preview ownership and disposal.
- `engine/tests/map-assets.browser.js`, with `PANA_ASSET_TEST_MAPS` selecting
  `track-plaza,track-llanos,track-estadio`: real Studio materials, asset grounding,
  fauna counts and preview rendering.
- Node/browser model architecture, Studio tour UI and syntax checks.

Plaza's added surroundings bring the complete scene to approximately 4.43 million
triangles, below the 5.28 million measured before the earlier house batching.
The guard is now 4.6 million triangles / 1,300 overview submissions; unchanged
route and foundation tolerances still apply. The focused driving views remain
below 900 submissions / 3.5 million triangles for every tested circuit.

Current screenshots and reports are in `art/surroundings/`, with actual Studio
placement renders in `art/studio/map-rollout/`. These generated assets are
ignored by Git. The source inventory records the new scene assemblies separately
from their reused canonical props.

The Puerto regression pass reproduced Plaza's 3,520,879-triangle starting view
on both unchanged HEAD and the working tree. Its town vegetation now uses 180 m
batch cells instead of 350 m, allowing road cameras to cull more offscreen trees
without removing models or reducing detail. The same view submits 3,493,683
triangles / 680 draws; the original 3.5 M / 900 limits remain unchanged.

Plan 56's full regression found the older Venezuela overview test still using
pre-surroundings limits: Plaza 3 M / 1,000 and Llanos 2.5 M / 1,000. Those world
constructors were unchanged by plan 56. Its measurements are 4,429,882 / 1,242
and 2,977,495 / 1,032 respectively. The overview test now uses Plaza's already
documented 4.6 M / 1,300 guard and a 3.1 M / 1,100 complete-pasture guard for
Llanos. The stricter existing driving-view 900 submissions / 3.5 M geometry
checks remain intact and passed all eight maps. This reconciles the old
inventory test with the shipped surroundings; it is not a new FPS claim.

The same legacy suite assumed Llanos had exactly ten asset IDs. The current
world also places cows, horses and chickens. It now checks each of the ten
required ranch IDs by name, while retaining positive-count checks for every
additional asset.

The festive roadside pass (`tracks/festive.js`, see `carreritas-scenery.md`) adds
about 75 k triangles to Plaza's starting view, from 3,493,683 to about 3.55 M.
That view had only 6 k of headroom, so the driving-view guard is now 3.6 M
triangles; the 900-draw guard is unchanged. Overview guards: Estadio 1.4 M (it
already measured 1.19 M against 1.0 M on unchanged code), Páramo 2.25 M, Llanos
3.4 M, Chi Chi 4.85 M, Plaza 4.7 M. Multi-colour kerbs use one vertex-coloured
material, which brought Estadio's overview from 966 draws to 947 before the
roadside models were added.
Other per-map guards account for the same roadside: Puerto 3.4 M in
`puerto.browser.js` and `nature.browser.js` (3.15 M town plus about 195 k),
the water-world environment guard 1.95 M (Delta 1.76 M plus about 185 k), and
`plaza.browser.js` 4.7 M (4.55 M plus about 70 k). Roadside dressing is
instanced with one cell per mesh. Spatial cells on a 6.6 km map multiplied
Puerto's festive draws from 42 to 109.
