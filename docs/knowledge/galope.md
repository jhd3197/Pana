# Galope

`/g/galope/` is a separate horse-racing game. Its 482 m route is sized for horses
and reuses the real Llanos ranch props, vegetation and fauna. The existing car
circuit is unchanged. Studio's `galope` map calls the actual `createCourse()`.

## Simulation and water

`course.js` is pure JS: a sampled closed spline with distance-based coordinates,
closest-point projection, terrain height, water depth, jumps and sector labels.
Both wetlands lower the bed smoothly to 0.12 m beneath a 0.68 m surface. The same
height function places the horses, draws the path and supplies signed depth to
the shared water shader. Flooding slows the horse, prevents sprinting and gives
stamina time to recover; jumping never removes water drag.

The original 482 m route now sits between two distinct landforms. **Laguna del
Hato** extends east into an indented lagoon with a dry island, landing and canoe.
**Caño del Morichal** bends west through a narrower palm-lined channel.
`WETLANDS[].channel` stores tapered channel points `[x,z,radius]`, with a smooth
union and low-amplitude shoreline variation. `wetlandDistance()` is shared by
the terrain and habitat placement; island elevations are composed into
`groundAt()`. Keep both existing crossing centers wadeable. The minimap samples
the actual bed once and fits the extended waterways instead of drawing ellipses.

`rules.js` owns free steering, acceleration/braking, sprint exhaustion, jump
edges, obstacle penalties and ordered gates. Horses slow outside the 4.8 m trail
and stay within a soft 9 m corridor. Reset returns to earned route progress.
Three jump logs have 0.5 m clearance. Space must be released before another jump.
Two laps take roughly 85 seconds for bots; races close 45 seconds after the first
finisher, when all human riders finish, or at the four-minute limit.

## Landscape and reusable assets

`landscape.js` composes scenery around the existing course. It places all eleven
factories from `engine/models/props/llano-life.js` (Studio: **Vida llanera**):
caney, chinchorro, saddle stand, hitching rail, campfire, coffee table, curiara,
wetland landing, flooded fence, trail sign and termite mound. `moriche.js` and
`savanna-grass.js` add two individually cataloged plants in **Vegetación**.
Driftwood, capybaras, mango trees, reeds and lilies reuse existing sources.

The caney stays open. Landing length accepts 3–16 m along Z, with its deck at
y=.95; the map sets its pile origin to .1 m. Canoes use a keel origin and sit
.18 m below water. Fence spans accept 3–20 m; hitching rails 2–8 m along X.
Moriche height accepts 4–16 m; grass height .25–2.5 m, with green/dry variants.
Seeds are deterministic and each factory owns its geometry. Chinchorro sway
rotates about the fixed rope-anchor line; fire animation uses absolute time.
Keep both animated roots outside static batches.

Placements reserve object footprints and the 9 m recovery corridor. Reeds follow
wet banks; palms group mainly along the western channel, with an open southern
grassland. Plant prototypes are instanced in 40 m cells for culling; moriche
colours are baked into vertices to keep each grove to one draw per cell. The
coarse outer plain joins the exact terrain perimeter and its vertex colours.
Keep Studio's explicit framing bounds independent of this horizon.

The riding trail clips the terrain's actual triangles at the route width, then
lifts them .018 m. Do not restore a separate analytic ribbon: it intersects
coarser bank triangles and flickers. Water shares the terrain grid and signed
depth, with low foam and a soft shore. This is scenery expansion; the current
race still uses its established recovery corridor and shallow-water rules.

## Rendering and ownership

