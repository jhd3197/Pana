# Ludo

`/g/ludo/` is an individual table game for four, five or six colors. Empty
seats are bots; a friend joining takes the first bot's pieces, including a
pending roll. All game copy
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
## Four, five or six seats

The room option `seats` (Jugadores: 4, 5, 6) is the length of `players`; every
rule reads the count from `players.length` (`trackOf(state)`), never from the
option, so old snapshots without it restore as four. `seat(n)` resizes in the
lobby only: panas keep their seat while it exists, one beyond the new count
takes the first bot seat, and a count below the seated panas rejects the whole
options patch. A pana arriving at a full lobby adds a seat up to six (the
`game.json` cap); mid-match they watch. Colors and bot names extend to Morado
`#a46bff` (Yoli) and Naranja `#ff8a3d` (Cheo). Local play keeps the count.

`ludoTrack(n)`: 13 ring cells per seat, `lap = 13n - 2`, five lane cells, home
at `lap + 6`; safe cells are every start `13·s` and `13·s + 8`. Four seats
keep the authored cross (`RING`, lap 50, home 56) byte for byte: a test
replays seed 7's whole bot match against a fingerprint recorded before.

Five and six seats use a star (`starMetrics` in rules, cell units centered on
7). Each seat owns a three-cell arm around a polygon center whose apothem is
`1.5 / tan(π/n)`; arm `s` points at angle `2πs/n` (outward `[-sin, cos]`).
Ring cells go out along one side column of each arm, across its tip and back
in along the other; ring index `13·s` (a start) is the inbound column's fifth
cell from the center, so the last ring cell before a lane is the arm's tip. Round yards sit
between arms at `θ + π/n`, far enough out that the yard disc never touches an
arm. Home is 0.58 of the apothem along the arm, inside its colored wedge.
`board-model.js` builds the round wood board (radius from `starMetrics`),
tiles turned to their arm, and `tableScale(n)` grows the shared table, chair
radius, hand, cacho spots, die rest, throw reach and camera bounds together
(1.21 for five, 1.35 for six; exactly 1 for four). The scene rebuilds board,
chairs, pawns and characters when the count changes; moments read the board
through a getter for that reason.

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

The `event` line is a list of `{ text, vars }` Spanish source sentences;
`eventText` in `rules.js` joins them in the viewer's language (the cachos'
note travels as `vars.how`). The protocol is `ludo-v6` since the seat count option.

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
  restore, coordinate consistency, star geometry and 200 seeded complete bot
  games for each of four, five and six seats.
- `PANA_TEST_URL=http://127.0.0.1:8487 npm run test:browser -- ludo`: real
  two-client rolls/moves, physical raycast, pending-roll host migration, late
  bot replacement, pause, finish/rematch, both mobile orientations, local
  fallback, Studio factories and hub discovery. Screenshots: `art/ludo/`.
- `seats.browser.js`: five and six seats on two clients: lobby option, every
  pana beside their own star yard, a guest's capture and finish on star cells,
  one progress plate per seat. Screenshots: `art/ludo/seats-*.png`.
- `.\dev.ps1 check`: repository syntax, unit and convention checks.

Chair angles use `-π(2·seat + 1)/n` (`seatAngle` in `scene.js`; for four seats
`-π/4 - seat·π/2`) to follow `rotateCell` and the star's yards: red near-left,
green far-left, yellow far-right and blue near-right. The same angle places
starter cachos and dice throws. Reversing its sign swaps green and blue while
leaving red and yellow apparently correct. The two-client suite checks every
avatar against its yard center and verifies that it faces the board.

Safe ring cells have contrasting double frames plus their central circle; the
HUD explains that no capture happens there. Shared cells use `piece-layout.js`
to stack up to four pawns at 90% size before adding columns for larger crowds.
Both horizontal bounds and vertical clearance include the selectable pulse;
even sixteen pieces stay inside the cell footprint. Count occupants before assigning targets and
refresh active hop endpoints when occupancy changes. Raycasts still hit each
pawn mesh; the 1–4 buttons remain available for very crowded cells.

## Playtest pacing

The host schedules forced moves after the actual toss duration plus 1.2 s
to read the result (`dice-timing.js`, shared with the scene). The die uses wall
time to avoid a low frame rate letting the host move before the visual lands. A
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

## Studio appearance and camino motions

The playable scene, hub preview and Studio use the same textured board,
lacquered numbered pawns with mesh faces, and rounded die factories.
`studio-finish.js` owns the finishes and facial poses. Each board owns its
procedural textures, so closing a Studio preview cannot dispose a game's maps.

`camino-motion.js` adapts the ten authored camino ideas (Chócala, Resbalón,
Rodar, Moonwalk, Resorte, Esquivar, Caballito, Paraguas, Túnel and Chicle) to
actual rule paths. `motion-choice.js` selects from snapshot RNG/revision and
pawn identity without consuming the dice RNG. Friend/rival tricks require a
real nearby pawn; partners and endpoints come from logical cells, never a
client's current animation time. A new board move settles existing tricks
before selecting another, making eligibility consistent across clients.

