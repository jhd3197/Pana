# engine/

Shared game code, served to browsers at `/engine/*`. Something moves here once a
**second** page needs it — duplicate first, extract on the second use.

| File | What | Used by |
|---|---|---|
| `avatar.js` | A player's look (fur, hat, glasses, outfit, face, extra) + name, saved in `localStorage`. Plain data, no Three.js. Brand palette lives here too. | hub, derrape, bululu, escondidas |
| `fx.js` | WebAudio `sound` (horns, bonks, pickups, whooshes…, no files), `Puffs` (smoke/dust), `Debris` (parts that pop off), `makeBubble()` (cartoon speech bubble sprite). | derrape, bululu |
| `props.js` | Procedural builders, no asset files: `makeMango({gold})`, `rock`, `woodSign(lines)`, `flagPole({flag:'pana'})`, `watchtower`, `venezuelaFlag`, `panaFlag`, plus helpers (`M`, `mesh`, `box`, `tube`, `canvasMat`, `rng`). Scenery sits on y = 0 and faces +Z; mangoes keep their centered carry/projectile origin. `userData.tick(t, dt)` wants animating. | derrape, bululu |
| `flora.js` | The canonical curved palms, mango trees, ceibas, pines, bananas, bushes, houses and static mesh batching (`bake`). The original Bululú import path re-exports this module. | all games and shared market kit |
| `flora-species.js` | Seeded `araguaney`, `bamboo`, `fern`, `monstera`, `heliconia`, `cactus`, `mangrove`, `papaya`, `agave`, `waterLily`, `hibiscus`, `reeds`, `jungleGiant`, `tropicalBush`, `frailejon`, `mountainPine`, re-exported by `flora.js`. Owned, batched geometry. | Studio; first twelve also in Derrape (Selva) |
| `botanical-shapes.js` | Folded leaf surfaces and tapered curved stems with independently owned geometry. | fruit, foliage, island house |
| `island-house.js` | Seeded plaster casita with shutters, veranda and terracotta tiles, returned as 12 material batches. `flora.js` re-exports `casita`. | shared scenery and Studio |
| `static-batch.js` | Canonical `bake` implementation; `flora.js` retains the public compatibility export. | shared scenery, casita |
| `landmarks.js` | Pana signature monuments: `capybaraStatue`, `goldenMangoStatue`, `welcomeArch`, `capybaraTopiary`, `panaFlagpole`, `trophyMonument`, `capybaraFountain`, `souvenirKiosk`, plus the shared `capybaraForm`. Grounded, +Z, baked. | Pana Studio |
| `water-details.js` | Instanced ripples and moving droplets for both shared fountains and the waterfall; deterministic absolute-time updates. | Landmarks, Plaza, jungle props |
| `jungle-props.js` | Jungle ruins and traversal: `templeEntrance`, `ropeBridge`, `waterfallRocks`, `vineArch`, `bambooBridge`, `stoneTotem`, `hollowLog`, plus `liana`. Plants `jungleGiant`/`tropicalBush` come from `flora.js`. | Pana Studio |
| `pueblo-props.js` | Pueblo 011–020: colonial house, bodega, church, bus shelter, arepa kiosk, animated clock tower, basketball hoop, rooftop tank, streetlight and park bench. | Pana Studio |
| `mountain-props.js` | Páramo 052–060: cabin, animated cable car station, modular cliff, adjustable guardrail, lookout, tent, suspension bridge and trail sign. Plants 051/057 come from `flora.js`. | Pana Studio |
| `architecture-kit.js` | Shared roof tiles, masonry, arches, shutters, railings and owned canvas signs; disposes temporary geometry after batching. | Pueblo and Páramo factories |
| `plaza-catalog.js` | Renderer-independent prop IDs, Spanish labels, dimensions, collision radii and heights. | escondidas rules, shared market kit |
| `plaza-props.js` | `barrel`, `crate`, `cooler`, `planter`, `bench`, `marketStall`, `streetLamp`, and `createPlazaProp(id)`. No gameplay state or game-specific imports. | escondidas, derrape (Los Llanos), hub |
| `plaza.js` | `createPlaza({cooking:false})`, `plazaFountain()`: the shared buildings, paving, fountain, greenery and market. `createPlazaEnvironment({clearance})` returns geometry and water animation without lights, for embedding in another game. | escondidas, cocina, derrape |
| `island-environment.js` | `ISLAND_LOOP` and `createIslandEnvironment(scene,{island,pathDist,inShot,clearance})`: sea, biome vegetation, big mango tree, harbor, lanterns, signs and animation. No tiles, dice or race logic. | bululu, derrape |
| `island-terrain.js` | Shared coastline, hill, Pico Pana, river and beach heightfield. `buildIsland(tiles,edges,{road})` optionally reserves a wider driving corridor and lowers the river below its deck. | bululu, derrape |
| `island-scenery.js`, `island-landscape.js`, `terrain-material.js`, `beach-props.js` | Offshore islands, tepuis, lighthouse, boats, clouds, terrain shading and beach furniture. Old Bululú URLs re-export these sources. | bululu, derrape |
| `plaza-layout.js` | Original hunt map data, collision, sight and navigation. Escondidas retains compatibility re-exports. | escondidas, plaza renderer |
| `kitchen-props.js` | `food(id,{stage,plated})`, `corn`, `cheese`, `kitchenStation`, `sink`, `kitchenSign`. Actual 3D food also supplies the order-ticket thumbnails. | cocina, hub |
| `character.js` | `buildCharacter(avatar,{seated,chef})`: articulated legs, expressive face, optional chef hat and apron. `update(dt,{open,dizzy,look,walk,carry,run})` animates the rig. `carry` is a hand-level attachment group. Existing `armL`, `armR`, `neck`, `head` APIs are preserved. Drivers explicitly use `seated:true`. | hub, derrape, bululu, escondidas, cocina |

