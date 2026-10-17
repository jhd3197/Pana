# Derrape online (Colyseus)

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

Aguacero sends one `cloud` effect with a unique ID, timestamp and at most seven
target/delay/duration records. Keep this below the room's 512-character effect
limit. Delayed recipients subtract elapsed server-clock time before scheduling;
duplicate IDs are bounded to a 64-entry cache, reset with the item system.
Chancleta damage is still decided exclusively by its victim's client, and its
`hit` relay ends the same projectile on other screens.

Render quality does not change pose cadence or gameplay. Procedural scenery
never travels over the room connection. Lower shadows/details help local
rendering and CPU headroom; they do not remove internet latency or packet loss.

Plan: `docs/plans/51_colyseus-and-derrape-online.md`. Proof:
`node Pana/games/derrape/tests/online.browser.js <playwright>` against a running
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

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Derrape races online through a Colyseus room (`games/derrape/server/room.js`,
`/colyseus`), not the `/ws` relay. `?room=<code>` joins; `&lead=1` makes that
player host (a pana.sh party's Pana Mayor). Each client simulates the cars it
owns (its own, plus bots if host) and sends stamped poses; remote cars are
kinematic and interpolate on the sender's server-time stamp. Hits and pickups
are decided by the owning client (`items.js` `remote*`/`emit`). Shared limits
and pose packing live in `public/online-rules.js`, imported by both sides.
Prove changes with `tests/online.browser.js` (two real clients). See
`docs/knowledge/derrape-online.md`.
