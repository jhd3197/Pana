# Trifulca

Cartoon barrio boxing at `/g/trifulca/`, 1–8 panas, made for 5. *Ganador se
queda*: two panas fight one round, the winner stays, the loser goes to the
back of the queue. Everyone else is the ring: they stand around it as their
own panas, shove fighters back in, bet dolitas, give water in the corner and
can shout ¡cálmate!. The night ends after `peleas` fights; the richest pana
wins and the titles are handed out.

## Files

- `public/fight-rules.js`: the punches. Two bodies, the four buttons, mareo,
  caídas, the count, the ring edge and the scorecard. Pure.
- `public/rules.js`: the night (`Trifulca`): queue, phases (`lobby → intro →
  fight → after → … → finished`), the crowd, bets, dolitas, mano de caballero,
  titles and the bots. Pure; tested by `tests/rules.test.js`.
- `public/network.js`: the live room; the host runs the night at 20 Hz.
- `public/scene.js`: stage, panas, NPC neighbours, the ref, the TV camera and
  the replay. `fighters.js` poses a pana; `arenas.js` dresses the four maps;
  `set.js` holds the gloves, the moto helmet, the tent ring and the Ávila.
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

- The camera sits on the fighters' perpendicular, keeping the side it had
  (it never flips across), and clamps inside the street on la calle and el
  mercado (`camBox`). El toldo keeps it low (`camHeight`) so the tent's
  banners stay above the frame. NPC neighbours on the camera's side of the
  fight are hidden while a fight is on.
- The replay records every render frame for 6 s and, on a K.O. or a count,
  plays from 1.5 s before the last caída to 0.5 s after it at 0.4× during
  the verdict.
- Arena reactions: `moto` (la calle) drives a moto through the fight;
  `out`/`vecino` near a row of parked motos topples it like dominoes (las
  motos) or tumbles the crate stacks (el mercado); `ropes` wobbles the ropes.
