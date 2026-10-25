# Chapita

Barrio baseball with a bottle cap (chapita) and a palo de escoba, for 2–8
panas in two teams of four; bots fill every empty seat. A turn-based game on
the shared table room (`engine/table-room.js`) with real-time pitches: the
host runs every timer in `advance(dt)`.

## Files

- `public/field.js`: pure geometry shared by rules and scene: the pitch path
  (`pitchPoint`), the batted cap (`hitPoint`) and `traceHit`, which walks a
  flight and reports the first fielder in reach and what ends the play.
- `public/rules.js`: `ChapitaGame` (innings, count, virtual bases, house
  rules, perks, derby, titles, bots), tested by `tests/rules.test.js`.
- `public/network.js`: the room; `step(dt)` slices the host tick into 50 ms.
- `public/street.js`: the two fields dressed from the model library.
- `public/studio-set.js`: the chapita, the palos, the señora's window, the
  floors, the chain-link fence, bleachers, superbloque, tuyuyo, the apodo
  decal and the jugadas' props (dog, drain, paper, tumbleweed, broken palo,
  ball and bat), registered in Studio (`web/studio/catalog/chapita.js`).
- `public/jugadas.js` (pure), `public/jugada-motion.js`, `public/jugada-fx.js`,
  `public/sounds.js`, `public/studio-preview.js`: the jugadas locas below.
- `public/scene.js`, `public/hud.js`, `public/game.js`, `tests/browser.mjs`,
  `tests/jugadas.test.js`, `tests/jugadas.browser.js`.

## Batting aids and the diamond

- The local batter sees two rings at the plate (scene.js `drawAim`): the
  aim at medium height, sliding to the real `pitch.target` between 60 % and
  80 % of the flight, and an approach ring scaled `1 + 3·(T − t)/T` that
  meets it at the arrival. Green inside `window()`, red when late or when the
  pitch leaves the zone. `world.aim` exposes it for the browser suite.
- The palo height follows `pitch.arrives` unless the batter pressed W/S for
  that pitch (`manualFor` in game.js), so timing is the skill. Three ticks
  land at T − 0,5, T − 0,25 and T. After a swing, `swingFeedback` shows
  ¡Perfecto! (within 35 % of the window), ¡Bien!, ¡Temprano! or ¡Tarde!
- Headless WebGL in the suites renders about one frame a second, so timing
  checks drive `world.frame(0)` with a shifted `clocks.pitch` instead of
  waiting on real frames.
- `BASES` form a diamond (1st and 3rd at x ±2,85, z −6; 2nd on the acera at
  z −12, y 0,15). The asphalt top is y 0,03 and sidewalks 0,15: chalk drawn
  lower is hidden. Runners queue every bag on the way (`slot.route`) and run
  home through the rest when they score, instead of cutting across.
- Swing and throw sounds are CC0 bamboo swishes (`public/audio/`, see
  `SOURCE.md`); the synth covers them until they decode.

## Jugadas locas

The Studio workbench's 21 plays run in matches, each tied to a real outcome:
strikeout swinging → `miss` or `helicopter`; looking → `pitch` or `argue`;
a swinging strike → sometimes `slip`; a bent-cap ball → sometimes
`boomerang`; contact → `hit` juice (or `broken` on weak contact, q < 0,25);
a fielder's catch → `catch`, a fielder's chapazo or a hit batter → `bean`;
foul → `grandpa`, a ground foul or a short roller → `drain`; sencillo →
`dog`; wall or azotea → `roof`; post → `pinball`; jonrón → `home`; window →
`window`; inning change → sometimes `dinner`; the carro house rule → `car`;
the end screen → `dance` for the winners.

- The host picks in `rules.js` through `jugadas.js`, hashing the seed and the
  pitch count (`roll`), never `draw()`: adding or tuning a jugada does not
  change how any game plays out. The id travels in `result.jugada` (numbered
  by `result.n`), `hit.jugada` (contact) and `hit.after` (catch/chapazo), and
  `result.until` stretches to `JUGADAS[id].seconds` so the next pitch never
  cuts one short.
- Everything a jugada does is cosmetic. `jugada-motion.js` poses panas after
  their own `update()`, owns the cap's position while it plays, and `stop()`
  resets body, head, eyes, expression, palo and props. Channels that
  `update()` never resets (body `rotation.y`, `position.x/z`) must be set
  absolutely each frame, never with `+=`. The scene syncs every pana's walk
  target to where a jugada left them, so they walk back instead of popping.
