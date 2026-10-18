# Pepazo — paintball

The player-facing name is Pepazo. Keep `/g/pintura/`, the `pintura` room type,
debug handles and stored IDs unchanged so existing links continue to work.

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
- All collision cover comes from `coverFor(mapId)`; scene geometry reads the
  same bounds. `COVER` is the original plaza court's default layout.
- A solo player starts with three bots; friends play without bots when two or
  more humans start the round. Live friends can join mid-round;
  when eight active slots are filled a joining friend replaces one bot.
- Touch steering uses `engine/touch.js`. Holding Pinta aims at the nearest
  visible opponent, excluding cover-obstructed and shielded opponents.

## Rendering and proof

The court uses real shared pueblo houses, church, market stalls, benches,
streetlights, araguaneyes, mango trees and crate geometry. Crates are fitted to
the authoritative `COVER` bounds, so artwork never changes movement or shots.
The paint marker is a canonical Studio asset in `engine/models/props/paintball.js`.

The default perspective camera follows the player's pana and starts facing
into the court. Q/E, right-button dragging and touch camera buttons orbit it.
WASD and the touch pad are camera-relative; the server still receives world-space
normalized movement. The shared menu offers a wide court overview, which retains
world-axis controls. Pointer aiming is reprojected as the camera moves, at the
same 1.1 m plane used by `screen()`. Keep those heights equal. Camera obstruction
uses scenery bounds to pull in before buildings, trees or cover hide the player.

The scene uses the saved shared pana sculpt, including its Three.js addons
import-map entry. `bindRenderer` sets full-window inline canvas dimensions;
reset the CSS size before reading layout so phone rotation resizes correctly.

`npm run test:browser -- pintura` uses real sessions for movement, shooting,
hit agreement, respawn, host departure, late join, natural round end, rematch,
local pause and touch layouts. Screenshots are ignored under the game's `qa/`.
`tests/rules.test.js` covers collisions, ammo, respawns, bots and win conditions.
`engine/tests/table-games.browser.js` also checks all three new 3D scenes, camera
picking, orbit, touch layouts and the actual Studio model constructors.

## Look

The plaza court follows the paint-battle brand board: `engine/look.js`
(`WARM_DAY`, `PALETTE`, `BUNTING`) for light and colours, stone paving and
splat textures painted by `engine/models/props/paintball.js`
(`pavingTexture`, `splatTexture`), decals on crates and paving from earlier
games, bunting along the top rope, paint buckets and tyre stacks outside the
fence. All of it is cosmetic: collision still comes from `COVER`. Hit splats
are glossy alpha-tested planes, four shapes per colour, with polygon offset so
they never fight the paving. Scene files may not paint 2D canvases
(conventions test): texture painters live in engine model files.

## Bot difficulty

`Arena.difficulty` (host message `difficulty`, lobby or results only) picks a
`BOT_SKILL` row: a deterministic aim wobble around the true line and the
trigger threshold on the bots' firing sine. Over a 45 s duel against a
stationary pana an Experto bot scores more than a Fácil one (rules test).
The phone browser check measures movement along `room.current` (the input
the pad sent), not a direction captured before the first frame set the yaw.

## Notes for agents

Keep simulation in pure rules and room authorization on the server. Never add
client-controlled score/position messages. Clear held input on blur and menus.
Online matches continue through the shared menu; local practice pauses.

## Shared map selection

Puerto Coco, Hato del Sol and Ruinas del Mango are available in the lobby.
The host chooses the setting; the selected map follows snapshots, practice,
late joins and host changes. See [shared-arenas.md](shared-arenas.md) for
layout variants, collision, table clearance, lifecycle and verification.
