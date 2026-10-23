# Carreritas track system

For the tested full-map improvement workflow and Bululu's coastal profile,
see `carreritas-map-improvements.md`.

## Repeatable map audit

`node Pana/scripts/map-audit.js --out art/map-audit/baseline` audits the
registry, or a `--tracks plaza,selva` subset. It starts a fresh server and
isolated browser context per map, seeds randomness, uses a 1280×720 driver
view, and writes ten fixed poses plus route/camera/render metadata. The
`--quality alta|media|baja` option controls scenery quality; render resolution
is explicitly one pixel per CSS pixel for comparisons. Race tone mapping is
used even though the normal animation loop is disabled.

Each map then restarts and runs a one-lap automated race through the actual
physics and presentation updates. Its telemetry and completion are separate
from the posed pictures; a successful pose capture does not prove a lap.
The output identifies the source revision, working diff, CPU and WebGL
renderer. Synchronous render timings are diagnostic submissions, not live FPS
or representative mobile performance. Keep all evidence ignored and compare
the same device/settings. Existing browser suites still own correctness and
budget assertions.

Add `--motion 12 --start .5` for a driver sequence starting halfway round the
lap. It advances actual physics at 60 Hz and records every third step, with
camera/vehicle states and a local `motion.html` player. Playback is 20 frames
per simulated second, independent of capture speed. Use identical options for
comparisons; enabling motion consumes random state before the separate lap.
It does not establish realtime performance or replace a full-lap check.
Use `--poses .50,.53,.56` for a focused sector and `--camera legacy` or
`--camera anticipation` for the debug comparison modes. The manifest records
these choices. Source diffs include staged and unstaged tracked changes;
stage newly added source files before capturing an uncommitted prototype.

## Surface contrast

`roadStyle(T).shoulder` optionally supplies an explicit verge colour. Salinas
uses dusty rose (`#b78f82`) to separate its pale sand road from the salt fields.
Other maps retain their existing dust mix. This only colours the existing
2.4-m sloping shoulder: it adds no texture, mesh or collision, and still skips
water gaps, bridges and decks separated from terrain by more than two metres.

Keep broad wear and edge cues legible before adding fine detail. A pale biome
does not automatically need a darker road: Desierto's warm earth, dust verge
and posts already separate the route. Preserve open horizons in Llanos,
Bululú and Sabana, and free steering across Delta/Margarita lagoons. Local
composition should frame a destination without becoming a continuous wall.

## Twenty authored roadside compositions

Plaza, Selva, Páramo, Bululú and Sabana explicitly opt into
`tracks/authored-sightlines.js` through `withSightlines`. Four sites per map
are named in `sightline-sites.js`; their `u` values are reproducible driver-view
positions. The wrapper adds scenery after each map's own scenery builder. It
does not change road elevation, camera settings or other games' shared worlds.

Placement samples the actual terrain, checks full model bounds against the
road and shortcuts, rejects water, and reserves building/landmark footprints.
Plaza's dry level terrain can be at -0.3 m: do not use the coastal positive-Y
cutoff there. Small deterministic along-road shifts find planting pockets.
Selva's added trunks and rocks chain its off-road collision constraint, with
height checks and escape from overlaps. Static geometry is batched per map;
the source buffers are released. `authored-sightlines.userData.sites` records
the actual accepted placements, not just candidates.

The Selva plateau and Bululú palm sites specify six candidate triples of
along-road distance, setback and scale. Selva keeps six accepted trees with
overlapping crowns; Bululú accepts five palms in two uneven groups with a
central opening. Crown clearance is strictly greater than five metres beyond
the road edge: a setback of exactly five rejects candidates. Keep the existing
clearance and footprint guards when composing groups, and inspect accepted
placements rather than counting the source array. These profiles reuse the
existing models and batches without changing the route or terrain.

