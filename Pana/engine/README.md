# engine/

Shared game code, served to browsers at `/engine/*`. Something moves here once a
**second** page needs it — duplicate first, extract on the second use.

| File | What | Used by |
|---|---|---|
| `avatar.js` | A player's look (fur, hat, glasses, outfit, face, extra) + name, saved in `localStorage`. Plain data, no Three.js. Brand palette lives here too. | hub, derrape |
| `character.js` | `buildCharacter(avatar)`: the low-poly capybara pana in Three.js, with blinking eyes, a mouth that opens and dizzy stars. Call `update(dt, {open, dizzy, look})` every frame. Outfits are the torso's own color (no cloth layers), details sit flush on it. | hub, derrape |

Import with absolute paths so it works from any page:

```js
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/character.js';   // needs "three" in the page's import map
```

New avatar options go in `avatar.js` (`OPTIONS`, color lists) and get built in
`character.js`. `normalizeAvatar()` keeps old saves working when options change.
