# Curiara

`/g/curiara/` is a downriver canoe race through the Venezuelan Amazonas: the
Caño de la Selva (with the Atajo del igapó), the Raudal del Autana under the
tepui and the Río Negro to a churuata landing. Up to 8 panas; bots fill the
river. Two formats: **Todos contra todos** (8 canoes, one pana each) and
**Parejas** (4 canoes; the proa paddles, the popa steers).

## Files

- `/engine/paddle.js` (pure, shared with Bululú's river minigames): the stroke
  model. `stroke(state, side, t)` grades the gap to the previous stroke;
  `step(state, dt)` delivers each stroke's impulse over `PADDLE.pull` s.
  State is a plain object so a race snapshot carries it across migration.
- `public/river.js` (pure): `buildRiver(def)` turns a course definition into
  splines with distance `s` and signed `offset` (positive = right bank looking
  downstream), `locate()` (main channel or igapó branch), `levelAt()` (raudal
  steps per lane), `currentAt()` (chorro, eddies, whirlpool), `groundAt()`,
  rocks, snags, logs, toninas and gates. `AMAZONAS` is the race; `GREYBOX` is
  the step-0 straight channel kept for tuning (`new Race(GREYBOX)`).
- `public/rules.js` (pure): `Race`, boat physics, hazards, bots, snapshots.
- `public/scene.js` terrain and per-tramo water; `public/landscape.js` the
  dressing; `public/water-fx.js` pooled ripples/spray and the chorro,
  whitewater and remolino sheets; `public/network.js` the host room.
- Models: `/engine/models/vehicles/curiara.js` (`createCanoe`: the shared
  `riverCanoe()` with one or two seated panas and animated paddles),
  `/engine/models/props/amazonas.js` (laja, igapó trunk, churuata, moriche
  finish arch, moriche dock), `fauna/aquatic/tonina.js`, `fauna/caiman.js`,
  `fauna/morpho.js`. All in Studio; the river is the Studio map `curiara`.

## The paddle (tuned in the grey box)

Impulse 1.1 m/s per full stroke, drag .6/s. Gaps: under .25 s is a chapoteo
worth `.3 × gap/.25` (so mashing tops out near 2 m/s at any rate); .25–.35
early (×.85); .35–.6 the sweet spot, ¡Remazo! (×1.25); .6–.9 good (×1);
over .9 a fresh start (×.8). The same side twice is a turn stroke: 40% power,
.5 rad/s of yaw away from that side (D D turns left, like a real dugout). Each
alternating stroke yaws .05 the same way, so pairs cancel. Back-paddle (S)
brakes to −1.1 m/s and pivots 1.2 rad/s toward a held side. Results on still
water: strokes every .36 s cruise at 6.1 m/s, .4 s at 5.5, a random .3–.9 s
newcomer near 2.8, mashing 2.1.

The ¡Ahora! bonus: the popa's tap within .12 s of the proa's stroke (either
order) adds 15% to that stroke, once.

## River and hazards

- Current 2.3 m/s in the caño, 2.5 in the raudal, ~2 in the Río Negro, plus a
  gaussian chorro (+1.5 / +1.2 / +2.6) along `def.chorro(s)`; 55% near the
  banks. Eddies multiply the current by `1 − 1.25w` (slightly upstream).
- Raudales: three lanes split by laja bars; every lane drops 1.5 m in total
  (fast lane: one 1.5 m drop with +2.2 m/s; sides: steps of .5 or .75 m). The
  water mesh samples finely across each step so drops read as sheets. Boats
  go ballistic when the level falls faster than gravity; landing adds tip
  `max(0, impact − 2.6) × 13 + crookedness × impact × 14`.
- Tip meter: fresh knocks only (rocks .5 s apart, canoe bumps .5 s apart),
  never while leaning on something. Drains 14/s paddling straight, else 4/s.
  At 100 the canoe capsizes for 1.8 s, then comes back upright, pointing
  downstream, with 1 s of grace.
- Pinned on rocks for .5 s, the current swings the hull round so nobody wedges
  across a lane. Before this, bots stuck forever in the first raudal.
- Salpicón: 4 s cooldown, reaches 2.5 m hull to hull, shoves 2.6 m/s, +12 tip,
  sprays the target's screen 1.3 s. Caimán: one log in three, snaps within 3 m
  once per 4 s per caimán: +40 tip and a 2.2 m/s jolt away from the bank.
- Toninas run on a fixed clock (`river.toninasAt(time)`, period 3.2 s), so no
  snapshot field: every screen agrees. Their wake pushes +2.4 m/s for 2 s.
- The remolino: swirl 3.2 m/s, inward pull 1.3, spin added to the heading; the
  eye's core (>70%) tips 18/s. Its inner edge runs downstream: the shortcut.

## Bots and balance

Skill .66–.95 sets cadence (`.355 + (1 − skill) × .2` s) and wobble; each
stroke has a 3.5–5% chance of a lost beat. Good bots take the fast lane, skim
the remolino and avoid caimanes. Simulated 40 races (8 bots): finishes
1:56–2:20 (median 2:09), best-skill bot wins 20%, ~0.7 capsizes per canoe.
Check with a script that runs `new Race(); start(true, seed)` and
`update(.05)` to the end; never judge balance from a throttled browser tab.

## Netcode

`curiara-v1` on the shared relay; the oldest member simulates at 20 Hz.
Inputs carry the last 8 strokes as `[seq, side, clientSeconds]` plus held
`back`/`steer` and a `splash` counter. The host maps each guest's clock onto
race time with the smallest `hostNow − clientNow` seen (creeping up .002 s
per message), so the rhythm survives jitter; strokes are deduped by `seq`.
**A starved host tick must not drop strokes:** stale guest inputs (600 ms)
only lose their held keys. Deleting them lost every stroke when software
WebGL slowed both tabs. Countdown strokes are swallowed.

## Rendering

Start view ~1.8M triangles, ~450 draws. Planted cells (90 m) are culled past
200 m; only the caño's canopy and lajas cast shadows (instanced plants
casting shadows doubled the cost). Fog 90–1100 m so the tepui (100×70 m,
175 m tall, straight downstream at z −1150) stays in view. Canoes and the
camera snap on jumps over 12/30 m (teleports, migrations), otherwise lerp.
Headless suites render slowly; give two-client steps long timeouts.
