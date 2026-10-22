# Colonia Tovar, Galipán, Maracaibo, Margarita, Sarisariñama and Gran Sabana

Six more user-supplied standalone HTML scenes adapted the same way as the
Aragua circuits (`aragua-circuits.md`): a `<id>-layout.js` with the authored
`MAP` and the sampled road and terrain, a `<id>-world.js` that builds the
scene, and `<id>.js` that hands both to `coastalTrack`. They are standalone
races, not Grand Prix stages. The recipe, checklist and pitfalls are the
`carreritas-map-port` skill (`.claude/skills/carreritas-map-port/SKILL.md`).

The shared helpers (`coastal-road`, `coastal-vegetation`, `forest-detail`,
`world-horizon`) and Galipán's layout and world live in
`engine/worlds/coastal/`, since Parapente flies over the same Galipán.

`coastalTrack(id, layout, createWorld, options)` now takes `scale`, `palette`,
`gripAt`, `previewBounds`, `items` and `def` (extra definition fields such as
`layered`); the Aragua circuits keep the defaults.

| Circuit | Scale | Lap | Min radius | Max grade | Light |
|---|---|---|---|---|---|
| Colonia Tovar (`tovar`) | 1.3 | 2.49 km | 22.3 m | 0.100 | misty day, fog 220–1400 m |
| Galipán (`galipan`) | 1.2 | 2.87 km | 18.6 m | 0.161 | night, daylight .12 |
| Maracaibo (`maracaibo`) | 1.0 | 2.29 km | 26.4 m | 0.168 | night, daylight .15 |
| Isla Margarita (`margarita`) | 1.4 | 2.85 km | 16.5 m | 0.117 | Caribbean day, sun halo |
| Sarisariñama (`sarisarinama`) | 1.0 | 2.85 km | 16.3 m | 0.204 | misty midday, layered |
| Gran Sabana (`sabana`) | 1.0 | 1.99 km | 21.1 m | 0.180 | afternoon, scenery storm |

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
- Galipán keeps the lit pueblito, Boca de Tigre, the sunflower house, the
  cable car and the Caracas light carpet. In Carreritas the lap leaves Boca de
  Tigre down el cañón and flies over Caracas as an avioneta (derrape.md,
  flight gates) instead of the old girasoles road. Light-pool decals stay off graded
  road so they never sit above the driving surface.

## Margarita, Sarisariñama and Gran Sabana

- `coastalVegetation` adds `moriche`, `mangrove` and `cactus` (cardón). A
  moriche keeps its own far model unsimplified: clustering its few long fronds
  leaves a bare pole.
- Margarita's castle hairpins get rounded tips; the reference's single-point
  tips measured a 6 m radius. Its sunset over Juan Griego is not kept, since a
  palette is per map.
- Sarisariñama's spiral passes 26 m above the cave gallery in plan view, so the
  lap is `layered`. `physicalGround` takes the lower of gallery floor and land
  under the vault and `roadSampleAt` picks the road by height. `crossfall` is
  off because it projects without height; the road is unbanked. A
  `constrainMotion` holds cars at the sheer drops and the gallery walls.
- Gran Sabana's storm is world-owned scenery on the race clock (clouds, a rain
  curtain, wet-looking ground). `def.rain` is not set, so grip and race light
  stay; only the jasper ford grips at .85. Tepuyes are pulled in to 0.55x
  distance and size so they stay inside the fog.

## Night

`palette.daylight` (0–1) feeds the shared sky's `update`, dimming its sun
glow and clouds. `sunDisc: false` hides the disc. The sky's `setPalette` now
resets `sunDirection` to the default when a palette omits it, so a moon
direction never carries over to the next map.

## Proof

`maps.browser.js` (with `PANA_MAP_TEST_TRACKS`) covers projection, radii,
grades, lane clearance, item rows and three AI laps for each.
`tovar-galipan-maracaibo.browser.js` and `margarita-sarisarinama-sabana.browser.js`
connect two real clients, selects each
circuit, drives off the grid and checks the library trees and night palette.
Menu pictures are renders of the real scenes.
