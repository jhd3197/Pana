# Trifulca

Cartoon barrio boxing at `/g/trifulca/`, 1–8 panas, made for 5. *Ganador se
queda*: two panas fight one round, the winner stays, the loser goes to the
back of the queue. Everyone else is the ring: they stand around it as their
own panas, shove fighters back in, bet dolitas, give water in the corner and
can shout ¡cálmate!. The night ends after `peleas` fights; the richest pana
wins and the titles are handed out.

## Learning it

- **Tutorial** (`startTutorial`, room action `tutorial`): you and Profe Cheo,
  no bell, eight steps in `TUTORIAL` (walk up, 3 jabs, a trompón, block 2,
  dodge 2, a counter, a grab, get up). Each step ends on the player's own
  events (`tutorialEvent`); the profe's bot does what the step needs; mareo is
  capped at 60 and the count never reaches ten. Start opens it the first time
  a pana is alone (`localStorage trifulca:tutorial`); the lobby button always
  does. `tests/tutorial.browser.mjs` plays it with real keys, so it is the
  end-to-end proof that every control reaches the fight.
- **Alone = the ladder** (`ladder`): ganador se queda with one pana adds five
  rivals at bot levels `LADDER` [0, 0, 1, 1, 2] (shifted by `nivel`). You fight
  every fight; a win climbs, a loss costs one of three lives. Bots never fight
  each other when you play alone.
- **Counter window**: dodging a trompón sets `contra` (0.8 s) on the dodger;
  their next jab or trompón ignores blocking and adds 14 mareo.
- HUD: a key bar that lights each button while held, a big prompt for the
  moment (¡ESQUIVA! when the foe winds up within 2.6 m, ¡CONTRA!, ¡machaca J!)
  and ¡OJO! over a pana winding up. Mouse: left button golpe, right cubrirse.

## Modes (`options.modo`)

- `queda`, ganador se queda: two fight, the winner stays.
- `libre`, trifulca libre: up to four in the ring (corners red, blue, yellow,
  green), each facing the nearest foe still standing. Four props spawn at
  62 % of the ring radius (silla, caja, casco, chancleta). Agarrar picks one
  up within 1.2 m when no foe is within 1.3 m; with one in hand golpe swings
  it (+0.35 m reach, ×1.4 mareo, ignores blocking) and agarrar throws it
  (9.5 m/s, 7 m, 22 mareo, 0.55 m hit radius). A knocked-out pana leaves
  (`out`); the last one standing wins; odds are the number of fighters.
