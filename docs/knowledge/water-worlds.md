# Derrape water worlds

Plan: `docs/plans/56_derrape-grand-prix-and-water-worlds.md`. Draft routes are
available only with `?waterDrafts`; production metadata remains unchanged until
the release proofs pass. Each map has separate layout, world and definition
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

## Outstanding release proof

Finished-scene screenshots, source/lip/pool continuity, mobile presentation,
wet/dry tire behavior, Studio model previews, repeated resource disposal and
two-client races are required after detailing. No physical-device FPS claim
may be inferred from the headless reference above.

## Detailed-world proof and integration

The authored environments pass the 1 m route/projection checks, three-lane
car clearance, forward/look-back chase rays and eight-car two-lap driving.
Measured environment triangles: Salto 1,503,713; Delta 1,705,138; Cuevas
1,043,390; Salinas 764,805. Delta initially exceeded the 1.8 million budget;
reducing distant mangroves/reeds/palms fixed it without narrowing the route.
The final Salinas water response samples the runtime deck plus the same 13 cm
clearance used by the rendered water. Its causeways remain dry.

Agua's initial release preset is 2/3/2/2 laps. Full-cup timing/balance and
reference-device rendering remain separate gates; these accelerated driving
times are not FPS claims. Shared waterfall supports a sloped run for Bululú;
the effect owns three draws, 36 mist instances (12 at low quality), no targets,
and absolute-time animation. Galope places the canonical landing shelter on
its existing dock without changing course/collision data.

The focused Derrape unit suite passes 73 tests after twelve-track registration.
Full multiplayer, Studio, resource and consumer regression proof is in progress.
