# Derrape water worlds

The four routes
are available in Carrera rápida, Copa del Agua and Studio without a debug flag.
Each map has separate layout, world and definition
modules. World geometry is game-local; reusable objects live in `engine/models`.

## Greybox geometry and budgets

Reference: headless Chromium, 1280 × 800, default quality. This is software
WebGL geometry/functional proof, not measured physical desktop/mobile FPS.
`tests/water-worlds.browser.js` builds the real constructors, traces 360 lane
rays and 240 forward/look-back chase segments per map, samples the actual
terrain, and runs eight cars for two laps through normal steering/checkpoints.

| Map | Length (m) | Min radius (m) | Max grade | Eight-car two-lap completion (s) |
| --- | ---: | ---: | ---: | ---: |
| Salto | 2676.47 | 32.74 | 0.189 | 168.1 |
| Delta | 1603.87 | 30.44 | 0.064 | 105.5 |
| Cuevas | 1798.57 | 33.33 | 0.082 | 117.2 |
| Salinas | 1799.91 | 25.82 | 0.038 | 123.2 |

All greyboxes had zero car/camera obstacles, no terrain protrusion, and lane
projection error below 0.12 m. Measure normals with a centered tangent: a
forward-difference tangent rotates an outer-lane sample and produces an apparent
0.4 m projection error on Salinas without a route crossing.

Pre-detail hard budgets: 1.8 million environment triangles, 850 environment
render submissions, 36 waterfall mist instances, three waterfall draws, zero
additional render targets. Full eight-car views may submit up to 3,200 draws
because the established vehicles are not scenery batches. Track one retained
world after transitions. Record loading and frames separately from triangles.

Fixed camera fractions: 0, .18, .40, .62 and .79, plus individual signature
positions. Artifacts: ignored `art/water-worlds/<id>/geometry.json`,
`eight-car-race.json`, `driver-*.png`. The initial two-lap times are simulation
pace only; loading and intermission are not included.

## Water and geometry contracts

`water-world-math.js` supplies pure bed/channel/pond queries. `channelAt`
returns the downstream arc distance and surface height from authored points.
`waterGrid` samples actual terrain triangles and gives road decks priority;
the shader discards dry fragments using signed depth. Channels are cut after
road carving so a bridge never dams the river or moves the driving surface.

Salto's high source terrace is separate overhead geometry. The gallery is a
real hollow passage with an open river side; its roof is never returned by
`groundAt`. Cuevas uses the same swept-corridor helper with two daylight gaps.
No drivable lanes cross in X/Z. Salinas ponds have independent irregular banks
and sluice channels; its shallow-road wetness comes from the pond field and
road elevation, not an independent timer.

The new waterfall takes explicit width/height and owns a curtain, foam and a
36-instance mist pool. All motion reads absolute time, including Studio rewind.
Low quality reduces mist to 12 instances and curtain motion, preserving the
visible water and wet-road cue. It allocates no reflection pass or texture.

## Release proof requirements

Finished-scene screenshots, source/lip/pool continuity, mobile presentation,
wet/dry tire behavior, Studio model previews, repeated resource disposal and
two-client races are covered by the final evidence below. No physical-device
FPS claim may be inferred from the historical headless reference above.

## Detailed-world proof and integration

The authored environments pass the 1 m route/projection checks, three-lane
car clearance, forward/look-back chase rays and eight-car two-lap driving.
Measured environment triangles: Salto 1,503,713; Delta 1,705,138; Cuevas
1,043,390; Salinas 764,805. Delta initially exceeded the 1.8 million budget;
reducing distant mangroves/reeds/palms fixed it without narrowing the route.
The final Salinas water response samples the runtime deck plus the same 13 cm
clearance used by the rendered water. Its causeways remain dry.

Agua's release preset is 2/3/2/2 laps. Full-cup timing/balance and
reference-device rendering are recorded separately; these accelerated driving
times are not FPS claims. Shared waterfall supports a sloped run for Bululú;
the effect owns three draws, 36 mist instances (12 at low quality), no targets,
and absolute-time animation. Galope places the canonical landing shelter on
its existing dock without changing course/collision data.

The focused Derrape unit suite passes 73 tests after twelve-track registration.
The final proof and remaining device-validation limits are recorded below and
in the plan's completion audit.

## Final map and control evidence

The final geometry/camera run passes all four maps. Salto's expanded receiving
pool/open gallery measures 1,514,749 environment triangles; the other final
counts are Delta 1,705,138, Cuevas 1,043,390 and Salinas 764,805. Maximum sampled
environment submissions (including track furniture/items, excluding racers)
are 372 / 458 / 347 / 310 respectively after the final vegetation batching,
within the predeclared 850 limit.
Eight cars completed two actual laps in 161.3 / 97.9 / 112.0 / 118.3 simulated
seconds. These remain geometry/functional results, not device FPS claims.

Each map folder now contains `route.svg`, an overview, nine real chase views,
mobile landscape, geometry metrics, render counts and an eight-car race record.
`water-controls.browser.js` additionally drives each built map with real W
input, a controller, and a held CDP touch; throws a mango and verifies the
zamuro returns the car to its safe road deck. Salinas' separate crossing suite
checks the continuous dry lane and three cars with both street/rain tires.

The seven shared water-world models pass actual Studio adapter renders. The
waterfall submits three draws, reduces mist from 36 to 12 instances, supports
absolute 0→17→0 scrubbing and disposes its own resources. Model architecture
and twelve-map Studio tours passed. Bululú's two-client Chinazo suite and
Galope's two-client riding/touch, landscape, water-FX and Studio suites passed.

Final vegetation uses 190 m cells with the same placements and whole-world
triangle counts. A geometry recheck covers all lane and
chase rays plus the nine driver views after that render optimization. Desktop
GPU timing is recorded in `derrape-performance.md`; the physical-phone run was
explicitly waived by the user, without replacing it with emulated FPS claims.
