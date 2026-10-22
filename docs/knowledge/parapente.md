# Parapente

`/g/parapente/` is a paragliding race over Galipán, the same map as Derrape's
Galipán circuit (`tovar-galipan-maracaibo.md`). Up to 8 panas launch from a
deck on the crest of El Ávila, fly five turnpoint beacons (La Cresta, El
Pueblito, El Mirador, El Bosque, Los Girasoles) and land on the diana on
Boca de Tigre's plaza. Pilots from the cerro fill the deck.

## Files

- `public/course.js` (pure): route in Galipán layout units scaled by 1.2 like
  Derrape, `buildCourse(groundAt, { thermals })`, `airAt` (thermal lift),
  `remaining`, `outside`. Beacons are cylinders (r 30 m, any height), rings
  sit on an 11:1 glide line from the deck (never closer than 22 m to the
  ground), thermals are Gaussian columns (r 30 m, 6 m/s core, fading over the
  last 40 m below `top` 380 m, a little sink around the edge).
- `public/galipan.js` (browser): one `createLayout()` per page shared by the
  course (host and each guest's prediction) and `galipanWorld()`. The course
  never travels in a snapshot; every client rebuilds it from the map and the
  `thermals` option.
- `public/rules.js` (pure): `fly(course, pilot, dt, input, time)`, `Race`,
  bots, `standings`.
- `public/network.js`: `ParapenteRoom` on the live room, predicting your own
  wing with `fly`.
- `public/scene.js`: golden-afternoon sky, the Galipán world, beacons, rings,
  thermal dust with cumulus caps and circling zamuros, the diana and windsock,
  the launch deck. `public/game.js`: wiring, HUD, vario beeps.
- Shared: `engine/models/vehicles/parapente.js` (`createParapente`, Studio
  `racing-parapente`) and `engine/worlds/coastal/` (Galipán).

## Flying (tuned by simulation)

Airspeed trim 16 m/s, bar 22, brakes 11; sink trim 1.45 m/s (about 11:1),
+1.25 on the bar (about 8:1), −.3 on brakes, +3.4 with big ears, all times
`1 + 1.7·steer²` in a turn. Yaw .78 rad/s at full steer (+.5 on brakes, ×.7
on the bar, ×.6 with ears). A ring gives 3 s of +7 m/s at .3 of the sink.

- A touchdown before the last beacon, or flying more than 220 m outside the
  course's box (out over Caracas), is a forced landing: 2.5 s on the ground,
  then a relaunch over the last beacon passed at its glide-line height + 25 m
  (at least 55 m above the ground).
- After the last beacon, touching down within 150 m of the diana finishes;
  off the 24 m circle costs .2 s per metre (at most 25 s). Farther is a
  relaunch.
- The race ends when every pilot has landed, 5 s after the last pana lands,
  or at 6 minutes.

## Bots and balance

Bots fly at the next target, budgeting height for the leg (clearing the
highest ground on the way) and for the rest of the course home. Below it they
circle the nearest reachable thermal on the brakes until 30 m over budget.
They take the bar only when the leg and the rest of the course still clear at
8:1, plus a margin of `10 + (1 − skill) · 70` m: that margin is what
separates easy from hard. They never detour for rings. Ground rising ahead
turns them to the clear heading nearest the target, never simply the lowest
side (that is the cliff down to Caracas).

Simulated on the real map (normal thermals): hard rivals land around 1:29,
normal 1:30–1:35, easy 1:32–1:40; a pilot flying only trim at the targets
lands around 1:37. Weak thermals with hard rivals leaves a forced landing
now and then. Check balance with a Node script that dumps `groundH` from the
browser into a height grid and runs `new Race(course)`, `start()` and
`update(.05)`, not in a tab.

## Traps

- Keep the launch inside Galipán's detailed terrain (layout ±440). At the
  map's edge the coarse horizon mesh rises as big flat facets that fill the
  start camera.
- The start camera sits behind the deck looking south over the course; north
  of the deck the map ends.
- Only the next beacon draws its column, and not while the camera is inside it.
