# engine/

Shared game code, served to browsers at `/engine/*`. Browser ESM, no build step.
Extract reusable code when a second page needs it; keep gameplay with its game.

Three layers, so it's clear what every game stands on and what only some use:

- **`engine/*.js` (the kit):** what any game or page needs: rooms (`net`,
  `live-room`, `table-room`, `predict`), lobby and menus (`game-entry`, `ui`,
  `room-options`, `lobby-roster`), settings, touch, fx, music, results, invites,
  icons, `hud`, `random`, the player's look (`avatar`, `portrait`, `wardrobe`)
  and the CSS. pana.sh loads `kit.css`, `ui.js`, `avatar.js`, `portrait.js`,
  `portrait-cache.js` and `wardrobe-preview.js` by path: keep those where they
  are (`tests/conventions.test.js` checks).
- **`worlds/`:** stages and maps several games build on: the plaza, the table
  stage (`table-world`), arenas and their layouts, the island, the sky and
  terrain shading, El Estadio, the colonial street, the Puerto tables.
- **`play/`:** mechanics two or more games share: shot charge and aim guide,
  dice throws and roll-offs, paddling, bolas criollas physics, seats and seat
  bubbles, difficulty, first-person look, map picker, frases, El Saber.

Plus `models/` (every 3D model), `river/` (the river races), `placement/`,
`audio/` and `vendor/`.

The canonical 3D library is [models/](models/README.md). Its factories are shared
by Studio and games; their catalog entries are plain data. For all current
resources, map consumers, missing previews and older code, see the
[model inventory](../../docs/knowledge/model-inventory.md).

| Location | Responsibility |
| --- | --- |
| `models/fauna/` | Individual birds, farm animals, fish, crab and natural capybara; scoped rigs |
| `models/vegetation/` | All 24 plant models, including moriche and savanna grass, with shared canopy/leaf helpers |
| `models/props/` | Scenery packs, monuments, furniture, buildings, kitchen and carried props |
| `models/characters/pana/` | Character sculpt, wardrobe, expression geometry and avatar adapter |
| `models/core/` | Cached materials, primitives, batching and construction helpers |
| `models/animation/`, `models/effects/` | Reusable motion, water and steam |
| `models/catalog.js` | Pure category/pack metadata; no eager model construction |
| `placement/` | Terrain-aware reef school placement and crab grounding |
| `avatar.js` | Saved appearance/name, brand palette and normalization; no renderer |
| `worlds/plaza.js`, `worlds/plaza-layout.js` | Plaza world composition and hunt layout/navigation |
| `worlds/island-environment.js`, `worlds/island-terrain.js` | Board island terrain and scenery composition |
| `worlds/island-scenery.js`, `worlds/island-landscape.js`, `worlds/terrain-material.js` | Offshore worlds, terrain shading and older scene assemblies |
| `fx.js` | Audio, particle bursts, debris and speech bubbles |
| `ui.js`, `settings.js` | Shared game menu, settings persistence and hints |
| `play/saber.js`, `play/saber-match.js` | El Saber: shared Venezuelan words (categories, variants, explanations, crude flag) and the pure normalize/fuzzy lookup that ¡Stop! uses; see `docs/knowledge/stop.md` |

Models have one home: `models/` (the pana itself is
`models/characters/pana/`). The old alias URLs (`props.js`, `flora.js`,
`wildlife.js`, `character.js`, `soft-character/*`) are gone; import canonical
files directly. The source inspector and inventory use actual model
paths. `worlds/plaza.js` still re-exports `house` and `plazaFountain` for compatibility,
while their implementations live in `models/props/plaza-buildings.js`.

## Using models

Import directly so changes propagate to the games and Studio without copies:

```js
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { scarletMacaw } from '/engine/models/fauna/birds/scarlet-macaw.js';
import { orbitBird } from '/engine/models/animation/orbit-bird.js';
import { createPlazaProp } from '/engine/models/props/plaza.js';
import { palm } from '/engine/models/vegetation/palm.js';

const barrel = createPlazaProp('barrel');
barrel.position.set(10, 0, 4);
scene.add(barrel, palm({ seed: 4 }));
```

The page needs Three.js and `three/addons/` in its import map. Models use metres,
+Y up, +Z forward and ground y=0, except documented carried/water/keel origins.
Games own collisions and interactions; catalog registration does not place an
asset. `models/props/plaza-definitions.js` is the shared source for disguise
labels and dimensions.

Keep animated roots outside `bake()`. Tick each root once, using absolute time
where supported. Factories return owned geometry and may share cached materials;
do not dispose or mutate cached materials while other models use them. Preview
controls clone materials. Call character/texture/skeleton disposers when releasing
models and detach shared carried objects first. The character adapter preserves
saved avatars, game-world size, articulated legs, seated drivers and carrying.

## Reusing whole worlds

Edit foliage in `models/vegetation/`, Plaza models in `models/props/`, and
island scenery in `island-environment.js` and its neighboring modules. Changes
reach every consumer on reload. Do not add a second tree implementation in a
game folder or put game rules in an environment builder.

Environment `clearance(x,z,radius)` uses local world units and returns true
where scenery can stand. Carreritas converts Plaza coordinates by its 2.0 scale
and reserves the driving corridor before static batching. Bululú supplies its
board-camera `inShot` rule; the racer leaves that rule off. Each game owns its
lights and camera. Call the returned `update` once per frame; do not also tick
the same environment's animated children. Keep instanced offshore vegetation
out of `bake()`. Carreritas batches individual shared trees before placement.

`createPlazaEnvironment({town:true, clearance})` opens the courtyard's side
streets and front garden where the race passes. The default courtyard for the
other games is unchanged. `house()` is exported for extending the same pueblo.

The race island expands local geography by 3.2 horizontally and 1.7 vertically.
Pass those values as `layoutScale` and `heightScale` to the island environment
before applying the same transform to its group; placed trees and houses keep
their original dimensions. Convert road queries and clearance into local units.
The board uses the defaults of 1. `bake(root,{cellSize})` optionally separates
material batches into spatial cells so distant parts can be culled.
