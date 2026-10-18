# Pana multiplayer kit (Colyseus)

Every game's online play goes through one kit. Do not write sockets, retries,
member lists or host election in a game.

| Side | File | What it gives you |
|---|---|---|
| Server | `Pana/server/src/room-kit.js` | `PanaRoom`, `Member`, `roomState()`: one room per invite code, seats, host (party lead first), instant host handoff on drop, 20 s reconnection, `me`/`ping`, `/api/rooms` metadata, "full" instead of a duplicate room |
| Server | `Pana/server/src/relay-room.js` | The default room for any game without `games/<game>/server/room.js`: relays `relay` messages tagged with the sender's seat |
| Browser | `Pana/engine/net.js` | `joinRoom()` → `RoomLink` (state copies, `until()`, server clock `now()`, reconnect after reload) and `HostRoom` (base class for host-simulated games) |

`server/src/colyseus.js` registers a room for every game automatically (its own
`server/room.js` or the relay room), under the game's id with `filterBy(['code'])`.
The legacy `/ws` relay is gone; every game talks to Colyseus under `/colyseus`.

## Two ready-made rooms: TableRoom and LiveRoom

Most host-simulated games are one of two shapes, and each shape has a base class
on top of `HostRoom`. Start there (the `new-game` scaffold does); drop to plain
`HostRoom` only for a game that fits neither.

- **`engine/table-room.js` `TableRoom`**: turn-based, the whole game is one
  snapshot (Dominó, Caída, Ludo, Billar, Bolas Criollas). Give it `fresh`,
  `restore`, `snapshot`, `accept` and `valid`; implement `seatMembers()`,
  optionally `unseat(id)` and `step(dt)` (bots via `botReady(dt, botTurn)`, or
  physics). It owns seq numbers from the room's ledger, snapshot routing, a
  revision guard (the same host never moves backwards), the host-change notice
  and practice. Unit tests: `engine/tests/table-room.test.js`.
- **`engine/live-room.js` `LiveRoom`**: real time, the host steps the game at
  20 Hz with everyone's latest input (Cocina, Escondidas, Reliquia, Galope,
  Curiara). Implement `cleanInput(raw)`, `takeOver`, `handle(id, action)` and the
  member hooks (call `super.takeOver`/`super.memberLeft`). It expires stale
  inputs, drops repeated actions, routes `notice(id, text)`, and steps the game
  in fixed 50 ms slices from real elapsed time. Drive it with `elapsedClock()`:
  a host in a background tab gets timers about once a second, and a fixed
  `tick(0.05)` would slow the game twenty times for everyone.
  Unit tests: `engine/tests/live-room.test.js`.

## A host-simulated game on HostRoom directly

Extend `HostRoom`; keep only the game's rules.

```js
import { HostRoom } from '/engine/net.js';
export class KitchenRoom extends HostRoom {
  constructor({ code, name, avatar, onState, onStatus, onNotice }) {
    super({ game: 'cocina', protocol: 'cocina-v2', code, name, avatar, onState, onStatus, onNotice,
      texts: { connecting: '…', full: '…', lost: '…', offline: '…' } });
    // game-only fields
  }
  entered(alone) {}         // you just joined; alone = a fresh room (drop stale state)
  takeOver(previous) { /* you became host: build or restore this.game, publish */ }
  memberJoined(m, already) {} // m = { id, name, avatar }; id is the seat number;
                              // already: they were there when you joined (no "X llegó")
  memberLeft(id, m) {}
  memberHello(id, m) {}     // m now has avatar and any hello() extras
  hello() { return {}; }    // extras for your own hello (Galope sends its coat)
  statusText() {}           // optional connected status line
  receive(id, data) {}      // every non-hello message, already filtered by protocol
}
```

The base provides `connect()`, `send(data)` (wraps `{ game: protocol, ...data }`),
`members` (Map seat → member), `id`, `hostId`, `isHost`, `connected`, `offline`,
`practice(text)` (local play as seat 1 and host; reset game state first, then call
`super.practice(...)`), `cut()` (lose the connection for good, as after every
retry failed; suites use it to reach the offline fallback, since kit rooms have no
`socket`) and `dispose()`. The SDK quietly reconnects any room that has been up for
more than 5 s, so closing the transport is not a disconnect test; use `cut()`.

