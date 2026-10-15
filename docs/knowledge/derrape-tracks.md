# Derrape track system

Derrape supports multiple maps. Everything lives in `games/derrape/public/`:

- `tracks.js` — registry (`TRACKS`, `getTrack`, `makeTrack`). Turns a track
  definition into the runtime `T`: `pointAt/paramOf/offsetOf/groundAt`,
  `TOTAL`, `HW`, `LINE`, `ramps`, `animated`, and `T.build()` which returns
  the scenery group. Two geometry backends: `oval: {S, R}` (exact original
  math, retained as an optional backend) and `points: [[x, z], ...]` (closed centripetal
  Catmull-Rom sampled into a lookup table).
- `track-kit.js` — shared prop builders (fence, chevrons with auto bend
  detection, tire walls, signs, bridges, water, palms, windmill, birds…).
  Anything with `obj.userData.tick(t, dt)` is collected at build time and
  animated during the race.
- `tracks/<id>.js` — one file per map: geometry, palette, ramps, item
  positions (fractions `u` of the lap, never absolute), and a
  `scenery(group, kit, T)` function.

## Gotchas

- **Positive `off` is the `(-tz, tx)` side** of the direction of travel —
  `placeOnTrack`, `scatter`, items and walls all share this convention.
- Most circuits hard-confine cars to `|off| < HW - 1.6`; Selva opts into
  drivable rough ground and natural obstacle collisions instead. Keep scenery at
  `|off| >= HW + 3`. Straddling props (gates, arches): pillars at
  `|off| >= 10`, lintel clearance `y >= 5.5`.
- A straddling prop built along local X needs `rotation.y = p.h` (NOT
  `p.h + PI/2`) — `p.h = atan2(tx, tz)` already maps local X perpendicular
  to travel.
- Wall collision works on any curve: the normal is the numeric gradient of
  `offsetOf`. On the oval this is identical to the old capsule math.
- Items are rebuilt per track into `race.trackGroup`, so switching tracks in
  the garage disposes pads/boxes with the group. Only geometries are
  disposed; materials come from shared caches (never dispose those).
- Track choice persists in `localStorage['derrape:track']`; `?track=<id>`
  overrides. New maps also need their import added to `tracks.js`.
- Keep loops drivable: min radius of curvature > 15, lap length 1,000–2,600, no
  self-intersections. Verify with a numeric spline check before shipping
  (control-point drafts often hide tight corners between points).

## Shared worlds (2026-10-14)

The registry has eight maps: estadio, desierto, llanos, chichi, selva, paramo,
plaza and bululu. Playa is consolidated into Bululú, including legacy ID and
Studio bookmark migration. The five rebuilt routes are 2.04–2.60 km; see
`venezuela-circuits.md` for current construction, landmarks and proof. The
shared-world notes below describe the original integration and its contracts.

- `track-kit.js` wraps `/engine/flora.js` builders with `bake()` so the current
  palm's many leaflets do not become hundreds of draw calls per tree. The
  obsolete `props.js` palm and Selva's duplicate ceiba were removed. Páramo
  now uses shared pines; Estadio uses shared mango trees, palms and market props.
- A track's optional `environment(T)` returns `{group,groundAt,update}`.
  It replaces the default terrain and is animated once through `T.animated`.
  Do not copy a game's scenery into a new track definition. Shared Plaza and
  island builders accept a clearance callback before baking scenery.
- `heightAtS(s)` gives centerline elevation; `surfaceAt(x,z)` projects onto the
  road and returns its base height; `groundAt` adds ramps; `terrainAt` is the
  surrounding scenery ground. Road, starting grid, tires, finish line, pads,
  item boxes and the follow-light now account for elevation.
- **Stepped projection caused terrain jitter.** Spline queries now project
  onto the nearest segment, with a fixed center for the refinement scan.
  Never snap elevation to the nearest sample. Descending ordinary terrain
  keeps cars grounded; driving off a ramp still launches them.
- **River water cut through an uphill road edge.** Lowering the terrain alone
  did not lower the river ribbon or foam. The island's optional `road` callback
  reserves the bank across the whole width, lowers the bed and water below
  the bridge, and preserves downhill flow. Bululú's board omits this callback
  and retains its original heightfield and river.
- Pickups must compare car height with the box's local ground, never `y > 3`.
  The default old rule prevented collection on the island's upper road.
- `?debug&auto&track=bululu` exposes `getActiveTrack`, `updateRace`, `toGarage`
  and `renderer` for inspection and fixed-step simulations. The race minimap
  overrides the page's global fixed-canvas positioning.

