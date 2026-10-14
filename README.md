# Pana

**Juega con tus panas.** A hub of free multiplayer browser games — share a link, friends join, no installs.

First game: **Choque** — a car crash arena. Drive around, smash your panas, last car laughing wins.

## Run it

```powershell
npm install
npm start            # or: npm run dev  /  Pana\dev.ps1
```

- Hub: http://localhost:8461
- Choque: http://localhost:8461/g/choque/
- Friends on your network: the dev script prints your LAN URL.

## Repository layout

The repo root stays clean on purpose — everything lives in [`Pana/`](Pana/):

```
Pana/                  ← this repo
├── README.md          ← you are here
├── package.json       ← npm workspace root: npm start / check / dev
└── Pana/              ← the app
    ├── dev.ps1        ← Windows dev launcher (start / check / setup)
    ├── server/        ← pana-server: HTTP API + statics + WebSocket rooms
    ├── web/           ← hub frontend: game list, live rooms, name picker
    ├── games/         ← one folder per game (choque, derrape, bululú…)
    ├── engine/        ← shared game code
    ├── docs/          ← architecture, deployment, plans/, knowledge/
    └── AGENTS.md      ← rules for AI coding agents working in the repo
```

## Roadmap

- **Choque** — crash derby arena (playable now)
- **Derrape** — drift racing mode
- **Bululú** — minigame collection
- **pana.sh** — public deploy

## Contributing / AI agents

See [Pana/AGENTS.md](Pana/AGENTS.md). This repo is designed to be built largely by AI coding agents — read that file first.
