# Reliquia · La mina del sol

First-person co-op treasure extraction at `/g/reliquia/`, 1–8 panas, tuned
for 5. The run's one decision: *¿nos vamos ya con lo que tenemos, o bajamos
un piso más?* Only loot that reaches the truck at the camp counts.

## The run

Camp (floor 0, outdoors, sunlit) → floor 1 … floor N (option `floors`, 2–4,
default 3) → the vault on the last floor. Everything is level: the mine is a
gallery into the hill (`minePortal({ niche: false })` leaves its mouth open),
floor 1's way back is that gallery to daylight, deeper floors climb a rope
under a shaft of light, and the way down is a rappel hole (the ground dips
1.6 m as you step in). Each of these stub ends is a **portal**: a body that
walks into the zone is moved to the matching landing (a client fades to
black for its own trip). Big treasures, carritos and their pushers, dragged
panas and loose items all travel through them.

From floor 2 down, the entrance room has a **montacargas** (`run.lifts`):
hold E on its deck for 3 s and everything within 2.1 m (panas, items,
carritos) rides to the camp's headframe; from the camp it goes down to the
deepest floor already reached. Then both ends rest 8 s.

Each floor's way down is closed by a seal in its exit room:
`ruedas` (two winches, hold E 1.6 s each, latch 12 s, one pana can do both),
`guardian` (the sun guardian falls) and, on the last floor, the `boveda`
with the gold jaguar instead of a seal. `sealKind(floor, floors)` decides.
An open seal shows the choice banner to panas near it; barks 1 and 2 are
the votes ("¿Nos vamos ya?", "¡Una sala más!") and count for the titles.

