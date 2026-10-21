# ¿Quién empieza?

The mini game every turn-based game plays before its first turn: every pana
shakes a cacho, slams it on the table, all cachos lift at once and the highest
die starts. 10 to 20 seconds when nobody ties.

| Piece | File |
|---|---|
| Rule (pure, Node-tested) | `Pana/engine/play/quien-empieza-rules.js`, tests in `Pana/engine/tests/quien-empieza.test.js` |
| Stage (Three.js + overlay) | `Pana/engine/play/quien-empieza.js`, styles in `quien-empieza.css` (the module links it) |
| Models | `Pana/engine/models/props/cacho.js`: `createCacho`, `createCachoDie`, `createMoneda` (Studio: Objetos → table-games) |
| Tie grouping | `Pana/engine/play/roll-off.js` (`rollOffGroups`) |

## How a game plugs it in

The state is a plain object inside the game's snapshot, so a reload or a new
host continues it. The host picks every value; guests only send shake and slam.

```js
// rules.js
this.starter = createStarter({ seats, need: 'first', seed, option: this.options.starter, last: this.lastPlace });
if (starterDone(this.starter)) this.begin();          // 'azar' and 'anfitrion' finish at once
// accept(): before the revision check
if (data.action === 'starter') ok = starterInput(this.starter, seat, data.cacho, data.power);
// host step(dt)
stepStarter(this.starter, dt, { bots: seatsWithoutAPana });   // true → revision++ and publish
// begin(): starterResult(this.starter).order[0] starts
```

```js
// scene.js: a spot per seat on the game's own table; out points at the pana
const starter = createStarterStage({ root, camera, canvas, scale,
  spot: seat => ({ position: [x, tableTop, z], out: [dx, dz] }), onInput });
starter.update(state.phase === 'starter' ? state.starter : null, { ownSeat, names });
starter.frame(dt);
```

Ludo is the reference (`Pana/games/ludo/public/`). Also wired: Bululú
(`starter.js`, whole order), Caída (first dealer), Póquer (first dealer
button, server room), Billar (first break), Dominó (`cachos`, next to its
Salida rule) and Bolas criollas (coin, option stored as `opener`). A game
whose state already has a `starter` field stores the cachos elsewhere. The room option is
`STARTER_FIELD` (Cacho, Al azar, El anfitrión, Revancha) added to the game's
own option list; a game whose old rule stays the default (Dominó) puts its own
choice first.

- `need: 'first'` only rethrows a tie at the top; `'order'` also rethrows lower
  ties so the whole turn order comes out of the cachos (Bululú).
- `flavour: 'moneda'` with exactly two seats (two teams): one coin flip, no
  inputs (Bolas criollas).
- `joinStarter(s, seat)`: a pana who sits down mid-roll goes last.
- The stage sets `body.pana-starter` while it shows: games hide their action
  bar with it. `--pk-qe-top` / `--pk-qe-top-phone` on body move the heading
  below the game's own top HUD.

## Timing

Bots slam between 1.2 and 4.4 s, a human is slammed for them at 8 s
(`SHAKE_LIMIT`), the lift takes 2.6 s (`LIFT`, the cups come up at 1.05 s
after a drum roll), the order strip stays 3 s (`ORDER_HOLD`). After six tie
rounds the seed settles it.

`stepStarter` returns true only when something visible changed (a bot shaking
or slamming, a phase change), so the host does not publish on every tick.
Guests run their own clock from the phase change for the animation.

## Notes for agents

- Never send a field named `kind` in a `TableRoom` action: the room's message
  is `{ kind: 'action', action, ...values }`, so `kind` overwrites it and the
  host silently drops the guest's action (the host's own actions still work,
  which hides the bug). The starter uses `cacho: 'shake' | 'slam'`.
- Starter actions skip the game's revision check: everyone shakes at once, and
  a bot slamming between a pana's shake and slam bumps the revision.
- Give the starter its own seed (derived, not drawn) when the game's dice
  stream is seeded in tests, so seeded matches stay the same.
- Older browser suites that expect seat 0 to start pick El anfitrión.
- The die is small at table distance; the stage shows the number in a chip
  over each revealed die. Keep it.
