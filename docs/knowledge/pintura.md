# Pepazo — paintball

The player-facing name is Pepazo. Keep `/g/pintura/`, the `pintura` room type,
debug handles and stored IDs unchanged so existing links continue to work.

`/g/pintura/` is an eight-seat, server-simulated arena with team and free-for-all modes. The own Colyseus
room extends `PanaRoom`; `Arena` in `public/rules.js` also runs local practice.
The host only starts rounds. Its departure cannot interrupt simulation.

## Rules and input

- Three minutes by default or ten knockouts; ties share victory. `toughness` (Aguante, default 3)
  pepazos knock a pana out for 2.5 seconds; `paint` counts hits taken and `stains` keeps
  their colours. After 4 s without a hit one pepazo washes off every 1.5 s; respawn clears both. Spawn protection lasts 1.5 seconds and firing cancels it.
- La Chispa starts with twelve paintballs, a 0.25-second firing interval and
  1.3-second reload. Every marker has its own magazine, cadence, spread and
  reload in `armory-data.js`. Empty magazines reload automatically. Server ticks
  are 50 ms.
- Movement is normalized and clamped server-side. Input expires after 350 ms,
  so a backgrounded or disconnected browser does not keep running or firing.
- Projectile travel uses segment/AABB and segment/circle intersections. At
  34 units/second, testing only projectile endpoints misses thin cover.
- All collision cover comes from `coverFor(mapId)`; scene geometry reads the
  same bounds. Courts are 54 m (`SIZE` 27): each map's cover is spread 1.5×
  from the centre (boxes 1.15× larger) plus an eight-piece outer `RING`.
  `sizeFor(mapId)` gives each court's half-width; Muelle uses 32. A rules test
  keeps ≥2.2 m between all cover, room around every spawn and one connected court.
- A solo player starts with three bots; friends play without bots when two or
  more humans start the round. Live friends can join mid-round;
  when eight active slots are filled a joining friend replaces one bot.
- Touch steering uses `engine/touch.js`. Holding Pinta aims at the nearest
  visible opponent, excluding cover-obstructed and shielded opponents.

## Knockout events and layouts

`Arena.events` (last 12, numbered by `eventSerial`) carries `hit`/`out` with
owner, victim, rounded distance, the owner's knockout `streak` and `revenge`
(knocking out your last killer). Clients announce only numbers above the last
one seen; local practice starts a new count, so `game.js` resets on
`room.local` changes. Ball ids drive the shot sounds the same way.
Callouts: ≥25 m Tiro largo, ≤4 m A quemarropa, streaks 2–5+, Venganza.
`sounds.js` synthesizes them on the shared `sound` context (no files).

Each map has `VARIANTS` (3) fixed layouts; `start()` sets `variant` to
`(round - 1) % 3`, so the lobby and first round always use layout 0. Shared
maps: 0 spread, 1 rotated a quarter (spawns and ring are symmetric), 2 adds
2.6 m crate stacks from `FILL` wherever they keep 2.4 m passages and room around
spawns. Muelle hand-writes `STACK_SETS`. Everything reading cover passes the
variant (`coverFor`, `blocked`, scene, minimap, touch assist); the scene rebuilds
cover only when map or variant changes. A rules test checks all fifteen layouts.

## Rendering and proof

The court uses real shared pueblo houses, church, market stalls, benches,
streetlights, araguaneyes, mango trees and crate geometry. Crates are fitted to
the authoritative `COVER` bounds, so artwork never changes movement or shots.
The paint marker is a canonical Studio asset in `engine/models/props/paintball.js`.

Look input is `engine/play/first-person.js` (`createLookControls`), shared with Escondidas: it owns pointer lock, drag-to-look and the saved sensitivity (`pana:look-sensitivity`); the scene keeps yaw/pitch. Shift sprints 45% faster while `stamina` lasts (3 s, refills in 5 s) and holds fire; Tab shows the round table.

