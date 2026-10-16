# Derrape — cauchos (custom wheels)

Plan: `docs/plans/50_derrape-custom-wheels.md`. Implemented in
`games/derrape/public/wheel-definitions.js` + garage step `2 Cauchos`.

## Lineup (final profile values)

Multipliers compose with the car's `def.tune` (`top/accel/turn/grip`);
`offroad` is roughness resistance (-1..1, negative amplifies), `wet` is the
grip floor when `roadGripAt` reports wet (0..1).

| id | name | top | accel | turn | grip | offroad | wet | visual (r/w/style) |
|----|------|-----|-------|------|------|---------|-----|--------------------|
| calle | Cauchos de calle | 1.00 | 1.00 | 1.00 | 1.00 | 0.00 | 0.00 | null (car keeps its own wheels) |
| slick | Slicks de pista | 1.04 | 1.05 | 1.12 | 1.25 | -0.40 | 0.00 | 0.62 / 0.74 / spokes |
| barro | Cauchos de barro | 0.96 | 0.94 | 0.98 | 0.95 | 0.75 | 0.15 | 0.80 / 0.78 / steel |
| palo | Llantas de palo | 0.97 | 0.98 | 1.15 | 0.45 | 0.00 | 0.00 | 0.66 / 0.55 / steel (wood colours) |
| lluvia | Cauchos de lluvia | 1.00 | 1.00 | 1.02 | 1.02 | 0.10 | 0.85 | 0.66 / 0.62 / spokes |

## Where composition happens

- `makeRacer` (`game.js`) stores `c.wheel` (id) and `c.tune = composeTune(def.tune, wheel.profile)`.
  `composeTune` is pure and returns a new object; `def.tune` is never mutated.
- `stepCar` reads `c.tune` (was `c.def.tune`). Right where the surface is sampled:
  - `rough = roughnessAt(...) * (1 - t.offroadResist)` — one scale factor feeds the
    existing accel term, speed cap and drag (and, cosmetically, the dust colour).
  - `grip = Math.max(roadGripAt(...), t.wetFloor)` — rain cauchos floor the wet grip.
  - With `calle` (multipliers 1.0, offroad 0, wet 0) every term is bit-identical
    to the old behaviour; dry defaults elsewhere are untouched.
- Mass is not composed: `crash`/`collidePair` keep reading `def.tune.mass`.
- Rivals get thematic wheels via `AI_WHEELS` (machito/montanero/toro → barro,
  bala → slick, rumbera → palo, lancha/familiar → lluvia).

## Visual path

- Car builders in `cars.js` accept an optional `wheel` spec (`build(avatar, wheel)`);
  `rig()` already parametrizes hub height (`steer.position.y = wheel.r`) and
  `game.js` spins wheels by `car.radius`, so radius changes need no extra wiring.
- `calle.wheel = null` means "keep the car's own spec" — Estadio parked cars and
  Studio car previews call `build(avatar)` with no override and are unchanged.
- Garage cache key is `${index}:${wheelId}`, bounded at 16 entries.
- Persistence: `localStorage 'derrape:wheels'`, restored on boot before `showCar(0)`,
  fallback calle (`wheelById` falls back too).
- Studio: five explicit entries in `web/studio/catalog/vehicles.js` (`wheel-<id>`,
  Vehículos, factory `makeWheel`, `previewBounds` = w/2 × r box).

## Gotchas

- `offroad` resistance scales the *penalty*, not the terrain response: slick's
  negative resistance makes rough ground worse than stock, which is the intent
  ("useless in mud") — don't clamp the scaled roughness back to [0, 1].
- The wet floor applies `Math.max(grip, wetFloor)` unconditionally; since
  `roadGripAt` already returns 1 on dry roads and floors are < 1, dry handling
  is unaffected.
- Garage stats bars are display-only: they scale `def.stats` by the composed
  ratios (Manejo uses `sqrt(turnRatio * gripRatio)`), clamped to [0.04, 1].
- Wheel previews (`wheelCards` in `garage-cards.js`) render real `makeWheel`
  output on a short-lived renderer, same pattern as the car thumbnails; calle
  previews as the classic street wheel since it has no spec of its own.

## Proof

- `npm run check` passes.
- `games/derrape/tests/wheels.browser.js`: composeTune ordering/purity, garage
  flow (stats recompute, persistence across reload), drift sim (palo > calle
  `|vr|` on the stadium) and mud sim (barro > calle speed at roughness 1 in La
  Selva). Run with the server up: `node games/derrape/tests/wheels.browser.js`.
