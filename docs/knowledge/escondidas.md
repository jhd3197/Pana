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
- 30 seconds hiding by default + 180 seconds seeking. The host can choose
  15, 20, 30, 45 or 60 hiding seconds in the lobby. The seeker cannot move or inspect
  during preparation and its view is obscured. A human seeker inspects within
  3.5 units with line of sight; a missed check has a 1.6-second cooldown.
- Bot seekers patrol using the collision map and chase visible movement. A
  suspicion meter grows near the seeker; stationary props are harder to detect.
  Bots fill a small room to four participants. The host chooses 3, 4, 6 or 8 rounds; eight rounds rotate through a full room.
- One point per capture; three per surviving hider. Bot scores survive rounds.

## Multiplayer traps

The server only relays `x`, `z`, `h`, `v`. New top-level message fields silently
disappear. Escondidas envelopes all its data in `v: {game:'hunt-v2', kind, ...}`.
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
`/engine/models/vegetation/`. Both games use exactly the same plant factories. The shared
market kit is in `/engine/models/props/plaza.js`; its plain dimensions are in
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
`hunt.environment`, `hunt.step(seconds)` and `hunt.place(id,x,z)` for deterministic QA. Debug placement
does not validate collisions; normal gameplay always does.

Observed desktop gameplay was approximately 196 draw calls and 124k triangles
including shadow passes. These are scene counts, not an FPS benchmark.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Escondidas uses a host-simulated round: clients send input/actions, and the
room's host broadcasts snapshots at 20 Hz. See `docs/knowledge/escondidas.md` for role and recovery rules.

## Shared map selection

Puerto Coco, Hato del Sol and Ruinas del Mango are available in the lobby.
The host chooses the setting; the selected map follows snapshots, practice,
late joins and host changes. See [shared-arenas.md](shared-arenas.md) for
layout variants, collision, table clearance, lifecycle and verification.

## Round layouts and hiding time

Every room starts with a random unsigned `layoutSeed`; the host advances it
once per round, including replays. `layout.js` derives shuffled prop types,
positions and quarter-turn orientations from that seed. The same snapshot
drives rendering, collision, sight, nearest-object copying, minimap and bot
paths. Keep `mapId`, `layoutSeed` and `hideSeconds` when returning to the lobby
after host election or entering practice. Late joiners receive all three.
Only the host can configure time, only in the lobby, with `HIDE_TIMES` values.

Landmarks and major cover stay fixed. Placement preserves each map's prop
counts, keeps 1.8 m between prop footprints and other obstacles, and reserves
the southern arrival lane plus the counting spot at (0, -10). Plaza lamps are
obstacles too. Large props are placed first to avoid leaving no room for a
bench. Navigation uses each map's bounds, including the wider legacy plaza.
The eight-entry layout cache also retains lazy navigation graphs; do not rebuild
them per tick or mutate the source plaza shared with other games.

`scene.js` mounts the shared environment without its fixed disguise props,
then batches the generated props separately. A new round replaces only this
batch, leaving landmarks and animations mounted. Batch materials are owned
clones so round disposal cannot invalidate the shared model materials.
Studio continues to show the base map arrangement.

`tests/round-layout.test.js` checks 100 seeds per map for deterministic placement,
clearance and variety, plus connected routes, spawns and timer boundaries.
`tests/round-layout.browser.js` compares rendered and collision props across
real peers on all four maps, exercises host authorization, consecutive rounds,
late joins, phone settings, host changes and practice, and checks GPU geometry
disposal over twelve generated layouts. Run it alongside `tests/browser.mjs`
with `npm run test:browser -- escondidas`.


## Room options

The shared room-options panel exposes 3/4/6/8 rounds, barrel-only or all
transformations, one or two seekers, hiding time, 2/3/4 seeking minutes,
periodic sound/whistle hints, movement while disguised and the seeker's map.
The existing arena picker retains all four real maps. Eight rounds let an
eight-person room rotate through everyone; a deliberately shorter match need
not give everyone a seeker turn. Both seekers freeze during hiding and neither
can capture a teammate. Captures credit the seeker who inspected the hider.
Sound hints give a short directional cue every 20 seconds; whistles repeat
every ten seconds and remain on an enabled seeker map for three seconds.

The host alone accepts a strict options patch in the lobby. `options` travels
with snapshots, practice and the fresh lobby after host migration. `seekers`
is the complete active role list; `seeker` remains the first seeker for old
portrait/debug consumers. New gameplay must use `isSeeker()` or the list.

`tests/action-options.browser.js` verifies Escondidas, Cocina, Pepazo and
Reliquia with two real clients each. It changes every shared control, checks
read-only guests, reset, mobile modal bounds, host migration and configured
start effects. This includes hidden Reliquia hints and its nine real trap
meshes, Pepazo flags and Cocina arepas-only chaos orders.
