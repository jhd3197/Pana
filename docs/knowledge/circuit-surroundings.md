# Complete circuit surroundings

The October 2026 pass addresses visible world edges and empty surroundings in
Derrape. It preserves the eight racing routes, elevations, widths and handling.
It builds on the earlier living-sky and varied-house work.

## Continuous land and water

`Pana/games/derrape/public/tracks/world-horizon.js` attaches one coarse landscape
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

- `games/derrape/tests/surroundings.browser.js`: all eight real map factories,
  exact seams, outward ray coverage, placement-vs-mesh heights, closed river ends,
  shader errors, render budgets, overviews and three road-camera views per map.
  `PANA_SURROUNDINGS_BASELINE=1` captures a baseline without continuity assertions.
- `games/derrape/tests/maps.browser.js`: actual three-lap races, pickups, route
  projection, slopes, obstacle rays and grounded cars across all eight circuits.
- `games/derrape/tests/plaza.browser.js <playwright-path>`: foundations, streets,
  road clearance, town budgets and actual historic/uphill/downhill race views.
- `games/derrape/tests/water.browser.js`: actual river depths, bridge channels,
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

Current screenshots and reports are in `Pana/art/surroundings/`, with actual Studio
placement renders in `Pana/art/studio/map-rollout/`. These generated assets are
ignored by Git. The source inventory records the new scene assemblies separately
from their reused canonical props.
