# Billar

Billar is a casual eight/nine-ball table for two balanced teams of one to three
players at `/g/billar/`. It also has
explicit local practice: one player pockets all fourteen colored balls before
the eight, and a local match against Pana Bot (`createGame(false, { bot: true })`). The hub discovers its metadata and Canvas 2D preview.

## Files and rules

- `public/rules.js`: plain state, fixed-step physics, action validation, aiming
  guide and house rules. `tests/rules.test.js` checks collisions and outcomes.
- `public/network.js`: `PoolRoom extends HostRoom`. The host simulates and sends
  complete snapshots at 20 Hz during shots and on actions or member changes.
- `server/room.js`: the shared relay; `game.json` sets its six-player cap.
- `public/scene.js`: perspective WebGL table in the shared plaza, physical
  numbered balls, cue, first-contact guide and standing saved panas.
  `engine/models/props/pool.js` owns the Studio-registered equipment.
  `public/preview.js` keeps the lightweight Canvas 2D hub thumbnail separate.
  `game.js` wires the shared menu, input, roster and results.
- `public/portraits.js`: the actual saved Pana sculpt rendered to a portrait.
  The portrait is optional; the playable scene itself requires WebGL/Three.js.

The first legal colored pot assigns solids/stripes, including on the break.
A legal own-group pot retains the team's turn, with the next teammate shooting.
A scratch, no contact, wrong first
contact or neither a pot nor a cushion after contact grants the other player
ball in hand anywhere unobstructed. Potted object balls stay down after fouls.
Potting the eight before clearing the group, or with a scratch, loses. The
group must already be clear when the shot starts. Called pockets are optional.
An eight potted on the opening break is respotted. These are the displayed
house rules, not a claim to implement tournament rules.

## Physics and network traps

The cloth is 1000 by 500 units, balls have radius 11, pocket capture radius is
25. Integration uses **1/240 s** steps: at the maximum shot speed a ball moves
less than a radius per step, avoiding tunneling through the rack. Cushion
restitution is .84; equal-mass contact restitution is .96; rolling deceleration
is 205 units/s². The renderer never advances the authoritative simulation.

Each rolling snapshot contains velocities and the full shot ledger: first
contact, post-contact cushion, potted IDs, eight eligibility at shot start and
elapsed time. Omitting that ledger would make handoff misjudge the shot. The
new host copies the latest snapshot and completes it. A small visual rollback
of up to one snapshot is possible on sudden disconnect. Guests interpolate
positions for display only. Gameplay revisions change on actions/outcomes,
not on every physics snapshot, so duplicate or stale shots cannot fire twice.

Game slots are separate from never-reused room seat IDs. Even slots share one
team, odd slots the other. Starting freezes `activeSeats`; a late arrival in an
unused slot watches until the next match, while replacing a departed active
slot resumes that role. A shot already rolling finishes, but further shots
wait for all active players. `teamTurns` advances each team's shooter after
every shot, including a legal pot. The host can rearrange seats in the lobby.
The kit owns membership, host election, reconnection and invitations.

## Room options

`match-rules.js` declares typed room choices and pure team/match helpers.
`room-options.js` displays primary choices and the shared advanced dialog.
The host's validated options persist through practice, rematches and migration.
`reset-options` restores rules, Plaza, normal difficulty and the rack in one
host-authorized lobby revision, preserving all player seats.
Eight-ball remains the default. Nine-ball racks only 1–9, requires the lowest
live ball first, allows a legal combination into 9 to win, and respots a nine
potted with a foul or into an uncalled pocket. Physical ball arrays remain 16
entries so renderers and snapshots retain stable IDs.

Called-pocket mode numbers all six physical pockets with camera-facing markers.
Only a pot in the called pocket retains the team turn; a wrong-pocket eight
loses. Kitchen fouls restrict placement to x <= 250 and require the cue to cross
that boundary before its first object contact. The scene highlights that area.
These are explicit house rules rather than tournament rule claims.

Best-of 1/3/5 tracks team rack scores, with alternating/winner/loser break policy
between racks. The 30/60-second clock includes placement time and pauses when
an active player is absent; expiration passes to the next team with ball in
hand. Clock snapshots do not increment the gameplay revision, so normal clock
updates cannot cancel a held shot. Café adds the shared café terrace setting;
long/short/no guide overrides the difficulty-driven guide without changing bots.

## Controls and proof

Point/drag to aim, then hold the shot button or Space/Enter. The power meter
appears only while held: it rises from 5% to 100% in one second, falls over the
next second and repeats. Release shoots at the current strength; the red top
marks strong shots. `engine/play/shot-charge.js` (shared with Bolas Criollas) samples elapsed time, including at release,
so frame rate does not change the timing. Aiming and spin lock while charging.
Blur, hidden tabs, pointer cancellation, menu opening and changed gameplay
revisions cancel without firing. Shared `holdButton` also calls `up` on lost
capture and programmatic release: only an actual `pointerup` may shoot.
Left/right refine angle; up/down no longer select power.
With ball in hand, arrows move its proposed position
and Enter confirms; mouse/touch places it directly. Narrow portrait play
rotates the table, with inverse pointer coordinates and upright ball numbers.
Solo practice pauses in the shared menu; connected multiplayer continues.
The shared settings menu offers plaza and overhead table cameras.

