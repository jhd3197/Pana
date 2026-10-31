# Lancha

`/g/lancha/` is a downriver race in outboard-motor lanchas: the Caño del
Sipapo (with the Atajo del igapó), the Raudales de Atures, the open Orinoco
and the landing at Puerto Ayacucho. Up to 8 panas, one lancha each; river
drivers fill the start. It shares Curiara's river machinery and scenery, so
read `curiara.md` for the river itself.

## Files

- `public/course.js`: the Sipapo course (`sipapoDefinition()`, `RIVER`,
  `courseRiver(options)`), about twice Curiara's river in length (1827 m) and
  width (caño 20 m, raudales 44 m, Orinoco 58–65 m, landing 56 m: the finish arch spans at most 60 m), built by the shared
  `/engine/river/river.js`. `def.tepui`, `def.finish` and `def.fog` move the
  tepui, relabel the finish arch and push the fog to 120–1500 m.
- `public/rules.js` (pure): `Race`, the lancha physics, hazards, turbo, bots.
- `public/network.js`: `LanchaRoom` on the shared live room. Inputs are held
  keys (`throttle`, `steer`, `back`) plus a `turbo` press counter; a quiet
  guest lets go of the keys but keeps its counter.
- `public/game.js`: wiring, chase camera, HUD, motor drone (`sound.startEngine`).
- Shared: `/engine/river/{scene,landscape,water-fx,guide,minimap,hud}.js` and the
  model `/engine/models/vehicles/lancha.js` (`createLancha`, Studio
  `racing-lancha`). The water FX throw a rooster tail behind any boat with
  `throttle > .2`.

## Driving (tuned by simulation)

Thrust 8.4 m/s² × throttle, drag .56/s: top speed 15 m/s on still water,
~13.5 m/s after 4 s. Brake 9 m/s², reverse to −3.5 m/s. Yaw 1.25 rad/s at
full lock, scaled by `clamp(v/4, .2, 1)` and 20% less above 10 m/s. Turning
keeps the water velocity's direction (the hull slides), and grip 3.4/s bleeds
the slide away; carving costs a little speed, nothing more.

Holding the throttle is always fastest, by design: Curiara players mashed
keys thinking it was faster. Mashing W at 50% (`throttle` 0/1 at 6 Hz) runs
the course in 2:52 against 1:45 held. Four W presses within 1.2 s flash
"¡Sostenlo!". The automatic throttle option removes the key altogether.

Steering help (on by default): with hands off the tiller the hull turns
toward the river's heading (`err × 1.4`, capped .7 rad/s, only within 1.3
rad) and, within 6 m of a bank while heading into it, away at .9 rad/s. A
pana holding only W finishes in 1:52 with no bank knocks.

## Jumps, turbo and hazards

- On the water the hull follows the level (snapped while less than .08 m
  above it). Snapping matters: without it the gentle slope let the hull
  creep up 2 mm a tick until it "launched" every few metres, 96 jumps a race.
- A step falling away launches it; above 6 m/s the lip throws the bow up
  (`vy = v × .14`). The fast lane's 1.5 m drop gives ~.6 s of air. Landing
  crooked (`|sin| > .55`, impact > 3 m/s) drowns the motor for .9 s.
- Turbo meter 0–100: +5/s riding the chorro core (within 2.6 m), +.8/s
  otherwise, +30 per straight landing, +35 per tonina wake. Espacio spends 50
  for 1.6 s of +5 m/s².
- `stalled` seconds kill the throttle: rocks hit at over 5 m/s (.7 s, ×1.6
  threshold with soft collisions), caimanes (1.1 s, speed halved, 3 m/s
  jolt), crooked landings (.9 s). Buoys only nudge.

## Bots and balance

River drivers aim 16 + 1.1·v m down `river.guideAt` with a sine wobble of
`(1 − skill) × 6` m; skill .62–.95. Throttle cap by Lanchas del río: easy .8,
normal .93, hard 1 (× .94–1 by skill, × .65 when badly off line). Turbo on
straights only, never within 60 m of a raudal. 30% of skilled ones take the
igapó. Simulated 8-bot races (normal) finish 1:36–1:52, the pack within
~8 s; nobody gets stuck. A pana following the gold arrows (no turbo) runs
1:45 and beats easy rivals. Check balance with a script running
`new Race(); start(seed)` and `update(.05)` to the end, not in a tab.

## Room options

Acelerador (Sostener W / Automático), Guía en el agua, Lanchas del río
(Tranquilas / Normales / Bravas / Ninguna), and advanced: steering help,
current (×.6 / 1 / 1.45), river objects (rocks, trunks, caimanes, toninas),
raudales, soft collisions. Options lock during a race and survive host
migration (`Race.restore` rebuilds the river from them).
