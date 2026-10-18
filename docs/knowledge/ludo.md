# Ludo

`/g/ludo/` is a four-color individual table game. Empty seats are bots; a friend
joining takes the first bot's pieces, including a pending roll. All game copy
is Spanish. The hub discovers `game.json` and categorizes it as Mesa.

## House rules

- Four pieces per color. A six brings a piece out onto its starting square.
- A six grants another roll. The third consecutive six forfeits that roll only;
  earlier moves remain. Captures and reaching home do not grant bonus rolls.
- Eight ring cells are safe (starts and their offsets +8). Opponents can share
  those cells. Landing on any other ring cell sends all rival pieces there back
  to their yards. Stacks do not block movement.
- Home lanes are private, finishing requires the exact number, and all four
  pieces must finish to win. No legal move automatically consumes the roll.

These variants are stated in the shared menu's Controles tab.

The shared room panel also offers entry with one or six, an optional capture
bonus roll and an optional third-six penalty. Defaults retain classic behavior.
Only the host changes them in the lobby; typed validation rejects an entire
invalid patch. Snapshots, rematches and local fallback preserve the options.
Ludo remains four players because its authored board has four private lanes and
four colors; increasing room metadata alone would overlap lanes and pieces.

## Coordinates and ownership

Pure `rules.js` is the authority for the ring and rendering coordinates. Progress
is -1 in the yard, 0–50 around the ring, 51–55 in the private lane, and 56 at
home. Each seat offsets the 52-cell ring by 13; its lane branches before the
last ring cell. `cellFor` also places the yard and final triangle.

`LudoRoom` extends `HostRoom`; only the elected host generates seeded dice and
accepts actions. Revision plus per-member sequences reject stale, duplicate,
out-of-turn and invalid-piece actions. RNG, pending die, consecutive six count,
round and ledger travel in event-driven snapshots. Replacing a departed player
must change ownership only, preserving their pieces and pending move. A fresh
empty room or local fallback starts a new lobby. Local play disables invites.
This uses the existing trusted-friends host model, not server anti-cheat.

## Visuals and controls

The shared illustrated entry loads the table behind the lobby and waits for
`sceneReady` (textures, shader compilation and first render). `scene.js` exposes
its renderer, scene and camera for this preparation. Lobby portraits use the
shared cache and the supplied Ludo illustration; readiness uses shared rooms.

`board-model.js` owns the board, numbered pawn and six-face die factories, also
registered in Studio. The playing scene and hub preview share those factories.
The scene uses the shared game table/chairs and actual saved Pana avatars.
Desktop, touch and the 1–4 keys all dispatch the same validated piece action;
Space rolls when focus is outside a button. Accessible buttons remain available
when physical pieces overlap. The shared menu freezes bots only with one human.

The canvas is sized to the available stage, not the window: its raycasts must
subtract its bounding rectangle, and its renderer must use its client size
after shared quality settings change. Portrait keeps a scrollable lobby below
the visible board, and the in-game buttons remain below it.

## Proof

- `node --test Pana/games/ludo/tests/rules.test.js`: rule edges, stale requests,
  restore, coordinate consistency and 200 seeded complete bot games.
- `PANA_TEST_URL=http://127.0.0.1:8487 npm run test:browser -- ludo`: real
  two-client rolls/moves, physical raycast, pending-roll host migration, late
  bot replacement, pause, finish/rematch, both mobile orientations, local
  fallback, Studio factories and hub discovery. Screenshots: `art/ludo/`.
- `.\dev.ps1 check`: repository syntax, unit and convention checks.
