# engine/

Shared game code, served to browsers at `/engine/*`. Something moves here once a
**second** page needs it — duplicate first, extract on the second use.

| File | What | Used by |
|---|---|---|
| `avatar.js` | A player's look (fur, hat, glasses, outfit, face, extra) + name, saved in `localStorage`. Plain data, no Three.js. Brand palette lives here too. | hub, derrape, bululu |
| `fx.js` | WebAudio `sound` (horns, bonks, pickups, whooshes…, no files), `Puffs` (smoke/dust), `Debris` (parts that pop off), `makeBubble()` (cartoon speech bubble sprite). | derrape, bululu |
| `props.js` | Low-poly builders, no asset files: `makeMango({gold})`, `palm`, `rock`, `woodSign(lines)`, `flagPole`, `watchtower`, `venezuelaFlag`, plus the helpers they use (`M`, `mesh`, `box`, `tube`, `canvasMat`, `rng`). Props sit on y = 0 and face +Z; `userData.tick(t, dt)` wants animating. | derrape, bululu |
| `character.js` | `buildCharacter(avatar)`: the low-poly capybara pana in Three.js, with blinking eyes, a mouth that opens and dizzy stars. Call `update(dt, {open, dizzy, look})` every frame. Outfits are the torso's own color (no cloth layers), details sit flush on it. | hub, derrape, bululu |

Import with absolute paths so it works from any page:

```js
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/character.js';   // needs "three" in the page's import map
```

New avatar options go in `avatar.js` (`OPTIONS`, color lists) and get built in
`character.js`. `normalizeAvatar()` keeps old saves working when options change.
