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
- Who starts: the match opens in phase `starter`, the shared ¿Quién empieza?
  cachos (`quien-empieza.md`, `need: 'first'`); the highest starts and play goes
  on from that seat. The cachos never move pieces, never count as sixes and do
  not draw from the match's dice stream. Revancha starts whoever came last.

These variants are stated in the shared menu's Controles tab.

The shared room panel also offers entry with one or six, an optional capture
bonus roll and an optional third-six penalty. Entry, capture and third-six defaults retain classic behavior; the disclosed
assisted-entry option limits yard droughts.
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
Desktop, touch and the 1–4 keys all dispatch the same validated piece action.
The die is shaken and thrown (`engine/play/dice-throw.js`): hold the button or Space
and let go, or flick across the table. The roll action carries that power;
`state.toss` (seat, power) lets every client fly the same throw from the
thrower's chair, landing nearer the middle the harder it went. Bots get a
varied power from the rng. A moved ficha hops cell by cell; a captured one
waits for the hunter to land, then flies home spinning while the two seated
panas cheer and flail and `shout()` calls it out. Captures are read from the
state diff in `scene.js`, so every screen plays them, but only within a round. Accessible buttons remain available
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

Chair angles use `-π/4 - seat·π/2` to follow `rotateCell`: red near-left,
green far-left, yellow far-right and blue near-right. The same angle places
starter cachos and dice throws. Reversing its sign swaps green and blue while
leaving red and yellow apparently correct. The two-client suite checks every
avatar against its yard center and verifies that it faces the board.

Safe ring cells have contrasting double frames plus their central circle; the
HUD explains that no capture happens there. Shared cells use `piece-layout.js`
to arrange pawns in a centered grid at one height, scaled to stay inside the
cell even with sixteen pieces. Count occupants before assigning targets and
refresh active hop endpoints when occupancy changes. Raycasts still hit each
pawn mesh; the 1–4 buttons remain available for very crowded cells.

## Playtest pacing

The host schedules forced moves 1.1 s after a roll so the die lands first. A
single legal move or a choice only between yard pieces needs no extra click;
strategically different moves remain manual. Pending automatic moves travel in
snapshots and manual moves cancel them.

Salida asistida defaults on and is disclosed in the lobby and controls. Each
stranded episode gets a seeded threshold of 3–5 failed entry rolls. The next
roll is six if still stranded; natural entry resets the counter. Only players
whose unfinished pieces are all in the yard qualify, including after captures
and late in a match. Moving/finishing dice stay random; repeated numbers are
allowed. Every seat uses the same rule, independently of name or score. Classic
random dice remain a lobby option. Thresholds and counters survive migration.
