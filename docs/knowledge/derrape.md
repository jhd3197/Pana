# Derrape

Toy-car racing on the Venezuelan circuits: quick races, three four-race Grand
Prix cups, battle mode, local split screen and online rooms. Derrape is the
largest game and keeps its own four-step garage menu instead of the shared
lobby (`derrape-menu.md`), and its own Colyseus room (`derrape-online.md`).

## Which note for which part

| Part | Note |
|---|---|
| Garage and menus | `derrape-menu.md`, `derrape-wheels.md` |
| Driving feel and tuning | `derrape-driving.md` |
| Items (mango, jugo…) | `derrape-items.md` |
| Tracks and scenery | `derrape-tracks.md`, `derrape-scenery.md`, `venezuela-circuits.md`, `puerto-circuit.md`, `circuit-surroundings.md`, `water-worlds.md` |
| Grand Prix cups | `derrape-grand-prix.md` |
| Online | `derrape-online.md` |
| Performance budgets | `derrape-performance.md` |

## Notes for agents

- `public/game.js` is far over the 600-line wiring limit (conventions test
  allowance). New work goes into its own module (`garage-*.js`, `race-*.js`,
  `*-rules.js`), never into game.js; moving a section out is always welcome.
  Drift milestone toasts live in `public/feats.js`, on `engine/feats.js`.
- Derrape signals readiness with `window.PANA_PREPARED` once the garage car is
  built, like every other game (tests/browser-kit.js `waitPrepared`).