The default camera is first person (`primera`): the camera sits at eye height
(1.55 m) over the smoothed avatar, the own avatar is hidden, and the marker is a
camera child that kicks on each shot and pulls back when cover is in front.
Shots stay level: the server only receives `world.forward()` as the aim, so
pitch is cosmetic and clamped. WASD is yaw-relative (`world.movement`); Q/E turn.
The mouse uses pointer lock. Esc releases the lock before the page sees the
key, so a lock lost during play opens the shared menu; opening the menu or the
results screen releases it. Without a lock (refused, headless, touch) a drag on
the canvas looks around. Touch Pinta aims at the visible rival closest to the
crosshair within 20° and 40 m. After a respawn and at round start the view
turns to face the court centre. The menu's "Ver la cancha" overview keeps
world-axis keys and plane-projected mouse aim at the same 1.1 m height as
`screen()`; keep those equal. Splats from balls stopped by cover are placed
vertically on that face. `minimap.js` draws the HUD map (cover, team, and
rivals with a clear line of sight); it is a 2D overlay, not scene drawing.

The scene uses the saved shared pana sculpt, including its Three.js addons
import-map entry. `bindRenderer` sets full-window inline canvas dimensions;
reset the CSS size before reading layout so phone rotation resizes correctly.

`npm run test:browser -- pintura` uses real sessions for movement, shooting,
hit agreement, respawn, host departure, late join, natural round end, rematch,
local pause and touch layouts. Screenshots are ignored under the game's `qa/`.
`tests/rules.test.js` covers collisions, ammo, respawns, bots and win conditions.
`engine/tests/table-games.browser.js` also checks all three new 3D scenes, camera
picking, Q/E turning, touch layouts and the actual Studio model constructors.

## Muelle de La Guaira

