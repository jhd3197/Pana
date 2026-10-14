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
| `character.js` | `buildCharacter(avatar)`: the low-poly capybara pana in Three.js, with blinking eyes, a mouth that opens and dizzy stars. Call `update(dt, {open, dizzy, look})` every frame. Outfits are the torso's own color (no cloth layers), details sit flush on it. | hub, derrape, bululu, escondidas |

Import with absolute paths so it works from any page:

```js
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/character.js';   // needs "three" in the page's import map
```

New avatar options go in `avatar.js` (`OPTIONS`, color lists) and get built in
`character.js`. `normalizeAvatar()` keeps old saves working when options change.

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
