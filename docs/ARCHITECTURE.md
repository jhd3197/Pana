# Architecture

Pana is a monorepo: one Node backend, one static hub frontend, and one folder per game.

```
Pana/                    ← repo root
├── AGENTS.md            ← rules for AI coding agents
├── dev.ps1              ← Windows dev launcher (start / server / studio / check / setup / new-game)
├── package.json         ← npm workspace root
├── docs/
│   ├── ARCHITECTURE.md  ← request flow, multiplayer model, WS protocol
│   ├── DEPLOYMENT.md    ← local dev + going live on pana.sh
│   ├── plans/           ← numbered implementation plans (NN_name.md)
│   └── knowledge/       ← field notes written by whoever learned something
└── Pana/                ← the app
    ├── server/          ← pana-server: the only backend
    │   └── src/
    │       ├── index.js     ← entry point: wires HTTP and /colyseus together
    │       ├── config.js    ← ports, limits, paths (env: PANA_HOST, PANA_PORT)
    │       ├── app.js       ← HTTP routing
    │       ├── api.js       ← /api/* JSON endpoints + game discovery
    │       ├── static.js    ← safe static file serving
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
    └── engine/          ← shared code served at /engine/*: the kit every game uses
        │                  (net.js, live-room.js, ui.js, settings.js, avatar.js, kit.css…)
        ├── worlds/      ← stages and maps several games build on (plaza, table-world, arenas)
        ├── play/        ← mechanics two or more games share (shot charge, dice, paddling)
        └── models/      ← every 3D model, registered in Pana Studio
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
| `/colyseus/*` | `colyseus.js` | Colyseus matchmaking (HTTP) and room sockets |

## A game's files

Every game uses the same split, so data, rules and rendering never tangle.
`.\dev.ps1 new-game <id> -Kind table|live` creates it (`Pana/scripts/templates/`):

```
games/<game>/
├── game.json        name, description, players, color (the hub reads it)
├── public/
│   ├── index.html   links /engine/kit.css, /engine/ui.css, then style.css
│   ├── card.js      the hub tile's live art
│   ├── rules.js     pure rules: plain data in, plain data out; no DOM, no Three.js
│   ├── network.js   thin room: TableRoom (turn-based) or LiveRoom (real-time),
│   │                both on HostRoom (engine/net.js), or joins its own room
│   ├── scene.js     required: the 3D world (Three.js, perspective camera,
│   │                the players' panas); table games use engine/worlds/table-world.js
│   ├── ui.js        DOM: HUD, lobby, results (optional while game.js stays small)
│   └── game.js      wiring only (≤ 600 lines): input → rules → network → scene/ui;
│                    engine/game-shell.js runs loading, loops and teardown
├── server/room.js   optional: the game's own Colyseus room
└── tests/
    ├── rules.test.js      node --test, runs in npm test and CI
    └── *.browser.js/.mjs  Playwright, runs in npm run test:browser
```

Anything a test can check without a browser goes in `rules.js` (or a sibling such
as Derrape's `item-rules.js` and `online-rules.js`) with a `rules.test.js` beside
it. Rules use `engine/random.js` for seeded randomness (it has no Three.js). A single-player game (`players: 1`) has no `network.js`. Shared pieces live in
`engine/`: room codes and invites (`invite.js`), rooms (`net.js`), the end screen
(`results.js`), menu and settings (`ui.js`, `settings.js`), touch (`touch.js`).
`Pana/engine/tests/`, `Pana/server/tests/` and `Pana/tests/conventions.test.js`
enforce the contract; `engine/tests/all-games.browser.js` loads every game in a
real browser. Browser suites share `Pana/tests/browser-kit.js`.

## Players

A player is a name plus a look (`engine/avatar.js`), both kept in the browser's
`localStorage` (`pana:name`, `pana:avatar`). The hub edits them; games read them
on load. Games build the 3D pana with `engine/models/characters/pana/avatar-model.js`. Nothing about the
player is stored on the server.

The character sculpt is shared under `engine/models/characters/pana/`. The game adapter
in `engine/models/characters/pana/avatar-model.js` preserves game-world scale, seated/carry poses and saved
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
and results while each client drives its own car. ¡Embuste! ships its own room
that runs the whole game and sends each player a private view, because its
roles must stay secret (`docs/knowledge/embuste.md`).

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
matchmaking and sockets; `index.js` refuses every other upgrade. A room's cap is its
game's `game.json` `players` (`cappedRoom()` in `colyseus.js`), so a room never sets
`maxClients` itself. `/api/rooms` lists live rooms for the hub. Only `public/` is ever
served (and never `engine/tests/`), so room code stays private. Rooms define
`onUncaughtException`, so a handler that throws skips that message and is logged
instead of ending the server. The room owns what must agree (phase, host, roster, start time, results)
while clients may still simulate their own entities; see
`docs/knowledge/derrape-online.md`.
