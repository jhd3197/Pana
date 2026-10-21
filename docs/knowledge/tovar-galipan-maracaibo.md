# Colonia Tovar, Galipán and Maracaibo

Three more user-supplied standalone HTML scenes adapted the same way as the
Aragua circuits (`aragua-circuits.md`): a `<id>-layout.js` with the authored
`MAP` and the sampled road and terrain, a `<id>-world.js` that builds the
scene, and `<id>.js` that hands both to `coastalTrack`. They are standalone
races, not Grand Prix stages.

`coastalTrack(id, layout, createWorld, options)` now takes `scale`, `palette`,
`gripAt`, `previewBounds` and `items`; the Aragua circuits keep the defaults.

| Circuit | Scale | Lap | Min radius | Max grade | Light |
|---|---|---|---|---|---|
| Colonia Tovar (`tovar`) | 1.3 | 2.49 km | 22.3 m | 0.100 | misty day, fog 220–1400 m |
| Galipán (`galipan`) | 1.2 | 2.45 km | 22.0 m | 0.161 | night, daylight .12 |
| Maracaibo (`maracaibo`) | 1.0 | 2.29 km | 26.4 m | 0.168 | night, daylight .15 |

## What changed from the references

- Every procedural tree is a library model through `coastalVegetation`, which
  adds `pine` (pino caribe) and `fir` (mountain pine, also used for the
  references' cypresses). Conifers keep their tiered outline in the far zone.
  Small ferns, flowers and hydrangea clumps stay instanced as in Chuao.
- Renderer setup, sky domes, scene lights, camera views and the traffic that
  drove on the racing road are dropped. Parked props stay.
- Maracaibo's Reflector mirror is a dark glossy water shader. Its parapets are
  a `constrainMotion` on the bridge, ramps and boardwalk. Bridge towers, piers
  and stays follow the faired deck. The Catatumbo bolts and fireworks run on
  the race clock inside the world's `update`; they have no thunder sound.
- Colonia Tovar's fog banks roll on the race clock and its reflector posts
  glow as they pass.
- Galipán keeps the lit pueblito, Boca de Tigre, the sunflower terrace, the
  cable car and the Caracas light carpet. Light-pool decals stay off graded
  road so they never sit above the driving surface.

## Night

`palette.daylight` (0–1) feeds the shared sky's `update`, dimming its sun
glow and clouds. `sunDisc: false` hides the disc. The sky's `setPalette` now
resets `sunDirection` to the default when a palette omits it, so a moon
direction never carries over to the next map.

## Proof

`maps.browser.js` (with `PANA_MAP_TEST_TRACKS`) covers projection, radii,
grades, lane clearance, item rows and three AI laps for each.
`tovar-galipan-maracaibo.browser.js` connects two real clients, selects each
circuit, drives off the grid and checks the library trees and night palette.
Menu pictures are renders of the real scenes.
