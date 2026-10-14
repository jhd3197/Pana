# Architecture

Pana is a monorepo: one Node backend, one static hub frontend, and one folder per game.

```
Pana/
├── dev.ps1              ← Windows dev launcher (start / server / check / setup)
├── package.json         ← npm workspace root
├── server/              ← pana-server: the only backend
│   └── src/
│       ├── index.js     ← entry point: wires HTTP + WS together
│       ├── config.js    ← ports, limits, paths (env: PANA_HOST, PANA_PORT)
│       ├── app.js       ← HTTP routing
│       ├── api.js       ← /api/* JSON endpoints + game discovery
│       ├── static.js    ← safe static file serving
│       ├── rooms.js     ← RoomManager + WebSocket relay
│       └── check.js     ← syntax check across the repo (npm run check)
├── web/                 ← hub frontend: games, rooms, "Tu pana" character creator
├── games/
│   └── <game>/
│       ├── game.json    ← name, description, max players, tile color
│       └── public/      ← everything the browser needs (Three.js via CDN);
│                          optional card.js draws live art on the hub tile
├── engine/              ← shared code served at /engine/* (avatar.js, character.js)
└── docs/
    ├── ARCHITECTURE.md  ← request flow, multiplayer model, WS protocol
    ├── DEPLOYMENT.md    ← local dev + going live on pana.sh
    ├── plans/           ← numbered implementation plans (NN_name.md)
    └── knowledge/       ← field notes written by whoever learned something
```

## Request flow

| URL | Handler | Purpose |
|---|---|---|
| `/` | `web/` statics | Hub: game list, live rooms, name picker |
| `/g/<game>/*` | `games/<game>/public` | A game's client |
| `/engine/*` | `engine/` statics | Shared code: player avatar + 3D character |
| `/api/*` | `api.js` | JSON: health, games, rooms |
| `/ws` | `rooms.js` | WebSocket: join / state relay / leave |

## Players

A player is a name plus a look (`engine/avatar.js`), both kept in the browser's
`localStorage` (`pana:name`, `pana:avatar`). The hub edits them; games read them
on load. Games build the 3D pana with `engine/character.js`. Nothing about the
player is stored on the server.

## Multiplayer model

Clients simulate their own entity and broadcast state at ~20 Hz; the server only
relays inside a room. Rooms are ephemeral, keyed `${game}:${code}`, capped at 8
players (`config.maxPlayersPerRoom`). There is no persistence, no accounts, no
database — sharing a link IS the lobby.

This is deliberately trust-based: Pana is for playing with your panas, not for
competitive strangers. If a game ever needs anti-cheat or authoritative physics,
that game opts into it explicitly.

## Message protocol (WebSocket, JSON)

Client → server:
- `{t:"join", game, room, name}` — enter a room (creates it if missing)
- `{t:"state", x, z, h, v}` — entity state, relayed verbatim to the room

Server → client:
- `{t:"welcome", id, color, players[]}` — your id/color + who's already there
- `{t:"joined", id, name, color}` — someone arrived
- `{t:"state", id, x, z, h, v}` — someone moved
- `{t:"left", id}` — someone disconnected
- `{t:"full"}` — room is at capacity