Páramo's existing 2.25 M overview triangle limit remains unchanged. Its new
roadside pine variants retain the shared library's opaque crown tiers but use
a simple trunk instead of hidden internal branch tubes. Frailejón variants
retain the rosettes and flower centres without individual petals. These are
private instances; the shared library factories and other maps are unchanged.
The pass adds about 26.6 k geometry triangles to Páramo, rather than the initial
221.6 k from dense full-detail flower rows.

`sightlines.browser.js` checks all twenty sites exist, raycasts the added
geometry through driving lanes and chase-camera sightlines, verifies Selva's
off-road entry collision, and caps incremental geometry and batch counts.
The existing Plaza, Selva and Venezuela map suites own whole-map budgets and
terrain checks. For matched visual comparisons, freeze a driver pose, render
with the named scenery group visible, then hide only that group and render
again without advancing the simulation. This preserves lighting and particles.

## Plaza: Casas Botes return bank

The return road now has a physical 16-degree crossfall on lap fractions
0.530–0.569. `returnBank` in `plaza-layout.js` holds the inner (positive
offset) edge at its former height and lifts the outer edge about 5.16 m.
Smoothstep ramps reach full banking at .548–.556 and finish before the next
left turn. The existing runtime generates the road, ground queries and
kerb heights from this same crossfall; the nearby town terrain blends from
that surface. This changes the road silhouette independently of camera roll.
`banking.browser.js` probes rendered road/support agreement across the lane,
limits transition grades, checks the outer/inner edges and verifies car roll
in both driving directions.

`plaza-town.js` adds a compact planted bank around `(478, 196)` beside the
return bend, visible around 53–55% of the lap. Its height is part of the town's
`groundAt`, so visible terrain, prop foundations and terrain queries agree.
The analytic height builds the initial mesh; once its grass grid exists,
`groundAt` samples the actual triangles through `grassAt`. This matters near
the compact bank boundary, where smooth-formula heights differ from the
five-metre mesh. Props, paving and off-road queries use the sampled surface.
`plaza.browser.js` compares off-grid bank queries against independent terrain
rays; `nature.browser.js` checks grass supports without relaxed tolerances.
The mound fades outside an oriented ellipse and before road and side-street
setbacks; it does not alter `townHeight`, route elevation or the chase camera.
Five candidate mango placements use shared low-detail models, reject occupied
sites and road clearance conflicts, and join the existing vegetation batches.
Keep this a short enclosure followed by a town reveal, not a tree wall around
the lap. Use driver-camera captures on approach and exit to judge changes.

## Puerto

The thirteenth circuit joins a container terminal, colonial waterfront and
hilltop fort inspired by La Guaira. Route, terrain, scenery, ownership and
verification details are in `puerto-circuit.md`.

## Road-level race detail

`tracks/race-details.js` adds a small deterministic decoration group to all
twelve current runtimes: paired bend/braking marks (ruts on earth roads), short
painted edge blocks on paved tracks, and sector pennant clusters. Palettes vary
by circuit. Marks follow the road surface and pennants sample actual terrain,
reject water, large height differences and road/shortcut clearance conflicts.
They do not add colliders or change the route. `detailLevel` connects these
groups to the shared quality setting through `quality.js`.

`tracks/road-material.js` adds distance-filtered aggregate grain and broad wear
variation to the existing road draw. Earth roads use broader, stronger variation
than asphalt. It is procedural, with no texture allocation. Its uniform follows
quality (full / half / disabled); disposing the road releases its material.

Opaque pennants use the existing batcher in four global material batches.
Their few thousand triangles are cheaper to submit together: 190 m cells
pushed Plaza's overview to 1,310 draws, above its unchanged 1,300 budget.
Global batches bring that same overview to 1,248 draws with 4,434,126 triangles,
passing both existing limits. This is a draw-count check, not an FPS measurement.
The one road mark material is instance-owned and explicitly disposed on map replacement.
No texture downloads, per-frame prop rebuilds or network scenery messages.

