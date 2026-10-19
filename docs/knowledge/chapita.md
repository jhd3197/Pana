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
  floors, the chain-link fence, bleachers, superbloque, tuyuyo and the apodo
  decal, registered in Studio (`web/studio/catalog/chapita.js`).
- `public/scene.js`, `public/hud.js`, `public/game.js`, `tests/browser.mjs`.

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

- Swing window 0,12 s either side, ×1,25 cuarto bate, ×0,85 tuyuyo, ×0,85 a
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
