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
- Spawns (`public/spawn-picker.js`). Free-for-all round start uses `spreadSpawns`: an
  exact search over the court's spawns (8, El Puerto 14) keeps every pair at least
  `MIN_SPAWN_GAP` (20 m) apart, drawing among sets within 6 m of the widest spread.
  Every court reaches 20 m for 2-8 panas (El Puerto at least 22.4 m); should a
  court fall short, it takes the widest set (`fallback`) and people get the most
  isolated spots before bots. `tests/spawn-picker.test.js` asserts the empty
  fallback table and brute-forces the widest spread of every court.
  The lobby parks panas on the same spread; a late arrival lands like a respawn.
  `arena.spawnReport` holds `{ arena, count, minGap, fallback }`; `PANA_LOG_SPAWNS=1`
  prints it once per round. Free-for-all respawns use `pickRespawn`: 20 m from the
  nearest living rival when a spawn allows it (else the farthest), within 6 m of the
  farthest, out of sight only as a tie-break, never the last spawn. Team and flag
  rounds keep `pickSpawn` on their own half (even indices team 0).
- La Chispa starts with twelve paintballs, a 0.25-second firing interval and
  1.3-second reload. Every marker has its own magazine, cadence, spread and
  reload in `armory-data.js`. Empty magazines reload automatically. Server ticks
  are 50 ms.
- Movement is normalized and clamped server-side. Input expires after 350 ms,
  so a backgrounded or disconnected browser does not keep running or firing.
- Projectile travel uses segment/AABB and segment/circle intersections. At
  34 units/second, testing only projectile endpoints misses thin cover.
- Level shots fly at `SHOT_HEIGHT` (1.1 m, where the scene draws the ball) and
  pass over cover whose `h` is at or under it: El Puerto's sandbags, ammo piles
  and barrels, Noche's snakes. Sweeping every box as infinitely tall made those
  invisible walls: a rival seen over a sandbag could not be hit, and bots never
  fired at one. Bot line of sight and splat placement use `shotCover(cover)`.
- Collision debug: `?debugCollision=1` or F9 draws every collider of the court
  (red flagged, yellow lets shots pass, grey invisible on purpose), logs a table
  and Shift+F9 saves the JSON. `npm run collision-report` audits every court and
  variant headless into `Pana/reports/collision/`. Colliders come from
  `colliders.js` (`collidersFor`, `COLLISION_ALLOW` for blockers unseen on
  purpose, only the court edge today). `scene.draw` calls `setMap(state.mapId)`
  every frame, so anything that stands another court must measure it before the
  next frame (the debug `audit` retries until the asked court stands).
- Collision fixes: `npm run collision-report -- <arena> --fix` writes each
  proposed fix into `public/collision-fixes.js`, keyed `map:variant:index` on
  the raw layout row with the `from` box it was measured on; `coverFor` applies
  them (a changed row skips its fix and gets flagged again). Rows keep `ref`,
  so split pieces read `terminal:0:37.0`. `collision.browser.js` audits every
  court and variant and fails on any flagged collider; an intentional unseen
  blocker goes in `COLLISION_ALLOW` (`colliders.js`) with a comment. First
  run: El Puerto's four barrel groups (3 x 2.6 m boxes, drums filling 25%) now
  collide drum by drum, and the drums are mirrored between the bases.
- All collision cover comes from `coverFor(mapId)`; scene geometry reads the
  same bounds. Courts are 54 m (`SIZE` 27): each map's cover is spread 1.5×
  from the centre (boxes 1.15× larger) plus an eight-piece outer `RING`.
  `sizeFor(mapId)` gives each court's half-width; Muelle uses 32. A rules test
  keeps ≥2.2 m between all cover, room around every spawn and one connected court.
- The `bots` room option (Más ajustes: Auto / 0 / 1 / 2 / 3 / 5 / 7) sets how
  many bots a round seats. Auto is the classic rule: three for a pana alone,
  none when two or more humans start. A number is capped by the free seats
  (`botCount`, `SEATS` 8), so 7 means "fill the court". `Arena.seatBots(make)`
  runs at every start, on the server and in practice alike: old bots leave, new
  ones take the smaller team's lowest free seat in team and flag rounds, so one
  bot fixes a one-sided team start. A refused start leaves no bots in the lobby.
  Live friends can join mid-round; when eight active slots are filled a joining
  friend replaces one bot.
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
Every part of a pana (body, outfit, hat, vest, third-person marker, ring,
stains, knockout pose) lives under `avatar.group`, so hiding that one group in
`draw` hides the whole own body; keep new avatar parts under it. The browser
suite asserts no own-body mesh renders in first person and the rival still
sees it. A staged shot that puts the pana within about 1.5 m of a crate stack
shows the crate's wood and coral band at the right screen edge: that is cover,
not the own body (the plaza stack at x -11, z 21.5 sits next to x -14, z 22).
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

### First-load budget

The first load is capped at 161 modules (`npm run budget -- pintura`). The
shared courts (Puerto, Hato, Ruinas) are built by `engine/worlds/arenas.js`,
about 28 modules (its props, vegetation, water and ambient life) that El
Puerto, Plaza, Muelle and Noche never use, so `scene.js` loads it with
`import()` the first time one of those courts is picked; the lobby picker
fires that load as soon as the host chooses one. `world.setMap` returns a
promise that resolves once the court is built, and `prepareRound` awaits it
before `compileAsync` and `room.ready`, so the loading card covers the fetch
and nobody starts on an empty court. Until it lands the lobby shows sky and
avatars only. A failed fetch resolves anyway and retries on the next pick.
This took the first load from 161 to 133 modules (1456 to 1029 KB). The next
candidate is the armory's 3D preview and test range (`armory.js` `init`,
`rebuild`, the range), which only matter once the armory opens; the kit state
`armory.js` holds is needed at boot, so it would have to be split first.

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

## El Puerto

Pepazo-only base-to-base map (`terminal` in `PAINT_ARENAS`, player name El
Puerto; `puerto` is already Puerto Coco). It is the only rectangular court:
`boundsFor(id)` gives `{ x, z }` half-extents (58 × 32 here, square elsewhere)
and every fence test in `rules.js` goes through it; `sizeFor` is the larger
one, for whatever frames the whole court. Even spawns are the west (orange)
half, odd the east, so team seats and the two flag homes land in their own
base. The first eight are each base's four pads, only 6 m apart, so a third
free-for-all pana used to share a base: six more pads follow in pairs mirrored
through the centre (back corners at (∓55, ∓27) and (∓55, ±27), forward pads at
(∓34, ∓12)), clear of every yard at 2 m and 12 m off domination zone A/C.
Team and flag rounds may respawn on them too, always in their own half; the
search for 8 panas over 14 spawns tries 3432 sets, about 8 ms per round start. `public/terminal-layout.js` lists only the west half of each yard
(Pasillos, Fortaleza, Laberinto) and mirrors it, so both teams always get the
same map. Container sizes match the library `shippingContainer` (2.65 m per
level, box = length + .3), so models and collision agree. Base barrels and
ammo piles join a yard only where they keep the 2.4 m passages.

