# Derrape online (Colyseus)

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
- Pickups are per client; a remote car still hides crates/coins it drives through.
