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
| Pana Desierto | 2.243 km | 34.1 m | Pana Gas yard, terrain-fitted dunes, eroded mesas, two rock gateways, canyon pillars and an oasis well stop |
| Los Llanos | 2.325 km | 2.2 m | Two hatos, working wind pumps, cattle corral, pastures, morichal, connected esteros, two bridges and a roadside arepera |

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

### Ranch and canyon circuit rebuild

`desierto-layout.js` and `llanos-layout.js` own the route, road elevation and
terrain shapes. Their world modules compose all ten respective pack factories;
`group.userData.assetCounts` records actual placements for browser proof.
The main hato and service yard sit alongside the opening straight. Sector signs and
clear road edges guide the longer laps, with corners in both directions.

Desierto's mesa profiles have irregular, steep walls and broad tops. Dunes reuse
the pack model but fit owned vertices to sampled terrain and blend their skirts
into the sand. Cacti and rock pillars use spatial instances. Two 25 m arch
openings remain outside the 18 m racing corridor. Buildings get foundations;
small equipment sits on the ground instead of separate square plinths.

Llanos' riverbed is cut after road carving, leaving the race ribbon elevated
above two channels. `country-details.crossing` sweeps decks below that ribbon
and rails outside it. The connected water uses the exact 5 m terrain grid and
triangle split, with signed `waterDepth = surfaceY - groundAt(x,z)`. The water
shader discards dry fragments; this removes overlapping pond seams and keeps
the shore on the actual mesh. The caño continues beyond the terrain boundary.
Do not replace it with coplanar ellipses. Environment animation ticks water once,
alongside windmills and grazing cattle; static batches exclude these roots.

Measured full-scene geometry is 895,872 triangles / 483 meshes for Desierto and
1,330,108 / 720 for Llanos. Before the rebuild those were 848,431 / 1,016 and
1,228,390 / 1,443 respectively. More scenery and longer routes add modest
geometry while roughly halving mesh counts; these are not FPS measurements.
Both pass three AI laps, 480 lane-clearance rays, grounded grid/item checks,
continuous projection and zero terrain intrusion. Maximum grades are 0.1584
and 0.0140; minimum turn radii are 33.24 m and 30.52 m. Water proof checks
sampled depth agreement and exactly two wet river crossings below the road.
Six actual chase views per circuit, detailed model yards and overviews live in
ignored `art/studio/venezuela/`; old views are in `art/studio/rural-maps/`.

### Living water and the tidal causeway

`engine/water-surface.js` supplies a single-pass shader for ocean swell, shallow
caustics, broken shoreline foam, river currents and calmer lakes/canals. Surface
detail fades with distance to avoid moiré at the horizon. Rivers have transverse
depth and longitudinal distance attributes; control points run downstream
(Selva's layout array runs upstream, so its water factory receives a reversed
copy). Llanos' connected caño and esteros share one surface at y=0.65.
Ocean color and foam sample a 256² RG depth texture from the actual terrain.
Colors are linear Three.js colors, with tone mapping, color-space and fog chunks
for both the race renderer and Studio. No extra reflection render pass is used.

Tick the live `ShaderMaterial`: Studio clones materials and shader texture
uniforms. Disposal releases both the original depth texture and any live cloned
texture. Environments explicitly compose their water update with existing
landmark animation; normal scenery already receives child ticks.

Bululú's northern sandbar (route progress .665–.805) is lowered to 0.48 m and
supported by sand, with channels excavated on either side. The 28-second surf
cycle in `bululu-tide.js` shrinks the dry road from 18 m to 9.5–10.5 m. Its
animated inner vertices and `tideWetness` use the same front function, with a
gentle handling transition behind the foam. `def.waterAt(x,z,time,T)` opts in;
other roads remain dry. Water reduces lateral grip to 0.6, acceleration by up to
28%, and applies 0.7/s forward drag. Tire spray uses the existing bounded
particle pool. The dry center retains normal handling, and the ordinary road
boundary never moves. Race time drives physics and visuals; previews can scrub
and races can restart without accumulating motion state.

Switching away from Llanos exposed a cleanup issue: character disposal removes
children, so calling disposers during `Object3D.traverse` invalidates its child
iteration. `beginTrack` now collects callbacks/geometries before disposal,
matching Studio's existing release pattern.

`water.browser.js` checks visual/physical shoreline agreement, a dry center over
two cycles, real-car slowdown/slip, grounded driving, repeatable geometry and
rendered pixels after scrubbing, animation in all seven water-bearing circuits,
shader errors and original/cloned texture disposal. It captures low/high tide,
driver-level views and all water families under ignored `art/studio/water/`.

### Regression commands

Run with the local server and an external Playwright installation if needed:

```powershell
$env:PANA_PLAYWRIGHT_PATH='C:\path\to\playwright'
$env:PANA_MAP_TEST_TRACKS='estadio,paramo,bululu,chichi,plaza,desierto,llanos'
node Pana/games/derrape/tests/maps.browser.js
node Pana/games/derrape/tests/venezuela.browser.js
node Pana/games/derrape/tests/chichi.browser.js
node Pana/games/derrape/tests/water.browser.js
node Pana/games/derrape/tests/loading.browser.js
```

The map suite completes three laps, exercises every item row, casts 480 scenery
clearance rays per circuit, and checks road projection, gradients, finish-line
alignment and terrain intrusion. The five earlier rebuilds and both ranch/canyon
circuits pass; minimum turn radii range from 16.6 to 33.3 m and maximum grades
remain below 0.326.
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

## Outdoor colour pass (October 2026)

All eight track palettes now use clearer blue skies, less cloud cover and more
neutral sunlight. Llanos gains green grass/teal channels; the desert uses golden
sand and terracotta strata; Chi Chi/Selva use richer greens; Páramo keeps cool
snow and mountain greens. Plaza's town palette adds stronger ochre, coral,
turquoise and blue painted facades. Bululú retains bright sand and Caribbean
water. Terrain topology, route geometry and shared asset defaults are untouched.

The live game still uses its existing NoToneMapping renderer; this is material
and lighting direction rather than a screen saturation filter. Studio tours
read each track's sky palette. Galope independently uses its shared course
DAYLIGHT values with exposure 1 instead of its earlier yellow exposure 1.2 wash.

`PANA_PLAYWRIGHT_PATH=... node Pana/games/derrape/tests/colour.browser.mjs` builds
and renders each real circuit through the game at fixed positions, checks browser
and shader errors and records palette/draw counts. Optional `PANA_COLOUR_TRACKS`
selects a comma-separated subset. Before/after captures are in ignored
`art/world-colour/`; the colour changes add no geometry, lights or rendering passes.
