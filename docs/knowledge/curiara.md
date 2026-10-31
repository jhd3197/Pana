# Curiara

`/g/curiara/` is a downriver canoe race through the Venezuelan Amazonas: the
Caño de la Selva (with the Atajo del igapó), the Raudal del Autana under the
tepui and the Río Negro to a churuata landing. Up to 8 panas; bots fill the
river. Two formats: **Todos contra todos** (8 canoes, one pana each) and
**Parejas** (4 canoes; the proa paddles, the popa steers).

## Files

- `/engine/play/paddle.js` (pure, shared with Bululú's river minigames): the stroke
  model. `stroke(state, side, t)` grades the gap to the previous stroke;
  `step(state, dt)` delivers each stroke's impulse over `PADDLE.pull` s.
  State is a plain object so a race snapshot carries it across migration.
- `/engine/river/river.js` (pure, shared with Lancha): `buildRiver(def)`
  turns a course definition into splines with distance `s` and signed
  `offset` (positive = right bank looking downstream), `locate()` (main
  channel or igapó branch), `levelAt()` (raudal steps per lane), `currentAt()`
  (chorro, eddies, whirlpool), `groundAt()`, rocks, snags, logs, toninas,
  swimming caimanes, the guide line, buoys and gates.
- `public/river.js`: Curiara's courses only, re-exporting the shared helpers.
  `AMAZONAS` is the race; `GREYBOX` is the step-0 straight channel kept for
  tuning (`new Race(GREYBOX)`).
- `public/rules.js` (pure): `Race`, boat physics, hazards, bots, snapshots.
- Shared with Lancha in `/engine/river/`: `scene.js` terrain and per-tramo
  water, `landscape.js` the dressing, `water-fx.js` pooled ripples/spray and
  the chorro, whitewater and remolino sheets, `guide.js` the guide on the
  water, `minimap.js` the HUD map, `hud.js` the shouts, flash, shake,
  countdown and leaderboard (Galope uses its board and countdown too).
  `public/network.js` is the host room.
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

## Helpers

Curiara is hard for newcomers: they mash A/D believing faster is better,
which is a chapoteo, and lose the line once the river opens up. So:

- **Remo automático**: W held (or the touch Auto button) strokes for you
  every .42 s, alternating, at 1.05× a plain stroke, never a ¡Remazo!; A/D
  become a rudder and send no strokes. Still water: auto 4.6 m/s, a good
  rhythm 6.1, mashing 2.1. The ring hides and the key reads W.
- Every chapoteo now calls out (every third one "¡Más calma!") and the tip
  line says mashing slows the canoe.
- **Guía en el agua** (room option, on): a ring round your own boat with a
  pointer toward `river.guideAt(s + 14)`, gold on line, coral when pointing
  away, pulsing faster the further off you are; and seven chevrons along the
  line ahead, lit in a wave that runs downstream. Client-side only; it reads
  the same race clock, so it agrees with the swimming caimanes.
- `river.guideLine(s)` is the chorro, the fast lane through each raudal, the
  remolino's edge 1.2 m out, clear of rocks and bank caimanes, sampled each
  metre and box-smoothed over 13 m so the chevrons never jump.
  `guideAt(s, time)` also swerves 4.5 m round swimming caimanes, on the side
  they swim away from.
- **Buoys** (`def.buoys`): pairs 6 m either side of the guide every 40 m in
  the Río Negro (coral left, teal right), skipped near raudales, the remolino
  and rocks. They only nudge the hull; no tip.
- **Swimming caimanes** (`def.caimanes`): three cross the Río Negro back and
  forth on the race clock (`river.caimanesAt(time)`, periods 24–30 s, spans
  8–9 m), so no snapshot field. Same bite as a bank babo (+40 tip, 2.2 m/s
  jolt, once per 4 s each, ids `n0…`). Bots over skill .72 swerve round them.
  The guide warns "¡Caimán cruzando adelante!" within 30 m.

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
the remolino and avoid caimanes. Simulated 200 races (8 bots): finishes
1:54–2:30 (median 2:09; the slow tail is capsizes), best-skill bot wins 29%,
~0.7 capsizes per canoe.
Check with a script that runs `new Race(); start(true, seed)` and
`update(.05)` to the end; never judge balance from a throttled browser tab.

## Netcode

`curiara-v2` on the shared relay; the oldest member simulates at 20 Hz.
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

## Room options

The shared primary/advanced room panel publishes host-validated options through
race snapshots. Active races lock options, and host migration rebuilds the same
river before continuing. The existing Amazonas remains the default. Caroní has
narrower bends; Orinoco stretches bends and widens the channel, with sandy banks.
These are procedural course variants, not geographic surveys. The scene,
physics, minimap, finish distance and hazards all use the selected definition.

Each `amazonasDefinition()` owns its curvature/length closure. Do not share the
old mutable module-level curvature or length between river variants: constructing
one river otherwise silently changes the bank/current functions of another.
World and pooled effects are disposed/rebuilt only when river, cascades or river
objects change; current and assistance changes do not rebuild geometry.
Waterfall scenery must derive its placements from `river.drops`; assuming two
entries crashes world construction when the host disables cascades.

Solo keeps eight canoes. En pareja · 2×2 uses two two-person canoes;
2×2×2 uses three and 2×2×2×2 preserves the original four-pair format. A three-pair room with seven/eight humans
cannot start until the host selects enough seats; nobody is silently omitted.
Seat choices lock during a race. Eight players remain the connection cap.

Slow/normal/brave current scales flow by .6/1/1.45. Easy rapids reduce whirl
spin to 45% and landing/remolino tip to 35%. No cascades removes the drop geometry
and corresponding rock bars. No river objects removes rocks, snags, caimanes,
tonina boosts and salpicón. Soft collisions reduce canoe impulse and tip damage.
Steering help gently aligns the hull with the river while the player is neither
braking nor holding a rudder. Tap paddling gives each accepted tap equal thrust,
with a .25 s minimum interval; rhythm retains the shared graded stroke model.

`options.test.js` verifies options, eight-seat crews and map isolation. The
Galope `race-options.browser.js` suite covers both races with real client pairs,
read-only guest menus, snapshots, changed geometry and host transfer.

The grouped avatar roster shows effective automatic crew assignments as well as explicit choices. Any pana can swap their own role with an occupied role or move to an empty one; the host can arrange other panas. A successful move freezes the effective grid into explicit seats, so unrelated crew members never shift. Repeated hello messages refresh identity but cannot undo these authoritative choices. Running races lock all seat changes.

Opening a local race keeps the current room options and map while creating a fresh lobby and clearing network participants. This also applies to offline fallback after a disconnect.

Restablecer also enables the river-remeros bot fill checkbox again.

Seat interaction suites must wait for the acting client's rendered own card after a swap, not only the host snapshot. The roster updates on the visual tick; clicking a second destination against its old source before that update correctly fails authorization because the old seat now belongs to somebody else.
