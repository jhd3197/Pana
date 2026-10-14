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
- Cars are hard-confined to `|off| < HW - 1.6`; keep scenery at
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
- Keep loops gentle: min radius of curvature > 15, lap length 1,000–2,200, no
  self-intersections. Verify with a numeric spline check before shipping
  (control-point drafts often hide tight corners between points).

## Shared worlds (2026-10-14)

The registry has eight maps: estadio, desierto, llanos, playa, selva, paramo,
plaza and bululu. Plaza now extends the shared courtyard into a 1,404-unit town
route; Bululú has a 2,112-unit coastal and inland course. The other six maps
range from 1,091 to 1,175 units, with authored bends in both directions.

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
  keep their default courtyard. The extended town is batched into 100-unit cells.
- Bululú race geography scales by 3.2 in X/Z and 1.7 in Y. Its route leaves the
  coast, crosses the river and returns through the forest and harbor. Shared
  props compensate for that transform so trees and houses do not become giants.
  Terrain road queries must divide distance/width by 3.2 and height by 1.7.
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
