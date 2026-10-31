# Carreritas online (Colyseus)

## Temporary protection and item waves

`FLAG.phase = 1024` carries start/rescue/pileup protection in the existing
15-number, 20 Hz pose. The receiver's `phaseRemote` is distinct from `ghost`
(disconnection), so room-state patches cannot clear temporary protection.
Remote rescue timers advance in simulation, not vulture presentation: manual
and hidden-render simulations must not leave a car immune forever.
When bot ownership transfers, convert `phaseRemote` to a bounded local timer
and clear the remote flag, or the new host would keep the bot ghosted forever.
In a manual browser test, receiving a new pose does not mean interpolation has
displayed it. Wait for `applyRemote` to consume its timestamp when asserting
that protection has expired; advancing simulation in a tight loop does not
advance the server clock.

The guest-first host-election browser fixture gates the leader's real matchmaking
request until the guest has joined, then checks that their server arrival times
are less than 15 seconds apart. Warming an offline garage does not load the
Colyseus SDK; a later cold CDN fetch can otherwise exhaust the deliberate party
leader window and test a different scenario from the one intended.

Aguacero sends one `cloud` effect with a unique ID, timestamp and one
target/delay/duration record per rival: up to eleven on a twelve-car grid,
delays rounded to centiseconds. Keep this below the room's 1,024-character
effect limit (it was 512 for eight cars); a full twelve-car wave is about
500 characters. Delayed recipients subtract elapsed server-clock time before scheduling;
duplicate IDs are bounded to a 64-entry cache, reset with the item system.
Chancleta damage is still decided exclusively by its victim's client, and its
`hit` relay ends the same projectile on other screens.

Render quality does not change pose cadence or gameplay. Procedural scenery
never travels over the room connection. Lower shadows/details help local
rendering and CPU headroom; they do not remove internet latency or packet loss.

Proof:
`node Pana/games/carreritas/tests/online.browser.js <playwright>` against a running
server (`PANA_TEST_URL`), two real browser clients.

## Embedding Colyseus 0.18

- Use `@colyseus/core` + `@colyseus/ws-transport` + `@colyseus/schema`, never the
  `colyseus` meta package (142 deps, `uWebSockets.js` over git+ssh). `express` must
  be installed: the transport imports it at load time.
- Do not use Colyseus' `Server` class. It hijacks every HTTP request (answers all
  OPTIONS) and installs SIGINT/uncaughtException handlers. `colyseus.js` copies what
  `colyseus/vite` does: `matchMaker.setup()`, a `noServer` transport with
  `attachToServer(server, { filter })`, `setTransport()`, `matchMaker.accept()`, and
  `createNodeMatchmakingMiddleware()` called with the `/colyseus` prefix stripped.
- A `ws` server bound with `{ server, path }` 400-aborts every other upgrade, so the
  relay is `noServer` and `index.js` owns the single upgrade router.
- Schema v5 without decorators: `schema({ field: t.string() }, 'Name')`.
- 0.18 adds `onDrop`/`onReconnect`; `onLeave` runs only after the reconnection
  window fails. Catch `allowReconnection()` (it rejects on dispose).
- The SDK UMD (`@colyseus/sdk@0.18.5/dist/colyseus.js`) bundles schema; the client
  needs no schema classes. `client.reconnect(token)` resolves before state arrives.
- Engines: core needs Node 22.

## Netcode traps

- Do not timestamp poses on receipt. A client at 3–4 fps (software WebGL, cheap
  phones) sends bursts; receipt times bunch up and interpolation stalls. Poses carry
  the sender's server-time estimate, are sent once per rendered frame (≤20 Hz), and
  each remote car's delay adapts to its sender's observed gap (100–450 ms).
- `?speed=N` stretches remote lag N times (race time vs wall time): compare a
  remote car against the owner's recent *path*, not its current position.
- Car contacts: each client applies only its own car's share; the rival's client
  resolves the other half from the same poses.
- Mangos: a throw replays on every screen, but only the victim's client decides a
  hit and reports it (`hit`), so a late report must not splat twice (`gone` set).
- At accelerated test speeds, a mango may hit or expire between polling frames.
  Confirm `items.use()` accepted the throw (spin recovery blocks it), then observe
  that exact projectile ID attached to the guest scene when its `fx` arrives.
  A later snapshot of the live projectile array can miss a successful relay.
- Pickups are per client; a remote car still hides crates/coins it drives through.

## Smooth remote cars

A two-client race (both clients 16.7 ms frames, no freezes, ~18 messages/s
and 2–6 KB/s each way) showed other players' cars jerking ~10x more than the
player's own (frame-to-frame velocity change p50 3.5, p95 ~11 against 0.35 /
0.8). The cause was the interpolation clock, not the network: `net.now()` is
`Date.now()` in whole milliseconds read wherever the frame runs, stepping
13.5–20 ms between 16.7 ms frames. `applyRemote` now advances each car's
clock (`c.at`) by the simulation `dt` and eases it 5 % per frame toward
`net.now() - delay`, snapping past 250 ms. Positions follow a time-aware
Catmull-Rom curve through the poses (tangents skip neighbours over 15 m away
or 0.4 s stale), which trims the remaining pose-boundary spikes. Result:
remote jerk p50 0.47, p95 1.24. Measure with two real clients and per-frame
positions; message counts alone say nothing about smoothness.
`tests/online-smoothness.proof.js` does exactly that on the hardware GPU
(software WebGL stutters on its own and hides the signal).

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Carreritas races online through a Colyseus room (`games/carreritas/server/room.js`,
`/colyseus`). `?room=<code>` joins; `&lead=1` makes that
player host (a pana.sh party's Pana Mayor). Each client simulates the cars it
owns (its own, plus bots if host) and sends stamped poses; remote cars are
kinematic and interpolate on the sender's server-time stamp. Hits and pickups
are decided by the owning client (`items.js` `remote*`/`emit`). Shared limits
and pose packing live in `public/online-rules.js`, imported by both sides.
Prove changes with `tests/online.browser.js` (two real clients). See
`docs/knowledge/carreritas-online.md`.

## Languages over the wire

Speech bubbles travel: `say()` in game.js sends its text as a `say` fx, so
the bark tables (`LINES` in game.js and items.js, hazard `line`s) hold
`locKey()` Spanish and the bubble runs `loc()` where it is drawn, on the
sender and in `remote-cars.js`. Room notices (`state.notice`, `toLobby()`)
are `locKey()` text the lobby passes through `loc()`. Every public module
the room imports (today `car-`, `track-`, `wheel-` and
`tracks/water-track-definitions.js`, `parts.js`, `shop.js`,
`cup-definitions.js`) imports `engine/i18n.js` by relative path: a
`/engine/...` import breaks the server. Car, vessel, rival and track names
stay Spanish.
