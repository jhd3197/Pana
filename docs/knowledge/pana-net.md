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
The legacy `/ws` relay still runs for old cached clients; no game uses it.

## A host-simulated game (Cocina, Galope, Dominó…)

Extend `HostRoom`; keep only the game's rules. Reference: `games/galope/public/network.js`.

```js
import { HostRoom } from '/engine/net.js';
export class KitchenRoom extends HostRoom {
  constructor({ code, name, avatar, onState, onStatus, onNotice }) {
    super({ game: 'cocina', protocol: 'cocina-v1', code, name, avatar, onState, onStatus, onNotice,
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

When players must not see each other's data (¡Embuste!'s roles), run the game
in the room and `client.send()` each seat its own filtered view instead of
putting it in the shared state; see `embuste.md`.

## Proof

Each migrated game keeps its own two-client browser suite (`games/<game>/tests/`).
Run the server, then the suite with the Playwright path. Mobile portrait pages in
some suites currently stop on the shared "rotate to landscape" dialog; that is not
a network failure.
