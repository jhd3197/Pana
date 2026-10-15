# Escondidas / Pana Hunt

Standalone game at `/g/escondidas/`, with metadata and live artwork discovered by
the hub. No build step or additional production dependency. Tested on Three.js
0.160.0 and the existing `ws` relay.

## Rules and controls

- Three transformations to one of five shared props per round. Reverting to a
  pana is free, but never replenishes changes. Selecting the current or an invalid
  form does not consume a change. A larger disguise must fit its collision radius.
- WASD/arrows to move, drag to orbit, Shift to run as a pana, 1–5 to change, Q to
  revert, E to copy the closest map object or inspect as a seeker. Mobile has
  directional buttons, prop selection, revert and action controls.
- 15 seconds hiding + 100 seconds seeking. The seeker cannot move or inspect
  during preparation and its view is obscured. A human seeker inspects within
  3.5 units with line of sight; a missed check has a 1.6-second cooldown.
- Bot seekers patrol using the collision map and chase visible movement. A
  suspicion meter grows near the seeker; stationary props are harder to detect.
  Bots fill a small room to four participants. The match has 4–8 rounds depending
  on participant count; every participant seeks once when the roster is stable.
- One point per capture; three per surviving hider. Bot scores survive rounds.

## Multiplayer traps

The server only relays `x`, `z`, `h`, `v`. New top-level message fields silently
disappear. Escondidas envelopes all its data in `v: {game:'hunt-v1', kind, ...}`.
The oldest connected human (smallest server ID) owns the round simulation,
movement collision, charges, AI, timer, checks and scoring. Other clients send
normalized movement input and sequenced actions; snapshots are interpolated for
rendering. This is host authority for a casual game, not anti-cheat enforcement.

Late joiners spectate until the next round. A departing seeker ends the round.
A departing host elects the next oldest client and returns the room to a fresh
lobby, rather than trying to reconstruct partially received state. Remote inputs
expire after 600ms so a lost connection cannot keep a player moving indefinitely.
Solo menus pause simulation; multiplayer menus stop only local movement.
The menu is the shared `engine/ui.js` dialog (see `pana-ui.md`).

A disconnect must show the lobby with its practice fallback, even if it occurred
during gameplay. Otherwise the fallback button exists inside a hidden container.
When intentionally closing a socket to enter local practice, its delayed `close`
event must not clear the new local session's connected state.

## Shared assets

Bululú's original `flora.js` is now a compatibility re-export of
`/engine/flora.js`. Both games use exactly the same plant factories. The shared
market kit is in `/engine/plaza-props.js`; its plain dimensions are in
`plaza-catalog.js`. Los Llanos uses the stall, barrel, crate and cooler directly.
There are no cross-game asset imports. Add `three/addons/` to import maps,
including the hub's, because the foliage batcher imports BufferGeometryUtils.
The hub catches artwork import failures, so a visible game tile alone is not
proof that its live art loaded.

## Verification

`npm run check` checks all app JavaScript. Rules and collision tests run with:

```powershell
node --test Pana/games/escondidas/tests/rules.test.js
```

With the Pana server running, the optional Playwright suite can use a preinstalled
package and browser without adding either as a production dependency:

```powershell
node Pana/games/escondidas/tests/browser.mjs <playwright-package-directory> <browser-executable>
```

`PANA_QA_URL` overrides `http://localhost:8461`. `PANA_QA_OUTPUT` optionally saves
desktop and mobile screenshots. The suite verifies real browser peers, transforms,
capture, late joins, role rotation, host departure, mobile controls, match replay,
connection fallback, cross-game room isolation and the existing games/hub.

`?debug` exposes `hunt.state`, `hunt.room`, `hunt.scene`, `hunt.renderer`,
`hunt.step(seconds)` and `hunt.place(id,x,z)` for deterministic QA. Debug placement
does not validate collisions; normal gameplay always does.

Observed desktop gameplay was approximately 196 draw calls and 124k triangles
including shadow passes. These are scene counts, not an FPS benchmark.
