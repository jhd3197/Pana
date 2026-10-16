# Pana

**Juega con tus panas.** A hub of free browser games. Share a link, your friends
join, nothing to install. Every game uses the same pana: the character you make
in the hub.

## Games

| Game | What it is | Players |
|---|---|---|
| **Derrape** | Toy-car racing on eight circuits, with items, coins and swappable wheels | 1–8, online rooms |
| **Bululú** | Party board game on Mango Island, with a minigame every round | 1 vs bots |
| **Escondidas** | Prop hunt in a market plaza: hide as a barrel, crate or bench | 1–8, bots fill in |
| **Pana Cocina** | Cooperative three-minute cooking rush: arepas, cachapas, tequeños | 1–8, bot helpers |
| **Galope** | Horse racing around a Llanos ranch, through esteros and over logs | 1–8, bots fill in |
| **Reliquia** | Cooperative expedition into a mine and the temple beneath it | 1–8 |
| **Dominó** | Partnership dominoes to 100 at a 3D plaza table | 1–4, bots fill seats |
| **Caída** | Spanish cards to 24 points, individual or in pairs | 1–4, bots fill seats |

What changed and when: [CHANGELOG.md](CHANGELOG.md).

## Run it

Needs Node.js 22 or newer.

```powershell
npm install
npm start                 # or .\dev.ps1 on Windows
```

Then open http://localhost:8461. Games live at `/g/<game>/` (for example
`/g/derrape/`). The dev script prints a LAN address for friends on your network.

- **Pana Studio** (`.\dev.ps1 studio`, `/studio/library`): every shared character,
  prop, vehicle and map with a live preview and its source. See
  [the studio guide](docs/knowledge/pana-studio.md).
- **Character editor**: `/personaje.html`.

## Test it

```powershell
npm run check             # syntax check of every .js file
npm test                  # unit tests + house-rule checks (no browser needed)
npm run test:browser      # Playwright suites; set PANA_PLAYWRIGHT_PATH
.\dev.ps1 check -Browser  # all of the above
```

CI runs `check` and `test` on every push to `dev`.

## How it's built

One Node server, a static hub and one folder per game; plain ES modules with no
build step, Three.js from a CDN, and Colyseus rooms for online play.

```
README.md, AGENTS.md, CHANGELOG.md, dev.ps1, package.json
docs/                  architecture, deployment, knowledge/ (field notes)
Pana/
├── server/            HTTP, API and Colyseus rooms
├── web/               the hub, character creator and Pana Studio
├── games/<game>/      game.json + public/ (rules.js, network.js, scene.js, game.js) + tests/
├── engine/            shared code: kit, menu, rooms, invites, results, icons, models
├── scripts/           test runner and tooling
└── tests/             convention tests
```

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): request flow, a game's files, rooms.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): running it for real on pana.sh.
- [docs/knowledge/](docs/knowledge/README.md): notes per game and per area.

## Contributing

This repo is built largely by AI coding agents. Read [AGENTS.md](AGENTS.md) first;
it's short. Player-facing changes add a line to [CHANGELOG.md](CHANGELOG.md) in
the same commit.

Next up: the public deploy at **pana.sh**.