The owner's prototype also had a playable second floor (container roofs,
catwalks, the shed's mezzanine) and cranes that move containers between
rounds. Pepazo simulates a flat court, so towers are just taller cover and
the mezzanine is overhead scenery with no stairs.

`public/terminal.js` returns `lighting: { fog, far }`: `scene.js` merges a
map's partial lighting over `DAY`, and `far` sets the camera's far plane so
the other base stays visible 104 m away. The quay sits at z = 80, well south
of the fence: at z = 48 the "Ver la cancha" camera flew through the
ship-to-shore crane booms. On a court wider than it is deep, the overview
follows the pana at 0.8× instead of 0.4×.

Bots out of sight of a rival more than 12 m away walk a 1 m navigation grid
(`navGrid`, cached per map and layout) along a breadth-first distance field
from the target, refreshed at most twice a second (`Arena.route`). Flag
bots use the same route. Without it a bot circles in its own base forever on
this court; the rules test proves a lone bot reaches an idle pana within 30 s
on every layout.

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

## HUD, viewmodel and sound

- `hud-model.js` is the pure arithmetic (race rows, the 12-ball pepas row, low
  ammo, the angle a hit came from, the clock) and is unit tested in Node, so it
  imports nothing but `locKey`. `combat-hud.js` draws it into the `#hud` ids
  that `game.js` already reads; `hud-banderin.css` is the look (Banderín:
  night chips and yellow plates skewed 10deg with hard ink shadows, sized from
  `--u`, 1px of a 1600x900 screen). `minimap.js` is a round map in the same style.
- The one knockout line lives in the killfeed (yours in yellow, the one that took
  you out with a coral bar), so `combat.duplicate()` keeps the bottom pill quiet
  for those two messages. Team scores are in the race row, not the pill.
- Under the pepas the hopper plate shows the marker's name and class kind
  (`La Metra · Subfusiles`) and one icon per fitted part (`kitBarrel`,
  `kitHopper`, `kitStock`, `kitOptic` in `engine/icons.js`; the Mira's title
  names its kind).
