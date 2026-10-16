# Architecture

Pana is a monorepo: one Node backend, one static hub frontend, and one folder per game.

```
Pana/                    ← repo root
├── AGENTS.md            ← rules for AI coding agents
├── dev.ps1              ← Windows dev launcher (start / server / studio / check / setup)
├── package.json         ← npm workspace root
├── docs/
│   ├── ARCHITECTURE.md  ← request flow, multiplayer model, WS protocol
│   ├── DEPLOYMENT.md    ← local dev + going live on pana.sh
│   ├── plans/           ← numbered implementation plans (NN_name.md)
│   └── knowledge/       ← field notes written by whoever learned something
└── Pana/                ← the app
    ├── server/          ← pana-server: the only backend
    │   └── src/
    │       ├── index.js     ← entry point: wires HTTP, /ws and /colyseus together
    │       ├── config.js    ← ports, limits, paths (env: PANA_HOST, PANA_PORT)
    │       ├── app.js       ← HTTP routing
    │       ├── api.js       ← /api/* JSON endpoints + game discovery
    │       ├── static.js    ← safe static file serving
    │       ├── rooms.js     ← legacy /ws relay (old cached clients only)
    │       ├── colyseus.js  ← Colyseus mount at /colyseus; registers a room per game
    │       ├── room-kit.js  ← PanaRoom: seats, host, lead, reconnection, listings
    │       ├── relay-room.js← default host-relay room for games without their own
    │       └── check.js     ← syntax check across the repo (npm run check)
    ├── web/             ← hub frontend: games, rooms, "Tu pana" character creator
    ├── games/
    │   └── <game>/
    │       ├── game.json    ← name, description, max players, tile color
    │       ├── public/      ← everything the browser needs (Three.js via CDN);
    │       │                  optional card.js draws live art on the hub tile
    │       └── server/      ← optional Colyseus room (room.js), never served
    └── engine/          ← shared code served at /engine/* (avatar.js, character.js,
                           net.js: the browser half of the multiplayer kit)
```

## Request flow

| URL | Handler | Purpose |
|---|---|---|
| `/` | `web/` statics | Hub: game list, live rooms, name picker |
| `/studio/library`, `/studio/workspace` | Studio shell | Lightweight catalog and saved working set |
| `/studio/assets/:id` | Studio shell | Dedicated resource page; lazy live preview |
| `/studio/settings`, `/studio/guide` | Studio statics | Cache settings and contributor guide |
| `/personaje.html` | `web/` statics | Full character and wardrobe editor; saves the game avatar |
| `/g/<game>/*` | `games/<game>/public` | A game's client |
| `/engine/*` | `engine/` statics | Shared code: player avatar + 3D character |
| `/api/*` | `api.js` | JSON: health, games, rooms |
| `/ws` | `rooms.js` | Legacy WebSocket relay (no current game uses it) |
| `/colyseus/*` | `colyseus.js` | Colyseus matchmaking (HTTP) and room sockets |

## A game's files

Every game uses the same split, so data, rules and rendering never tangle:

```
games/<game>/
├── game.json        name, description, players, color (the hub reads it)
├── public/
│   ├── index.html   links /engine/kit.css, /engine/ui.css, then style.css
│   ├── card.js      the hub tile's live art
│   ├── rules.js     pure rules: plain data in, plain data out; no DOM, no Three.js
│   ├── network.js   thin room: extends HostRoom (engine/net.js) or joins its own
│   ├── scene.js     the 3D world (Three.js)
│   ├── ui.js        DOM: HUD, lobby, results (optional while game.js stays small)
│   └── game.js      wiring only: input → rules → network → scene/ui
├── server/room.js   optional: the game's own Colyseus room
└── tests/
    ├── rules.test.js      node --test, runs in npm test and CI
    └── *.browser.js/.mjs  Playwright, runs in npm run test:browser
```

Anything a test can check without a browser goes in `rules.js` (or a sibling such
as Derrape's `item-rules.js` and `online-rules.js`) with a `rules.test.js` beside
it. A single-player game (`players: 1`) has no `network.js`. Shared pieces live in
`engine/`: room codes and invites (`invite.js`), rooms (`net.js`), the end screen
(`results.js`), menu and settings (`ui.js`, `settings.js`), touch (`touch.js`).
`Pana/engine/tests/` and `Pana/tests/conventions.test.js` enforce the contract.

## Players

A player is a name plus a look (`engine/avatar.js`), both kept in the browser's
`localStorage` (`pana:name`, `pana:avatar`). The hub edits them; games read them
on load. Games build the 3D pana with `engine/character.js`. Nothing about the
player is stored on the server.

The character sculpt is shared under `engine/soft-character/`. The game adapter
in `engine/character.js` preserves game-world scale, seated/carry poses and saved
avatars while using a lighter geometry profile. Pana Studio registers existing
asset constructors in `web/studio/catalog.js`; no additional backend is needed.
Its known browser routes serve `studio.html`; `routes.js` handles navigation and
filter URLs, and `inspector.js` loads on an asset page only. Legacy
`/studio.html#<id>` links remain valid. Unknown Studio paths keep normal 404s.

## Multiplayer model

Every game's online play runs on Colyseus rooms through one shared kit
(`docs/knowledge/pana-net.md`). Rooms are ephemeral, one per game and invite code
(`?room=<code>`), capped at 8. There is no persistence, no accounts, no database —
sharing a link IS the lobby. Most games are host-simulated: the room's host runs
the game and publishes snapshots while the room relays (`relay-room.js` +
`engine/net.js` `HostRoom`). Derrape ships its own room, which owns phase, roster
and results while each client drives its own car.

This is deliberately trust-based: Pana is for playing with your panas, not for
competitive strangers. If a game ever needs anti-cheat or authoritative physics,
that game opts into it explicitly.

### Colyseus rooms

`server/src/colyseus.js` registers a room under every game's id with
`filterBy(['code'])`: the game's own `games/<game>/server/room.js` (a `PanaRoom`
subclass) when it has one, otherwise the generic relay room. `room-kit.js` gives every
room members with never-reused seats, a host the room chooses (the party lead first),
instant handoff when the host drops, a 20 s reconnection window, server-clock pings,
listings, and "full" instead of a second room under the same code. Colyseus is embedded on
the same HTTP server (not through its `Server` class), under `/colyseus` for both
matchmaking and sockets; `index.js` routes upgrades by path so `/ws` keeps working.
`/api/rooms` lists both kinds. Only `public/` is ever served, so room code stays
private. The room owns what must agree (phase, host, roster, start time, results)
while clients may still simulate their own entities; see
`docs/knowledge/derrape-online.md`.

## Legacy relay protocol (`/ws`, JSON)

Kept only for clients cached from before the kit; no current game uses it.

Client → server:
- `{t:"join", game, room, name}` — enter a room (creates it if missing)
- `{t:"state", x, z, h, v}` — entity state, relayed verbatim to the room

Server → client:
- `{t:"welcome", id, color, players[]}` — your id/color + who's already there
- `{t:"joined", id, name, color}` — someone arrived
- `{t:"state", id, x, z, h, v}` — someone moved
- `{t:"left", id}` — someone disconnected
- `{t:"full"}` — room is at capacity