- The scene runs two channels with separate effect pools: contact (`swing`,
  `hit`, `broken`) and main (everything else), so a catch can follow the
  contact flash. Jugada camera shots are clamped to the street (|x| < 3,8 on
  the near street), or they land inside a house.
- A pitch high (1,05–2,2 m) and more than 0,9 m inside the batter's side is a
  chapazo to the batter: tuyuyo, `chapazos` stat, a walk to first. About one
  a game between bots.
- Pitch flavours (`pitch.flavor`): `fuego` with two strikes, `loca` for a bent
  cap, `globito` for a float; drawn by a third effect pool in the scene.
- The `equipo` room option (Chapita y escoba / Pelota y bate) only swaps the
  models (`createPelota`, `createBate`); the physics stay the chapita's.
- All-bot games show around 35 jugadas each; the rarest are `window` and
  `pinball` (physics decides those). Studio's `chapita-jugada-<id>` pages
  sample the same motion code with a short lead-in; turn on Animación.

## Field

Coordinates in `field.js` are `x` (screen right from behind the plate), `y`
and `d` (out from the plate); the scene draws `d` on −Z. Plate at 0, release
at d = 10,5. The near street ends at the acera (d = 12,5): a landing short of
it is "¡Ni a la acera llegó!", an out. The car (x −6,6…−2,4, d 22…23,9, 1,55 m
high) is a doble, the lamp post (x 3,8, d 24,6) a triple, the house fronts at
d = 26 end the play: over the 4,1 m roofline is a jonrón, the window
(x 0,7…2,3, y 1,3…2,6) a foul plus the señora, the wall below a sencillo.
Past |x| 4,6 before the acera or |x| 8,6 after it is foul. Both maps put the
scoring objects at these numbers; only the dressing differs.

## Timing and netcode

- A pitch is secret until thrown: the pitcher's choice lives only on their
  screen (`pick` in game.js) and travels in the `throw` action.
- Every screen starts its pitch clock when it first sees the pitch in
  `flight`, and its hit clock when it first sees `hit`. The batter sends
  `t` = seconds since *their* release; the host judges `t − pitch.time`. So
  latency never moves the timing window; it only delays the result.
- `throw`, `swing` and `catch` skip the revision check (they name the pitch
  or hit id instead), so a pana joining mid-pitch never eats a swing.
- The host waits `pitch.time + 1,1 s` for a human swing (a take), and a
  human catch until `chance.t + 1 s`.

## Tuning

- Human swing window 0,18 s either side (bots keep 0,12 s), ×1,25 cuarto bate, ×0,85 tuyuyo, ×0,85 a
  curve breaking in on the batter's hands (×1,12 away), narrower off-centre.
- Exit speed `8 + 11,5·q^0,8` m/s (q = timing quality), +3,5 Willy Mays,
  −0,8 bent cap; 10 % pop-ups. All-bot 3-inning games run about 85 pitches
  and 7 minutes with roughly one jonrón per ten contacts.
- Flat cap: wobble 0,035 m, control 0,025 m; bent: 0,12 and 0,085.
- Bots pitch by style (vieja escuela: drops; nueva: curves and bent caps)
  and mostly avoid a float aimed high or a drop aimed low (they leave the
  zone and are balls). Four balls walk; there is no other way on base.

## Notes for agents

- `createTableWorld(canvas, { arena: false })` skips the plaza; Chapita
  builds its own street. Keep the stage, not a second renderer setup.
- The batter's palo hangs off `character.armR` at (0, −0,7, 0,05) scaled 1,35;
  `rotation.x = π/2 − 0,2` holds it up over the shoulder with the arm at −1,9.
- Library models dispose themselves and leave their parent: collect the
  disposers before calling them (`street.js`), never call inside traverse.

- A pending human catch must block `finishPlay()` until `chance.t + 1`,
  even when the cap lands earlier. Otherwise a delayed valid catch loses to
  scoring at `end.t + .45`. Test with loaded bases and a late network response.
- Runner stations are shared `BASES` coordinates in field.js, shown as numbered
  meshes on both maps. Panas stand beside the marker, which turns yellow when
  occupied. These remain virtual bases, not a running/stealing simulation.
- The canvas CSS dimensions must override the renderer's initial inline size;
  otherwise a viewport resize crops the previous frame instead of reframing it.
  The browser suite projects home plate on both maps at desktop and portrait
  sizes and verifies that the pitching panel does not cover it.