- `viewmodel.js` poses the first-person marker (sway, recoil, reload, sprint
  lowering) from the player fields; the marker models are in
  `engine/models/props/paintball-kit.js`, one silhouette per marker. Aiming
  slides a side-mounted Mira (`userData.sightX`: El Zamuro, La Bazuca, La
  Fumigadora) to the centre, and `userData.spin` (La Licuadora's barrels, the
  revolvers' cylinders) turns on every shot. `RECOIL` has rows for the markers
  that need their own kick; the rest kick like their class (`CLASS_RECOIL`).
- Sound goes through the shared library (`engine/sfx.js`) via the `sounds.js`
  facade; steps come from `engine/play/footsteps.js`. See `shared-sfx.md` and
  `shared-player.md`. The six first markers plus La China and La Fumigadora
  have their own shot; the rest sound like their class (`shotKind`: pistolas
  `pistol`, subfusiles and fusiles `smg`, ametralladoras `minigun`, escopetas
  `shotgun`, francotiradores `sniper`, lanzadores `launcher`), and reloads go
  the same way (`reloadKind`: hopper, magazine, pump, bolt, tube).

## Spectating while out

Out in first person (the 2.5 s respawn wait or out of lives), the camera stays
where you fell and turns to whoever painted you for 1.6 s (`KILLCAM` in
`spectate-hud.js`), then follows a living pana from behind; Q / E, ← / → or a
controller's LB / RB switch pana, Space or A shows the whole court from above.
The overview camera (`Ver la cancha`) never spectates: it already shows the court.

- Who may be watched comes only from synced state. In team rounds it is your own
  team; rivals only once no teammate is standing. Nothing new goes to the room:
  inputs keep their shape (`spectator.browser.js` checks it).
- A controller arrives as the keys `engine/gamepad.js` types (LB is Shift, RB is
  G, A is Space). Those events are untrusted, which is how the spectator tells
  RB from a keyboard G. `ui.css` hides every `kbd` on controller and touch, so
  the bar's key chips are `<b>`.
- The follow camera clips against `cameraBounds` (the boxes that pull the marker
  in) but skips a box the head stands inside, or a tree's canopy would put the
  camera in the pana's head. A second clip after the easing stops a switch
  between panas from cutting through cover.
- `#hud .respawn` (hud-banderin.css) wins over a plain `.respawn` rule: the
  spectating style for it needs `body.spectating #hud .respawn`.

## La Lejana, La Bazuca and gun feel

- Markers carry `damage` (pepazos per hit, default 1). La Lejana's body hits
  fade with the distance the ball flew from where it was fired (`falloff` in
  `armory-data.js`, `rangedDamage` on the shared `engine/play/weapon-falloff.js`): 3 pepazos up to 10 m, linear down to 1 at
  50 m and beyond, rounded (2 at 30 m). One close hit knocks out at Aguante 3,
  two at Aguante 5. Its `damage: 2` is only the armory's pace number.
- La Lejana (`headshot`) knocks out with one head hit at any range. The shot is
  a ray from the eye (`EYE` 1.55 m plus the shooter's jump) at the input's
  pitch; where the flat sweep meets the victim it is a head hit at `HEAD_Y`
  1.4 m or higher (plus the victim's jump), else body. Only inputs with a real
  pitch (`look`, first person; other views send `pitch: null`) can reach a head.
  Bots holding it pitch at the chest (`CHEST_Y` 1.1 m), so theirs are body hits.
  `Arena.hit(victim, owner, color, impact, damage)` clamps paint at the
  victim's toughness; La Bazuca's `direct` rocket passes `Infinity`.
- Aim is an input flag (`aim`, right mouse, F, LT, or the Mira toggle on
  phones). The server honours it when `kitStats().aims`: a marker with its own
  `scope` (La Lejana, El Zamuro) or any marker wearing a Mira. Then the shot uses
  `aimSpread` instead of the hip `spread`, the walk halves and sprint is off.
  Clients zoom with `engine/play/scope.js` to `kitStats().zoom` (3.5× La Lejana,
  4.55× with its long-range Mira, 2.2× El Zamuro, the Mira's zoom, else 1.2×),
  slow the look by the zoom and by the Mira's `sens` (`world.sensitivity()`),
  and hide the held marker past `scoped` (zoom over 1.5); the overlay is
  `createScopeOverlay`.
- La Bazuca is a ball with `rocket`, `direct` and `kind: 'bazooka'`: 14 m/s for 3 s
  (42 m), one loaded plus two spare (`reserve`), 3.8 s reload, no sprint. A
  direct hit knocks out; the 1.4 m splash then paints one pepazo on panas
  beside it. Every blast (rockets, grenades) also pushes a `booms` entry
  (0.6 s) into the view; clients turn new ids into `sfx.boom`, the blast-fx
  fireball and a distance-scaled shake. Rockets glide between snapshots along
  their velocity (at most 60 ms ahead) and leave a smoke trail.
- Reserve rockets live in `kitStats().reserve` (El Cohetón 3, La Bazuca 2; the
  hopper adds one) and are a per-life resource: a weapon switch never refills
  them (armory test). Switching to a rocket marker mid-life keeps at most the
  ball count already loaded, and nothing after firing; spawn with it from the
  armory to carry all of them.
- Feel: each marker's `RECOIL` row in `viewmodel.js` has `back/rot/decay` for
  the held model and `cam/shake` for the view (`engine/play/recoil.js`). Muzzle
  flashes sit on the barrel axis just past the muzzle of every marker
  (`userData.bore`, `userData.tip`), size per marker or class (`flashSize` in
  `scene.js`) and turn randomly per shot. Scoped markers (La Lejana, El Zamuro)
  draw a tracer from the muzzle to the first cover or pana (`traceRay`) and
  their knockouts are called `¡Francotirador!`.
- Third-person markers are `bakePaintKit` batches (a few draws each), and ball
  streaks share one material per colour: La Licuadora and La Fumigadora put
  twenty balls a second in the air.
- Bots keep the default kit; they never use the other markers. A bot given a
  melee kit (tests, `selectKit`) walks straight at the nearest rival it sees and
  swings inside the reach (`Arena.meleeBot`); with La Chancleta it also throws at
  a rival 5–22 m away in sight, pitched by `aimThrow`.

## Melee: Los del pescozón

Six close-range weapons, the `melee` class of `PAINT_CLASSES` (its chip is the
last in the armory; Z/X reach them after the markers). The mechanic is shared:
`engine/play/melee.js` (state machine, one-target `swingHit`, the throw) on
`engine/play/projectile.js`'s gravity arc (`sweepArc`, `stepArc`). Pepazo's data
is `MELEE` in `armory-data.js`; `WEAPONS` is markers plus melee, and everything
that used to look a weapon up in `MARKERS` (cleanKit, cleanInput, the HUD, the
armory, the pause menu's weapon list) reads `WEAPONS`.

| Weapon | reach m | cone ± | windup + recovery s | pepazos | extra |
|---|---|---|---|---|---|
| El Bate `bat` | 2.4 | 0.55 rad | 0.25 + 0.5 | 3 (4 past 75% of the reach) | 0.8 m shove |
| La Chancleta `sandal` | 1.8 | 0.6 | 0.15 + 0.55 | 3 | throwable |
| El Rodillo `roller` | 2.2 | 1.0 | 0.2 + 0.4 | 2 | the widest cone |
| La Brocha `brush` | 1.8 | 0.7 | 0.1 + 0.2 | 1 | the fastest |
| El Tobo `bucket` | 2.6 | 0.6 | 0.35 + 0.75 | 3 (4 past 70%) | 1.6 m shove |
| La Maraca `maraca` | 2.0 | 0.75 | 0.1 + 0.3 | 1 | slows the victim 1 s |

Mobility 1.0–1.15 (lighter than La Chispa), sprint allowed, never aims, no
ammo or reload. `kitStats` returns `melee: true`, `cadence` = windup +
recovery, `magazine` 0; `meleeInterval` is the simulated interval in whole
ticks, and `dpsOf` uses it (2.2–4 pepazos/s; `tests/melee.test.js` keeps every
weapon between 2 and 5).

- **Damage is a big stack, not a one-hit rule.** A blow lands `damage` pepazos
  at once through `Arena.hit` (the same path as La Lejana's two). At the default
  Aguante 3 the heavy three (bate, chancla, tobo) knock out in one hit, but El
  Acolchado survives one and Aguante 5 needs two; the light ones (brocha,
  maraca) chain. One rule keeps toughness, armor, the Goteo part and room
  options meaningful, where a flat one-hit kill would make all of them moot.
- **One person per swing.** The blow is decided once, when the windup ends
  (`stepMelee` says `'strike'`): the nearest rival whose body (0.55 m) comes
  within the reach, inside the cone, with no cover between. Friendly fire,
  shields and respawns follow the balls' rules (`Arena.targetsOf`). A hit pushes
  a splat under the victim and counts `p.smacks` (clients play the blow sound).
- Parts (`ATTACHMENTS` with `melee: true`; the models mount them on the grip,
  head and pommel): **Cinta de agarre** `tape` swings 20% faster and reaches 15%
  less; **Goteo de pintura** `drip` paints +1 pepazo and recovers 25% slower;
  **Correa** `strap` brings a thrown chancla back 40% sooner (1.5 s), the others
  recover 15% faster, −4% mobility. Melee weapons take only these three and
  markers only theirs (`PAINT_MOUNTS` in `engine/models/props/paint-arsenal.js`); the
  armory lists only the kind that fits.
- Switching weapon mid-swing drops the blow but keeps 0.3 s of wait; while the
  chancla is away the server ignores a weapon change (the client keeps sending
  its pick, so it applies once the chancla is back).
- Client: `viewmodel.js` `swingPose` blends rest → cocked over the windup,
  snaps through in 0.09 s and eases back over the recovery, on its own clock
  from the `melee.swings` count (no allocation per frame). Third person reuses
  the grenade arm throw. Sounds: `sounds.js` `MELEE_SOUND` maps each weapon to an
  `engine/sfx.js` material (`swing`/`smack`: bat `wood`, sandal `slap`, roller
  `squish`, brush `swish`, bucket `clang`, maraca `rattle`) and `pop` when your
  chancla is back. The hopper plate shows pepazos per blow over a swing bar
  (`#hop.melee`, `--cd` = `readiness`), the crosshair ring fills the same way.
  Knockouts are called `¡Pescozón!`, a thrown one `¡Chancletazo!`.

### La Chancleta's throw

Asked for by name: a close strike (the melee path above) plus a throw.

- **Input.** `alt` in `cleanInput` (also accepted as `throw`, real booleans
  only; pitch clamped to the look's limits). Right mouse and F are Apuntar, but a
  melee weapon never aims, so with a throwable weapon in hand they throw instead;
  V always throws. Pad: LT (it sends F) or the right stick click (`rs`, V).
  Touch: the Mira button reads "Lanzar" and throws. The throw rides three inputs
  (`throwSends`), like a grenade; the server throws on the rising edge (`altHeld`).
- **Flight.** `throwStart` from the hand (`handAt`: 1.45 m up, 0.45 m ahead, never
  through cover) at 20 m/s, elevation = pitch + 0.15, gravity 9.8: from a level
  look it lands about 18 m out and is still at chest height at 15 m. Each tick
  `stepThrown` sweeps the chord against cover (with heights: it flies over a low
  crate), the fence, the ground and panas; the first pana it meets takes the
  strike's whole stack (3, so it knocks out at Aguante 3 from any range it
  reaches; Goteo raises both). It splats where it stops.
- **Recall after cooldown, not pickup.** It is back in the hand 2.5 s after the
  throw (1.5 s with the Correa) whether it hit or not: `phase 'away'` → `'return'`
  in `stepMelee`, `p.recalls` counts it, the client pops and the HUD bar ("La
  chancla vuelve en … s") fills. No chase across the court, a fixed and fair
  cost for a miss, nothing on the floor to sync or to get lost behind the fence,
  and it works the same on every map. A respawn puts it back at once.
  `returns: 'pickup'` exists in the engine for a later weapon (stays away until
  the game calls `recall`).
- **It leaves the hand.** While away the first-person model hides
  (`world.held`), and the third-person one too; the projectile is the pana's own
  baked sandal model (`Thrown sandal` in the scene, one per thrower, reused),
  spinning end over end and gliding between snapshots.

What changed for the chancla, by file: `Pana/engine/play/melee.js` (throw and
recall state machine, `aimThrow`), `Pana/engine/play/projectile.js` (`sweepArc`,
`stepArc`), `Pana/games/pintura/public/armory-data.js` (`MELEE.sandal.throwable`,
the Correa, `throwRange`), `rules.js` (`cleanInput.alt`, `handAt`,
`Arena.throwMelee`, `flyThrown`, `thrown` in the view, the bot throw), `game.js`
(right mouse / F / V / `rs` / the Lanzar button, `throwSends`, sounds),
`scene.js` (the flying model, hiding the held one), `combat-hud.js` (the recall
bar), `armory.js` ("lanzada … m", "Vuelve en"), `tests/melee.test.js` and the
melee part of `tests/browser.mjs`.

## Notes for agents

Keep simulation in pure rules and room authorization on the server. Never add
client-controlled score/position messages. Clear held input on blur and menus.
Online matches continue through the shared menu; local practice pauses.

## Shared map selection

Puerto Coco, Hato del Sol, Ruinas del Mango, Muelle de La Guaira, Cancha de Noche and El Puerto are available in the lobby.
The host chooses the setting; the selected map follows snapshots, practice,
late joins and host changes. See [shared-arenas.md](shared-arenas.md) for
layout variants, collision, table clearance, lifecycle and verification.

"Otra ronda" on the results sends the host message `lobby` (`Arena.toLobby`,
`engine/play/round-lobby.js`): the room goes back to the lobby, keeping seats,
teams, options and the round count (so the next court still rotates its layout),
and the host picks the next map there. `start()` only runs from the lobby, so a
finished round can never replay its map by accident. Online the bots leave and
the next start refills them; practice keeps its bots on the lobby cards
(`toLobby({ keepBots: true })`) and its start re-seats them from the `bots`
option, so a changed count applies there too.


## Room options and team play

The shared lobby offers free-for-all or two alternating-seat teams, three/five
minutes, one/three/unlimited lives, sticky paint, permitted markers, friendly
fire, faster reloads, and the capture-the-flag mode. Eight seats remain available. Teams
share a color and score. A finite-life player stays out after the last hit;
the surviving player/team wins even if its hit count is lower. Disconnecting
alone does not end an otherwise live round. The server alone validates settings
and accepts them only outside a running round.

A marker fires on a 50 ms tick, so its real interval is its `cadence` rounded
up to whole ticks (`shotInterval`): La Chispa 0.25 s, Las Gemelas 0.2 s, El
Trueno's three balls every 0.75 s. Keys 1–9 pick the first nine markers in menu
order (`PAINT_WEAPONS`), Z/X (or [ and ]) step to the previous/next marker in
class order (`WEAPON_CYCLE`, wrapping; Q/E already turn the view), the gamepad's
Y is X, phones have previous/next arrow buttons beside Mira, and the shared pause menu lists all
eighteen. All of it goes through `armory.setWeapon`; pistol-only rooms override
that input. Fast reload is 0.55 seconds instead of 1.3. Sticky paint slows the
victim for seven seconds including the respawn wait. Friendly hits can consume
a life when enabled but never award points.

### Capture the flag ("Captura la bandera")

A third `mode` (`'ctf'`), with its own lobby limits: `flagGoal` (3, 1 or 5
captures) and `flagTime` (10, 5 or 15 min); `duration` only shows for the other
modes (`visibleWhen`). `options.js` `teamPlay(options)` is true for teams and
CTF, `roundTime(options)` gives the round's clock. The flag rules are the
engine's (`engine/play/objectives.js`, see `docs/SHARED-ENGINE.md`); Pepazo's
part is `public/ctf.js`: the stand table, round reset, feed lines, the outcome
and the bot goals. The server room owns the flags like everything else: they
ride `view()` as `flags`, `flagEvents` (numbered, the last eight) and `outcome`.

- Stands (`FLAG_STANDS`, team 0 orange then team 1 turquoise) sit 4.5–10 m in
  front of each team's spawns and clear of cover in all three layouts of every
  map; `tests/ctf.test.js` flood-fills each layout from the team spawns to prove
  both stands are reachable and at least 30 m apart. A new map needs a row.
- One tick resolves in a fixed order: carriers follow or drop (painted out,
  disconnected), then captures (only with your own flag home), then contact (a
  defender's return beats an attacker's pickup on the same tick; the nearest
  rival lifts first), then the 30 s auto-return. Painted carriers also drop
  inside `hit()` so the flag lies exactly where they fell.
- Time up: more captures wins; a tie goes to the team whose flag is home while
  the other's is out, then to the team whose flag was taken fewer times, else a
  draw (`winners()` lists everyone). Kills still add to a pana's own score, never
  to the team score; a capture is worth 3 personal points.
- Bots take roles by their order on the team (attack, defend, attack, escort):
  a carrier runs home, defenders and the nearest bot return a dropped flag or
  chase the rival carrier, the rest escort a team-mate carrier or go for the
  rival flag. Goals go through `Arena.route`; the BFS hunt toward a hidden rival
  is off in CTF so one distance field per bot serves the goal. A 7-bot round on
  each map ends by the score limit in 40–400 s of game time at about 0.1 ms per tick.
- Client: `ctf-hud.js` (two chips under the race bar, a carrier/alarm banner,
  world markers with distance, synth cues for pickup, stolen, drop, return and
  capture) and `ctf-scene.js` (stand pads, flags with a light column, the
  carrier's flag on the back). Styles in `ctf.css`.

### Domination ("Dominación")

A fourth `mode` (`'dom'`): three zones, A on orange's half, B in the middle, C
on turquoise's. Lobby limits: `domGoal` (200, 100 or 300 points) and the same
`flagTime` field as CTF (10, 5 or 15 min). `objectivePlay(options)` covers CTF
and domination: team round, always respawn, paint knockouts never add to the
team score. The zone rules are the engine's (`stepZones`, `zonePoints`,
`zoneTieBreaks` in `engine/play/objectives.js`); Pepazo's part is
`public/domination.js`: the zone table, round reset, scoring, feed lines, the
outcome, bot goals and the pure HUD helpers. The server room owns the zones:
they ride `view()` as `zones`, `zoneEvents` (numbered, last eight) and `outcome`.

- Zones are 3.5 m rings; one pana turns a neutral zone in 7 s, each extra pana
  adds 50% (up to 3×), a rival's zone is neutralised first (another 7 s). Both
  teams inside freeze it; an empty zone keeps its owner (a drained owner's zone
  refills at half speed, an unfinished claim fades). Each owned zone pays one
  point a second (fractions bank per team); every pana of the capturing team
  inside gets a capture and 2 personal points.
- First to `domGoal` wins; at time up the higher score, then more zones held
  now, else a draw.
- `DOM_ZONES` was searched over the real cover: the middle 1.6 m is clear in
  all three layouts, 70%+ of the ring is walkable, zones sit 13 m+ apart and
  7.5 m+ off spawns, and B's mean distance to each team's spawns differs by
  under 4 m (spawns on the square courts are point-symmetric, so "nearest
  spawn" is a bad mid test). `tests/domination.test.js` flood-fills every
  layout from both teams' spawns. A new map needs a row.
- Bots take roles by order (capture, defend, capture, support): capturers split
  over the zones their team does not own, the defender answers an owned zone
  under attack or holds the one nearest the middle, support answers attacks and
  otherwise captures. With nothing to take, capturers hunt rivals. The goal is
  computed before the hidden-rival hunt and suppresses it: both share one cached
  route per bot, and alternating targets every tick froze bots in place on El
  Puerto. A 4v4 bot round to 100 points takes 60–100 s of game time.
- Client: `domination-hud.js` (A/B/C chips under the race bar with owner colour
  and a capture bar, an in-zone banner, world markers with distance, synth cues
  for captured, lost, neutralised, contested, a capture tick and the round end),
  `domination-scene.js` (ground ring, progress arc, glass wall that flashes when
  contested, light pillar, letter board hidden when the camera stands inside)
  and `domination.css`. The minimap draws each zone's ring.

Team and flag lobbies show the shared avatar roster, with four orange and four turquoise positions. Stable `player.seat` positions are separate from network IDs; team is seat parity. Any connected pana can move their own card, including swapping an occupied position; only the host can arrange other players. The server rejects live-round moves and preserves choices through start, rematch and host departure. With multiple humans, both teams need a player before starting; solo practice still fills bots. Reconnecting into a full arena cannot duplicate another player's position.

## Armory and composed combat kits

`armory-data.js` is the shared, pure source for eighteen markers, three
attachment slots, one armor slot, three grenades and cosmetics. `kitStats`
composes real tradeoffs and still honors pistol-only, fast-reload and room
toughness options. Marker names, classes, mounts, Mira kinds and bores come
from `engine/play/paint-arsenal.js`, which adds the class names players read
(through `loc()`) to the plain table in `engine/models/props/paint-arsenal.js`
that the models are built from (no Three.js). Models may not import `play/`,
so data-only readers (`camos.js`, the server's `camo-trust.js`) import the
models file directly.

Attachment slots are positional: `kit.attachments` is always
`[slot 0, slot 1, slot 2]`, each an id or `null`, so every consumer filters
nulls. `cleanKit` reads up to three entries as slot positions (old saved kits of
one or two land in the first slots), packs a longer list, allowlists, dedupes
and applies `canAttach`. `setSlot(kit, i, id|null)` fills or clears one slot and
moves a part already in another slot; `changeWeapon` returns the new kit plus
the parts that no longer fit. `ATTACHMENT_RULES` is built from the model's
mounts (`PAINT_MOUNTS`): a muzzle for the barrel, a feed for the hopper, a stock
mount (launchers take sliding rods) and a rail or bracket for the Mira. In the
new kit every marker has all four, at four separate places on the model (La
Lejana's stock swaps its wooden one for a skeleton, La Bazuca takes rods), so
any three parts fit together and three slots are safe; the fourth part stays in
the box. A marker without a mount simply leaves it out of `PAINT_MOUNTS`: the
armory greys that part out with "no tiene dónde montarlo" and a swap drops it
(unit tested with a mount removed). A barrel on
a marker that already flies straight (spread 0: Chispa, Cohetón, Bazuca) adds
12% shot speed instead of tightening spread, so range and the precision row's
m/s both move; on the others it tightens spread and adds 12% flight time.

The server accepts `kit` only for the sender's seat before a round and answers
a refused one with `kit-rejected` (`reason: 'playing'`); `Arena.kitRejection`
gives the reason and practice reports it the same way. The armory shows it in
`#armory-note`, or as a toast when closed; opening the armory mid-round toasts
that it opens between rounds. Number keys and the pause menu's marker go
through `armory.setWeapon`: the saved `pintura:kit` and client kit follow, the
lobby also sends the kit, and mid-round the server takes it from
`input.weapon`, running the same `cleanKit` so both sides drop the same parts.
Swaps keep reload debt and never refill limited rocket reserve.
Rocket splash and grenade blasts apply at most one hit per victim and respect
cover, teams and spawn protection. Respawn restores one grenade. Sticky pools
expire and slow opponents. Grenade flight and blasts: see "Grenades" below.

`armory.js` previews the actual marker (with its parts) alone: it turns on a pivot,
centred and scaled from its own bounding box so a pistol and La Bazuca fill the
frame alike. The own pana (with El Acolchado when worn) only appears on the
Equipo tab while choosing and during the range test (`view`/`frame`;
`pinturaDebug.armory.body` is its group). On Equipo the marker is hidden
(`visible=false`) and the pana stands alone at the origin, swaying, with the
camera at chest height (y 1.05): from higher up the big head hides the vest.
The range keeps the wider framing with the marker beside the pana. Hover gives
comparisons for range, damage, paint per second (`dpsOf`), spread (aimed spread
and zoom when it aims), the real fire rate, capacity, reload, mobility and
toughness. The marker picker comes by class: a chip per class with markers
(nickname over kind, `ARMORY_CLASSES`: the marker classes plus melee; granadas
has none so it gets no chip), then that class's weapons, each card with its pepazos/s, range and
magazine. The header shows the class under the name. Its Probar
range runs an independent `Arena` against a target, using the same rules as the
server. It never spends ammo or emits shots into the multiplayer room.
`paintball-kit.js` supplies the eighteen marker models, cosmetic finishes,
attachments and padded vest to both preview and gameplay. Studio registers
those same models. Paint pattern changes are cosmetic and never change hits.

El Acolchado (`createPaintVest`) is a plate carrier merged into one
vertex-coloured mesh (about 4,300 triangles, one draw; the browser suite caps it
at 5,000 and checks its bounds): front and back plates with teal binding and
stitching, shoulder straps, cummerbunds, three ball-pod pouches with mango caps,
a utility pouch and a splat patch. It is modelled in the pana's world units and
worn with `wearPaintVest(avatar)`, which parents it to `avatar.body` and undoes
the sculpt's 0.6 scale, so it rides the walk bob and lean instead of floating
on `avatar.group`. The shared pana is pear-shaped: the trunk is about ±0.47
wide at y 0.8 but only ±0.3 at the chest (y 0.9–1.05), and the hoodie's
sleeves (skinned to the arm bones inside the outfit mesh) reach x ±0.6 at belly
height. Torso widths measured from every visible mesh include those sleeves.
The cummerbunds therefore sit on a ±0.495 × 0.385 ellipse at y 0.815 and stop
under each arm, so the arm hangs over the band. The front plate tilts back
0.29 rad with the chest and its top sits under the jowls, which hide the
middle of the shoulder straps.

The two-client browser proof picks the marker through its class chip, fills a
guest kit slot by slot (slot 2 first, clearing slot 1 leaves slots 2 and 3),
fits La Bazuca's Mira in slot 3 (it names Holográfica), verifies the host
receives each kit, checks grenade consumption, rejects and announces a
mid-round armor change, checks number keys (7 is La Metra) and Z/X reach the saved kit, then
proves real shooting, respawn, host departure and rematch. Mobile
controls put reload and grenade beside a tall fire button without overflowing.

## Calculated kit nivel

`kitRating` in `armory-data.js` reads `kitStats` with current room options.
It returns 100 + 700 times a weighted sum of bounded 0–1 components: range
15%, precision 10%, sustained paint rate (pellets × damage) including reload 20%, magazine plus
reserve 10%, reload speed 10%, mobility 15%, toughness 15%, weapon spread-area
coverage 2.5% and grenade radius × centre damage per fuse second 2.5%. It is a build summary,
not a player rank or combat modifier; special utility such as sticky pools is
still explained on the grenade card rather than presented as extra damage.

The sala and armory show the same integer with shared D/C/B/A/S display bands
from `engine/kit-rating.js`. Hover previews the candidate rating; changed room
rules refresh an open armory. Finishes, charms and patterns do not affect it.
Unit tests cover bounds, cosmetics, attachments, armor, grenades and rule
overrides; the two-client sala test checks that a guest's changed rating reaches
the host and matches the armory.

## Mira (optic)

The fourth attachment. Each marker's model carries one kind (`PAINT_OPTICS`, the
model sets `userData.optic` when fitted) and `OPTICS` in `armory-data.js` tunes it:

| Kind | Markers | zoom | aimSpread × | sens | Why |
|---|---|---|---|---|---|
| `dot` red dot | La Chispa, La Licuadora, La Fumigadora, El Llanero, La Pulga, El Zamuro, La Culebrona | 1.35 | .75 | .9 | small, quick: a little closer, a little steadier |
| `holo` holographic | El Trueno, El Cohetón, La Bazuca, La Metra, El Tambor, La Parrandera, El Tuqueque | 1.5 | .7 | .85 | the mid-range sight: more zoom, steadier |
| `laser` under-barrel | Las Gemelas | 1.1 | .8 | 1 | also tightens hip fire (`hipSpread` .85): twins are fired from the hip |
| `scope` telescopic | La Lejana, La Corneta | 2.4 | .5 | .75 | La Lejana multiplies its own 3.5× by 1.3 (4.55×) instead |
| `pin` pin sight | La China | 1.2 | .6 | .95 | three pins to judge a slow stone's drop |

`kitStats` applies the Mira last, so it steadies whatever spread the other parts
left: `aimSpread = (aimSpread ?? spread) × aimSpread`, `zoom` as above, `sens`
for game.js's look while aiming (blended in with the aim, on top of the zoom's
own slowdown), −2% mobility. Fitting one sets `aims`, so the server honours the
aim flag for that marker (halved walk, no sprint while aiming). La Corneta's
brass scope zooms past 1.5, so it gets the scope overlay like a rifle; that is
the model's sight, kept as a joke with a real cost (−2% mobility for a
shotgun that cannot reach 12 m).

## Camuflajes

A fixed set of sixteen; there is no free colour picker anywhere in the game
(`tests/camos.test.js` greps `public/` for colour inputs). `kit.camo` is one id
or `null` (the factory body, coloured by `finish`). `public/camos.js` is the
catalog, the same ids and rules as pana.sh's `gateway/camos.json` (keep the two
equal):

| Kind | Camos | How |
|---|---|---|
| `start` | `liso-mango` `liso-caribe` `liso-uva` `liso-crema` `liso-carbon` `liso-coral` | everyone's; solid body colour |
| `kills` | `selva` carbine 15, `medanos` marksman 10, `bolivar` sniper 10, `caracas` smg 25, `jaguar` blunderbuss 15 | paint that many people with that marker; then it goes on any weapon |
| `mangos` | `caribe` 240, `tricolor` 300, `llanero` 360, `rumba` 420, `pepazo` 480 | bought with mangos on pana.sh |

The patterned ten take pattern, scale and colours from `PAINT_CAMOS`, the solid
six from `PAINT_SOLIDS` (`engine/models/props/paint-arsenal.js`; `caribe` the pattern is
not `liso-caribe`). `camoState(id, data)` gives the armory's state (`owned`,
`locked`, `buyable`, `cantAfford`) and its text ("7/15 pintadas con La
Parrandera"; the client writes its own progress text from the marker names).

- **Who owns what.** Online, only pana.sh says, and only through the room
  socket: its proxy adds `x-pana-camos` and `x-pana-camos-sig` (hex
  HMAC-SHA256 of that exact value with `PANA_GATEWAY_SECRET`, stripping any the
  browser sent). Colyseus 0.18 hands the upgrade headers to the room's instance
  `onAuth(client, options, context)` (`context.headers`); `server/room.js`
  runs them through `server/src/camo-trust.js` `parseOwned` and stores the
  result in `client.auth`, then per seat (`Arena.setCamos`, never in `view()`).
  A reconnect has no new auth and keeps the seat's list. Only the room
  socket's headers are read: a static `onAuth` would make Colyseus skip the
  instance one, and pana.sh signs the socket anyway. No secret, no or a bad
  signature: solid camos only. `PANA_UNLOCK_ALL_CAMOS=1` owns everything, for
  local screenshots and tests only (`docs/DEPLOYMENT.md`).
- **Mid-session refresh.** A camo bought or unlocked after the socket opened
  reaches the room without a rejoin, still only on pana.sh's word. The armory
  reloads the owned set fresh on open, after a buy and after
  `onCamoUnlocked`, and hands it to `network.js` `setCamos(owned, sign)`. When
  the list differs from the last one the room confirmed and the bridge has
  `camosSigned`, the client sends `camos-nonce`, the room answers a one-use
  16-byte hex nonce (`''` when the connection has no signed account handle),
  `camo-store.js` `signed(nonce)` asks pana.sh, and the client forwards
  `camos-refresh { ids, nonce, exp, sig }`. The room checks it with
  `camo-trust.js` `verifyRefresh` (same `PANA_GATEWAY_SECRET`): signed for the
  account handle this connection was vouched for at connect, the nonce it was
  given (spent on any attempt, stale after `REFRESH_WINDOW` 2 min), `exp` an
  integer epoch-ms no more than 2 min ahead. Only then does the seat's list
  get replaced; the room answers `camos-refreshed { ok }`. Binding to the
  account and the nonce means a signed answer can neither be replayed nor
  given to another player. A kit sent while a refresh is in flight waits for
  it, so a fresh camo is not swapped for a solid one. Without `camosSigned` the
  room keeps the connect list, and a refused camo the armory knows is yours
  says to rejoin. `parseOwned` rejects any value with characters other than
  ids and commas, so a refresh message never passes as a connect header.
- **pana.sh follow-up (not in this repo).** Until pana.sh ships both halves
  below, mid-session camos still need a rejoin:
  1. On the ws proxy upgrade, next to `x-pana-camos`, add `x-pana-sub: <sub>`
     and `x-pana-sub-sig: hex HMAC-SHA256(PANA_GATEWAY_SECRET,
     "pana-sub:v1|" + sub)`, and strip client-sent ones like the other
     `x-pana-*`. `sub` is a stable opaque account handle, 8–128 characters of
     `[A-Za-z0-9_-]` (for example the first 32 hex of
     HMAC-SHA256(secret, "pana-sub-id:" + uid)); never the raw uid or email.
  2. `window.PanaSh.camosSigned(nonce)` in `static/pana-sh.js`, backed by a
     session-cookie route (e.g. `POST /auth/camos/sign {"nonce"}`, rate-limited
     like `/auth/camos`, refusing a nonce that is not 1–64 characters of
     `[A-Za-z0-9_-]`). It resolves to `{ ids, nonce, exp, sig }`: `ids` the
     owned camo ids comma-separated exactly as for `x-pana-camos`, `exp`
     now + 60 000 as an integer of epoch milliseconds, `sig` hex
     HMAC-SHA256(PANA_GATEWAY_SECRET, "pepazo-camos-refresh:v1|" + sub + "|" +
     nonce + "|" + exp + "|" + ids) with the same `sub` as step 1. It rejects
     without a session. `server/tests/camo-trust.test.js` builds these exact
     strings; a pana.sh test should sign the same inputs and compare.
- **Refusal.** `Arena.selectKit` swaps an unowned camo for `FALLBACK_CAMO`
  (`liso-mango`) and keeps the rest of the kit; the room then sends
  `kit-rejected` with `reason: 'camo'` and the armory says so (inline, or a
  toast when closed) and wears what the room wears. Practice does the same with
  the owned list the armory read (`room.setCamos`).
- **Client.** `camo-store.js` wraps `window.PanaSh.camos()` / `buyCamo(id)`
  (cached 30 s, 5 s timeout, never rejects). Without the bridge (public Pana)
  only the start camos are owned and the rest say "Disponible en pana.sh"; a
  bridge without a session says to sign in. `camos.js` and `camo-store.js` are
  dynamic imports (the camo tab, or at once when `window.PanaSh` exists), to
  keep them off the first load (see "First-load budget"). The rules only need the ids, which come
  from `paint-arsenal.js` (`CAMO_IDS`, `START_CAMOS` in `armory-data.js`).
- **Armory.** Slot Camuflaje: a card per camo with a CSS swatch from its
  palette (no canvas), a padlock and the reason when it is not yours, and
  Comprar · N mangos (disabled when short) on mango ones. Every card previews on
  the 3D marker; only owned ones are picked. The choice saves in `pintura:kit`.
- **Unlock progress.** Every rival you paint (hit or knockout blow, not a
  teammate) sends `statEvent('pintura.hits.<weapon>')` from
  `feats.js` `weaponHit`, besides `pintura.paint-hits`; grenade blasts and
  unknown ids send nothing. pana.sh counts only the five kills weapons. If its
  bridge exposes `onCamoUnlocked(callback)`, the game toasts the unlock and
  refreshes the armory (and, through it, the room: see Mid-session refresh).
- **Rendering.** `scene.js` passes the kit (camo included) to the model, so the
  held marker, the third-person `bakePaintKit` marker and the thrown chancla
  rebuild when the camo changes (it is part of the model key). A solid camo is
  a plain colour; patterns share one shader program and set their uniforms once.

## Balancing

Eighteen markers in eight classes (`PAINT_CLASSES`). The rules: a role
triangle (close, mid, long); more paint per second costs mobility, accuracy or
reload; pellet weapons fly short; rifles are fast, straight, scoped and slow to
fire; launchers carry splash, weight and a per-life reserve; the specials are
gimmicks. Damage under one pepazo soaks (`Arena.hit`): the victim adds it to
`soak` and a pepazo lands, with its hit event, once a whole one has soaked in;
four quiet seconds wash the soak off with the stain, respawn clears it.

`tests/balance.test.js` holds every marker (bare and with every allowed set of
parts) inside its class envelope, keeps paint/s × range under 360 (nothing
kills fast and far at once), checks the trade-offs above, that `shotInterval`
is the arena's real rate, and that `kitRating` stays a 100–800 integer for every
marker, part set, armour and grenade.

| Class | pepazos/s | range m |
|---|---|---|
| pistolas | 3–5 | 30–60 |
| subfusiles | 5–10 | 20–36 |
| fusiles | 4–7 | 45–70 |
| ametralladoras | 5–10 | 30–60 |
| escopetas | 3–5.5 | 8–20 |
| francotiradores | 1.2–2.5 | 55–80 |
| lanzadores | 0.8–2.5 | 25–50 |
| especiales | 1–4 | 8–50 |

Columns: damage per ball (× pellets); the real interval between shots; DPS =
damage × pellets / interval with every ball landing (a direct rocket counts as
a knockout, 3); TTK-ish = (hits for the default 3-pepazo aguante − 1) ×
interval, ignoring reloads (single-shot launchers are much slower in practice);
range = speed × life; mobility (heavy: no sprint); magazine (+ reserve) /
reload; hip spread (→ aimed); native scope; kit nivel with the default kit.

| Marker | Class | Damage | Interval | DPS | TTK-ish | Range | Speed | Mobility | Mag / reload | Spread | Scope | Nivel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| La Chispa (pistol) | pistolas | 1 | 0.25 s | 4.00 | 0.50 s | 51 m | 85 m/s | 100% | 12 / 1.3 s | 0 |  | 575 |
| Las Gemelas (rapid) | pistolas | 1 | 0.20 s | 5.00 | 0.40 s | 37 m | 85 m/s | 100% | 18 / 2.4 s | 0.045 |  | 541 |
| El Llanero (sixshooter) | pistolas | 2 | 0.45 s | 4.44 | 0.45 s | 52 m | 95 m/s | 100% | 6 / 2.2 s | 0.012 |  | 534 |
| La Metra (smg) | subfusiles | 1 | 0.10 s | 10.00 | 0.20 s | 29 m | 80 m/s | 100% | 30 / 2.4 s | 0.09 |  | 587 |
| La Pulga (pdw) | subfusiles | 1 | 0.15 s | 6.67 | 0.30 s | 26 m | 78 m/s | 108% | 22 / 1.5 s | 0.06 |  | 596 |
| La Parrandera (carbine) | fusiles | 1 | 0.15 s | 6.67 | 0.30 s | 48 m | 95 m/s | 96% | 24 / 2 s | 0.03 |  | 602 |
| El Tuqueque (bullpup) | fusiles | 1 | 0.20 s | 5.00 | 0.40 s | 61 m | 105 m/s | 94% | 20 / 2.4 s | 0.022 |  | 584 |
| La Licuadora (minigun) | ametralladoras | 0.5 | 0.05 s | 10.00 | 0.25 s | 31 m | 75 m/s | 68% heavy | 90 / 4.4 s | 0.13 |  | 512 |
| La Culebrona (lmg) | ametralladoras | 1 | 0.15 s | 6.67 | 0.30 s | 45 m | 90 m/s | 80% | 50 / 3.6 s | 0.05 |  | 578 |
| El Trueno (scatter) | escopetas | 1 × 3 | 0.75 s | 4.00 | 0 s | 17 m | 85 m/s | 93% | 8 / 1.8 s | 0.18 |  | 450 |
| La Corneta (blunderbuss) | escopetas | 1 × 5 | 1.00 s | 5.00 | 0 s | 12 m | 70 m/s | 92% | 3 / 2.2 s | 0.28 |  | 399 |
| La Lejana (sniper) | francotiradores | 3 → 1 (head: K.O.) | 1.25 s | 1.60 | 1.25 s | 70 m | 140 m/s | 90% | 4 / 2.6 s | 0.1 → 0 | 3.5× | 493 |
| El Zamuro (marksman) | francotiradores | 1 | 0.50 s | 2.00 | 1.00 s | 62 m | 120 m/s | 92% | 8 / 2.3 s | 0.06 → 0.006 | 2.2× | 509 |
| El Cohetón (rocket) | lanzadores | 1 (splash 4.5 m) | 1.00 s | 1.00 | 2.00 s | 43 m | 18 m/s | 63% heavy | 1+3 / 3.2 s | 0 |  | 418 |
| La Bazuca (bazooka) | lanzadores | direct K.O. (splash 1.4 m) | 1.20 s | 2.50 | 0 s | 42 m | 14 m/s | 70% heavy | 1+2 / 3.8 s | 0 |  | 408 |
| El Tambor (revolver) | lanzadores | 1 (splash 2.2 m) | 0.60 s | 1.67 | 1.20 s | 31 m | 24 m/s | 80% heavy | 6+6 / 3.4 s | 0.02 |  | 433 |
| La China (slingshot) | especiales | 0.5 | 0.40 s | 1.25 | 2.00 s | 42 m | 60 m/s | 110% | 40 / 0.8 s | 0 |  | 570 |
| La Fumigadora (sprayer) | especiales | 0.2 | 0.05 s | 4.00 | 0.70 s | 12 m | 32 m/s | 95% | 120 / 3 s | 0.05 |  | 485 |

Why each one sits where it does:

- The six first markers keep their stats; the tick rounding (`shotInterval`) is
  what they always fired at.
- Pistolas are the mobile baseline (100%, 4–5 pepazos/s, ~50 m). El Llanero
  trades rate for two pepazos a shot: two hits knock out, six shots, long reload.
- Subfusiles own the close range: La Metra's 10/s pays with the widest
  automatic spread (.09 rad) and 29 m; La Pulga is the lightest marker (108%)
  with the quickest reload and the shortest reach.
- Fusiles are the mid-range all-rounders: La Parrandera trades reach (48 m) for
  rate, El Tuqueque the reverse (61 m, 5/s). Both were trimmed to stay under the
  paint × range budget with a barrel.
- Ametralladoras sustain: La Licuadora sprays twenty half-pepazo balls a second
  (soak) with the loosest spread, 68% mobility, no sprint and a 4.4 s reload;
  La Culebrona is steadier and reaches 45 m but moves at 80%.
- Escopetas one-shot up close if every pellet lands and die past 12–17 m. La
  Corneta's five pellets fan across ±.28 rad (`pellets` of any count spread
  evenly), three shots a magazine.
- Francotiradores are fast, straight and scoped, and fire slowly; El Zamuro is
  the quicker 2.2× marksman marker, one pepazo a shot.
- Lanzadores carry splash, weight (no sprint) and a per-life reserve. El
  Tambor fires six small-splash grenades (2.2 m) at mid range with six spare.
- Especiales: La China never really runs out (40 stones, 0.8 s reload, 110%
  mobility) but two stones make one pepazo; La Fumigadora is a slow 12 m stream
  of fifth-of-a-pepazo drops from a 120 tank.

## Grenades

What was wrong before the rework: `throwGrenade` spawned the grenade at the
pana's feet with a flat 12 m/s velocity along the aim and no pitch at all;
`stepGrenades` slid it in 2D and stopped it dead at the first wall (Chispita
reversed once, or "bounced" by slowing at half fuse); `scene.js` faked height
with a sine hop over a 0.22 m unlit sphere; the 1.1 s fuse capped every throw
near 13 m; and `blast` painted one pepazo anywhere inside the radius and
nothing past it.

Now the throw is a real 3D lob through `engine/play/lob.js`:

- Input: release G (or the Granada touch button) after holding it. The charge is
  `engine/play/shot-charge.js` (one second up, one down, never locked at max) and
  rides three inputs as `charge` with the look's `pitch`. `cleanInput` keeps
  only finite numbers: pitch clamps to the camera's limits (−0.7..0.55 rad),
  charge to 0..1. Respawning, eliminated or frozen panas never throw.
- Launch (`grenadeStart`, shared by the server, the preview and the bots): 1.45 m
  up and 0.45 m ahead (less when cover is in the way), elevation = pitch + 0.45
  rad, speed `speed[0]`..`speed[1]` (11..18 m/s) by charge. Gravity 9.81.
- Range from a level look on open ground, to the first bounce: 12.3 m at no
  charge, 28.8 m at full (rules test, ±1.5 m). Looking up lobs higher and
  further; a full-charge throw at 0.55 rad peaks 13 m up.
- The fuse starts on release (no cooking: the server only sees the release, so a
  lagging hold can never blow up in the hand). Pinita 2.4 s, Pegajosa 2.2 s,
  Chispita 2.8 s. A lob still in its first flight when the fuse ends blows on
  touchdown instead of in the air (`touched`, at most 4 s late).
- Bounces: floor and box tops with `restitution`/`friction`, box sides taller
  than the grenade and the fence reflect it, then it rolls (`roll`) to rest.
  Pinita (.38/.62) hops a few metres; Chispita (.6/.72, rolls longer) travels
  about 10 m past its first bounce; Pegajosa is `sticky` and stops where it lands
  (on a crate top too) and leaves its 3.3 m puddle.
- Blast (`blast(b, radius, damage)`): `falloff` is 1 inside 40% of the radius and
  falls to 0.35 at the edge; pepazos = max(1, round(damage × falloff)), so
  Pinita (4.5 m, damage 2) paints two within ~2.8 m and one to the edge; rockets
  (damage 1) are unchanged. Cover lower than the blast's height does not shield.
  The splat is flat at the blast's height and as wide as the radius; the boom's
  shock ring is sized `radius / 4.6`.
- Preview: while charging, `scene.aimGrenade` runs `traceLob` from the same
  start with `TICK` (0.05 s, the server step) into reused points: beads along
  the arc (`guideBeads`), a ground strip (`guideRibbon`) and a blast-size ring
  (`guideRing`) where it will blow. A rules test proves the predicted blast point
  equals the server's to 1e-9.
- Look and sound: `createPaintGrenade` (Studio `paint-granada`) in the
  thrower's colour tumbles in flight, glides between snapshots, and its lamp
  blinks through the last 0.5 s. The thrower's right arm swings overhand
  (`armR.rotation.x`, 0.45 s, after the avatar update). `sounds.js` adds the pin
  (charge start, own client only), whoosh, clink per bounce and fuse beeps.
- Bots (`botGrenade`): a rival 6–28 m away that is visible or within 2.5 m of
  cover; `aimGrenade` solves pitch and charge with `solveLob` on open ground,
  then traces the real throw and only throws if the blast lands within 60% of
  the radius. They check every 2 s, never in the first 3 s of a life. The
  armory's Probar range uses the same `aimGrenade` for its grenade button.

## Directional knockout physics

Hit metadata comes from the authoritative projectile velocity, or from the blast
centre to the victim, and is replicated as `impact`. Every hit is a body hit
except La Lejana's head hits (`impact.zone: 'head'`, `headshot` on the event),
which knock out at once. `knockout.js`
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
