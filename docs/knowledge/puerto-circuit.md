# Puerto circuit and harbor models

Puerto is a fictional La Guaira circuit, with sea at +Z and mountains at -Z.
`tracks/puerto-layout.js` owns the approximately 6,603 m loop, independent town
streets, dock footprints and hilltop terrace. The lap descends to -14 m under
the sea and climbs to the 190.2 m battlements, with an 18.12 m minimum bend radius and a maximum base-road
grade of .383. It remains a standalone circuit in `cup-definitions.js`.

The route passes through a 355 m submerged tunnel under the original silo bank, through three gantry cranes,
along the waterfront and up the mud road. It enters San Carlos at courtyard
level, climbs a viaduct, circles the battlements, jumps out northwest and
descends through town. `puerto-harbor.js` places 499 containers in instanced
cargo blocks and 15 taller walls, plus cranes, warehouses, boats and a ship.
`puerto-town.js` uses 70 houses from the existing six colonial families. Closed
blocks have frontages in all four directions, shops, interior gardens, laundry
patios and sidewalks. A connected civic plaza holds the kiosks and bus stop.
The street grid ends below z=-385; it must not climb the fort's sheer bank.

## Whole-race duration

Puerto defaults to **one adventure lap**, locally and in shared rooms. Ordinary
tracks keep three laps; local players can explicitly choose another count.
`lapsForTrack` reads the metadata default and the room uses it on selection and
race start. Cup stages retain their own lap counts.

The picker and ready screen show a **3:00–4:00 estimated whole race**, recalculated
when the lap count changes. This uses a 27–36 m/s planning band; it is not a human
playtest average. `puerto-duration.proof.js` runs every current car with actual
physics, normal AI steering, street tires, full player power, a standing start,
course pads and coins. It runs both with and without drift, without opponents or
attack items. All sixteen clean runs finish without recovery: mean **170.54 s**,
range **158.52–176.28 s**. Drift-on mean is 170.55 s; drift-off mean is 170.53 s.
The 3–4 minute target allows for ordinary mistakes and item exchanges. Choosing
three laps intentionally makes a much longer race.

## Prototype fidelity and ownership

`casa-guipuzcoana.js` and `port-silos.js` port the actual geometry and procedural
canvas materials from Juan's `Casa Guipuzcoana 3D (1).html`. Casa retains the
hip roofs, clay tiles, arcade, timber galleries, stairs, courtyard and facade.
The silo bank retains its twelve bins, 440 radial fins, striped shells, brick
infill, concrete formwork, headhouse, stepped tower, conveyor and roof details.
`san-carlos-fortress.js` ports the actual star walls, gate vault, garitas,
casemates, paving, cannons and stone materials from `Gran Premio San Carlos.html`.
The oversized flag, flag emblem and tricolour race edging are deliberately
omitted. No source HTML is embedded or required at runtime.

`puerto-prototype-kit.js` combines these factories while preserving UVs,
material types and every original InstancedMesh instance. The ordinary
`paintFinish` is unsuitable here: it discards textured UVs and does not expand
instances. Prototype factories own their materials and textures; their dispose
hooks release them. Do not put shared cached materials into this batcher.
`shippingContainer` instead uses the normal cached-material batcher, preserving
its own canvas markings. Its pressed corrugation is real beveled geometry.
Distant ship containers omit separate labels to keep the ship batched.

Studio's `props/catalog/puerto.js` registers all nine harbor/landmark factories,
including the original smaller coastal fort. These require no downloaded
meshes or texture assets. Modern Three.js canvas maps use sRGB colour space.

## Elevated route and jump

Route control points accept `[x,z,height]`; horizontal arc length drives lap
progress and a matched spline supplies height. `rounded:true` applies two
corner-cutting passes. `layered:true` lets `paramOf`, `offsetOf`, `surfaceAt` and
`groundAt` accept a height hint. Cars, AI, pickups, recovery and fragments pass
their actual height. The entrance and upper road overlap in XZ with 48 m of
clearance, so an unqualified nearest-road query can choose the wrong deck.

Altitude selects the route branch with an 8 m dead band; refinement then uses
horizontal distance in a 48 m neighborhood. Including height in that refinement
pulled airborne cars backward toward a higher road sample during the jump.

