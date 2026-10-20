# Reliquia · La mina del sol

First-person co-op treasure extraction at `/g/reliquia/`, 1–8 panas, tuned
for 5. The run's one decision: *¿nos vamos ya con lo que tenemos, o bajamos
un piso más?* Only loot that reaches the truck at the camp counts.

## The run

The camp is the hub; the game is a chain of **jornadas**. Each jornada deals
a new deck of floors (`levelSeed(origin, level)`) and asks a quota
(`quotaFor(level, roster, floors)`): the team's one carrito, which waits on
the montacargas deck, has to carry it up. From floor 1 the red lever only
goes to the camp with that carrito on the deck and the quota in it; the
cage arriving at the camp with it completes the jornada (`completeLevel`):
the load banks, everyone still below is brought up (the fallen at 50 HP),
the next, deeper deck is dealt with a bigger quota, and la codicia, seals,
chests and enemies reset. Banked bolívares also become mangos (one per
Bs. 10), spent at the camp's shop (`SHOP`, a market stall west of the camp):
farol, botiquín, machete, honda and the marcadora de pintura (fast paint,
less stun), each straight into a hand. Holding E at the truck ends the
expedition with everything banked; a wipe ends it with `wipeShare` %.

**Aiming.** E uses whatever the crosshair points at: every target in
`interaction()` is a point and a radius, scored by its angle from the line
of sight (`p.h`, `p.pitch`) and distance; something within 1.4 m in front
of your feet counts too. Levers, the carrito, the call at the empty shaft,
the shop's goods, items, chests, winches, rubble and fallen panas all work
this way.

Camp (floor 0, outdoors, sunlit) → floor 1 … floor N (option `floors`, 2–4,
default 3) → the vault on the last floor. Everything is level and there are
no teleports: the **montacargas** is the one way between floors. One cage
rides one shaft; its stops (`run.lifts`) are the end of the mine gallery at
the camp and an alcove off each floor's entrance room. On the deck, hold E
by the green lever (right, seen from the room) to go down, or the red one
to go up to the camp; at an empty shaft, hold E to call the cage, which
comes back empty. A trip takes `3 + 2.2 · floors` seconds and carries every
pana, carrito and item on the deck; halfway it changes stops. While it
travels nobody can have it, and an empty shaft is a hole (`layout.blocked`).
The camp's green lever goes straight to the deepest floor already reached.
The client draws the cage sinking out of one stop and rising into the next
(`liftView`), with riders, through a cribbed shaft (`liftShaft`).

Each floor's seal stands in its exit room, and opening it lets the green
lever go one floor deeper (`deepestStop`):
`ruedas` (two winches, hold E 1.6 s each, latch 12 s, one pana can do both),
`guardian` (the sun guardian falls) and, on the last floor, the `boveda`
with the gold jaguar instead of a seal. `sealKind(floor, floors)` decides.
At the montacargas with the way down open the choice banner shows; barks 1
and 2 are the votes ("¿Nos vamos ya?", "¡Una sala más!") and count for the
titles.

Extraction: hold E at the truck while every standing pana is within 9 m of
it. A pana down elsewhere is left behind. A wipe (everyone down for 3 s)
pays `wipeShare` % of the truck (option: 20, 0 or 50). Downed panas inside
the truck zone get up after 3 s (the truck's botiquín).

## Hands and treasure (`items.js`)

There is no bag: everything travels in the two hands, in a carrito or
between panas carrying a big treasure.

- `small` loot (coins, emerald, pearl, cup) goes into a hand as a handful of
  up to four pieces; a new piece joins a handful with room before taking an
  empty hand.
- `hand` items take a whole hand: one-hand treasures (mask, idol), tools
  (machete, honda, farol, botiquín) and the eight enchanted artifacts. Only
  one weapon (machete or honda): picking up another drops the old one.
- Near the truck, handfuls and hand treasures bank by themselves; artifacts
  bank when dropped there; tools never do.
- `big` treasures need both hands free and `need` panas (2–4). Speed is
  `3.4 · min(1, carriers/need)^1.6`: alone you crawl. Carriers are pulled to
  slots around it; one stuck more than 2.4 m from its slot lets go.
  Letting go while it moves tips it (−5 % worth, counted as dropped).
- G throws a hand (a handful fans out as separate pieces); a flying item
  bonks a pana (stun .6 s), bounces off walls, and is lost in a pit.
  Holding E with a free hand catches a thrown hand item.
- Going down drops both hands.

Click / Space uses the right hand, right click / F the left: machete
30 damage, fists 12, any treasure 15 (a melee bonk), honda fires glowing
paint (6 damage, stuns mummies 1.2 s, splats stay on walls and floors), the
botiquín heals 50 or instantly revives a pana in front, miche drinks.

## El carrito

Carritos (`state.carts`: at the mine mouth, in the camp, by the montacargas
on every floor, and in many vein rooms) hold 14 items and one big treasure.
E with a hand treasure or a handful loads it, with empty hands takes the
handle (two panas can push from 1.9 m behind, 4.4 m/s less up to 40 % for
the load). The model is drawn at 70 % so it stays below eye level; its
balance floats above it except for the pana pushing it, whose hand slot
shows it instead. A big treasure walked up to an empty cart
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
Sun crown: light around you / enemies prefer you. Laughing idol: what
your hands bank is worth ×1.5 while you hold it / laughs every 14–22 s, waking enemies and a
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
islands and rope bridges stay walkable), checks the montacargas shafts, fake walls
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
spectators. A departing pana drops both hands.

## Verification

```powershell
node --test Pana/games/reliquia/tests/rules.test.js Pana/games/reliquia/tests/options.test.js
npm run test:browser -- reliquia
```

The rules tests cover reachability across seeds, handfuls and one weapon, throwing,
bonks and catches, two-pana carrying to the truck, tipping, the idol
bonus, the montacargas (riding, calling, busy, seals), farol freezing, collapses and digging, drag to
the truck, wipe share, extraction, titles, the echo mask, prediction
parity, snapshots, the guardian fight and the jaguar's pounce and daze.
`tests/browser.mjs` uses real relay sessions: two desktop panas and a late
390 × 844 phone pick up a farol, throw it, carry the sun disk to the truck
together, shout a vote, ride the montacargas (the guest left behind can
only call it), revive, migrate the host,
extract and replay, plus solo pause, the offline fallback and the hub.
`tests/studio.browser.mjs` opens the new models and the map in Studio.
With `?debug`, `window.reliquia` exposes `room`, `view`, `state`, `me`,
`place(id, x, z, h)`, `face(h)`, `step(seconds)` and `interaction`.

Idle panas (no tool, no light) last about 50 s on floor 1 and 45 s deeper;
a group of five on floor 1 often holds two minutes.
