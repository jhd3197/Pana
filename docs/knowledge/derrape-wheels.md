# Derrape — cauchos (custom wheels)

## Friends playtest balance

The revised base top speeds span 35–39 m/s, instead of 33–40. La Bala still
has the best straight speed, but slower acceleration and 0.9 drift charge/turbo
duration. La Rumbera has 1.3 charge and 1.35 duration; wooden wheels multiply
these by 1.25 and 1.18. The fixed-input drift regression compares earned boosts
through a real moving bend; it no longer pins cars in place. See
`derrape-driving.md` for the default drift assistance. This proves the skill
payout, not equal human lap times.

Chamo favors acceleration and drift; Lancha and Toro favor slipstream; Machito
reduces rough-ground penalties; Familiar retains a wet grip floor; Montañero
gets a 1.65 landing-trick payout. These are tune fields, so the existing driving
mechanics and the same loadout apply online and locally. Garage blurbs explain
the trigger. No additional upgrade slot or paid performance was introduced.

`composeTune` multiplies drift traits, combines roughness resistance as
`1 - (1-carResistance)*(1-wheelResistance)`, and keeps the larger wet floor.
Rain and road water now also reduce top speed by `wet * wetDrag`; wheel drag
coefficients are calle .25, slick .65, barro .18, palo .30 and lluvia .04.
The wet floor reduces shallow-water drag by up to 65%. Slicks therefore cannot
compensate for rain simply through their dry grip multiplier. Native muddy
off-road remains an authored Selva mechanic; no invisible mud was added to
other roads. Current cups and their weather remain unchanged.

Proof: `feedback.test.js`, `feedback.browser.js`, `wheels.browser.js` and the
seeded full-cup browser suite. Existing historical tuning below is superseded
by the current profile table.

Plan: `docs/plans/50_derrape-custom-wheels.md`. Implemented in
`games/derrape/public/wheel-definitions.js` + garage step `2 Cauchos`.

## Lineup (final profile values)

Multipliers compose with the car's `def.tune` (`top/accel/turn/grip`);
`offroad` is roughness resistance (-1..1, negative amplifies), `wet` is the
grip floor when `roadGripAt` reports wet (0..1).

| id | name | top | accel | turn | grip | offroad | wet | visual (r/w/style) |
|----|------|-----|-------|------|------|---------|-----|--------------------|
| calle | Cauchos de calle | 1.00 | 1.10 | 1.00 | 1.00 | 0.00 | 0.00 | null (car keeps its own wheels) |
| slick | Slicks de pista | 1.025 | 0.94 | 1.03 | 1.18 | -0.40 | 0.00 | 0.62 / 0.74 / spokes |
| barro | Cauchos de barro | 0.985 | 1.02 | 1.00 | 0.98 | 0.85 | 0.60 | 0.80 / 0.78 / steel |
| palo | Llantas de palo | 0.99 | 1.00 | 1.08 | 0.60 | 0.00 | 0.00 | 0.66 / 0.55 / steel (wood colours) |
| lluvia | Cauchos de lluvia | 0.995 | 1.03 | 1.03 | 1.05 | 0.20 | 0.90 | 0.66 / 0.62 / spokes |

## Where composition happens

- `makeRacer` (`game.js`) stores `c.wheel` (id) and `c.tune = composeTune(def.tune, wheel.profile)`.
  `composeTune` is pure and returns a new object; `def.tune` is never mutated.
- `stepCar` reads `c.tune` (was `c.def.tune`). Right where the surface is sampled:
  - `rough = roughnessAt(...) * (1 - t.offroadResist)` — one scale factor feeds the
    existing accel term, speed cap and drag (and, cosmetically, the dust colour).
  - `grip = Math.max(roadGripAt(...), t.wetFloor)` — rain cauchos floor the wet grip.
- Street tires now favor acceleration, with a 1.10 multiplier. Slicks trade
  acceleration and drift charge for dry top speed and grip.
- Mass is not composed: `crash`/`collidePair` keep reading `def.tune.mass`.
- Rivals get thematic wheels via `AI_WHEELS` (machito/montanero/toro → barro,
  bala → slick, rumbera → palo, lancha/familiar → lluvia).

## Visual path

- Car builders in `/engine/models/vehicles/cars.js` accept an optional `wheel` spec (`build(avatar, wheel)`);
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
- Garage bars use the actual composed tune: top / 42, acceleration / 30,
  sqrt(turn * grip) / 4.7 and mass / 1.5, clamped to [0.04, 1].
- Wheel previews (`wheelCards` in `garage-cards.js`) render real `makeWheel`
  output on a short-lived renderer, same pattern as the car thumbnails; calle
  previews as the classic street wheel since it has no spec of its own.

## Proof

- `npm run check` passes.
- `games/derrape/tests/wheels.browser.js`: composeTune ordering/purity, garage
  flow (stats recompute, persistence across reload), drift sim (palo > calle
  `|vr|` on the stadium) and mud sim (barro > calle speed at roughness 1 in La
  Selva). Run with the server up: `node games/derrape/tests/wheels.browser.js`.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Swappable wheels (cauchos) live in `wheel-definitions.js`: five trade-off
profiles composed per racer (`composeTune` at `makeRacer`, never mutating
`def.tune`). `stepCar` reads the composed tune, scaling off-road roughness by
`offroadResist` and flooring wet grip at `wetFloor`. Car builders take an
optional wheel override; without one each car keeps its own wheels. The
garage has a `2 Cauchos` step persisted in `localStorage 'derrape:wheels'`
(fallback calle), and rivals wear thematic wheels (`AI_WHEELS`). The five
wheels are registered in Studio under Vehículos. See
`docs/knowledge/derrape-wheels.md`.