## Difficulty, guide and Pana Bot

`engine/play/difficulty.js` is the one knob shared with Bolas Criollas: Fácil,
Normal, Difícil, Experto. `state.difficulty` travels in snapshots. Online the
host sets it in the lobby (or between games); a local table (practice or bot)
accepts it any time from the menu. Each level's `guide` sets how much of the
predicted shot the scene draws and `aimError` sets the bot's aim noise.

`predictShot()` in rules.js uses the physics constants (friction, cushion
restitution on the normal component only, contact restitution, follow factor)
so the drawn object-ball path ends within a ball width of the simulated one
for an unobstructed shot (tested). It ignores secondary collisions. Do not
damp the whole speed at a cushion in the trace: step() damps only the
component into the rail, and the prediction drifts by hundreds of units.

Spin is an optional `{ x, y }` in [-1, 1] on the shoot action. Follow/draw adds
`spin.y × .62 × contact impulse` along the shot direction at the cue ball's
first contact; side english rotates the cue ball's next two cushion rebounds
by `spin.x × .22` rad. The shot ledger carries both, so a mid-shot handoff
finishes the same way.

Pana Bot (seat 1, id `bot`) plays on the host in `PoolRoom.step` through
`botReady`: ball in hand is its own visible step (`botPlacement`), then
`botShot` picks the clear ghost-ball shot with the least cut and the shortest
travel, sizing power from friction. Breaks aim at the apex at full power. With
no clear pot it rolls firmly into the nearest legal ball. Over four seeded
matches an Experto bot clears the table in fewer shots than a Fácil one.

## Camera

`taco` (default) rides behind the cue ball and turns with the aim; between
shots it rises to a high view down the same line, and ball in hand looks
straight down. Because the view moves with the cue, a drag turns the cue
(.004 rad/px, Shift for fine) and a tap aims at the tapped spot; hover never
aims. The picture is lifted above the bottom HUD with a view offset. `mesa`
and `plaza` are the original framed views. The choice is remembered in
`localStorage['pana:billar:view']`. Browser checks that aim by clicking a
projected cloth point set that key to `plaza`; a separate section proves the
taco camera, drag aiming, guides per difficulty, spin and bot turns.
Standing panas wait off the table corners, and a pana within 1.8 m of the
camera hides so it never fills the screen.

## 3D coordinate contract

Rules stay at 1000 × 500 units; the cloth mesh is 10 × 5 metres. Map x to
`(x - 500) / 100`, y to world Z `(y - 250) / 100`; cloth height is 1.55.
Picking intersects the plane through ball centres, at 1.66, so `screen()` and
`point()` remain exact inverses under perspective and portrait rotation.
The renderer never advances physics. Rolling texture rotation and snapshot
interpolation are cosmetic. Keep table bases below the cloth; an overlapping
wood slab can silently hide the entire felt surface.

`engine/worlds/table-world.js` shares the plaza, sky and lighting with Póquer. It fits
the actual 3D bounds to the HUD's available screen rectangle using camera view
offsets, while the canvas fills the viewport. Do not restore inset canvas padding.

Run `npm run test:browser -- billar` with the repo's Playwright dev dependency.
The browser suite uses actual independent Colyseus clients
for a full-rack break, guest shots, turn rejection, room capacity, ball in hand,
results, rematch, host departure mid-shot, late arrival and reload recovery.
Late-game shot fixtures exercise known pocket geometry through the same mouse
controls. It also checks portrait/landscape touch layout, shared pause, keyboard
input, charge cycles and interruption without firing, offline fallback,
saved-avatar portraits and hub discovery. Screenshots
are saved under ignored `art/billar/`.

## Shared map selection

Puerto Coco, Hato del Sol and Ruinas del Mango are available in the lobby.
The host chooses the setting; the selected map follows snapshots, practice,
late joins and host changes. See [shared-arenas.md](shared-arenas.md) for
layout variants, collision, table clearance, lifecycle and verification.


The shared avatar-card roster groups the six seats into alternating teams.
Guests use Cambiar/Unirme aquí to swap or move themselves before the break;
the host may select any occupied card and then a destination. `swap` rejects
unrelated guest rearrangements and all moves after the lobby. Player IDs stay
stable, so moving between teams does not change room ownership or identity.

## Banderín HUD

The supplied Billar HUD skin uses the existing portraits, turn ownership,
ball tracks, spin control and charging meter. The bottom instruction/action
strip has independent columns so a long turn message cannot squeeze into a
one-word column. Small landscape screens retain the existing side-mounted
shoot controls. The opt-in shared Banderín CSS expands results and styles
shared lobby controls without replacing the room or menu implementation.

The shot strip has one charging hint and a short Tirar/Soltar action label.
Below 800px it stacks status and controls; desktop gives the action a fixed
250px column so the status cannot collapse into a one-word column. Keep the
optional called-pocket and shot-clock rows spanning both columns.
