# Venezuelan circuits

The October 2026 rebuild uses the user's supplied photographs as visual
inspiration, with authored race layouts rather than geographic replicas.
The registry remains eight circuits. `playa` resolves to `bululu`; Studio's
`#track-playa` bookmark resolves to `#track-bululu`. The old module also re-exports
Bululú. The original Bululú board-game environment is unchanged.

| Circuit | Lap | Elevation range | Features |
| --- | ---: | ---: | --- |
| El Estadio | 2.224 km | flat | Linked chicanes, hairpins, covered grandstands, football pitch, pit garages and floodlights |
| Pana Páramo | 2.255 km | 93.8 m | Frailejones, glacial lake, rocky meadows, snowy mountains, modern summit terminal and moving cable cars |
| Isla Bululú | 2.044 km | 5.1 m | Los Roques-inspired white cays, shallow lagoons, village, lighthouse, peñeros and mangroves; Playa Pana is a sector |
| Chi Chi | 4.880 km | 195.0 m | High ridge, Aguas del Cielo thermal terraces, mountainside switchbacks, misty forest/waterfall, diving village, crescent bay and river bridges |
| Plaza Pana | 2.598 km | 25.5 m | Original town plus four canal peninsulas, two-storey villas, docks and a 300 m Maracaibo-inspired bridge |

## Construction

`tracks/world-kit.js` contains game-local terrain, batching, spatial foliage
instances, water and placement helpers. `world-landmarks.js` contains the new
station, lift, bridge, villas, dive school, coastal lookout and grandstands.
Native Three.js geometry and shared architecture/flora keep the assets consistent
with the rest of Pana. No image textures or geographic data were imported.

`paramo-layout.js` and `chichi-layout.js` separate the racing line from the
surrounding landform. Road height is continuous; terrain blends to a clear road
cross-section. Plant foundations use interpolation of the actual terrain
triangles, not just the analytic function. Landmark platforms sample their whole
footprint. Station terraces flatten the base terrain to avoid giant support boxes.
Plaza's water is excluded from the bridge deck; the route supplies the physical
driving surface while the bridge supplies deck structure, pylons and barriers.

Static scenery is merged by material; repeated foliage uses spatially grouped
`InstancedMesh` geometry. Do not rebake instances: `static-batch.js` operates on
ordinary meshes. Source/prototype buffers are disposed after construction.
Canvas signs retain texture disposal callbacks, now called by game map switching
as well as Studio. Studio triangle/vertex counts include instance multiplicity.

The cable lift receives absolute time through the environment's single update
callback. Child motion is not separately registered, preventing double updates.

## Chi Chi thermal expansion

The springs are an authored interpretation of the user's family recollection,
not a claim about real geothermal sites. The new loop is almost twice its former
2.468 km length. The upper road meets a flattened 173 m spring terrace before
descending the mountainside; the river climb returns to the 200 m ridge.
`chichi-layout.js` owns the route, heights, shelf, wetness and river coordinates.
`chichi-thermal.js` composes the pools, fumaroles, walkways and mist;
`chichi-village.js` builds the expanded waterfront and curved river bridges.
The optional `world-kit.terrain` cut runs after road carving, allowing river
channels under bridge decks without changing the driving surface.

Five real shared factories in `engine/thermal-props.js` appear under Studio's
Termales category: hot spring, steam vent, mineral terraces, bathhouse and lookout.
Steam uses instanced billboards with deterministic phases and absolute-time
uniforms. Its conservative culling bounds must not determine asset thumbnail
framing: thermal factories provide `userData.previewBounds` for the catalog.
Studio clones materials, so steam updates the live mesh material, while disposal
still releases its originally allocated material. Ripple groups also own their
material disposal. Never send these animated roots through static batching.

`def.gripAt` is opt-in, read by `roadGripAt` independently of off-road drag.
About 15.7% of the Chi Chi road has noticeably reduced grip, down to 0.54 near
mineral runoff; irregular puddles and low plumes mark those sections. It reduces
lateral damping and braking, without inventing driveable shortcuts through the
pools or changing other maps. Keep testing the real car simulation, not only
the helper's numerical return value.

## Proof

Run with the local server and an external Playwright installation if needed:

```powershell
$env:PANA_PLAYWRIGHT_PATH='C:\path\to\playwright'
$env:PANA_MAP_TEST_TRACKS='estadio,paramo,bululu,chichi,plaza'
node Pana/games/derrape/tests/maps.browser.js
node Pana/games/derrape/tests/venezuela.browser.js
node Pana/games/derrape/tests/chichi.browser.js
node Pana/games/derrape/tests/loading.browser.js
```

The map suite completes three laps, exercises every item row, casts 480 scenery
clearance rays per circuit, and checks road projection, gradients, finish-line
alignment and terrain intrusion. All five rebuilt circuits pass; minimum turn
radii range from 16.6 to 31.2 m and maximum grades remain below 0.326.
`venezuela.browser.js` checks registry migration, landmarks, rendering budgets,
and captures overview, top, detail and actual chase-camera views. The Chi Chi
suite checks wet braking/slip, dry defaults, bridge water, model grounding,
material ownership, repeatable steam motion after cloning, and six driver views.
Files are local
under ignored `art/studio/venezuela/`. The loading suite verifies startup,
browsing, cancellation and replay without freezing the animation loop.

Measured actual geometry: Estadio
0.338 M triangles, Páramo 1.872 M, Bululú 1.007 M, Chi Chi about 4.387 M and Plaza
2.051 M. Bululú's race previously submitted roughly 14.8 M triangles. Counts
include instances; they are measurements, not gameplay data. Current exact
counts and overview draw calls are in the generated `metrics.json`.
