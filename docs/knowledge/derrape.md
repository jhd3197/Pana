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
- Drift presentation lives in its own modules: sparks and the charge smoke
  plume in `public/drift-fx.js`, skid marks in `public/skid-marks.js` (one
  InstancedMesh ring buffer), purple-release slow-mo in `public/slow-mo.js`.
  All three load lazily with the first race (the feats.js pattern): the
  garage's first load is capped at 160 modules. The slow-mo scales only the
  local frame accumulator — never the fixed step, never an online race clock.
- Drift style scoring is pure math in `public/drift-score.js` (points rate,
  chain window, banking; unit-tested like rules.js) and its HUD combo meter in
  `public/drift-combo.js`. It is additive flavour: it never changes placement,
  and a crash banks points instead of taking them. Only the local player's
  banked points reach `statCount('derrape.drift-points', …)`.
- Personal-best ghost: `public/ghost-recorder.js` samples the local car's
  `packPose` stream at POSE_HZ and keeps only the fastest lap per track in
  localStorage (`derrape:ghost:<trackId>`, `{ lap, poses: [[tMs, …15]] }`,
  writes wrapped in try/catch). `public/ghost-car.js` replays it on a
  translucent replica (`setGhost`, opacity 0.42) that never joins `race.cars`,
  so collisions, items, hazards and placements never see it; drift flags are
  stripped on replay so it sheds no sparks or skid marks. Records in every
  race mode except battle; `?noghost` turns the feature off.
- River stretches: a track definition can list `transformGates: [{ from, to,
  sheet }]` (route fractions). Choroní floods its east-bank road; Chuao derives
  its gate from the quebrada's wet segments (`sheet: false`: the track already
  draws that water). `public/transform-gates.js` (lazy, like feats.js) adds a
  tricolour arch at each end (and the water sheet when asked), and every frame
  decides from position alone whether each car — remote ones too — is a
  lancha. The swap uses the Lancha game's own model (`createLancha` from
  `engine/models/vehicles/lancha.js`, the car's paint, the racer's avatar at
  the tiller), built hidden 150 m before the gate and freed with the car's
  driver: the car squashes away inside the spray and the peñero pops up.
  Crossing a gate kicks a hop so the change happens mid-air, with a
  "¡Modo lancha!" shout, slow-mo and a splashdown. The road stays the driving
  surface, so AI, checkpoints and placements never notice. On the water a
  drift charges faster (wake turbo); skid marks and sparks give way to spray.
  The local player's splash counts `derrape.metamorfosis`. Proof:
  `tests/transform-gates.browser.js`; to look at it,
  `npm run shots -- derrape --track chuao --at gate-60`.
- Derrape signals readiness with `window.PANA_PREPARED` once the garage car is
  built, like every other game (tests/browser-kit.js `waitPrepared`).