`/engine/models/fauna/farm/llanero-rider.js` mounts the shared saved character
on `llaneroHorse` (Bululú's coleo uses it too). The opt-in
`locomotion` rig adds upper/lower limb bones without changing the default grazing
rig or cached sculpt template. `gallop(phase,speed,jump)` poses the actual skinned
mesh; the game accumulates gait phase. Models own geometry/skeletons and release
them on replacement/navigation. Static flora is instanced; water, cows and birds
remain outside static batches. Ranch models are never copied into game code.

## Rooms and controls

`network.js` extends `HostRoom` (the generic relay room) with payload marker
`galope-v2`. The oldest member simulates at 20 Hz and broadcasts the whole race.
Delayed render frames catch up in 50 ms physics steps (at most one second per
network tick), publishing once so a busy GPU does not slow every simulated step.
Migration restores the latest snapshot and removes departed humans. Guest inputs
expire after 600 ms. Players joining an active race watch until the next start.
The shared menu freezes solo play; multiplayer continues. Failed connections can
fall back to a local race from the shared menu. This follows Pana's trusted-peer
room model, not competitive anti-cheat.

- W/up: forward; S/down: brake; A/D or arrows: steer.
- Shift: sprint; Space: jump; R: recover to the trail.
- Touch: hold Arre and steering; Salto/Remate are separate controls.
- Esc/menu: shared settings, invite and local fallback; M: shared sound.

## Verification

Run `npm run check`, `node Pana/games/galope/tests/rules.test.js` and
`node Pana/engine/tests/model-architecture.test.js`.

Against the running server, `node Pana/games/galope/tests/browser.mjs [playwright]`
checks two-client input/countdown, water, jumping, late join, migration, solo and
multiplayer menus, results/replay, real mobile touch and disconnected fallback.
Screenshots go to ignored `art/galope/`. `?debug` exposes test state; `&manual`
disables the automatic simulation timer so deterministic tests can step it.
Shared horse regression: `Pana/engine/tests/farm-animals.browser.js`.

`node Pana/games/galope/tests/studio.browser.mjs [playwright]` builds the real map
through Studio, checks course continuity and tour play/pause/scrub/copy/overview,
then verifies animated skinned hooves, deterministic gait and the unchanged
default grazing skeleton. Registry/thumbnail dependencies are covered by
`Pana/engine/tests/model-architecture.browser.js`.

`node Pana/games/galope/tests/landscape.browser.mjs [playwright]` renders all 13
new assets, both waterways, the hato, landing and four riding views. It verifies
owned/deterministic geometry, bounded dimensions, time scrubbing, open passages,
the canoe's hollow hull, all assets actually placed, corridor clearance, exact
terrain/water agreement, the dry island, channel continuity, landing grounding,
trail-to-terrain separation and repeated disposal. Images and metrics are in
ignored `art/galope/landscape/`. The full Galope browser suite covers the live
two-client race, mobile controls and replay after landscape changes.

## Horse water effects and daylight

`public/water-fx.js` owns a game-local pool shared by up to eight nearby riders
(45 m around the followed horse). `rider.stridePhase` is the same phase used by
the galloping skeleton. Its four contact events emit world-space expanding
ripples and ballistic, camera-facing spray. Distance travelled emits trailing
wake arcs; speed changes their strength. A sampled bed texture clips surface
crests off dry banks. Jump height is compared with actual water depth, so hooves
can still disturb water during the first part of a jump.

The hard GPU budget is two instanced draws, 128 surface quads plus 192 spray
quads (640 triangles total), with no reflections or extra render target. The
256-square RGBA bed texture is built once. Effects fade after stopping/leaving
water, skip spectators/distant riders, reset for a new race, freeze with solo
pause and dispose geometry, materials, instance buffers and texture on pagehide.
Keep gameplay state independent of this cosmetic pool.

`course.DAYLIGHT` owns Galope's live/tour sky palette. Balanced daylight, blue
distance haze, green savanna and teal water replace the yellow/olive wash;
terrain geometry, route and physics are unchanged by the colour pass.

`node Pana/games/galope/tests/water-fx.browser.mjs [playwright]` checks eight-rider
pool saturation, two real GPU draws, anchored ripples, pause, airborne/landing,
dry/stopped riders, removal, reset and idempotent disposal. It renders a real
mounted horse from chase/side views and at 390 px. Proof is under ignored
`art/galope/water-fx/`. GPU counts describe the effect only, not the whole scene.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Galope uses a host simulation at 20 Hz (`galope-v2`), with ordered route gates,
bots, snapshots and host migration. `games/galope/public/course.js` owns the
482 m horse circuit, terrain and water depth; `scene.js` uses the shared ranch,
plants and fauna. Late arrivals spectate until replay. Keep decorations outside
the 9 m recovery corridor and water geometry aligned with the terrain bed.
Horses opt into `{locomotion:true}` and `userData.gallop(phase,speed,jump)`;
ordinary Studio/Derrape horses retain their grazing rig. The rider uses the
saved Pana character. See `docs/knowledge/galope.md` for proof and controls.
Galope's `landscape.js` extends the scenery into Laguna del Hato (bays/island)
and Caño del Morichal (winding channel), using the signed field in `course.js`.
The minimap samples the same bed. The 11 `Vida llanera` props live in
`engine/models/props/llano-life.js`; moriche and savanna grass have individual
vegetation modules. All 13 appear in the actual map and Studio. Keep animated
fire/chinchorro outside static batches, instance plants in spatial cells, and
preserve the canoe's keel origin, landing deck height and fixed hammock anchors.
The trail clips actual terrain triangles to avoid bank flicker; the far plain
joins exact perimeter heights/colours. See the landscape section in that note.
Galope's game-local `water-fx.js` pools ripples, wakes and hoof spray across nearby
riders: two instanced draws, at most 640 triangles. Use the rider's gait phase,
real water depth and paused render time; dispose the bed texture and instance
resources. `course.DAYLIGHT` supplies its live scene and Studio tour palette.

Plan 56: the lagoon dock at (87,45) reuses landingShelter from the Delta model family, with a 2.4 by 3 m footprint. Course and collision rules remain unchanged.

## Room options

The shared room-options panel edits validated lobby options on the host. Options
are included in race snapshots, restored on migration, and locked while racing.
Eight humans remain supported; bots fill to six when fewer humans join.

Llanos retains the original clockwise circuit. Morichal is explicitly a reverse
variant, starting beside the existing palm creek at 69% of the circuit. Its
ordered progress is independent of world spline distance; use `routeAt()` and
`distanceAhead()` when working with reverse races. Both share the safe 9 m
corridor. Enabled shortcuts remove the off-trail speed penalty, allowing inside
cuts without bypassing ordered checkpoints or entering ranch buildings.

Two/three laps change the finish gates and time limit. Obstacles select one,
three or six rendered logs; crazy jumps raise clearance from .5 to .95 m and
jump velocity from 5.9 to 7.4 m/s. Jump help launches before the next log. Rain
reduces top speed to 92%; storm to 82% and adds wind steering. A bounded 240-point
rain draw and darker light/fog make weather visible. Rebufo grants 15% top speed
behind a rider within nine route metres and ten world metres. Random coats use a
seeded draw at race start, preserved in snapshots.

`options.test.js` covers rule effects; `race-options.browser.js` uses two real
clients for shared settings, authority, scene changes and host migration in both
Galope and Curiara.

Opening a local race keeps the current room options and map while creating a fresh lobby and clearing network participants. This also applies to offline fallback after a disconnect.

Random coats are fixed for a running race; late-join hello refreshes update the avatar without replacing the assigned horse. Restablecer also enables bot fill again.
