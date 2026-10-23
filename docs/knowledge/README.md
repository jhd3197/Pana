# knowledge/

Field notes: short markdown files recording non-obvious lessons learned while
building Pana — netcode traps, physics tuning values, deployment gotchas.

Format: symptom → cause → fix, plus exact versions that worked.
Written by whoever learned the lesson, human or AI, for whoever comes next.

## Which note for which area

| Area | Notes |
|---|---|
| Starting a game | `AGENTS.md`, then `.\dev.ps1 new-game <id> -Kind table\|live` (`Pana/scripts/templates/`) |
| Three.js version and renderer migrations | `three-renderer.md` |
| Hub and launcher | `launcher.md` |
| Shared UI and look | `pana-kit.md` (kit, results, icons, colours, touch), `pana-ui.md` (menu, settings, invites); NPC barks come from `Pana/engine/play/frases.js` (dichos by mood, seeded `pickLine`, `crude` lines opt-in) and show in `engine/play/seat-bubbles.js` |
| Sound and music | `fx.md` (SFX voice budget), `music.md` (songs) |
| Online rooms | `pana-net.md` (room kit, `TableRoom`, `LiveRoom`), `carreritas-online.md` |
| Who starts a table game | `quien-empieza.md` (the shared cacho mini game, its room option and flavours) |
| Characters | `character-reference.md` |
| Pana Studio and models | `pana-studio.md`, `model-inventory.md`, `shared-props.md`, `shared-arenas.md`, `living-world.md`, `nature-surfaces.md`, `venezuelan-trees.md`, `colonial-houses.md`, `folio-grab-list.md` |
| Prop packs | `pueblo-paramo-props.md`, `llanos-desert-props.md`, `coastal-props.md`, `procedural-farm-animals.md`, `wildlife.md`, `map-asset-rollout.md` |
| Carreritas | `carreritas.md` (start here), `carreritas-menu.md`, `carreritas-loadout.md`, `carreritas-driving.md`, `carreritas-grand-prix.md`, `carreritas-scenery.md`, `water-worlds.md`, `carreritas-tracks.md`, `carreritas-map-improvements.md`, `venezuela-circuits.md`, `puerto-circuit.md`, `aragua-circuits.md`, `tovar-galipan-maracaibo.md`, `carreritas-road-polish.md`, `circuit-surroundings.md`, `carreritas-items.md`, `carreritas-wheels.md`, `carreritas-performance.md`, `carreritas-online.md` |
| Other games | `billar.md`, `bululu.md`, `caida.md`, `chapita.md`, `cocina.md`, `criollas.md`, `curiara.md`, `domino.md`, `embuste.md`, `escondidas.md`, `galope.md`, `lancha.md`, `ludo.md`, `parapente.md`, `pintura.md`, `poquer.md`, `qqsmp.md`, `reliquia.md`, `stop.md`, `tambor.md`, `trifulca.md` |

Each area note ends with **Notes for agents**: the rules for that area that used
to live in `AGENTS.md`.