Carreritas supports multiple maps. Everything lives in `games/carreritas/public/`:

- `tracks.js` — registry (`TRACKS`, `getTrack`, `loadTrack`, `makeTrack`).
  `TRACKS` starts as names and blurbs (`track-definitions.js`); `loadTrack(id)`
  imports `tracks/<id>.js` and fills that entry with its full definition (about
  100 modules of world per map, so only the picked one loads). The garage shows
  name and blurb at once and the route preview when the module lands; the
  loading screen awaits it. Debug pages (`?debug`) load every map before
  `PANA_PREPARED`, so suites can still call `buildTrack(id)` synchronously.
  `makeTrack` turns a loaded definition into the runtime `T`: `pointAt/paramOf/offsetOf/groundAt`,
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
- Track choice persists in `localStorage['carreritas:track']`; `?track=<id>`
  overrides. A new map needs its entry in `track-definitions.js`; `tracks.js`
  finds `tracks/<id>.js` by id.
- Keep loops drivable: min radius of curvature > 15 and a lap of at least 1,000 m.
  Ordinary circuits are around 2 km; Puerto extends to 6.60 km and defaults to
  one adventure lap, with an estimated 3–4 minute whole race. XZ crossings
  require explicit layered heights, verified vertical clearance and moving-car
  tests on both decks (see `puerto-circuit.md`). Verify with a numeric spline check before shipping
  (control-point drafts often hide tight corners between points).

## Shared worlds (2026-10-14)

The registry has eight maps: estadio, desierto, llanos, chichi, selva, paramo,
plaza and bululu. Playa is consolidated into Bululú, including legacy ID and
Studio bookmark migration. The five rebuilt routes are 2.04–2.60 km; see
`venezuela-circuits.md` for current construction, landmarks and proof. The
shared-world notes below describe the original integration and its contracts.

- `track-kit.js` wraps `/engine/models/vegetation/` builders with `bake()` so the current
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

