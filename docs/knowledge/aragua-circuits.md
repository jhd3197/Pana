# Aragua circuits

Cata, Choroní and Chuao adapt the user-supplied standalone HTML scenes into
Derrape's track registry. They are standalone races rather than changes to
saved Grand Prix editions. Studio discovers them from the same registry;
online track validation also derives from it. Menu pictures are renders of
the actual scenes. Music reuses the coastal and jungle recordings.

## Roads and geography

Each circuit retains its authored coastline, terrain, village and landmarks.
The layout modules expose the same sampled road and height preparation used
by the world builders. `coastal-road.js` fairs the display references' tight
corners before carving terrain and placing scenery. Heights are relaxed to
limit successive grades. Cata's horizontal scale is 1.6 and Choroní's is 1.3;
Chuao stays at its authored scale. Heights are not scaled. These choices keep
minimum measured corner radii above 15 m and maximum grades below 0.4 while
preserving the characteristic sequence of bends.

Measured routes are 3.204 km for Cata, 2.322 km for Choroní and 1.384 km for
Chuao. Their minimum radii are 16.33, 16.72 and 26.97 m respectively; maximum
grades are 0.234, 0.267 and 0.222. All three complete the three-lap driving
regression with working item rows, continuous projection and clear lanes.

The road is at least 16 m wide before horizontal scaling. The sampled native
road supplies the physics heights; banking follows cumulative horizontal
distance, not the reference's original sample index. Fairing changes sample
spacing, so indexing bank by normalized lap distance would tilt the physical
surface differently from the visible ribbon. Physical ground includes the
12 cm road-surface offset. Authored ribbons replace the generic road mesh.

Chuao climbs past the cacao patio to the waterfall, enters the river at the
top and follows the quebrada downhill to the beach. Its river-side rocks and
bushes reserve the wider driving corridor. The cacao patio is narrower than
the display reference, and its terrace cannot override the road cut. Choroní's
ford water follows the road crossing without rising through the cars.

The source shoreline raster caps its inland distance at 170 m. Switching
straight to the uncapped distance outside the 700 m grid creates a square
cliff. Blend that fallback near the boundary and attach the shared
`world-horizon.js` continuation to the exact terrain-edge vertices. Distant
plant roots and sea-depth sampling follow the extended terrain; sea depth
coordinates also account for each circuit's horizontal scale.

## Forest and existing circuits

`coastal-vegetation.js` replaces the reference trees with the library's ceiba,
mango, cacao, coconut palm and tree fern. Planting zones retain thousands of
placements. `forest-detail.js` assigns three fixed zones by distance from the
nearest racing route in world metres (including each map's horizontal scale):

- Within 2.75 road half-widths: unchanged game-detail models, fruit and shadows.
  This preserves the prior 22 m source-space roadside band (35.2 m in Cata,
  28.6 m in Choroní and 22 m in Chuao).
- Beyond that band up to 70 m (70.4 m in Cata): simplified native foliage
  and branches, without fruit or shadows.
- Beyond the middle band: broadleaf crown silhouettes derived from the native
  model's extreme vertices, retaining its colors and crown dimensions. Dense stands
  omit hidden bark. Isolated trees keep a simplified trunk; palms and ferns
  retain fronds, and pines retain their tiered silhouette.

A stand is dense when a tree has at least three neighbors within 20 world
metres. Spatial buckets find those neighbors during construction. No trees
are removed by detail selection. Near/middle/far counts are available as
`group.userData.forestZones`. Zones follow the route rather than the camera,
so racing around a bend never swaps models or causes detail popping. New
large forest placements should use this policy instead of drawing detailed
leaf meshes on distant hills. Existing authored landmark trees remain intact.

Spatial instances retain terrain placement and frustum culling. All randomness
and placements are deterministic. The dense far prototypes use 36 triangles
for ceiba, 32 for mango and 34 for cacao, down from 666, 501 and 269 respectively
with the previous clustered meshes. These are geometry counts, not FPS claims.
Across all tree instances, measured reductions are 38.1% in Cata
(5,598,811 to 3,463,699 triangles), 39.0%
in Choroní (4,841,319 to 2,951,599), and 31.5% in Chuao (9,543,933 to 6,533,023).
Tree counts stay at 5,767, 5,325 and 8,922, including the same detailed roadside
bands of 561, 388 and 698 trees respectively.

The source road-distance raster stops at 44 m: it cannot distinguish middle
forest from distant hills. Use the runtime's uncapped `T.roadDistance` for the
outer bands, converting source coordinates by the map scale. Preserve the
source distance only in the existing detailed roadside band.

The existing natural circuits receive additional distant native vegetation
through `background-forest.js`. It excludes the driving corridor, water,
steep edges and unsuitable biomes. Town, stadium, cave, desert and salt-pan
circuits keep their authored vegetation. Shared road materials now carry
longitudinal wheel wear and dusty edges, and `road-shoulders.js` seats the
road against the terrain without filling air beneath bridges or cave decks.

The added background forest uses the same distance and density policy.
Native near models are never mutated by simplification. Derived geometries
are instance-owned; library materials stay shared. The far crown hulls use
smooth normals to keep the broad foliage appearance at low triangle counts.

Reference-created materials and textures are owned by each environment and
disposed on switching tracks. Library vegetation materials remain shared.

## Proof

`maps.browser.js` covers route projection, grades, radii, scenery clearance,
item rows and three completed laps. `aragua.browser.js` connects two real
clients, selects each new circuit, waits for both to load and verifies actual
driving movement. The full Derrape suites, Studio and all-games smoke cover
the shared road and registry changes.

`forest-detail.browser.js` verifies unchanged near geometry, reduced distant
cost, crown dimensions, foliage masks, isolated trunks and dense-stand detection.
