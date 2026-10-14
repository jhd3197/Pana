# engine/

Shared game code, served to browsers at `/engine/*`. Something moves here once a
**second** page needs it — duplicate first, extract on the second use.

| File | What | Used by |
|---|---|---|
| `avatar.js` | A player's look (fur, hat, glasses, outfit, face, extra) + name, saved in `localStorage`. Plain data, no Three.js. Brand palette lives here too. | hub, derrape, bululu, escondidas |
| `fx.js` | WebAudio `sound` (horns, bonks, pickups, whooshes…, no files), `Puffs` (smoke/dust), `Debris` (parts that pop off), `makeBubble()` (cartoon speech bubble sprite). | derrape, bululu |
| `props.js` | Low-poly builders, no asset files: `makeMango({gold})`, `palm`, `rock`, `woodSign(lines)`, `flagPole`, `watchtower`, `venezuelaFlag`, plus the helpers they use (`M`, `mesh`, `box`, `tube`, `canvasMat`, `rng`). Props sit on y = 0 and face +Z; `userData.tick(t, dt)` wants animating. | derrape, bululu |
| `flora.js` | Bululú's curved palms, mango trees, ceibas, pines, bananas, bushes, houses and static mesh batching (`bake`). The original Bululú import path re-exports this module. | bululu, escondidas, shared market kit |
| `plaza-catalog.js` | Renderer-independent prop IDs, Spanish labels, dimensions, collision radii and heights. | escondidas rules, shared market kit |
| `plaza-props.js` | `barrel`, `crate`, `cooler`, `planter`, `bench`, `marketStall`, `streetLamp`, and `createPlazaProp(id)`. No gameplay state or game-specific imports. | escondidas, derrape (Los Llanos), hub |
| `plaza.js` | `createPlaza({cooking:false})`: the shared buildings, paving, fountain, greenery and market. Cooking clears the courtyard and moves the fountain behind the kitchen. | escondidas, cocina |
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

Characters use broad polygon facets, a continuous forward muzzle with small
nostril slits on top, rounded ears, and a pear-shaped torso. Keep outfit details
on `BODY_PROFILE` using `onTorso`; flat patches can disappear into the belly.
Chef aprons follow the same facet boundaries. Standing and seated variants share
the rig and avatar options; hats must fit both front and side views.

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