Extraction: hold E at the truck while every standing pana is within 9 m of
it. A pana down elsewhere is left behind. A wipe (everyone down for 3 s)
pays `wipeShare` % of the truck (option: 20, 0 or 50). Downed panas inside
the truck zone get up after 3 s (the truck's botiquín).

## Hands, bag and treasure (`items.js`)

- `bag` loot (coins, emerald, pearl, cup) goes in the morral, 8 slots; a full
  bag slows you by up to 16 %. It banks by itself near the truck.
- `hand` items take one of two hands: one-hand treasures (mask, idol, bank
  at the truck), tools (machete, honda, farol, botiquín: never banked) and
  the eight enchanted artifacts (bank only when dropped at the truck).
- `big` treasures need both hands free and `need` panas (2–4). Speed is
  `3.4 · min(1, carriers/need)^1.6`: alone you crawl. Carriers are pulled to
  slots around it; one stuck more than 2.4 m from its slot lets go.
  Letting go while it moves tips it (−5 % worth, counted as dropped).
- G throws a hand item (pitch adds lift); a flying item bonks a pana
  (stun .6 s), bounces off walls, and is lost if it falls into a pit.
  Holding E with a free hand catches a thrown hand item.
- Going down drops both hands and spills half the bag.

Click / Space uses the right hand, right click / F the left: machete
30 damage, fists 12, any treasure 15 (a melee bonk), honda fires glowing
paint (6 damage, stuns mummies 1.2 s, splats stay on walls and floors), the
botiquín heals 50 or instantly revives a pana in front, miche drinks.

## El carrito

Carritos (`state.carts`, one by the truck and one in many vein rooms) hold
14 items and one big treasure. E with a hand treasure loads it, with a bag
empties it, with empty hands takes the handle (two panas can push, 4.4 m/s
less up to 40 % for the load). A big treasure walked up to an empty cart
climbs in; a thrown item that drops into the hopper stays (¡encestó!). A
cart inside the truck zone banks everything. Its balance floats above it.

## La codicia and the Director

`codicia` (0–100) rises when deck loot is first lifted (`value / 45`, damped
for big rosters), +5 per curse, +2 per chest and slowly with depth. Option
`greed` multiplies it. Tiers every 25: torches gutter and dust falls
(client), enemies +8 % speed and +10 % damage per tier, plates rearm
faster, Director rests shorter and waves larger; tier 3 caves in a
corridor every 26–40 s (hold E 5 s in total to dig, several panas add up)
and sends the **stalker**, a black jaguar that follows the team across
floors and waits while everyone is at the camp. `director.js` keeps the
build/peak/fade/rest cycle; floor 1 rests 1.4× longer and its waves are
small; enemy damage scales `0.75 + 0.15 · floor`.

## Enemies (`enemies.js`)

Mummies freeze in a farol's beam (7.5 m, ~37°, clear line) and run 35 %
faster in the dark (no farol, crown or brazier within 5 m). Phantoms come
with the echo mask. The guardian slams (3.8 m ring) and is only slowed by
light. Jaguars prowl, **crouch** (the telegraph: a ring at the landing spot),
leap .45 s and recover; a beam dazes one for 1.6 s, then it is immune 6 s.
The vault jaguar sleeps until someone comes within 7 m or lifts vault loot.
Rooms wake their sleepers the first time a pana enters (1.5 m inside).

Guácharos (`bat`) fly at 2 m in flocks (waves double their count), orbit,
dive to peck, and scatter 1.6 s from a beam. Spiders hang on the ceiling
(`hanging`) until a pana is within 4.5 m; their bite slows (×0.6, 2.5 s).
Cuaimas (`snake`) are dealt beside a room's loot; they strike within 2.4 m,
poison (2 HP/s for 5 s) and slide home when the pana leaves their reach.
Director waves on floor 1 are 30 % guácharos; deeper, spiders join.
Models: `engine/models/fauna/cave-creatures.js`.

## Artifacts (all in hand)

Echo mask: reveals a hidden room within 9 m / a phantom every 20–28 s.
Sandals: ×1.55 speed / momentum (velocity eases toward the input).
Sun crown: light around you / enemies prefer you. Laughing idol: the bag
banks ×1.5 while you hold it / laughs every 14–22 s, waking enemies and a
wave. Miche: +60 HP per sip, three sips / controls reversed 9 s. Crooked
compass: the HUD tag points to the best treasure, or every third 15 s
window to the biggest enemy on the floor (`compassTarget`). Lucky coin:
chests give two more items and artifacts half the time / plates in your
room fire on their own. Jaguar heart: melee ×3 / −2 HP per second.

## The deck (`deck.js`, `layout.js`)

`generateRun(seed, { floors })` is pure and cached; host and guests build
the same run from `state.seed`, so snapshots carry only what changed
(`touched` loot ids, `items` that moved, `chests`, `open`, `revealed`,
`rubble`, `winches`, `plates`). Floors sit `SPACING` (220 m) apart in x;
`floorOf(x)` is the floor. Rooms are on a 3 × 4 grid of 26 m cells: a
random walk north from the entrance (row 0) to the exit (row 3, at least
five rooms), a shuffled deck for the middle (always one idol room), and up
to two side rooms (one may be hidden behind a fake wall). Room furnishing
keeps a 3 m mouth clear in front of every corridor, stair and seal, and a
final pass pushes loot out of obstacles. `layout.js` rasterises rooms,
corridors and stairs into a 0.25 m bitmap per floor (pits are value 2;
islands and rope bridges stay walkable), checks closed seals, fake walls
and rubble at query time, and paths on a 1 m grid with string pulling.
`groundAt` follows the stair ramps and the bridge sag (−0.75 m mid-span).
A run builds in about 5 ms. A test walks 25 seeds and reaches every room.

## Rendering

`view.js` is the first-person camera (eye 1.45 m, pitch −1.2…1.1) and owns
the light: camp = sky, sun and shadows; underground = dark fog (5–30 m),
the headlamp spot on the camera, a hand light when you hold a farol or the
crown, and a fixed pool of five point lights moved to the nearest braziers
and other panas' faroles every 0.25 s. The light count never changes, so
shaders never recompile on the way down. Your paws (fur colour) hold the
hand items; the own avatar is hidden. Look input is
`engine/play/first-person.js`; the left/right arrows also turn.

`scene.js` builds the camp at once and each floor when it becomes
reachable (floor 1 at start, floor f+1 when seal f opens), only from
Studio models: `ruinShell` (brick walls, slabs, grout, ceiling, painted
`stoneTexture`s tinted per block; one
InstancedMesh each, plain boxes: about 110–140 k triangles and ~100 draw
calls in play) plus ruins, mine, cave, cemetery, camp and crystal props.
Static decor is baked per floor; braziers animate; crystal clusters are
instanced with their own shader and must not go through `bake`. A revealed
hidden room rebuilds that floor's shell once. Every item kind has one
prototype that the map clones. Floors other than yours are hidden.

## Networking

Host simulation at 20 Hz on `LiveRoom` (`reliquia-v3`). Input:
`{ x, z (world move), h (heading), pitch, sprint, hold }`. Actions:
`use {hand}`, `throw {hand}`, `drop`, `drag`, `bark {line}`, `interact`,
plus host-only `configure` and `start`; the expedition's own `ledger` in
snapshots stops a new host replaying them. Guests predict their own
walking with `stepExplorer` unless they grip a treasure or are dragged.
Late arrivals start at the camp; joiners during results wait as
spectators. A departing pana drops both hands and the bag.

## Verification

```powershell
node --test Pana/games/reliquia/tests/rules.test.js Pana/games/reliquia/tests/options.test.js
npm run test:browser -- reliquia
```

The rules tests cover reachability across seeds, bag/hands, throwing,
bonks and catches, two-pana carrying to the truck, tipping, the idol
bonus, portals and seals, farol freezing, collapses and digging, drag to
the truck, wipe share, extraction, titles, the echo mask, prediction
parity, snapshots, the guardian fight and the jaguar's pounce and daze.
`tests/browser.mjs` uses real relay sessions: two desktop panas and a late
390 × 844 phone pick up a farol, throw it, carry the sun disk to the truck
together, shout a vote, go down the mine, revive, migrate the host,
extract and replay, plus solo pause, the offline fallback and the hub.
`tests/studio.browser.mjs` opens the new models and the map in Studio.
With `?debug`, `window.reliquia` exposes `room`, `view`, `state`, `me`,
`place(id, x, z, h)`, `face(h)`, `step(seconds)` and `interaction`.

Idle panas (no tool, no light) last about 50 s on floor 1 and 45 s deeper;
a group of five on floor 1 often holds two minutes.
