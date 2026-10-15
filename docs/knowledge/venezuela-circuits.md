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
| Chi Chi | 2.468 km | 99.0 m | Switchback descent, forest, diving school, crescent bay, village and river climb |
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

## Proof

Run with the local server and an external Playwright installation if needed:

```powershell
$env:PANA_PLAYWRIGHT_PATH='C:\path\to\playwright'
$env:PANA_MAP_TEST_TRACKS='estadio,paramo,bululu,chichi,plaza'
node Pana/games/derrape/tests/maps.browser.js
node Pana/games/derrape/tests/venezuela.browser.js
node Pana/games/derrape/tests/loading.browser.js
```

The map suite completes three laps, exercises every item row, casts 480 scenery
clearance rays per circuit, and checks road projection, gradients, finish-line
alignment and terrain intrusion. All five rebuilt circuits pass; minimum turn
radii range from 16.6 to 31.2 m and maximum grades remain below 0.326.
`venezuela.browser.js` checks registry migration, landmarks, rendering budgets,
and captures overview, top, detail and actual chase-camera views. Files are local
under ignored `art/studio/venezuela/`. The loading suite verifies startup,
browsing, cancellation and replay without freezing the animation loop.

Measured actual geometry: Estadio
0.338 M triangles, Páramo 1.872 M, Bululú 1.007 M, Chi Chi 2.596 M and Plaza
2.051 M. Bululú's race previously submitted roughly 14.8 M triangles. Counts
include instances; they are measurements, not gameplay data. Current exact
counts and overview draw calls are in the generated `metrics.json`.
