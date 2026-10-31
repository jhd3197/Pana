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
- **The capis are panas**: `buildCharacter` from `avatar-model.js` at ×0.8
  (1.7 units tall: the 1.4 body disc plus the head). Our lead capi (team 0,
  slot 0) wears the player's saved look (`loadAvatar`, wardrobe included); the
  other five are `randomAvatar` seeded per capi, in their team's shirt colour, so
  the same panas show on every load. Every capi wears a team-colour bandana
  (one torus geometry and two materials shared by all six). The rival's paint
  tints the coat and clothes by `paint` %. The six are built once and reused for
  every match (a pana costs ~100 ms to build).
- **La Bazuca** is Pepazo's (`engine/models/props/paintball-kit.js`),
  `bakePaintKit` once per team colour (about 4 draws) and `.clone()`d into each
  capi. It is a child of the capi's root, not of the body, so it stays exactly in
  the side plane while the body turns 22° towards the camera (`TURN_IN`) to show
  the face. It pivots at `RULES.shoulder` (0.9 above the feet), scaled ×0.6 and
  slid along its axis so the warhead's tip is exactly `RULES.muzzle` (1.1) from
  the pivot: `muzzle()` in rules.js is the visible tip, and the browser suite
  checks it within 0.03. The in-flight shell is Pepazo's `createPaintRocket`
  (×2.2), turned along its velocity, with smoke and paint drops behind.
- **Poses** come from `public/poses.js` (pure, tested): `aiming` (only the capi
  on its turn raises the barrel, at its `aim`), `barrelPose` (else carried low,
  −0.3 rad and 0.28 below the shoulder), `bodyPose` (`idle walk rise fall cheer
  sulk splat sink`). The scene adds its own timers: a hit flinches (squash,
  wobble, mouth open, leaning back, a splash of the rival's paint), a shot
  recoils (`createRecoil`: the barrel slides back and climbs, the capi is pushed
  back, the camera kicks), idle breathes and flicks an ear now and then, a win
  hops with the bazuca overhead, a capi painted out topples onto its back with
  its paws up and dizzy stars, one in the river spins as it sinks. The arms are
  set after `avatar.update`: near paw on the rear grip, far paw on the front grip.
- **Charge cue**: a drop of the team's paint swells and glows at the barrel's tip
  while the shot charges; the shot flashes there (an additive plane, as in
  Pepazo) and bursts paint.
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
- `public/poses.js`: which pose each capi shows and where its barrel points (pure).
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
| Muzzle | 1.1 from the shoulder pivot, 0.9 above the feet | the shell never starts inside its own capi at any aim (tested) |
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
- The paws on the grips are set by hand-tuned angles, not inverse kinematics:
  at steep aims (above about 1 rad) the far paw drifts off the front grip.
- The warhead stays in the launcher after the shot (the batched model is one
  mesh per finish); it is not reloaded visibly.
- Aiming up, the barrel on the near shoulder crosses the face.
- Teammates of the lead capi do not use the player's look; there is no way to
  dress them yet.
- The six studio panas are the frame's main cost: about 40 draws each. The
  whole-map lobby view went from 135 to 408 draws and 136 k to 380 k triangles
  (CPU submit 2.7 → 6.2 ms, GPU 0.14 → 0.56 ms at Nítida, 2560 × 1600 on a
  desktop) when the capybara model gave way to them. The launchers are ~4 draws
  each. A lower-detail pana for far views would win most of that back.

## Proof

`npm test -- capis` (map, turns, clock, blast, damage, water, winner, bot) and
`npm test -- terrain-mask ballistic side-walker` for the engine pieces.
`npm run test:browser -- capis` checks that all six capis are the studio pana
with a team bandana and a batched La Bazuca, that only the capi on its turn
raises it and that its tip is the rules' muzzle; it starts from the lobby, walks with D, holds and
releases Space, waits for the crater and the paint, the machine's turn and
shot, then a win, the results card and the way back to the lobby.
