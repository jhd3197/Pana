# Billar

Billar is a casual two-player eight-ball table at `/g/billar/`. It also has
explicit local practice: one player pockets all fourteen colored balls before
the eight. No bots. The hub discovers its metadata and Canvas 2D preview.

## Files and rules

- `public/rules.js`: plain state, fixed-step physics, action validation, aiming
  guide and house rules. `tests/rules.test.js` checks collisions and outcomes.
- `public/network.js`: `PoolRoom extends HostRoom`. The host simulates and sends
  complete snapshots at 20 Hz during shots and on actions or member changes.
- `server/room.js`: the shared relay with `maxClients = 2`; no custom transport.
- `public/scene.js`: perspective WebGL table in the shared plaza, physical
  numbered balls, cue, first-contact guide and standing saved panas.
  `engine/models/props/pool.js` owns the Studio-registered equipment.
  `public/preview.js` keeps the lightweight Canvas 2D hub thumbnail separate.
  `game.js` wires the shared menu, input, roster and results.
- `public/portraits.js`: the actual saved Pana sculpt rendered to a portrait.
  The portrait is optional; the playable scene itself requires WebGL/Three.js.

The first legal colored pot assigns solids/stripes, including on the break.
A legal own-group pot retains the turn. A scratch, no contact, wrong first
contact or neither a pot nor a cushion after contact grants the other player
ball in hand anywhere unobstructed. Potted object balls stay down after fouls.
Potting the eight before clearing the group, or with a scratch, loses. The
group must already be clear when the shot starts. No called pocket is required.
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

Game slots are separate from never-reused room seat IDs. A departing player
leaves their group and turn in place; a newcomer inherits that free table slot.
A shot already rolling finishes, but further shots wait for both players.
The kit owns membership, host election, reconnection and invitations.

## Controls and proof

Point/drag to aim, choose power, then press Tirar. Arrow keys refine angle and
power; Space/Enter shoots. With ball in hand, arrows move its proposed position
and Enter confirms; mouse/touch places it directly. Narrow portrait play
rotates the table, with inverse pointer coordinates and upright ball numbers.
Solo practice pauses in the shared menu; a connected two-person match continues.
The shared settings menu offers plaza and overhead table cameras.

## 3D coordinate contract

Rules stay at 1000 × 500 units; the cloth mesh is 10 × 5 metres. Map x to
`(x - 500) / 100`, y to world Z `(y - 250) / 100`; cloth height is 1.55.
Picking intersects the plane through ball centres, at 1.66, so `screen()` and
`point()` remain exact inverses under perspective and portrait rotation.
The renderer never advances physics. Rolling texture rotation and snapshot
interpolation are cosmetic. Keep table bases below the cloth; an overlapping
wood slab can silently hide the entire felt surface.

`engine/table-world.js` shares the plaza, sky and lighting with Póquer. It fits
the actual 3D bounds to the HUD's available screen rectangle using camera view
offsets, while the canvas fills the viewport. Do not restore inset canvas padding.

Run `npm run test:browser -- billar` with `PANA_PLAYWRIGHT_PATH` set to an external
Playwright install. The browser suite uses actual independent Colyseus clients
for a full-rack break, guest shots, turn rejection, room capacity, ball in hand,
results, rematch, host departure mid-shot, late arrival and reload recovery.
Late-game shot fixtures exercise known pocket geometry through the same mouse
controls. It also checks portrait/landscape touch layout, shared pause, keyboard
input, offline fallback, saved-avatar portraits and hub discovery. Screenshots
are saved under ignored `art/billar/`.