Rules the base enforces, so games must not re-implement them:

- The host is chosen by the room, not `Math.min(ids)`. The party's Pana Mayor
  (`?lead=1`) hosts if they arrive within 15 s of the room opening (the party's
  move); later they join like anyone else, so a running game never hands over to a
  host without its state. When the host drops, the next pana takes over at once.
- Every (re)connection starts with no host, so a retry that lands in a fresh room
  rebuilds the game instead of carrying the old one on. Don't override `connect()`.
- A pana whose connection drops counts as left until the SDK reconnects it, then
  joins again with the same seat. A reloaded page is a new pana with a new seat
  (seats are never reused), so per-seat ledgers can't go stale. Games only see
  `memberLeft` / `memberJoined`.
- Avatars come from the room (sanitized server-side); `hello` still runs so
  extras and late avatar changes arrive.
- Snapshots up to 256 KB per message; keep them event-driven or ~20 Hz.

## A game with its own room (Derrape)

Ship `games/<game>/server/room.js` exporting a `PanaRoom` subclass. Build state
with `roomState({ ...fields }, Member.extend({ ...memberFields }, 'Name'))`, call
`super.onCreate(options)` first, and use the hooks `joined`, `dropped`, `returned`,
`left`, `hostChanged` instead of overriding `onJoin`/`onLeave`. Browser side:
`joinRoom('<game>', options)` and listen on the link. See `derrape-online.md`.

A room that runs the game itself (Póquer, Pintura, ¡Embuste!) uses the kit's
helpers instead of its own: `seatOf(client)`, `connectedMembers()`,
`onHostMessage(type, fn)` for host-only commands, `memberAvatar(member)`,
`fillBots(count, add)` (seats from `BOT_SEAT`) and `InputBuffer(ttl)` for latest
inputs that expire. Never set `maxClients` (game.json `players` is the cap) and
never register `ping`/`me`/`lobby-ready` again: Colyseus stacks handlers, so a
second registration answers every message twice. `server/tests/room-kit.test.js`
fails on any duplicate, and `server/tests/harness.js` runs a room without
Colyseus for unit tests.

When players must not see each other's data (¡Embuste!'s roles), run the game
in the room and `client.send()` each seat its own filtered view instead of
putting it in the shared state; see `embuste.md`.

## Proof

The illustrated lobby adds `assetsReady` and `lobbyReady` to each shared member.
`joinRoom()` announces its `RoomLink` through `pana:room-link`; `lobby-ready`
messages may update only the sender's flags. New illustrated clients join with
`lobbyLoading: true`; older clients default ready. The UI prevents starting until
connected members have prepared assets and have not opted to wait. This is a
cooperative readiness signal, not anti-cheat or a replacement for game host
authority. `engine/tests/lobby.browser.js` proves a real two-client ready hold,
host launch, game preparation failures and each shared lobby's entry.

Each migrated game keeps its own two-client browser suite (`games/<game>/tests/`).
Before the next revision-bearing action, wait for the acting client's view as
well as the other client's acknowledgement. Private views can reach the guest
before the host has processed its own update. For consecutive roster clicks,
also wait for the acting client's rendered own-seat card: its click handler
captures the seat shown in that snapshot. A stale source is correctly rejected
by the room's permission check.

Run `npm run test:browser -- <game>`; the runner starts a fresh server and uses
the repository's Playwright dependency. Mobile portrait pages may show the
shared "rotate to landscape" dialog; handle that UI before testing gameplay.

### Full-room errors through the Colyseus HTTP adapter

Colyseus 0.18's Node adapter passes a matchmaking `ServerError.code` to HTTP
`writeHead`. A WebSocket-style 4009 code is not a valid HTTP status: its thrown
range error falls through to a misleading 404. The room kit now uses 409 for
capacity rejection; the client accepts 409 and legacy 4009. The plan-56
`cup-failures.browser.js` capacity case joins eight independent sessions and
asserts the ninth receives `full: true`, through the actual HTTP/SDK path.