The browser regression is `Pana/games/carreritas/tests/maps.browser.js`. Run with
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
surrounding ridges. Trees and understory use the canonical `engine/models/vegetation/`
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

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Carreritas's eight circuits include Plaza Pana, Isla Bululú and Chi Chi. Playa
is now a sector of the Los Roques-inspired race island; legacy `playa` IDs
resolve to `bululu`. All trees come
from `engine/models/vegetation/`.
`createPlazaEnvironment()` provides scenery without lights, while
`createIslandEnvironment()` shares Bululú's vegetation, harbor, sea and
landmarks. Island terrain/scenery/beach modules now live in `engine/`;
old Bululú paths re-export them. Keep gameplay in the games, and pass route
clearance to the shared environment instead of copying its assets.
`engine/worlds/sky.js` supplies scene-owned skies to outdoor games and Studio tours.
Cloud wind uses absolute time; palettes accept `skySeed` and `cloudCover`.
Keep the sky outside scenery batches/bounds; the tour disposes it on exit.
Bululú still owns its day/night lights, stars and moon. Plaza bunting is a
separate live mesh with fixed cable attachments and absolute-time cloth motion.
The shared `house()` has tejas/balcon/tienda/terraza styles, registered in Studio;
preserve the 5.4 m shell, ground origin and road clearance. Its painted trim
is color-batched before the town repeats it. See `docs/knowledge/living-world.md`.
Race routes are 1.14–4.88 km with bends in both directions. Plaza extends
the shared courtyard into a pueblo. Its game-local `tracks/plaza-layout.js`
owns the street grid and hill; `plaza-town.js` builds blocks independently of
the racing line. Keep streets and buildings clear as well as the race lanes.
`plaza-waterfront.js` adds Casas Botes and the Maracaibo-inspired bridge.
The race island has its own light coastal terrain; the original Bululú
board world stays independent. `world-kit.js` batches static landmarks and
spatially instances shared flora. Do not pass instances through `bake()`.
`engine/worlds/coastal/world-horizon.js` joins the exact playable terrain-grid boundary to
coarser surrounding land; keep that mesh as a child of the original terrain.
It also extends coastal water without changing its near grid/depth-map domain.
Preserve explicit Studio framing bounds rather than fitting the whole backdrop.
Plaza's outer streets join residential lanes; Llanos' extra water samples the
actual outer bank triangles and closes before its grid boundary. `landscape-kit.js`
ground overlays use polygon offset for distant views. `ceiba({detail:'distant'})`
is a lighter form of the same canonical tree for repeated groves. Estadio's
parked cars reuse garage factories, remove/dispose the driver, and color-batch
opaque trim before instancing. See `docs/knowledge/circuit-surroundings.md`.
Páramo and Chi Chi use elevated, continuous roads over carved terrain;
keep waterways below the road and inspect actual chase-camera views.
Chi Chi now spans 195 m of elevation, with springs, mountainside switchbacks,
forest, a dive village and river bridges. Its thermal shelf and bridge channels
use the optional post-carve terrain cut. Wet grip is opt-in through `def.gripAt`
and `roadGripAt()`; preserve dry defaults and normal road confinement elsewhere.
Bululú's `bululu-tide.js` shares one absolute-time wash front between visible
geometry and `def.waterAt(x,z,time,T)`. Use race time for grip, drag and tire
spray; preserve at least 9.5 m of dry center at peak tide. This is an opt-in
flooded edge, not a moving collision wall. Track cleanup collects disposers
before invoking them because character disposal detaches scene children.
See `docs/knowledge/venezuela-circuits.md` for construction and validation.
Selva's `selva-world.js` builds the river valley and shared forest assets;
`selva-temple.js` sweeps a hollow tunnel along the road. Keep the terrain
below its driving surface and test the chase camera through both portals.
`selva-flora.js` composes eighteen shared species by habitat, including the
giant jungle tree and tropical bush. Keep its footprint clearance, water height,
and sampled terrain grounding; do not duplicate plant geometry in the map.
Selva opts into off-road drag through `offroad.js`. Its `selva-driving.js`
constrains motion against trunks, steep banks and tunnel masonry, while grass
leaves steering to the driver. Keep the interior ridge's tunnel-exit sightline
tests and reset environment motion callbacks when rebuilding a track.
The race island uses expanded geography
with normal-sized assets. Keep those options opt-in for the original games.

## Shortcuts, open edges, hazards, rain (plan 53)

- `shortcuts: [{ from: [u, off], to: [u, off], w, arch }]` builds a plank
  road (`track-kit.js plankRoad`). `T.plankAt` is the deck height; walls are
  off on it, scenery (`world-kit clear`), rails (`edges`) and sector signs
  step aside. Off the plank the car falls and the zamuro rescues it.
