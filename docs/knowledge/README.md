# knowledge/

Field notes: short markdown files recording non-obvious lessons learned while
building Pana — netcode traps, physics tuning values, deployment gotchas.

Format: symptom → cause → fix, plus exact versions that worked.
Written by whoever learned the lesson, human or AI, for whoever comes next.

## Which note for which area

| Area | Notes |
|---|---|
| Starting a game | `AGENTS.md`, then `.\dev.ps1 new-game <id> -Kind table\|live` (`Pana/scripts/templates/`) |
| Hub and launcher | `launcher.md` |
| Shared UI and look | `pana-kit.md` (kit, results, icons, colours, touch), `pana-ui.md` (menu, settings, invites); NPC barks come from `Pana/engine/frases.js` (dichos by mood, seeded `pickLine`, `crude` lines opt-in) and show in `engine/seat-bubbles.js` |
| Online rooms | `pana-net.md` (room kit, `TableRoom`, `LiveRoom`), `derrape-online.md` |
| Characters | `character-reference.md` |
| Pana Studio and models | `pana-studio.md`, `model-inventory.md`, `shared-props.md`, `shared-arenas.md`, `living-world.md`, `nature-surfaces.md`, `venezuelan-trees.md`, `colonial-houses.md`, `folio-grab-list.md` |
| Prop packs | `pueblo-paramo-props.md`, `llanos-desert-props.md`, `coastal-props.md`, `procedural-farm-animals.md`, `wildlife.md`, `map-asset-rollout.md` |
| Derrape | `derrape.md` (start here), `derrape-menu.md`, `derrape-driving.md`, `derrape-grand-prix.md`, `derrape-scenery.md`, `water-worlds.md`, `derrape-tracks.md`, `venezuela-circuits.md`, `puerto-circuit.md`, `circuit-surroundings.md`, `derrape-items.md`, `derrape-wheels.md`, `derrape-performance.md`, `derrape-online.md` |
| Other games | `billar.md`, `bululu.md`, `caida.md`, `cocina.md`, `criollas.md`, `curiara.md`, `domino.md`, `embuste.md`, `escondidas.md`, `galope.md`, `ludo.md`, `pintura.md`, `poquer.md`, `qqsmp.md`, `reliquia.md` |

Each area note ends with **Notes for agents**: the rules for that area that used
to live in `AGENTS.md`.