- `parejas`: two teams of two, one per team in the ring (`bench` on the
  apron, 0.55 m outside the ring at the team's side, recovering 12 mareo/s).
  Agarrar within 2.2 m of the partner tags them in. The team loses together;
  the winning pair stays (`champions`). Bots fill to four.
- `torneo`: a bracket of 4 (up to 4 panas) or 8, bots filling it. `bracket`
  holds the rounds; the final is fought in el toldo (`arenaNow`) and ends the
  night with the belt and 15 dolitas.

## Files

- `public/fight-rules.js`: the punches. Two bodies, the four buttons, mareo,
  caídas, the count, the ring edge and the scorecard. Pure.
- `public/rules.js`: the night (`Trifulca`): modes, queue, phases (`lobby →
  intro → fight → after → … → finished`), the crowd, props, bets, dolitas, mano
  de caballero and titles. `bot-rules.js` holds the bots. Pure; tested by
  `tests/rules.test.js`.
- `public/network.js`: the live room; the host runs the night at 20 Hz.
- `public/scene.js`: stage, panas, NPC neighbours, the ref, the TV camera and
  the replay. `fighters.js` poses a pana (fighters wear the wardrobe's kart
  helmet, and every jab, trompón, block, taunt and win picks one of a few
  styles when it starts); `arenas.js` dresses the maps; `set.js` holds the
  gloves, the thrown moto helmet, the tent ring and the Ávila.
- `public/hud.js`, `narrator.js`, `controls.js`: HUD, narrator lines/voice and
  ringside sounds, keyboard/touch/gamepad.

## The fight

- Input is a world-space stick (the client turns its screen stick with the
  camera's basis) plus held `g`/`b` and press **counters** `gp`, `e`, `a`, `t`
  (mod 256). A tap shorter than a 50 ms tick still reaches the host as a
  counter change, and mashing after a caída is just the counter delta.
- Golpe: a tap (released before `T.hold` = 0.16 s) is a jab; held past it is
  the trompón's 0.55 s windup (`wind`, the glove shakes back), which fires on
  its own. A press while busy is buffered for 0.2 s.
- Rock-paper-scissors: a jab landing on a `wind` interrupts it (+6 mareo
  counter); blocking from the front turns jabs into 1.5 chip; a dodge's
  invulnerable window (0.03–0.34 s) makes a trompón whiff and leaves the
  puncher `open` 0.4 s; a grab ignores blocking and shoves 7 m/s.
- Mareo (0–100) drains 7/s after 1.5 s without being hit. At 100 the pana is
  `dizzy` for 2.1 s; a clean hit then is a caída. Recovering without one
  resets mareo to 55. Getting up takes `7 + 6 × (caídas − 1)` presses before
  the ref's ten (one count per 0.85 s). Three caídas or the ten is a K.O.
- The bell after `seconds`: card = jabs + 3 × trompones + 6 × caídas
  inflicted + 0.35 × seconds pressing forward + 0.25 × blocks. A gap under 1
  point goes to the crowd (cheers plus bets per corner).
- Bot balance (12-fight nights, seeds 1–3): roughly a third of fights end by
  K.O. or count at every level; bravos throw about 1.5× the trompones of
  tranquilos.

## The ring and the night

- Circle arenas have a human ring (`r` 4.1–4.5 m). A fighter more than 0.1 m
  out for 0.55 s is shoved back by a neighbour; a pana in the crowd within 2 m
  who presses golpe does it first and earns 2 dolitas (only when the fighter
  is out or within 0.35 m of the edge). El toldo is a square ring with ropes
  that bounce instead.
- Crowd panas walk around the ring at `r + 0.95`; during the intro golpe gives
  water to the fighter by them (−15 mareo, once). ¡Cálmate! (agarrar) works
  once per fight on a fighter within 2.6 m at 75+ mareo: the round ends as a
  loss with no caída and the peacemaker gets 4 dolitas.
- Bets: 10 dolitas during the intro, ×2, or ×3 against a champion on a streak
  of 2+ (×1.5 on him). The stake leaves when placed and is refunded if the
  intro restarts. A streak of 3 is the belt; the champion then starts at 25
  mareo, plus 35 % of the mareo he finished his last fight with.
- Bots: alone you get three (a ladder); two panas fight each other straight
  with only NPC neighbours watching; `rivales` overrides it.

## Scene notes

- One fixed side camera, like a fighting game: the red corner starts on the
  left and right on the stick is right on screen. A chooser scores the
  candidate sides (`arena.camSides`, default +Z and −Z) by the fighters'
  depth spread along the side, how far a fighter drifts toward the camera and
  how far the camera position would overflow `camBox`, and only switches when
  another side stays clearly better for 1.5 s — a one-on-one keeps the
  default side (rules pull each body's z back to 0 at 2.2/s except while
  dodging, so both sides tie), while trifulca libre and caídas that fling a
  body outward can flip it. `world.cameraSide` exposes the choice. The crowd
  never stands within `CROWD_GAP` (1.15 rad) of the camera side, and NPC
  neighbours on that side hide during a fight. The ref waits outside the
  ring, 1.05 rad off the far side, and walks the edge to count. Crowd panas
  and neighbours face the fight's middle rather than the centre mark, idle on
  their own seeded rhythm (`crowd-life.js`, deterministic across peers) and
  the neighbours near a landed trompón or a caída gasp; hits stagger the
  engine character toward the blow's side and cheer landings and get-ups
  bounce it. Props and the toldo's ring wear ink outlines (`toon.js`,
  inverted hulls on regular meshes only — SkinnedMesh bodies are skipped;
  `?ink=0` disables).
- A caída sits the pana down dazed (tilt 0.62 of the full flop) with a small
  dust puff and a short zoom; the count is drawn at the side, not over it.
- The replay records every render frame for 6 s and, on a K.O. or a count,
  plays from 1.5 s before the last caída to 0.5 s after it at 0.4× during
  the verdict.
- Seven arenas (`ARENAS` in fight-rules.js, dressed in arenas.js): la calle,
  el toldo, el mercado, las motos (night), la manga de coleo (llanero hats on
  the neighbours, wooden stands with seated crowd), el paso de cebra (dusk,
  under the lake bridge whose rail lamps light the crossing) and la colonial
  (`createColonialStreet` lowered 0.8 m so its graded street meets y = 0).
- Mercado's 26 stalls use the batched `marketStall()` factory. An isolated
  1200×600 Three 0.160 render on an RTX 4090/D3D11 kept the same 104,520
  triangles while reducing submissions from 2,080 to 208 and mean CPU time
  around `renderer.render()` from 7.37 ms to 0.91 ms. This is a controlled
  rendering measurement, not a claim that whole-game FPS rises by the same ratio.
- Each arena's twist fires once per fight between 14 s and the bell minus
  10 s (`fight.moto`): `moto` splits two fighters, `toro` knocks anyone
  within 1.5 m of the bull's lane (+10 mareo), `balde` takes 12 mareo off the
  fighter nearest a balcony and slips them, `pito` (a bus honk) freezes
  everyone 0.25 s.
- Arena reactions: `moto` (la calle) drives a moto through the fight;
  `out`/`vecino` near a row of parked motos topples it like dominoes (las
  motos) or tumbles the crate stacks (el mercado); `ropes` wobbles the ropes.

### Head pose and controller feedback

The shared character never resets `neck.rotation`; crowd gaze writes all three
axes absolutely after `update`, never adds an idle or gasp offset each frame.
Fighter recoil uses small integration steps and bounded neck angles. Heavy hits
recoil without a full turn, keeping the opponent readable.
HUD labels distinguish mareo (fills with damage) from aguante and caídas. Native
controller input does not advance press counters while the menu is open. The
shared controller guide replaces the keyboard strip and tutorial keys follow
the active device.

The Banderín HUD lives in `hud-banderin.css`; `hud-details.js` supplies shared
3D avatar portraits, event-driven hit streaks (reset after 1.8 s or being hit)
and the result table from each body's authoritative `score`. Portraits reuse
`portrait-cache.js` and lazy-load `portrait.js`, never the reference's SVG faces.
The reference's health/super/round-win mock values are not game state: the live
bars remain mareo and aguante, diamonds count received knockdowns, and ¡Dale!
remains a taunt. The shared controller strip is styled in-game rather than
duplicated. Reduced motion disables HUD transitions, not gameplay messages.
