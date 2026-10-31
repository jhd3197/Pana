# Capis a Pintazos

Turn-based paint artillery between capybaras: two teams of three capis on a
Llanos riverbank, one player against the machine (`players: 1`, offline, no
room and no `network.js`). Each turn a capi walks, jumps, aims and fires La
Bazuca de pintura; the shell flies with the wind, digs a crater, paints the
ground and the capis near it and knocks them back. A capi with 100 % paint, or
one that falls into the river, is out. The last team standing wins.

## How it is built

The play is 2D (side-on), drawn as a 2.5D side view so it is still a 3D game
(AGENTS.md): a perspective camera looks at the plane the capis move in.

- **Ground** is `engine/play/terrain-mask.js`: a 800 × 400 grid (one cell is
  0.1 world units, the map is 80 × 40) of solid/air cells with a paint layer.
  `paintRGBA` writes it into a `THREE.DataTexture` (no canvas), repainted only
  for the columns a blast changed. Nine stacked alpha-tested planes from
  z = -2.6 to 0.55 carry the same texture, darker towards the back, so the
  earth reads as a slab with sides.
- **Capis, shells, the aim arrow and the dashed arc** move at z = 1, in front of
  the slab, so a capi in a crater stays visible.
- **Walking** is `engine/play/side-walker.js`; **flight** is
  `engine/play/ballistic.js`. The bot, the aim preview and the match share the
  same flight, so the preview is the real path.
- **The map** (`public/map-rules.js`) is built from `fbm2` with a fixed seed
  (2026): banks dropping into the river at both ends, a médano in the middle
  with a small cave under it, two caños as dips. Same ground on every load.
- **The world behind** (`public/backdrop.js`): sky gradient, river sheet,
  savanna, two ridges of hills (perspective gives the parallax), moriche palms
  and reeds from the model library, and the player's own pana on a dock by the
  left bank. It bounces on a good shot, wobbles when one of ours is hit and
  goes dizzy on a loss.

## Files

- `public/rules.js`: the match (pure): teams, turn order, timers, wind,
  firing, blasts, damage, knockback, water, the winner.
- `public/map-rules.js`: the Llanos riverbank and the spawn points.
- `public/bot.js`: the machine's capis (pure, tested).
- `public/options.js`: turn time and the machine's level, through the shared
  room panel even offline.
- `public/scene.js`, `public/backdrop.js`: the 3D view.
- `public/hud.js`: turn and clock, wind, both teams' paint bars, name tags,
  results.
- `public/game.js`: wiring (keys, mouse, touch, the shot charge, sounds).
- `tests/rules.test.js`, `tests/capis.browser.js`.

## Rules and tuning (`RULES` in `rules.js`)

| Value | Now | Notes |
|---|---|---|
| Turn time | 35 s (30, 35, 45) | lobby choice |
| Retreat after the shot lands | 3 s | the shooter may still walk and jump |
| Settle | up to 5 s | waits for sliding and flying capis |
| Muzzle speed at full charge | 30 units/s | `shotPower` from `shot-charge.js` |
| Gravity / wind force | 18 / 7 units/s² | `FLIGHT` in `ballistic.js`; wind is −1..1, drawn per turn from the match seed, shown ×10 |
| Crater radius | 3.5 | paint reaches 5.2 |
| Paint on a direct hit | 50 % | falls to 25 % at the edge of reach (crater + body radius) |
| Knockback | 13 units/s | 30 % at the edge, aimed away from the blast and slightly up |
| Capi body | radius 0.7 | walks 2.4 units/s, jumps 7.2 up and 2.8 forward |
| Max climb (bare ground) | 52° | steeper is a wall |
| Painted ground | slides above 12° | paint ≥ 0.25 under the feet; uphill on paint the feet only paddle (25 % speed) |
| Water line | y = 4.2 | feet below it: out |

Turns alternate teams; inside a team they rotate to the next capi still in.
Firing is refused once the clock reaches zero, so neither a player nor the bot
can shoot late.

## The machine (`bot.js`)

On its turn it picks the nearest rival, walks towards it for up to 2 s when it
is more than 34 units away, then searches angles −0.2..1.4 rad and powers
0.2..1 (about 1 000 simulated flights, ~12 ms) for the shot that lands closest,
penalising landings in the water or next to its own capis. The difficulty's
`aimError` (from `engine/play/difficulty.js`) is scaled ×3 for the angle and
×1.6 for the power. It turns the barrel at a player's speed, waits 0.9–2.2 s,
and fires; with under 2 s left it fires at once. With no shot that lands
within 25 units it fires a default lob, so it never stalls.

## Controls

| Keyboard and mouse | Touch | Does |
|---|---|---|
| A D / ← → | left and right buttons | walk |
| W S / ↑ ↓, or move the mouse | aim buttons | aim (the mouse also turns the capi) |
| hold Space or the left button, release | hold ¡Pinta! | charge and fire |
| Enter (or J) | jump button | jump |
| Z | Mapa | whole-map view |

Space is the fire key, so jump is Enter. Escape is the shared pause menu.

## Sound

All from `engine/sfx.js`, no music: `shot('bazuca')`, `boom`, `splat`,
`squeak` (a capi is hit), `boing` (jump), `land('grass')`, `splash` (water),
`chime` (turn starts), `tick` (last 5 s), `sting(win)`.

## Known gaps (milestone one)

- One map and one weapon. No team or player-vs-player online yet.
- No launcher illustration: the hub tile is the scaffold's live card
  (the player's pana) and the lobby has no background picture.
- The slab's sides show the planes as steps when seen at an angle.
- Paint is per cell; the stain shows mostly on crater rims, not as drips.
- A capi pushed against a crater wall can lose most of its knockback (the walker
  bounces off at 30 %), so it seldom flies far from inside a crater.

## Proof

`npm test -- capis` (map, turns, clock, blast, damage, water, winner, bot) and
`npm test -- terrain-mask ballistic side-walker` for the engine pieces.
`npm run test:browser -- capis` starts from the lobby, walks with D, holds and
releases Space, waits for the crater and the paint, the machine's turn and
shot, then a win, the results card and the way back to the lobby.
