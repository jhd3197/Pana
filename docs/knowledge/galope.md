# Galope

`/g/galope/` is a separate horse-racing game. Its 482 m route is sized for horses
and reuses the real Llanos ranch props, vegetation and fauna. The existing car
circuit is unchanged. Studio's `galope` map calls the actual `createCourse()`.

## Simulation and water

`course.js` is pure JS: a sampled closed spline with distance-based coordinates,
closest-point projection, terrain height, water depth, jumps and sector labels.
Both esteros lower the bed smoothly to 0.12 m beneath a 0.68 m surface. The same
height function places the horses, draws the path and supplies signed depth to
the shared water shader. Flooding slows the horse, prevents sprinting and gives
stamina time to recover; jumping never removes water drag.

`rules.js` owns free steering, acceleration/braking, sprint exhaustion, jump
edges, obstacle penalties and ordered gates. Horses slow outside the 4.8 m trail
and stay within a soft 9 m corridor. Reset returns to earned route progress.
Three jump logs have 0.5 m clearance. Space must be released before another jump.
Two laps take roughly 85 seconds for bots; races close 45 seconds after the first
finisher, when all human riders finish, or at the four-minute limit.

## Rendering and ownership

`rider.js` mounts the shared saved character on `llaneroHorse`. The opt-in
`locomotion` rig adds upper/lower limb bones without changing the default grazing
rig or cached sculpt template. `gallop(phase,speed,jump)` poses the actual skinned
mesh; the game accumulates gait phase. Models own geometry/skeletons and release
them on replacement/navigation. Static flora is instanced; water, cows and birds
remain outside static batches. Ranch models are never copied into game code.

## Rooms and controls

`network.js` uses the existing `/ws` relay with `game: galope` and payload marker
`galope-v1`. The oldest member simulates at 20 Hz and broadcasts the whole race.
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
