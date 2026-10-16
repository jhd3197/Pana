# Pana

**Juega con tus panas.** A hub of free multiplayer browser games — share a link, friends join, no installs.

First game: **Derrape** — a goofy toy-car race. Jump ramps, flip over, lose your bumpers, honk *La Cucaracha*. Your pana (made in the hub) is the driver.

Choose from eight circuits, including **Plaza Pana** and **Isla Bululú**.
Collect coins for up to 8% extra speed, smash wooden supply crates and carry two
items. Throw forward with **Space**, backward with **X**, and switch with **Q**
or **1/2**. Keep a mango equipped to block an incoming mango; each block spends
one mango. The garage previews all eight detailed cars, and touch controls are
available on phones.
The plaza buildings, island terrain, trees and scenery use the same shared
sources as the other games, so asset improvements carry through everywhere.

Second game: **Bululú**: a party board game on Mango Island. Roll the die, collect monedas, buy the *Mango de oro*, and win a minigame after every round.

Third game: **Escondidas · Pana Hunt** — hide in a colorful market plaza as a
barrel, crate, cooler, plant or bench. Three transformations per round; 15 seconds
to hide, then 100 seconds to hunt. Play solo with bots or share a room with up to
8 panas. Roles rotate, with four rounds for a small group and up to eight for a
full room. Uses the same saved character, Bululú foliage, and market props now
also featured in Derrape's Los Llanos track.

Fourth game: **Pana Cocina** — a cooperative three-minute cooking rush in the
same Plaza Pana. Collect ingredients, prepare arepas, cachapas, tequeños and
empanadas, mind the stoves, and serve before orders expire. Play with two bot
helpers or invite up to 8 panas. Includes touch controls, shared counters,
fire recovery, team scores and replay. Panas now have animated legs, and the
kitchen crew wears chef hats and aprons over their saved outfits.

Fifth game: **Galope** — horse racing around a 482-metre Llanos ranch circuit.
Ride your saved pana through two shallow esteros, jump three logs per lap and
manage stamina over two laps. Choose a horse coat, race against the hato's
jinetes or invite up to 8 panas. Includes touch controls, shared settings,
ordered checkpoints, results, replay and host migration.
The surrounding hato now opens onto an irregular lagoon with an island and a
winding morichal channel, with caneyes, chinchorros, a canoe landing and native
grassland. Thirteen new reusable models are also available in Pana Studio.

Sixth game: **Reliquia** — a cooperative expedition into an abandoned mine and
the temple beneath it. Explore with your saved pana, fight wrapped guardians,
activate two timed winches, retrieve the sun relic and return to camp together.
Includes dodging, healing, revives, adaptive encounter pacing, touch controls,
late joining, host migration and replay. Play solo or share a room with up to
8 panas; the first expedition is designed around small groups.

## Run it

```powershell
npm install
npm start            # or: npm run dev  /  Pana\dev.ps1
.\Pana\dev.ps1 studio # Pana Studio: character editor and asset library
```

- Hub: http://localhost:8461
- Derrape: http://localhost:8461/g/derrape/
- Bululú: http://localhost:8461/g/bululu/
- Escondidas: http://localhost:8461/g/escondidas/
- Cocina: http://localhost:8461/g/cocina/
- Galope: http://localhost:8461/g/galope/
- Reliquia: http://localhost:8461/g/reliquia/
- Pana Studio: http://localhost:8461/studio.html
- Character editor: http://localhost:8461/personaje.html
- Friends on your network: the dev script prints your LAN URL.

## Repository layout

Pana Studio preserves the character editor and catalogs shared objects, scenery,
vehicles and maps with live previews and source paths. **Usar en los juegos**
saves an outfit for the shared character used by all games. Agents add assets
through the existing factories and `Pana/web/studio/catalog.js`; see
[the studio guide](docs/knowledge/pana-studio.md). The catalog is managed in code;
it is not yet a visual map-placement editor.

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
- **Cocina**: cooperative Venezuelan cooking in Plaza Pana (playable now; helpers + shared rooms)
- **Galope**: Llanos horse racing (playable now; shallow water, jumps, bots + shared rooms)
- **Reliquia**: cooperative mine and temple expedition (playable now; mummies, shared puzzles, revives and relic extraction)
- **pana.sh** — public deploy

## Contributing / AI agents

See [Pana/AGENTS.md](Pana/AGENTS.md). This repo is designed to be built largely by AI coding agents — read that file first.
