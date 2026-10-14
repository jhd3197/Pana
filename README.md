# Pana

**Juega con tus panas.** A hub of free multiplayer browser games — share a link, friends join, no installs.

First game: **Derrape** — a goofy toy-car race. Jump ramps, flip over, lose your bumpers, honk *La Cucaracha*. Your pana (made in the hub) is the driver.

Second game: **Bululú**: a party board game on Mango Island. Roll the die, collect monedas, buy the *Mango de oro*, and win a minigame after every round.

Third game: **Escondidas · Pana Hunt** — hide in a colorful market plaza as a
barrel, crate, cooler, plant or bench. Three transformations per round; 15 seconds
to hide, then 100 seconds to hunt. Play solo with bots or share a room with up to
8 panas. Roles rotate, with four rounds for a small group and up to eight for a
full room. Uses the same saved character, Bululú foliage, and market props now
also featured in Derrape's Los Llanos track.

## Run it

```powershell
npm install
npm start            # or: npm run dev  /  Pana\dev.ps1
```

- Hub: http://localhost:8461
- Derrape: http://localhost:8461/g/derrape/
- Bululú: http://localhost:8461/g/bululu/
- Escondidas: http://localhost:8461/g/escondidas/
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
    ├── games/         ← one folder per game (derrape, bululú…)
    ├── engine/        ← shared game code
    ├── docs/          ← architecture, deployment, plans/, knowledge/
    └── AGENTS.md      ← rules for AI coding agents working in the repo
```

## Roadmap

- **Derrape** — toy-car race with goofy physics (playable now)
- **Bululú**: party board game + minigames (playable now; more minigames coming)
- **Escondidas**: prop hunt in Plaza Pana (playable now; solo bots + shared rooms)
- **pana.sh** — public deploy

## Contributing / AI agents

See [Pana/AGENTS.md](Pana/AGENTS.md). This repo is designed to be built largely by AI coding agents — read that file first.