The race fortress uses `terrace:14`, XZ scale 4 and height scale 3. Its enlarged
deck surrounds the entire upper circuit, with continuous three-bar iron guards.
The native gate vault length follows the enlarged curtain wall. Parapet faces
and caps have actual openings where the route exits; hiding props alone does
not clear that geometry. The mountain approach stays outside the broader bastion.

`T.gaps` removes the road ribbon across the castle exit and makes `groundAt`
return terrain there. The 55 m ramp rises 35 m above its base and follows the
curve across the road width. Terrain is cut below the gap, and road furniture
skips it. The ramp is intentionally steeper than the .4 limit for ordinary
road grades. Keep the lip, gap and landing together when moving the route.
Never test airborne clearance against the missing road's interpolated surface.

## Placement traps

- House sites flatten small earth terraces before foundation placement. Sample
  the actual terrain triangles through `world.groundAt`; do not use an analytic
  height or the highest corner alone, which produces tall concrete blocks.
- Town streets sample both axes on a 2 m grid and classify junction cells once.
  Tree placement reserves streets; lot rotation also rotates foundations,
  awnings and front paths. Each frontage reaches its block's street.
- `roadHeight` grades the western neighborhood toward the actual descent.
  Lot pads anchor to their front street, and street grading runs after the
  terrace pass so flat house pads cannot deform the roadway. Hill foundations
  remain grounded and below one storey. The sampled maximum street slope is
  .584 outside the race junctions, versus vertical banks in the old layout.
- Keep both mountain approaches clear of the enlarged bastion footprint and
  each other across the full road width. Centerline-only clearance missed
  high terrain at the outer curb where two different elevations nearly met.
- The race uses the unchanged original silo bank at scale 1.6. The separate
  tunnel has 12.5 m headroom, 78 sea-facing panes, overhead lights and harbor
  piles. The sea surface is at y=0 and the exposed seabed at y=-25. Native fish
  schools stay outside the glass and update through the environment callback.
  Tunnel panels share exact edge vertices: overlapping rotated boxes left
  triangular roof gaps at bends. The quay slab has openings at both approaches.
- Layered-course cameras follow `car.y + 5`, including negative heights. The
  old world-y=5 clamp placed the camera above the tunnel and behind opaque water.
- The ship's local waterline is 2.8 m. At scale 1.75 use y=-4.9.
- Repeated cargo and vegetation belong in `instances`, outside static baking.
  Capture a prototype's disposal callback before instancing consumes it.
- The harbor updater composes buoy motion with `waterAnimator` exactly once.

## Table settings

`TABLE_ARENAS` extends the ordinary arena registry with `guipuzcoana` and
`san-carlos` for Caída, Dominó and Póquer only. Action games and Billar retain
their existing choices. `engine/worlds/puerto-tables.js` uses the same native factories:
Casa scale 3.2 with its central planter omitted, or San Carlos scale .72.
Equipment, actors and camera remain game-owned around y=0. Studio exposes the
same worlds as `table-guipuzcoana` and `table-san-carlos`.

Map changes are validated host-only lobby actions, carried in ordinary snapshots
and retained during migration, late joins and practice. Póquer validates on its
server; Caída and Dominó use their existing host action/revision contracts.

## Proof and maintenance

Use a fresh `PANA_TEST_URL` and `PANA_SUITE_TIMEOUT=1800000` for the long real
multiplayer suites. Run `npm run test:browser -- puerto` for native models,
landmark table rooms, geometry, moving cars and online race proof. Run all
Derrape, Caída, Dominó and Póquer browser suites for gameplay regressions, plus
`table-games` and `shared-arenas` for the shared integrations. Finish with
`.\dev.ps1 check`.

Geometry proof checks radius/grade/projection, both decks, five lanes against
actual scenery, foundations, street-facing entrances, the tunnel roof and ship waterline. Budgets
remain 3.2 million scene triangles and 900 overview draws, not an FPS promise.
The current full overview uses 3,080,394 triangles and 888 draws.
Driving proof exercises both crossing levels, mud response and a moving jump
with a landing. The general maps suite completes three laps and collects each
item row. Native table proof uses two clients, host migration, rejected guest
and mid-game actions, late arrivals, phone practice and independent disposal.

Ignored evidence lives in `art/studio/puerto/`. The menu WebPs are
illustrated art (see `images/menu/sources.json`), not captures.
Local plan 75 stays ignored and untracked.