- Pick chords with a scan of the *built* world, not the spline alone: test
  the deck against `terrainAt` (hills bury it) and against non-instanced mesh
  boxes (buildings). Batched city blocks slip past box tests, so look at a
  top-down render too. Fixed landmarks that call `clear()` throw when a plank
  crosses them (Los Llanos' water windmill did): drop that chord.
- Keep the gain at 35–120 m once the plank's 0.72 speed cap without turbo is
  counted, and never let a chord cross the line or skip two of the eight
  checkpoint sectors (`course-rules.js advanceLap`).
- `drops: [{ u0, u1, side }]` opens an edge (ground past it is the real
  terrain). Only use it where the model has no rail or fence: every bridge and
  water crossing found so far has one.
- `hazards: [{ kind: 'cow' | 'bus' | 'rock', u, phase }]` cross on the race
  clock, so online screens agree. Cows stay inside roadside fences; buses and
  rocks need a cross-street or open dune on both sides.
- `rain: 0..1` greys the palette, cuts grip (rain cauchos keep their floor)
  and turns on the camera-following streaks.

For artwork-inspired props, native placements, batching and clearance proof,
see [Carreritas scenery](carreritas-scenery.md).

### Optional crossfall

Salinas supplies `def.crossfall(s, offset, T)` for its dry crossing line.
The coastal-family adapter also supplies crossfall from its authored bank
profile. Sarisarinama explicitly disables it to preserve height-disambiguated
projection through its stacked spiral. `surfaceAt`, the generic road ribbon's
center column and `placeOnTrack` use the same crossfall function. Salinas's outer
positive lane rises up to 60 cm at the shallow crossing, preserving a dry line
without changing other maps. Water depth gives the rendered road its existing
13 cm clearance. `water-crossing.browser.js` checks 1,000 sections for a dry
lane, every road vertex against physics, and three cars on street/rain tires.

## Distance raster, point tags and far plane

- Spline tracks build a distance raster on the first `paramOf`/`offsetOf`
  call (not when the menu browses routes): a grid of about 2 m cells
  covering the route plus 96 m, each storing the nearest centreline sample.
  Two sweeps of a vector distance transform keep the build linear: 5–20 ms
  for 1–2.7 km tracks, about 70 ms for Puerto's 562k cells. `nearest()`
  then refines ±6 m of route around the samples named by the four cells
  around the point: 0.2–0.5 µs per call, against 0.65–3 µs for the old
  stride-16 scan, which grew with track length. Outside the grid it falls
  back to the scan (`T.nearestScan`).
- Layered tracks (Puerto) flag raster cells where a sample more than 60 m
  along the route, at a height differing by 2 m or more, lies within 40 m.
  Height-aware lookups in those cells use the scan with its altitude
  penalty, so stacked roads keep choosing the branch by height.
  `maps.browser.js` checks that the raster never finds a farther road
  than the scan.
- `T.roadDistance(x, z)` (bilinear raster distance, within about half a
  cell near the road) and `T.clearOfRoad(x, z, margin)` are the cheap
  scenery-exclusion and off-course queries; `T.raster` exposes the grid.
- Points may carry a 4th tag, `[x, z, y, tag]`: `g` ground (default), `b`
  bridge, `l` ledge, `a` arch, `t` tunnel. Use `[x, z, undefined, 'b']` on
  an `elevation` track: only a numeric 3rd element switches to authored
  heights. Rounded corner cuts keep the tag of the nearer point.
  `T.tagAt(s)` and `T.tagRuns()` (`[{tag, from, to}]` in u, a run across
  the line has `to > 1`) let builders put structure on each run.
- The race cameras' far plane is `max(1800, fog far)`, set with the palette.
- `hollowGallery` accepts `widthAt(u)` and `heightAt(u)`; `hallProfile(base,
  [{u, add, spread}])` builds Gaussian halls. The corridor in
  `userData.corridor` carries both functions for placement against walls.

## Salt mine under Salinas (tracks/salt-cave.js)

- Salinas runs 2.83 km: the old salt-flat loop, then a detour north through
  a salt mine (u .385–.765) under a pink mountain. The ford moved from
  u .445 to u .283; `water-crossing.browser.js` follows it.
- `salt-cave.js` is reusable: `caveMountain` wraps a track's ground (flat
  hall floors, an 80 m mountain over the shell, the caller's ground past the
  mouths), `caveColor` paints it, `saltCave` builds the shell, crystals
  (one instanced field per 5% of route, so far halls cull), pools, waterfall,
  formations, mine timbers, portals, beams and motes, and `caveFog` turns
  the fog rosy and close while the camera is inside. Layouts that Node tests
  import keep their own hall profile maths (no Three.js).
- Six point lights on the giant crystals are the only lights; the shell and
  formations use a pink emissive so the cave never reads dark. Environment
  draws peak near 840 with eight cars at u .79 (budget 850 without cars).
