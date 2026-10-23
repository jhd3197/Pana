# Puerto circuit and harbor models

Puerto is a fictional La Guaira circuit, with sea at +Z and mountains at -Z.
`tracks/puerto-layout.js` owns the approximately 6,757 m loop, independent town
streets, dock footprints and hilltop terrace. The lap descends to -14 m under
the sea and climbs to the 190.2 m battlements, with an 18.53 m minimum bend radius and a maximum base-road
grade of .383. It remains a standalone circuit in `cup-definitions.js`.

The route passes through a 355 m submerged tunnel under the original silo bank, through three gantry cranes,
along the waterfront and up the mud road. It enters San Carlos at courtyard
level, climbs a viaduct, circles the battlements, jumps out northwest and
descends through town. `puerto-harbor.js` places containers in instanced
cargo blocks and authored approach lots, plus cranes, warehouses, boats and a ship.
`puerto-town.js` uses 70 houses from the existing six colonial families. Closed
blocks have frontages in all four directions, shops, interior gardens, laundry
patios and sidewalks. A connected civic plaza holds the kiosks and bus stop.
The street grid ends below z=-385; it must not climb the fort's sheer bank.

## Whole-race duration

Puerto defaults to **one adventure lap**, locally and in shared rooms. Ordinary
tracks keep three laps; local players can explicitly choose another count.
`lapsForTrack` reads the metadata default and the room uses it on selection and
race start. Cup stages retain their own lap counts.

The picker and ready screen show a **3:15–4:15 estimated whole race**, recalculated
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
return terrain there. The 80 m ramp rises 18 m above its base and follows the
curve across the road width. Terrain is cut below the gap, and road furniture
skips it. Its cubic rise t²(2−t) starts tangent to the road; both the road support
and rendered mesh evaluate the same optional ramp profile. Keep the lip, gap and landing together when moving the route.
Never test airborne clearance against the missing road's interpolated surface.
The gap is 28 m; the receiving road stays at battlement height until it clears
the castle footprint, then continues northwest before its return bend.

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
Carreritas, Caída, Dominó and Póquer browser suites for gameplay regressions, plus
`table-games` and `shared-arenas` for the shared integrations. Finish with
`.\dev.ps1 check`.

Geometry proof checks radius/grade/projection, both decks, five lanes against
actual scenery, foundations, street-facing entrances, the tunnel roof and ship waterline. Budgets
remain 3.4 million scene triangles and 900 overview draws, not an FPS promise.
The current full overview uses 2,693,322 triangles and 884 draws.
Driving proof exercises both crossing levels, mud response and a moving jump
with a landing. The general maps suite completes three laps and collects each
item row. Native table proof uses two clients, host migration, rejected guest
and mid-game actions, late arrivals, phone practice and independent disposal.

Ignored evidence lives in `art/studio/puerto/`. The menu WebPs are
illustrated art (see `images/menu/sources.json`), not captures.
Local plan 75 stays ignored and untracked.

## Tunnel entrance and presentation

The quay opening includes both the low-s tunnel and the final 180 m before
the route seam. Ignoring the late-lap approach leaves a concrete slab across
the descent. The geometry suite probes the harbor across that seam at three
lane offsets with eight metres of vertical clearance; the shorter general
road probe missed this obstruction.

The submerged corridor uses blue glazing on the sea-facing walls and exposed
roof, cyan chamfered ribs every 12 m, and continuous low edge lights. Joined
roof panes preserve shared boundary vertices. Ribs remain outside the driving
envelope and above the tested roof clearance across the driving lanes. The
green 15 by 20 m strip at u=.037 is a real boost pad using the existing item
system and featured-zone model. Geometry is statically batched; there are no
new dynamic lights, downloaded textures or bloom passes.

San Carlos's half-cylinder vault uses the negative-Z half before its X rotation,
placing the curved ceiling above the 6.5 m spring. The opposite half bent down
into the gate. The native-model test checks the final baked vault vertices,
which retain their identifying colour in the vertex-colour buffer.

## Full-lap placement audit

Puerto opts out of automatic chevrons, then calls the same bend builder with
a tunnel exclusion. Nine geometric arrow boards sit 0.75 m inside the shell's
centreline on its visible wall face. Their material is double-sided because
mirroring the arrow before static baking reverses its triangle winding.
The audit suite rays from the driving lane to every board, checks no ordinary
posts remain inside the shell, and verifies the exact sign count.

Random breakables are restricted through `def.breakableAt` to the waterfront
and town return (u .15-.27 and .85-.95). The grid, tunnel, fort and jump stay
clear. Placement and flying fragments use height hints to select the correct
road deck. Other tracks retain their existing zone selection. Route-side lamps
also test clearance against all road sections, plus supporting-terrain height.
The audit probes all lamp meshes every 2 m across seven offsets including
10.8 m from the centre, from the crane straight through the coastal climb.

Four existing fishing boats bob and roll, and one off-road crane load rises
and falls on the absolute race clock. Its four ropes are instanced, stretch
from the existing spreader to the container, and update without rebuilding
geometry. The load remains over the water, more than 30 m from the road.
Distant peaks are fewer, smaller and less saturated to preserve the sea vista.

The four large harbor floodlight towers are a separate asset from the town's
83 street lamps. Two old fixed tower locations (-86,95) and (-86,245) fell
inside the road bend; a sparse lane ray can miss their thin poles. Placement
now reserves the complete four-metre light-head radius against the road and
container stacks. Accepted tower coordinates are recorded on the harbor and
tested independently. The tunnel approach uses authored cargo lots with unequal heights and open
handling lanes, preserving its central sightline and existing road setback.


## Castle jump presentation

The launch ramp reuses the native fortress stone material with metre-scaled UVs.
Curbs and parapet caps connect adjacent route samples in three dimensions rather
than stacking horizontal boxes up a slope. Painted chevrons conform to the ramp
and mark the landing road beyond the gap. The underlying gap and route remain
unchanged. Driving proof covers normal and slower approaches, landing within the
lane, continuous progress and a near-zero ramp entry grade.

The tunnel entrance uses unequal cargo lots: a taller west block, a low east
handling apron, and taller stacks deeper on the east. Colour runs group cargo
by lot rather than alternating every box. Native container instancing and full
road/floodlight clearance remain in use.


The final ramp section passes through an open fortress cannon, built locally
for the track. Its 32-segment bore, reinforcing hoops, carriage and guide lamps
use shared materials without dynamic lights or textures. Orient its local +Z
with yaw then pitch (YXZ); a minimal +Z-to-tangent quaternion can roll the bore
on this heading and push its side into the road. The audit rays five lanes over
the ramp to eight metres above the surface. Cars retain normal steering and
ballistic flight; the barrel does not teleport or capture them.

Native fortress garitas now consult the existing clearance callback with their
full footprint. The race excludes the tower crossing the jump corridor; default
Studio/table construction still retains every tower.


## First touchdown is the landing criterion

Ending a driving run onGround is insufficient: the old long gap allowed a car
to land on terrain about 45-51 m below the road and recover afterwards. Driving
proof now records the first touchdown and requires its height to match the road
within 0.3 m and its lateral offset to stay below 9 m. Eighteen cases use speeds
22/32/42 m/s, offsets -5/0/5 m and headings ±0.04 rad, with no airborne steering.
The short gap and extended straight receiving deck pass these cases. The deck
must stay at 190.2 m until outside the fort: lowering it sooner intersects the
native battlement slab on the right lanes. Grounded proof cannot detect that
rendered obstruction; the five-lane scenery-ray proof also remains required.