Import with absolute paths so it works from any page:

```js
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/character.js';   // needs "three" in the page's import map
```

New avatar options go in `avatar.js` (`OPTIONS`, color lists) and get built in
`character.js`. `normalizeAvatar()` keeps old saves working when options change.

Characters use the sculpt in `soft-character/`, shared with Pana Studio. The
game adapter preserves avatar data, game-world size, seated drivers and carrying.
The editor uses full tessellation; games sample the same surfaces more sparsely.
Use `character.dispose()` when removing one. Detach shared carried props first.
See `docs/knowledge/pana-studio.md` for the catalog and extension workflow.
See `docs/knowledge/shared-props.md` for fruit/foliage geometry budgets and checks.

## Reusing the plaza kit

```js
import { createPlazaProp, marketStall, PLAZA_PROPS } from '/engine/plaza-props.js';
import { palm, mangoTree, bake } from '/engine/flora.js';

const barrel = createPlazaProp('barrel');
barrel.position.set(10, 0, 4);
scene.add(barrel, marketStall({ seed: 4 }));
```

Models sit at ground level and face +Z. Their world-unit dimensions are in
`PLAZA_PROPS`; games decide movement, collision and interactions. Disguises and
map scenery use identical factories. Keep moving objects outside `bake()`.
Builders share cached materials: dispose owned geometry when removing an object,
but do not dispose shared materials while another scene still uses the kit.
Include `three/addons/` in the page's import map for the foliage batcher.

## Reusing whole worlds

Edit foliage in `flora.js`, Plaza models in `plaza.js` / `plaza-props.js`, and
island scenery in `island-environment.js` and its neighboring modules. Changes
reach every consumer on reload. Do not add a second tree implementation in a
game folder or put game rules in an environment builder.

Environment `clearance(x,z,radius)` uses local world units and returns true
where scenery can stand. Derrape converts Plaza coordinates by its 2.0 scale
and reserves the driving corridor before static batching. Bululú supplies its
board-camera `inShot` rule; the racer leaves that rule off. Each game owns its
lights and camera. Call the returned `update` once per frame; do not also tick
the same environment's animated children. Keep instanced offshore vegetation
out of `bake()`. Derrape batches individual shared trees before placement.

`createPlazaEnvironment({town:true, clearance})` opens the courtyard's side
streets and front garden where the race passes. The default courtyard for the
other games is unchanged. `house()` is exported for extending the same pueblo.

The race island expands local geography by 3.2 horizontally and 1.7 vertically.
Pass those values as `layoutScale` and `heightScale` to the island environment
before applying the same transform to its group; placed trees and houses keep
their original dimensions. Convert road queries and clearance into local units.
The board uses the defaults of 1. `bake(root,{cellSize})` optionally separates
material batches into spatial cells so distant parts can be culled.
