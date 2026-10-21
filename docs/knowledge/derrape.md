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
- Race extras, each a lazy module with a `race.*` stub in game.js:
  `public/breakables.js` (`race.props`: seeded clusters of the market kit's
  barrels and crates on the road edges, merged once per material; smashed
  from position by any car, local cars lose 10 % speed, back after 25 s),
  `public/name-tags.js` (`race.tags`: DOM pennants over racers, place on
  ink and name on the car colour; up to 30 m the full tag, 30-45 m only the
  place number, none beyond; no textures, hidden in split screen),
  `public/race-hud.js` (`race.hud`: the standings slide in for 3 s only
  when the player's place changes during `go`, three rows around the player
  past 5 racers; the speed gauge needle and its peak mark; key hints only
  in the first 6 s), `public/drift-audio.js`
  (`race.audio`: screech, level chimes, overheat ticks, burn, release thump,
  water rush and outboard; silenced on pause and clearRace). Hits — walls,
  cars and props — count in `c.hits`; the results tag El Chocón on the most
  hits (5 or more); the player's reach the stats pipe as `derrape.crashes`
  and `derrape.smashes`. Proof: `tests/race-extras.browser.js`.
- Dev ghost: `public/ghosts/<trackId>.json` ships a signed lap
  (`{ by, car, avatar, lap, poses }`); `pickGhost` races it while it beats
  your own best (ghost-recorder.js). To ship one: race the track with
  `?debug`, then run `exportGhost()` in the console and drop the file in
  `public/ghosts/`. The ghost also turns lancha on river runs.
- Race glow: `public/race-fx.js` (lazy; `race.glow` stub until it loads)
  draws the turbo exhaust (`drive.js`, every boosting step), impact sparks
  (wall hits in `drive.js`, `crash()` in game.js) and coin sparkles (pickup
  and spill) on one additive `particles.js` field.
- Drift presentation lives in its own modules: sparks and the charge smoke
  plume in `public/drift-fx.js` (glowing point sprites from
  `public/particles.js`: one draw per field, no polyhedra; sparks flicker red
  in the overheat warning), skid marks in `public/skid-marks.js` (one
  InstancedMesh ring buffer), purple-release slow-mo in `public/slow-mo.js`.
  All three load lazily with the first race (the feats.js pattern): the
  garage's first load is capped at 160 modules. The slow-mo scales only the
  local frame accumulator — never the fixed step, never an online race clock.
- Drift style scoring is pure math in `public/drift-score.js` (points rate,
  chain window, banking; unit-tested like rules.js) and its HUD combo meter in
  `public/drift-combo.js`. The HUD plates are a skewed `::before` behind
  each element, grouped under `:where()` in style.css: an `:is()` list there
  takes the specificity of `#board li b` and repaints every plate dark,
  including the yellow place plate. It is additive flavour: it never changes placement,
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
  sheet }]` (route fractions; or `fromAt: [x, z]` + `lead`: start where the
  route passes closest to a world point). Choroní floods its east-bank road;
  Chuao starts under its waterfall (`MAP.fall`) and runs to the end of the
  quebrada's wet segments (`sheet: false`: the track already draws that
  water). Margarita floods La Restinga's whole `r` segment (~480 m). Delta's
  route never runs along a caño, only crosses them on causeways, so its two
  gates are short fords (.51–.575, .745–.805) centred on the crossings at
  .54 and .77, where the sheet meets the caño on both sides. `public/transform-gates.js` (lazy, like feats.js) adds
  the water sheet when asked — nothing marks the ends, the water is the cue —
  and every frame
  decides from position alone whether each car — remote ones too — is a
  lancha. The swap uses the Lancha game's own model (`createLancha` from
  `engine/models/vehicles/lancha.js`, the car's paint, the racer's avatar at
  the tiller), built hidden 150 m before the gate and freed with the car's
  driver: the car squashes away inside a crown of droplets (a `particles.js`
  field) and the peñero pops up; moving boats throw a droplet rooster tail.
  Crossing a gate kicks a hop so the change happens mid-air, with a
  "¡Modo lancha!" shout, slow-mo and a splashdown. The road stays the driving
  surface, so AI, checkpoints and placements never notice. On the water a
  drift charges faster (wake turbo); skid marks and sparks give way to spray.
  The local player's splash counts `derrape.metamorfosis`. Proof:
  `tests/transform-gates.browser.js`; to look at it,
  `npm run shots -- derrape --track chuao --at gate-60`.
- Derrape signals readiness with `window.PANA_PREPARED` once the garage car is
  built, like every other game (tests/browser-kit.js `waitPrepared`).