Pepazo-only map (`PAINT_ARENAS` in `engine/worlds/arena-layouts.js`; never in `ARENAS`,
so hunt and table games don't list it; the picker takes `{ paint: true }`).
`public/muelle-layout.js` is renderer-free: container `STACKS` (1–3 high,
12.2 or 6.1 m), the crane's two court-side legs and three street stalls become
`MUELLE_COVER`. `public/muelle.js` builds the scenery from Studio factories only:
shipping containers, port crane, cargo ship, warehouse, bollards, colonial
houses, market stalls, street lamps and palms. Factory materials are cloned
before baking, as in the shared arenas. The sea and quay are at −Z; the colonial
street at +Z.

## Cancha de Noche

Pepazo-only night field (`noche` in `PAINT_ARENAS`, never in `ARENAS`). Same
pattern as Muelle: `public/noche-layout.js` is renderer-free and holds
`NOCHE_COVERS` (three variants: Torre, Inflables, Tubos), `NOCHE_SPAWNS` and
the floodlight `MASTS`. Each cover row carries a `kind` (pallet, can, dorito,
snake, brick, tube, tower) so `public/noche.js` picks the bunker model, fitted
to the row's box. Bunkers, masts and LED rope are Studio models in
`engine/models/props/glow-paintball.js` (pack `glow-paintball`); the tower is the
shared `watchtower`, the trees beyond the net are `deadTree`.

Lighting is per map: an environment may return `lighting` (see `NIGHT` in
`noche.js`) and `scene.js` `light()` applies it, or `DAY` when it has none:
background, fog, hemisphere, sun, exposure, sky visibility and `glow`. With
`glow` on, balls are unlit with an additive halo, new splats are emissive, and
a forward spotlight on the camera works as a headlamp. Splat materials are
cached per glow state, so switching maps never reuses a lit one in the dark.
The map holds six spotlights and one point light under the tower; keep the
count low, every lit material pays for each one.

## Look

The plaza court (fence, paving, bunting and pueblo spread with `SIZE`/`SPREAD`) follows the paint-battle brand board: `engine/worlds/look.js`
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

Puerto Coco, Hato del Sol, Ruinas del Mango, Muelle de La Guaira and Cancha de Noche are available in the lobby.
The host chooses the setting; the selected map follows snapshots, practice,
late joins and host changes. See [shared-arenas.md](shared-arenas.md) for
layout variants, collision, table clearance, lifecycle and verification.


## Room options and team play

The shared lobby offers free-for-all or two alternating-seat teams, three/five
minutes, one/three/unlimited lives, sticky paint, permitted markers, friendly
fire, faster reloads and capture-the-flag. Eight seats remain available. Teams
share a color and score. A finite-life player stays out after the last hit;
the surviving player/team wins even if its hit count is lower. Disconnecting
alone does not end an otherwise live round. The server alone validates settings
and accepts them only outside a running round.

Pistols fire every 0.25 seconds; the automatic marker every 0.13 seconds; the
scatter marker sends three shorter-range balls every 0.75 seconds. Keyboard
1/2/3 or the shared pause menu selects the marker; pistol-only rooms override
that input. Fast reload is 0.55 seconds instead of 1.3. Sticky paint slows the
victim for seven seconds including the respawn wait. Friendly hits can consume
a life when enabled but never award points.

Flag mode uses two teams even when the ordinary mode is free-for-all. Pick up
the rival flag by touching it, then return to your base while your own flag is
home. Touching a dropped friendly flag returns it; getting painted drops a
carried flag. Three captures win, or the clock/finite-life victory ends the
round. Flags and team scores are authoritative snapshot data and have 3D meshes.

Team and flag lobbies show the shared avatar roster, with four orange and four turquoise positions. Stable `player.seat` positions are separate from network IDs; team is seat parity. Any connected pana can move their own card, including swapping an occupied position; only the host can arrange other players. The server rejects live-round moves and preserves choices through start, rematch and host departure. With multiple humans, both teams need a player before starting; solo practice still fills bots. Reconnecting into a full arena cannot duplicate another player's position.

## Armory and composed combat kits

`armory-data.js` is the shared, pure source for four markers, two attachment
slots, one armor slot, three grenades and cosmetics. `cleanKit` allowlists all
IDs and deduplicates at most two attachments. `kitStats` composes real tradeoffs
and still honors pistol-only, fast-reload and room toughness options.

The server accepts `kit` only for the sender's seat before a round; clients
cannot change armor/grenades mid-round. Weapon keys retain the existing weapon
switch behavior, with reload debt and no refill of limited rocket reserve.
Rocket splash and grenade blasts apply at most one hit per victim and respect
cover, teams and spawn protection. Respawn restores one grenade. Sticky pools
expire and slow opponents; Chispita bounces before its fuse expires.

`armory.js` previews the actual marker and own pana, with hover comparisons for
range, spread, cadence, capacity, reload, mobility and toughness. Its Probar
range runs an independent `Arena` against a target, using the same rules as the
server. It never spends ammo or emits shots into the multiplayer room.
`paintball-kit.js` supplies the four visible marker meshes, cosmetic finishes,
attachments and padded vest to both preview and gameplay. Studio registers
those same models. Paint pattern changes are cosmetic and never change hits.

The two-client browser proof picks a guest kit, verifies the host receives it,
checks the attachment cap and grenade consumption, rejects a mid-round armor
change, then proves real shooting, respawn, host departure and rematch. Mobile
controls put reload and grenade beside a tall fire button without overflowing.

## Calculated kit nivel

`kitRating` in `armory-data.js` reads `kitStats` with current room options.
It returns 100 + 700 times a weighted sum of bounded 0–1 components: range
15%, precision 10%, sustained pellet rate including reload 20%, magazine plus
reserve 10%, reload speed 10%, mobility 15%, toughness 15%, weapon spread-area
coverage 2.5% and grenade radius per fuse second 2.5%. It is a build summary,
not a player rank or combat modifier; special utility such as sticky pools is
still explained on the grenade card rather than presented as extra damage.

The sala and armory show the same integer with shared D/C/B/A/S display bands
from `engine/kit-rating.js`. Hover previews the candidate rating; changed room
rules refresh an open armory. Finishes, charms and patterns do not affect it.
Unit tests cover bounds, cosmetics, attachments, armor, grenades and rule
overrides; the two-client sala test checks that a guest's changed rating reaches
the host and matches the armory.

## Directional knockout physics

Hit metadata comes from the authoritative projectile velocity, or from the blast
centre to the victim, and is replicated as `impact`. Pepazo still shoots level:
all hits are body hits, with no cosmetic headshot damage bonus. `knockout.js`
drives the own sculpt's body, neck, arm and skinned leg pivots from the pure
`KnockoutPhysics` distance-constraint solver. It uses 120 Hz steps, bounded
catch-up, floor and cover collision, and restores captured transforms on respawn.
No bones are reparented and no replacement humanoid or physics dependency is
loaded. Rest-world rotations preserve facing. Paint blobs attach to the torso
and must detach before character disposal because their geometry and materials
are shared across players. Markers and rings hide during the fall. Knockout simulation is cosmetic;
server positions, scoring and respawn remain authoritative.

The Cla-Go Verlet constraint approach is adapted under MIT (see
`docs/licenses/cla-go.txt`). Its procedural humanoid is deliberately not used:
the shared Studio sculpt preserves player appearance. Tests compare 30/60/120 Hz,
cover collision, real sculpt hierarchy and restoration, and two-client impacts.