Verification: all eight tracks completed three-lap bot races, every item row
was collected explicitly, route projection and minimum turning radii passed,
and Plaza / Bululú / Estadio survived repeated switches. Browser clearance
rays sampled 120 points in three lanes on each new map with no scenery in the
car corridor. Bululú completed two board rounds with minigames; Escondidas and
Cocina rendered and their 22 existing rule tests passed.

The browser regression is `Pana/games/derrape/tests/maps.browser.js`. Run with
the server on port 8461 and Playwright available. Optional environment variables:
`PANA_PLAYWRIGHT_PATH` (external package), `PANA_BROWSER_PATH` (browser executable),
and `PANA_TEST_URL` (server origin). No runtime dependency is added to the games.

## Grand circuits and car corrections (2026-10-14)

- `rounded:true` applies two corner-cutting passes before constructing the
  spline. Author streets with generous spacing; this rounds junctions instead
  of introducing tiny-radius hairpins. The arc-length table uses at least
  1,200 divisions. The regression checks both turn directions and route length.
- Sector definitions drive roadside signs and the minimap subtitle. The map
  fits the actual min/max route bounds, including asymmetric town routes.
- The Plaza race uses the shared `house()` and `town:true` courtyard option;
  route clearance opens side streets and the front garden. Its other games
  keep their default courtyard. The extended town is batched into 200-unit cells.
- The original Bululú race scaled the board world by 3.2 in X/Z and 1.7 in Y.
  That race environment has been replaced by authored Los Roques-inspired
  terrain in `tracks/bululu.js`; the board keeps its original shared world.
- Optional spatial cells in `flora.bake()` preserve frustum/shadow culling on
  large environments. Keep the default for existing compact game scenes.
- Construct the finish stripe from along-road and across-road coordinates.
  The old Euler rotation put it lengthwise on some headings. Upward normals,
  full-road width and approximately two-unit depth are now regression checked.
- `detachable()` must subtract the accessory's **local** center from children.
  Subtracting a world-space center moved already-positioned spare wheels to the
  vehicle origin. The test covers a positioned and rotated accessory.
- Machito is now a compact closed-roof utility 4x4 with horizontal grille,
  square lamp surrounds, snorkel and correctly placed rear spare.

Validation also casts 480 clearance rays per map, tests every item row and
completes three laps, then repeats Plaza/Bululú/Estadio map switches. Scenery
rays exclude items and test the named `track-environment` / `track-scenery` groups.

## Plaza street network and hill

`tracks/plaza-layout.js` owns seven avenues, six cross streets, thirty blocks,
the route and `townHeight`. `plaza-town.js` builds perimeter houses, gardens,
the market, a wooded park, a hilltop terrace and outer neighborhoods. Building
placements are independent of the racing spline; clearance filters remove
conflicts with both the circuit and ordinary streets. Main avenues continue
beyond the built blocks. The street network is scenery: racing retains the
existing single-loop projection, lap logic and confinement to the marked route.

The route rises from 0 to about 25.5 units, with a maximum grade near 0.321 and
minimum turn radius above 19. The historic plaza stays flat. The same heightfield
grounds foundations and city streets; terrain blends to a level cross-section
under the race. Mesh clearance must be checked with rays, not just the analytic
height function: coarse terrain interpolation can otherwise poke through road
edges. Pavement, lawns and street markings use separated heights to avoid
overlapping surfaces on slopes. Houses use retaining foundations sampled across
their footprint, rather than floating at a single terrain point.

The shared plaza's `town:true` option uses a courtyard-sized backing plane;
the default 170-unit plane remains unchanged for Escondidas/Cocina. Low kerbs
and temporary barriers replace the race's tyre stacks. Prop constructors and
materials remain shared. Discard source geometry after batching, and retain
shared materials. Before the waterfront extension, the town was about 1.40
million triangles and 774 overview draw calls. Current render counts live in
`venezuela-circuits.md` and the ignored visual-proof metrics.

Optional `track.previewBounds` is a pair of min/max XYZ arrays for Studio;
Plaza includes the surrounding neighborhoods instead of framing only the lap.
Selva uses it too, to include the forest valley. Other tracks keep their existing camera bounds.

`tests/plaza.browser.js [playwright-package] [browser-executable]` checks the
hill, route projection, independent blocks, building/street clearance, foundations,
actual terrain mesh clearance and render budgets, then renders three sections
through the real race camera. Proof is local in ignored `art/studio/plaza/`.
`PANA_MAP_TEST_TRACKS=plaza,estadio,plaza` selects a focused switch/race regression
in `tests/maps.browser.js`; omitting it still runs all eight maps and repeats.

## Selva river valley and temple tunnel

