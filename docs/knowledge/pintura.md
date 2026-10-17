# ¡Pintura! — paintball

`/g/pintura/` is an eight-seat, server-simulated free-for-all. The own Colyseus
room extends `PanaRoom`; `Arena` in `public/rules.js` also runs local practice.
The host only starts rounds. Its departure cannot interrupt simulation.

## Rules and input

- Two minutes or ten paint hits; ties share victory. One hit eliminates a pana
  for 2.5 seconds. Spawn protection lasts 1.5 seconds and firing cancels it.
- Twelve paintballs, 0.25-second firing interval, 1.3-second reload. Empty
  magazines reload automatically. Server ticks are 50 ms.
- Movement is normalized and clamped server-side. Input expires after 350 ms,
  so a backgrounded or disconnected browser does not keep running or firing.
- Projectile travel uses segment/AABB and segment/circle intersections. At
  29 units/second, testing only projectile endpoints misses thin cover.
- All collision cover is defined once in `COVER`; scene geometry reads it.
- A solo player starts with three bots; friends play without bots when two or
  more humans start the round. Live friends can join mid-round;
  when eight active slots are filled a joining friend replaces one bot.
- Touch steering uses `engine/touch.js`. Holding Pinta aims at the nearest
  visible opponent, excluding cover-obstructed and shielded opponents.

## Rendering and proof

The scene uses the saved shared pana sculpt, including its Three.js addons
import-map entry. `bindRenderer` sets full-window inline canvas dimensions;
reset the CSS size before reading layout so phone rotation resizes correctly.

`npm run test:browser -- pintura` uses real sessions for movement, shooting,
hit agreement, respawn, host departure, late join, natural round end, rematch,
local pause and touch layouts. Screenshots are ignored under the game's `qa/`.
`tests/rules.test.js` covers collisions, ammo, respawns, bots and win conditions.

## Notes for agents

Keep simulation in pure rules and room authorization on the server. Never add
client-controlled score/position messages. Clear held input on blur and menus.
Online matches continue through the shared menu; local practice pauses.