All tricks are cosmetic: they end at the awarded cell, including its crowd
layout. Captures retain the timed hop and return flight, with the victim's
old path cleared. A changed round, interrupted trick or teardown restores
visibility and partner transforms and disposes temporary props and text maps.
Studio's ten `ludo-<style>` pages use `studio-preview.js` and the exact live
motion sampler; enable **Animación** to play their repeating demonstrations.

`studio-motion.browser.js` scrubs all ten motions for all four seats, verifies
crowded endpoints and cleanup, checks matching choices after a real host move
on two clients, and renders every new Studio page. `ludo.browser.js` also
covers capture flights, shared safe squares, rematches and mobile controls.

## In-game HUD

The action dock adapts the Banderín reference using kit fonts and colors over
the live 3D scene. `hud-model.js` derives legal move previews, captures, safe
cells, exact-home moves and recommendations from the real rules. `hud.js`
shows the pip result after the physical throw settles; move inputs wait for
that reveal, and holding the shake button never disables its release event.
Capture totals live in rule snapshots and reset on rematch.

The corner progress plates (one per seat; five and six use three rows) are
hidden by default. Hold either Shift key
to inspect; releasing Shift, losing focus, hiding the page or opening the menu
clears them. «Ver panas» toggles the same view for touch and keyboard users.
V switches the existing camera view. The closer perspective frame reserves
space measured from the actual action dock, including narrow landscape mode.
No demo background images, duplicate rules, sockets or menus are imported.

`hud.browser.js` proves two-client result visibility before automatic exit,
large shared-cell stacks, hold/release dice input, Shift/blur/touch inspection
and responsive desktop/portrait/landscape layouts. `hud.test.js` checks timing
at every throw strength, move descriptions and migrated capture totals.

## Sound cues

`sounds.js` plays recorded hop, whoosh, squish and swish cues through the shared
`engine/fx.js` AudioContext, voice budget and master volume. The Ludo asset ZIP
contains the recordings; `public/audio/CREDITS.md` records source licenses.
Fetch and decode are asynchronous; late loads never replay an old action.
Hidden pages, mute and teardown stop live samples. The scene triggers the result chime
only when the die settles, steps on path crossings, and capture/home/victory
on the moving pawn landing. Studio tricks have individual opening cues.
There are no delayed JavaScript audio timers; hidden pages skip new cues.
Shake cadence uses elapsed time, not frame counts. Initial snapshots and
repeated room renders do not replay landing celebrations.

## Extra Studio moments

The eleven `moment-events.js` entries complement the ten camino tricks.
`moments.js` derives intro/suspense/no-moves/podium from state transitions,
and safe/shared-square/near-miss reactions from real landings. Idle human turns
can sleep after 18 seconds. `moment-visual.js` samples reversible visual offsets;
the controller restores poses before both state updates and ordinary animation.
A same-color stack raises a decorative wall (Bloqueo); it never rejects a legal
move or bounces an opponent to another logical cell. Leap crosses a real occupied
path cell; sprint is selected on entering the private home lane. Both use the
same legal path and endpoint. The podium uses `ranking`, appears after the final
landing and gives way to results after 2.6 seconds of elapsed time, so low FPS
does not stretch the ceremony. Rematches remove its props.
Initial/late-join snapshots do not replay the introduction or winning ceremony.
All eleven have Studio catalog previews; all twenty-one have shared-volume cues.

The match browser suite uses `tests/browser-kit.js` `launch`: its background
timer flags are necessary for the hidden host to advance multiplayer turns.
Its opening seed is fixed to avoid an accidental tie extending unrelated checks.

Turn pacing stores `turnPause` (actor, kind, remaining seconds) in snapshots.
Rules resolve the next logical seat immediately; `presentedState` keeps the HUD
and scene on the actor until the host clears the pause. Network actions and
bots respect that lock, including missed rolls and third-six forfeits. Move
pauses cover the longest trick or capture return plus a landing beat. Pawn
motions use elapsed wall time, like the die, to finish consistently at low FPS.
Manual browser fixtures must clear `turnPause` when replacing a position.

The local turn cue is a 3.2-second real spotlight centered on the four fixed
yard cells, not the average position of travelling pawns. It retains 40% of
the scene lighting under a soft local pool, fades back to the original
intensities, and never runs for
an opponent or the scene's first snapshot. Live turn rings are suppressed;
Studio still exposes the authored turn reaction.

Yard cells are symmetric around the colored panel center (2.5, 11.5 before
rotation). The cloud caption sits above the full canopy, separately from the
raindrops and pawn faces; the live scene and Studio use the same visual.