`tracks/selva-layout.js` owns the river samples, gentle route elevation,
interior ridge and tunnel interval. `selva-world.js` builds continuous terrain, a carved riverbed,
a raised plank crossing, waterfall, stepped ruins and forest extending up the
surrounding ridges. Trees and understory use the canonical `engine/flora.js`
factories. `selva-flora.js` owns the sixteen-species planting composition,
including all twelve newer Studio plants. Scenery is merged into spatial material batches. Geometry is freed
after baking while cached materials remain shared. The former tire wall is
replaced by low wooden markers, stones and foliage.

`selva-temple.js` builds an invented Maya-inspired ruin, with stepped stone
portals and jade inlays. Its 68.5-unit passage follows the racing spline from
u=0.445 to 0.505. Interior width is 25.2 units at road level; the corbelled roof
rises to 16.2, with over 12 units of clearance above the outer racing lanes.
The outer earth shell and end faces enclose a real void. Never raise the base
heightfield across the road to make the tunnel hill: that would bury the track.
Roof plants sample the outer shell separately. The race stays on the original
1,141-unit loop, with a gentle maximum grade around 0.085.

The riverbed also cuts below the bridge. Individual deck strips must sample
the route at both ends; flat boxes intersect a curved, sloping road ribbon.
The temple's base samples its rotated footprint on a broad earth terrace;
flatten the terrain beneath it instead of exposing a tall box foundation.
The interior ridge hides the far portal and cars leaving the passage from
the early bend. Keep these sightlines blocked without burying the road.

`tests/selva.browser.js` verifies every racing lane, actual terrain triangles,
the roof over each lane and the full 11-unit chase-camera segment at both
portals and inside the passage. It renders the actual race camera as well as
Studio views. It currently measures roughly 3.90 million triangles, 661
overview draw calls and 678 plant placements; render budgets are regression
checked, not claims of frame rate on every device. Local proof is ignored at
`art/studio/selva/`. Use `PANA_MAP_TEST_TRACKS=selva,estadio,selva` for the
full-race, pickup and switching regression. Both tests accept the existing
`PANA_PLAYWRIGHT_PATH`, `PANA_BROWSER_PATH` and `PANA_TEST_URL` variables.

Planting uses habitat patches rather than the same roadside banana repeated
around the lap: bamboo and broad-leaf understory in the shaded western forest,
fruit/flower groves in clearings, mangles and reeds following the river itself,
and agave/cardón on the exposed eastern ruin slope. Water lilies use y=0.3,
the river's surface, rather than the riverbed. Roof plants use the tunnel shell.
The old map-specific flower model has been removed in favor of shared heliconia.

`meshHeight` interpolates the actual terrain triangles for plant origins and
Selva's `T.terrainAt` driving surface. The
analytic height function can diverge from the four-unit terrain grid on steep
riverbanks; using it directly made narrow stems float. Keep road elevation
independent of this terrain surface. Plant clearance uses each shared
template's rotated footprint radius, with a safety margin outside the road.
The regression checks all twelve additions, lily-pad height/bank bounds,
sampled plant grounding, and forest camera clearance around the whole lap.

### Selva off-road handling

`selva.js` opts into `offroad: {fullAt:4.5, speed:0.36, accel:0.48, drag:0.75}`.
`offroad.js` smoothly increases roughness outside the road edge. `stepCar`
reduces acceleration, bleeds speed and applies drag; turbo retains the grass
penalty. On a sustained full-throttle sample the starter car measures about
11.7 m/s on grass versus 33 m/s on the road, or 17.6 m/s with grass turbo.
There is no automatic steering or positional snap back to the racing line.

`T.groundAt` blends onto the sampled mesh over the first two metres off-road.
Vertical following uses the previous ground sample so descending a bank does
not create a false ramp jump. `selva-driving.js` uses spatially indexed trunks
and ruin footprints, local uphill grade, river banks, and the tunnel shell.
Blocked velocity components are removed, allowing sliding and reverse escape.
Limit tunnel collision to its actual lateral shell; testing only the spline
parameter incorrectly creates invisible walls far out in the forest. A car
that lands in water must be able to move toward shore even on a flat riverbed.
Environment `constrainMotion` is optional and resets during every `T.build()`.
Other circuits retain their existing road confinement.

`tests/selva-driving.browser.js` exercises the real car simulation: grass speed
with and without turbo, stationary shoulder control, steering back onto the
road, trunk entry/reverse escape, steep banks, tunnel walls and river recovery.
`tests/selva.browser.js` also traces 27 opponent sightlines and the far portal's
cornice from three early-lap views. Keep these tests with the full map race and
switch regression when tuning terrain or physics.
