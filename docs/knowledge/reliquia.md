# Fosa · La mina del sol

Players know this game as **Fosa** ("Bajen juntos. No se desarmen."). It
was called Reliquia: the folder, route, protocol and storage keys keep that id
so old links and saved settings still work, and internal notes may use either.

First-person co-op cave extraction at `/g/reliquia/`, 1–8 panas, tuned
for 5. The run's one decision: *¿nos vamos ya con lo que tenemos, o bajamos
un piso más?* Only loot that reaches the truck at the camp counts.

## The run

The camp is the hub; the game is a chain of **jornadas**, each one floor
dealt from the deck with `depth` = the jornada's number (`levelSeed(origin,
level)`, `layoutFor(seed, depth)`): deeper means more sleepers, richer loot,
darker palettes, and every third jornada ends in the jaguar's vault. The
others end in a room whose seal (two wheels or the sun guardian) keeps a
treasure chamber (`kind: 'vault'` stub) with a big treasure behind it.

People ride the **montacargas**: one cage, one green lever. At the camp it
goes down into the jornada; below, up to the camp, but only once the
**cargo lift** has delivered the jornada's quota (`quotaFor(level,
roster)`). When the cage is elsewhere the shaft is a hole and the button
calls it; while it travels nobody else can have it. The team's one carrito
lives in the jornada: push it onto the cargo pad by the entrance and press
the yellow button (`sendCargo`); it rises through the ceiling (3 s), its
load banks (`delivered`, haul, mangos) and it comes back down empty (3 s).
Riding up with the quota met takes 2.4 s (`RIDE_HOME`; other rides 5.2 s) and completes the jornada (`completeLevel`):
everyone still below is hauled to the camp with **1 HP**, and the next,
deeper jornada is dealt. Banked bolívares also become mangos (one per
Bs. 10), spent at the camp's shop (`SHOP`, a market stall west of the camp):
farol, botiquín, machete, honda and the marcadora de pintura, each straight
into a hand. Holding E at the truck ends the expedition; a wipe ends it with
`wipeShare` %.

**Sobretiempo** (`sobretiempoPay` in `rules.js`) pays bonus mangos when a jornada
is completed: 1 per Bs. 50 above the quota, plus 1 per 30 s left on a `turno`
encargo's clock, never more than `encargoPay(level)`. On a timed jornada a clock
that ran out pays nothing, so hauling more risks the bonus. The Tab panel shows
the running figure, and the clock stays visible once that encargo is paid.
`state.sobretiempo` totals it across jornadas: the `level` event line and shout
say each jornada's share, the results card shows the total. At the end it counts
in the payout at Bs. 10 a mango (so Calor and `wipeShare` apply) and in `xpFor`.
The mangos themselves are not multiplied: Calor only pays bolívares and XP.

**Aiming.** E uses whatever the crosshair points at: every target in
`interaction()` is a point and a radius, scored by its angle from the line
of sight (`p.h`, `p.pitch`) and distance; something within 1.4 m in front
of your feet counts too. Levers, the carrito, the call at the empty shaft,
the shop's goods, items, chests, winches, rubble and fallen panas all work
this way.

Camp (floor 0, a terrace in a vast cavern above an underground lake) → floor 1 … floor N (option `floors`, 2–4,
default 3) → the vault on the last floor. Seals:
`ruedas` (two winches, hold E 1.6 s each, latch 12 s, one pana can do both),
`guardian` (the sun guardian falls) and, on the last floor, the `boveda`
with the gold jaguar instead of a seal. `sealKind(floor, floors)` decides.
At the montacargas with the way down open the choice banner shows; barks 1
and 2 are the votes ("¿Nos vamos ya?", "¡Una sala más!") and count for the
titles.

Extraction: hold E at the truck for 1.5 s while every standing pana is within 9 m of
it. A pana down elsewhere is left behind. A wipe (everyone down for 2 s)
pays `wipeShare` % of the truck (option: 20, 0 or 50). Downed panas inside
the truck zone get up after 3 s (the truck's botiquín).

## The record

`record.js` keeps two records on the shared board (`engine/records.js`, drawn by
`engine/record-widget.js`): most **jornadas** and most **remontadas** in one
expedition. `tallyRound()` in `rules.js` is the definition:

- A **jornada** counts for each pana standing when it is completed (`rounds`). A
  pana hauled up while still down gets the 1 HP ride, not the number.
- A **remontada** is falling in that jornada, getting back up (a pana's E, a
  botiquín, the truck) and standing when it is completed (`comebacks`), at most
  one per pana per jornada. `p.fell` carries the fall and clears each jornada.

Both live in `p.stats`, so they travel in snapshots and survive a new host. A
client reports every pana's numbers when a jornada ends and at the results, so
leaving mid-expedition keeps what was earned. The lobby and the Tab panel read
the holder; the results say what fell. The readout has `data-room-personal`, so
the shared lobby stands it under the roster.

## Saved expeditions

`save.js` keeps sessions on the shared store (`engine/save-game.js`, drawn by
`engine/save-widget.js`), up to three, in the host's browser. The save is the
whole `snapshot()`: jornada, `origin` (the place order), `seed`, options, the deck
as played, mangos, encargo, carts and each diver (name, avatar, seat, hands,
stats). It is written only between floors (`saveable`: everyone at the camp, cage
and cargo at rest), at once on a new jornada and every 5 s while at the camp, so
shop purchases count. Only the host writes; a new host keeps saving in its own
browser. A finished expedition removes its save. Bump `SAVE_VERSION` when a saved
state stops loading.

**Continuar** loads it into the lobby (`loadSave`, `resumed: true`, phase
`lobby`): every diver starts as a held slot, and whoever is in the room finds
theirs by name (`addPlayer`, `findSlot`). The slots replace the lobby's seat cards
(`data-pana-roster`). Someone new gets their own diver and can press Tomar on a
missing pana's slot (`takeSlot`, which also renames it). `¡Seguir!` calls
`resume()`. Options are locked while resumed, because they decide the place
order. Slots that nobody claims stay **held**: Fosa has no bots, so the team plays
short-handed and the owner can walk in later.

A held slot is `held` + `spectator`, so everything that already skips spectators
(enemies, quota, extraction, wipe, the view) skips it. `leave()` is what a
departure calls now: during play it holds the slot at the camp with its tools and
drops any treasure, so loot and a quota are never lost with a person. Coming back
by name claims it mid-session. A slot's `id` becomes `held-<seat>`: room ids are
seat numbers and come back, so a slot must not answer to its old one.
Names are the only identity a host-run game has: the device key stays on the server.

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

Click / V uses the right hand, right click / F the left: machete
30 damage, fists 12, any treasure 15 (a melee bonk), honda fires glowing
paint (6 damage, stuns mummies 1.2 s, splats stay on walls and floors), the
botiquín heals 50 or instantly revives a pana in front, miche drinks.

## El carrito

Carritos (`state.carts`: at the mine mouth, in the camp, by the montacargas
on every floor, and in many vein rooms) are an open hopper with real walls and
a floor (`mineCart({ hollow: true })`, interior 1 × 1.5 m, floor .6, rim 1.02,
low enough to look into from eye height). E with a hand treasure or a handful
loads it, with empty hands takes the handle (two panas can push from 1.9 m
behind, 4.4 m/s less up to 40 % for the load). Its balance floats above it,
except for the pana pushing it, whose hand slot shows it instead. A cart inside
the truck zone banks everything.

**Capacity is what fits** (`carga.js`, pure). `BULK` is each piece's true
footprint from its model's bounds; `packCart` drops each piece on the lowest
place of a 0.25 m height map of the hopper, far end first, and the view draws
them there at scale 1 (`lay` pieces on their backs; a piece never shrinks).
`fitsIn` is whether the next one stays under the heap line, .75 m above the
floor: 18 coin piles, a dozen cups or emeralds, six masks. `state` keeps only
`contents`, so every client and a new host pack it the same. A big treasure sits
on the load at true size, edge-on so the pusher sees past it; it fills the cart
and shoves out whatever stood above the rim. Contents are drawn within 18 m.

**Loading has a little skill to it, and no speed changes anywhere.** The
crosshair has to land in the opening (`aimInto`: `in`, or `rim` up to .35 m past
the edge); off it the prompt only says to aim inside. Handfuls are a tap, hand
treasures a held E (`placeTime`, .25 s + .5 × heft; `p.placing`). `bounceChance`
is the one formula for a piece bouncing out, and a careful drop into a calm cart
with room is always 0: the rim, a load past two thirds, a rolling cart, a hard
throw and the piece's heft (`HEFT`) add to it. A bounced piece is ordinary loot
on the floor (`spill`; `spilled` stops it falling straight back in). G throws
heavier pieces shorter (`throwPower`); a throw only lands from above the opening.
A big treasure takes `climbTime` (.5 + .4 × need s) beside the cart. While
pushed, `stepWobble` turns hard starts, stops, turns and bumps into `cart.wobble`,
scaled by how heaped the load is; at 1 the top piece falls off and the cart rocks
(view). Under about half full it never spills.

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
faster in the dark (no farol, crown or brazier within 5 m).

The mummy (and the phantom, and the Silueta scare) is `mummy({ gaunt: true,
seed: e.id })`: `engine/models/props/gaunt-mummy.js`, about 2.8 m (just over
the classic mummy, 2.7 m, so it looms), thin, arms to the knees, dark grey
wraps over ribs, a hollow face with two small cold emissive eyes; the
guardian and every other game keep the classic `mummy()`, unchanged (the
`momia.browser.mjs` suite pins its shape). Each pivot is one tinted bake, so
a mummy is 20 draws and no lights. Its motion is
`engine/models/props/gaunt-pose.js` (pure numbers, Node-tested): idle
twitches and dead stops, an uneven lurch with one arm reaching, a jerky
raise on the windup, and in a beam it holds the exact pose while only the
head turns to you. `view.js` passes `{ frozen, look, lit, scares }` and
only calls it walking when it covers ground (the snapshot speed, smoothed).
On Sustos normales its eyes gutter out for a moment in the dark and the
body darkens with them (the tinted materials' colour, no shader change);
suaves and apagados tame the twitches and never flicker.

`presence.js` makes a mummy felt before it is seen, per player: a whisper
clip where it stands the first time it comes within 11 m (at most one
every 4 s), a low chain or board creak every 1.4–3.2 s while it walks
within 9 m, a dust puff and the synth breath within 3.6 m, and the drone
swelling as the nearest one closes (`ambience.presence`, up to +0.03).
Suaves: half the whispers, quieter, ticks at half rate, no breath sound;
apagados: none. Phantoms come
with the echo mask. The guardian slams (3.8 m ring) and is only slowed by
light. Jaguars prowl, **crouch** (the telegraph: a ring at the landing spot),
leap .45 s and recover; a beam dazes one for 1.6 s, then it is immune 6 s.
The vault jaguar sleeps until someone comes within 7 m or lifts vault loot.
Rooms wake their sleepers the first time a pana enters (1.5 m inside).

### El Lector and La Estatua (the library's own)

Two hunters only the library deals (`libraryHaunts` in `deck.js`, from their
own seeded stream after the rest of the deck, so adding them changed no
existing layout). Per floor: one Estatua against a wall of a `lectura`,
`estanterias`, `archivo` or `copistas` room (sometimes two from jornada 5),
and usually one Lector sleeper in a stacks, archive or copyists' room (up to
two from jornada 5, `lectorCap`); never the entrance, a sealed room or within
3.2 m of a corridor mouth. Director waves in the library swap a mummy wave for
one Lector 12 % of the time (+2 % per codicia tier), never past the cap. The
mine deals neither.

- **El Lector** (`lector.js`, model `props/blind-librarian.js` + pose
  `reader-pose.js`): blind, it hunts by ear on the shared noise board
  (`engine/play/noise.js`, `g.noise`, never in a snapshot). `NOISE` in
  `rules.js` is each noise's reach: running (stamina draining) 10 m, landing a
  jump 8, a search tick 7 and its opening 10, a chest 11, a melee hit 10 (a
  miss 4), getting hurt 8, a shot 6, a rolling carrito 8, darts 9, the
  laughing idol and a cave-in 30, anything landing `5 + 0.55 · impact` m and
  an `oldBook` ×1.35. Walking (4.6 m/s, the non-sprint pace; there is no
  crouch), standing still and riding are silent. A wall between muffles a
  noise to 60 % of its reach. On a new noise it stops dead (`listen`, 0.7 s:
  the head turns toward it, `e.look`, and cocks hard), then homes in at
  3.6 m/s (`hunt`), searches 3 m around the spot for 6 s at 2 m/s and wanders
  at 1.3 m/s with pauses (`prowl`). It claws (windup 0.55 s, 15 damage before
  scaling, a bit over a mummy) anyone within 1.1 m or anyone noisy in the last
  0.8 s within its 1.6 m reach. Light does nothing (`lit` stays `dark`); hits
  stagger it as usual. A thrown book is the lure: throw it away from you and
  stand or walk.
- **La Estatua** (`estatua.js`, model `props/library-statue.js` + poses
  `statue-pose.js`): placed when the jornada is dealt (`placeStatues`, asleep,
  no spawn puff) so it is in the room from the start like decor; it wakes
  silently with its room. Each tick the host checks every standing pana on
  its floor (`seenBy`): inside the view cone of `engine/play/sight.js` (the
  heading `p.h` and `p.pitch` players already send, 62° each side and 41° up
  and down, wider than the 74° camera on any screen up to 21:9, plus the
  statue's own width) within 30 m, and a clear sight ray from the eyes to its
  middle or either shoulder (`layout.sightClear`: walls, bookcases, wardrobes,
  fake walls and rubble block; reading tables, desks and pits do not). Light
  and the dark do not matter, nor does holding Tab. Seen by anyone, it is
  frozen, wind-up included. Unseen, within 26 m of a pana, it strides
  1.5–2.5 m along `findPath` with `moveBody` (never through a solid) every
  0.6–1.1 s, stopping a metre short, and takes a new pose (`e.pose`: far,
  reaching, close); within 1.5 m it raises its arms (0.5 s) and strikes once
  (24 before scaling), then stands 2.6 s. Melee and paint only stagger it
  (`wound()` refuses stone; 0.9 s): the answer is to keep eyes on it or leave.
  The view snaps it to each host position (no lerp) with a little dust.
  Look: a pale marble mourner (albedo about 0xa3a197, roughness 0.82, a
  faint cold emissive 0x10141a) on a 12 cm plinth, about 2.07 m: bare face
  with hollow sockets and an open mouth, a thin torn veil behind it, two
  separate arms with long fingers, moss on the hem and plinth. The poses
  (weeping, reading with a book, one arm reaching, both arms and the mouth
  open, the lunge) each turn the head 30–70° from the last so a snap reads
  from 8 m. The headlamp clips that marble to white within 3 m, so the view
  dims it by distance with `userData.setShade` (×0.28 at 2 m under a full
  lamp, full from 8.5 m, `STATUE_DIM` in `view.js`); never darken the
  palette instead, or the silhouette vanishes at range.
- **Cues** (`presence.js`, existing clips only): the Lector's tell is a page
  turning where it stands, a slow low creak while it stands listening within
  8 m, a low chain while it walks within 10 m; each Estatua stride is the
  trunk lid at half speed under a low book thud, within 24 m. Suaves: half
  the level, creaks and chains at half rate, no thud layer, three dust motes
  instead of six; apagados: no cues and no dust. Behaviour is the same in
  every mode (a unit test runs the Lector under all three).
- **Perf.** No lights; geometry and materials shared; one tinted bake per
  pivot (under 20 draws each). A frozen statue costs no pose work; the
  sight check is a dot product per pana and, only inside the cone, at most
  three 0.2 m-step rays over the bitmap.
- Debug: `reliquia.spawn('lector' | 'estatua', ahead, side)`; suite
  `tests/enemies.browser.mjs`, unit tests `lector.test.js`, `estatua.test.js`.

### El Silbón (`silbon.js`)

One per jornada, and nothing kills it: `wound()` refuses it and `stagger()` gives
a .9 s stun at most, then 5 s of shrugging blows off (no stun lock). It sleeps on
the rim of the pit room, which every jornada now deals (`deck.js`), and gets up
when a pana enters. Model: `props/reliquia-boss.js`, about 3.2 m, a wide hat, arms
past the knees, a sack of bones; eight draws, no lights. HUD: the shared boss
panel, its name and a bar that is its attention (`e.alert`), not health.

- **You lose it.** It chases what it can see (`layout.sightClear`, 13 m; not a quiet pana in cover) at 3.4 m/s
  × difficulty, below a walking pana. Out of sight for .8 s it goes to the last
  spot it saw you (`search`, 14 s in all), tries up to three nooks within 13 m and
  then wanders off (`wander`) from room to room.
- **You lure it.** It hears the noise board like the Lector does. A bat's
  `screech` (`NOISE.screech`, 24 m) is the bait: a bat woken from its roost or
  caught in a beam, and it comes running (`hunt`), even while you stay hidden.
- **You drop it.** Hunting, it takes the straight line whenever one exists
  (`layout.crossable`), and a pit is floor to it until its centre is over one
  (`layout.moveAcross`), so it never looks down: get it to run at you (or at a
  screech) across the pit. `mode: 'fall'` is 1.4 s (the view drops it), then
  `defeated()` opens the floor's seal, whichever kind, and leaves a mask, a cup and
  coins on the rim. Paths (search, wander) go around the pit, so it never falls by
  accident. The two wheels are unchanged and still open the seal on their own.
- **The pit's edge** (`pitEdge` in `scene.js`): a stone lip with a pale band around
  the pit and the island, broken at the bridge, and sheer walls: three draws.

### Hiding nooks (`run.nooks`, `dealLair` in `deck.js`)

Two stone slabs against a wall leave a 1.25 m gap, 1.5 m deep, with a chalk hand on
the lintel and no text (`hideNook`). It has to read as a door you can walk through,
because that is the only tutorial it gets: a pale sill crosses the threshold, flags
run inside, and the back wall is warm unlit courses around a candle on a ledge (one
`userData.flames` point, so the floor's `candleFlames` draws it; no light of its
own). `dress` in `scene.js` hangs nothing within 1.2 m of a nook's rect: a relief
on the wall behind one stands in the opening and reads as a blocked doorway. The lane
a .42 m body fits through is only .41 m wide, so a pana stopped by a slab within
.95 m of the middle slides along it into the opening (`nookFunnel` in `deck.js`,
called from the walker's `move` in `rules.js`, so it is the same for host and guest
and draws nothing random). The boss's body (`SILBON_BODY`, .72 m radius)
does not fit; a pana's (.42) slips in and out. Edges sit on the .25 m collision
grid (hence the odd eighth in `dig`). Three in the pit room, sometimes one or two
in others, never in the entrance, the vault or a hidden room; dealt last from their
own stream with the roosting bats, the same map on every difficulty. Slabs live in
`nook.slabs`, not `run.solids`, so library furniture code never sees them. Inside,
`p.hidden` is the nook's id: to the boss that pana is not there, its blows pass over
them, and the screen closes in (`body.in-nook`, no text). Other enemies still come
in: only the boss is too wide.

**How hard it looks is one table, `PEEK` in `silbon.js`:**

| | looks in | warning | finds you | then |
|---|---|---|---|---|
| Tranquila (`easy`) | never | none | never | sniffs around outside |
| Normal | 50 % of nooks | 1 s | within .6 m of the opening | 1.1 s stun, pushed out |
| Momia brava (`hard`) | 90 % | .7 s | anywhere inside | 1.6 s stun, 14 damage, pushed out |

**The warning (`e.peek`)** is plain JSON: `{ spot, t, of, seq }`. Nothing can happen
to anyone until `t` runs out (`stepPeek`), and while it runs the boss is looking at
the nook, so slipping out then is safe. `ambience.js` plays the `peek` cue (stone
scrape, two sniffs) once per `seq` on every client (`peekCueDue`), panned from where
the boss stands and never below a quarter of full level. A pana pulled out has
`p.exposed` for 5 s: no nook hides them. All of it restores on a new host.

### Bats and the rest

Bats (`bat`, `caveBat` in `cave-creatures.js`: dark fur, big ears, two-panel leather
wings, six draws) roost on ceilings (`hanging`, `dealLair`: a colony in the pit room,
sometimes a few elsewhere). A pana within 3.8 m or a noise that reaches them (a
screech only within 7 m, so one colony does not wake the floor) drops them with a
`screech`. They fly at 2 m in jittery flocks (two unrelated beats on the heading and
height; waves double their count), orbit, dive to bite, and scatter 1.6 s from a beam,
screeching. Spiders hang on the ceiling
(`hanging`) until a pana is within 4.5 m; their bite slows (×0.6, 2.5 s).
Cuaimas (`snake`) are dealt beside a room's loot; they strike within 2.4 m,
poison (2 HP/s for 5 s) and slide home when the pana leaves their reach.
Director waves on floor 1 are 30 % bats; deeper, spiders join.
Models: `engine/models/fauna/cave-creatures.js`.

**Fear wears off (`BRAVE`, `enemies.js`).** A beam held 4 s on a mummy or a phantom stops freezing it for 5 s. A bat that scatters flees 1.6 s, then ignores the beam for 5 s while it comes back, and an ecosystem body in that state keeps its target (`e.brave`) instead of drifting back to its site past `attention`'s reach. A flare within 4.5 m never wears off.

**The white disc.** The headlamp is a SpotLight of 25-58 cd on the camera, so anything within arm's reach burned to white; in the camp the jeep did it from 0.27 m. `capSpotNearField` (`engine/fx.js`) stops spots gaining strength inside 2.5 m (`LAMP_NEAR`), and the jeep's collider keeps your eyes further off it. Moths and mushroom halos are additive Points that would fill the screen up close: `fadePointsNear`.

### The food chain (`ecology.js`, `eco-view.js`, `engine/ai/ecosystem.js`)

Moths graze glowing mushrooms, bats eat moths, cuaimas eat bats. `dealEcology`
(`deck.js`, its own stream) deals `run.ecoSites`: mushroom thickets and root
thickets (nothing collides), a roost per bat colony, a lair per cuaima. A jornada's
chain is rebuilt from those at `start` and `completeLevel` and simulated 150 s
before anyone arrives, so each floor starts somewhere different. Once someone is
below it steps once a second. Caps: 10 bats, 7 cuaimas.

- **Bodies.** Every creature is a row in `g.eco.pop`; only those within 26 m of a
  pana, in a woken room, get a body in `g.enemies` (`e.eco` is its id; at most 3
  bats, 5 cuaimas) and go back to being numbers past 34 m, wounds kept. A body's
  death kills its creature, and starving or being eaten kills its body. Bodies sit
  outside the Director's cap of 18. The rest of a roost is one instanced draw.
- **Senses (`attention`).** A body only notices a pana within 2.6 m, noisy within its
  `hearing`, or inside its `sight` with a clear ray; founders see less and hear more
  with depth (`traitsFor`, blind at jornada 7). Otherwise it follows its creature to
  feed or roost. El Silbón's sight fell from 20 m to 13 m for the same reason.
- **Hiding (`p.covered`, `hiddenFrom`).** In a thicket or the roots, past 2.6 m and
  quiet for .8 s, bats, cuaimas, spiders, the stalker and El Silbón do not see you.
  Mummies, phantoms, the guardian and the jaguar are not fooled: otherwise a patch
  beats the whole Director. A thicket hides only with cover at or above .3, which it
  loses as moths strip it; roots never wilt. Unlike a nook, a blow still lands.
- **Why a wipe matters.** No bats: moths reach most patches within a minute or two,
  cover and light go (a healthy patch counts as light for `lightOn`, so mummies speed
  up), and no screech is left to lure El Silbón; waves stop bringing bats too. No
  cuaimas: more bats, and past 8 on a roost it is `touchy`, dropping at 6 m instead
  of 3.8 m. Sucesos and the crack swarm stay outside the chain: they come from
  elsewhere. A farol's beam or a flare cuts a patch's moths by 45 % a second.
- **Net.** `g.eco` is plain JSON: under 8 KB whole, deltas once a second, and a new
  host carries on exactly (`rng` included). Sites and links never travel. The Tab
  layer shows the four numbers. Noises for the simulation wait on `g.noise`, which
  no snapshot carries.
- **Tuning.** Pest numbers round to .001, not .01: at .01 the seed rounds away and a
  patch never comes back. Eating to `full`, not just past `hungry`, is what lets bats
  reach the breeding energy. Hunters' `hungry` bounds their kill rate (about one bat
  per 130 s), so `catch` can be high without wiping the colony. Over 120 seeded runs
  of 600 s, cover took bat survival from about 62 % to about 87 %.

Try it: `?debug`, then `reliquia.crowd(24)` or `reliquia.wipe('bat')` (host only).

### The swarm (`swarm.js`, `swarm-view.js`)

Now and then the Director's wave is dozens of snakes instead (`swarmDue`: from 45 s
into a jornada, 20 % of waves plus 5 % per codicia tier, 75 s rest after one; size
`swarmSize`, at most 90, debug up to 160). It has three phases. `hiss`, 2.4 s: the
`swarm` event plays `swarmHiss` from each crack and dust rises there, with no text.
`crawl`, 30 s: they pour out, at least 8 a second. `retreat`, 9 s: they go back down
the holes, or at once if nobody is left on the floor.

- **Holes** (`pickHoles`): 2 to 4, at the foot of a wall, one per room, never in the
  `boveda` or `guardian` rooms or a sealed room. Each pass asks for less: unseen, 14 m
  away and within 45 m of walking; then 9 m; then 5 m at any distance. Every layout
  has been checked in `swarm.test.js`; a floor with no spot simply gets a normal wave.
- **Bodies**: chains of 12 Verlet points, 0.17 m apart (`engine/play/verlet-chains.js`).
  Heads steer; bodies only follow. No rigid bodies, no rotations.
- **Walls**: a 0.25 m signed distance field baked from `layout.footprint(floor)`
  (`swarmField`, about 10 to 20 ms). Pits, obstacles, cages and whole nooks are solid
  too, so nothing enters a nook. A fallen tunnel or an opened wall rebakes it.
- **Steering**: one breadth-first flow field from every chaseable pana, redone every
  0.4 s; each head reads its own cell, plus a sine wiggle. Within 3 m in the open it
  goes straight. Past 16 m of walking it hurries (x1.6), so far holes still arrive.
  Without that field heads pile up against the first wall.
- **Bite**: 3 HP (scaled by difficulty) at most every 0.9 s, plus `p.slow` for 1.4 s.
  That is the existing x0.6 debuff, so walk speed is untouched. A snake near you (2.2
  m/s, 2.53 on hard) is slower than a slowed pana (2.76), so you can always walk out.
  A jump over 0.7 m clears them; a hidden pana is not bitten.
- **Swing** (`swingAtSwarm`): the machete reaches 2.6 m, anything else 1.1 m, not
  through walls. Points fly out, links let go for 1.1 s, then pull back over 0.7 s.
  Snakes never die of it, and a loose snake neither steers nor bites.
- **Light**: a farol's beam (7.5 m, the same cone as `lightOn`) or a sun crown (5.5 m)
  makes a head turn and flee at x1.2 while lit and 0.7 s after. Modest on purpose: it
  opens a gap and does not clear a room. Checked on a quarter of the heads per step.

**Net.** `g.swarm` is plain JSON: phase, holes, and `heads`, one string of 5 base64
characters per snake (13 bits x, 13 bits z at 1/16 m, 4 of flags), rewritten every
0.15 s. As one string a delta sends it whole or not at all, about 2 KB/s for 60
snakes. `g.swarmSim` (the typed arrays) is left out of `snapshot()`, and `restore()`
clears it; `tickSwarm` rebuilds it from `heads`, so a new host loses only body poses
and they straighten out within a moment. Every screen, the host's included, draws
through a `SwarmFollower`: heads chase the synced ones and bodies run on the same
solver. A swing reaches them as the `snake-scatter` event, and the `loose` flag covers
a missed one. So a host runs two simulations (see Perf).

**Perf.** 150 snakes x 12 points, median, from `swarm-perf.test.js`: about 0.3 to 0.6 ms a host
step in the open, 0.6 to 0.9 ms with all of them packed around one pana, 0.3 to 0.7 ms a client
step (30 and 45 steps a second). A step allocates nothing measurable (under 256 bytes,
and the test fails above that). Separation goes through `engine/play/spatial-hash.js`,
capped at 6 pushes a point, so a crowd costs less than double. Drawing is three draw
calls at any count (`snake-swarm.js`: segments, eyes, cracks), checked at 30 and 150 in
`swarm.browser.mjs`. A snake past 34 m writes no instances, since fog has hidden it.

Colour slots are fixed per instance, so the bands stay put but a far snake that
returns may swap skin; nobody can see it at that distance. Keep the bands light: a dark
band reads as a gap in the body against the dark floor.

Try it: `?debug&snakes=60` on the URL, or `reliquia.snakes(150)` in the console (host
only; it puts you down the shaft if you are at the camp).

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
the light. There is no sun and no shadow pass anywhere: the camp is a look like
any other (`caverna`), with dark fog (8–60 m, the far hall carries its own haze past it), the headlamp spot on the camera, a hand light when you hold a farol or the
crown, and a fixed pool of five point lights moved to the nearest braziers
and other panas' faroles (at the camp, to its `LAMPS`) every 0.25 s. The light
count never changes, so shaders never recompile on the way down. Your hands are the engine's rig
(`hand-view.js`): sleeves in your seat colour, holding the hand items, each with a
row in `grips.js` (shape, rest, model turn and the blow it plays). The hand light sits
ahead of the held farol, not on it: at about 10 cm it burns the glove white. Blades
rest outside the headlamp's cone for the same reason. A blow lands the moment you
press, so its windup is a flick; `p.swing` going up starts it. The own avatar is hidden. Look input is
`engine/play/first-person.js`; the left/right arrows also turn.

**Diving suits** (`suit-look.js` as data, `explorer-suit.js` as meshes) are looks
only: no rule, stat or module that decides play sees them, and height and speed
are untouched. `view.js` builds each pana from `suitedAvatar()` (no hat, necklace,
backpack or chosen garment; fur, face and glasses stay) with `head: SUIT_HEAD`,
then hides every mesh on the body except the neck's subtree and hangs the suit on
the same bones, so poses, squash and stagger still apply. Parts merge per bone into
shared per-colour geometry with two vertex-coloured materials (cloth, brass).

The helmet is one closed brass ball minus a round hole in front, with a dark
inward-facing liner merged into the same mesh and a glass cap over the hole; it
clears the sculpt's farthest vertex, the ear cup. The glass is an unlit shader patch
on `MeshBasicMaterial`: nothing transmissive or environment-mapped. Its crescents
are drawn in view space at a smaller radius than the old dome's, because a cap's
normals only reach `sin(port)` facing the viewer.

Your own headlamp is strong enough to bleach a full-strength colour to white at a
few metres, and just past its beam the cave is nearly black. So the cloth is painted
at `CLOTH` and both materials add their own colour as emissive (`SELF_GLOW`). Patch
the emissive with `diffuseColor`, not `vColor`, which does not compile here.

**Headlamps:** a suit adds no light. Every diver has an unlit lens, a glow sprite
and a beam cone (additive, fading along its length, edge-on and near the eye, or
standing in one paints hard wedges on the screen). `headlamps.js` lends a fixed pool
of real SpotLights to the nearest divers (1 / 2 / 3 by quality, chosen at start),
idle ones at intensity 0, since a changed light count recompiles every shader. Your
own lamp stays the camera's. Character disposal frees whatever is under the sculpt,
so call `suit.remove()` first. Measured at quality `alta`, 1280 x 720, four other
divers in view in the mine: about 145 draws and 120 k triangles.

**Glowing mushrooms** (`sowMushrooms` in `scene.js`) grow on every floor of both
themes: shelves on mine walls, clumps at wall feet (the library's walls are full
of cases, so only clumps there) and in the pits. They use their own seeded stream
and never touch the deck, `layout.js` or `run.lights`: mummies avoid `run.lights`,
so adding them there would change play. No new lights: the last two of the five
pool slots go to the nearest clumps within 13 m, displacing the farthest warm
sources; halos are one `THREE.Points` draw per floor. Caps use deep colours because
ACES tone mapping bleaches a bright emissive to white. Hidden rooms and their
corridors get none: a pool light shines through walls and would give them away.

`scene.js` builds the camp at once and each floor when it becomes
reachable (floor 1 at start, floor f+1 when seal f opens), only from
Studio models: `ruinShell` (brick walls, slabs, grout, ceiling, painted
`stoneTexture`s tinted per block; one
InstancedMesh per 24 m tile and part, plain boxes, so the camera culls the
floor tile by tile) plus ruins, mine, cave, cemetery, camp and crystal props.

**What a frame costs.** The camera's far plane sits at the fog's far end
(`scene.fog.far + 1`; fog depth and the far plane are the same view depth, so
nothing visible is lost).
Measured headless (SwiftShader, 1280 × 800, seed 424242, one pana on floor
1): the mine went from 267 draw calls and 133 k triangles to 66 and 35 k,
the library from 212 and 223 k to 81 and 107 k, and frames came twice as
often in the mine and 1.75× in the library (two panas, host: 4.96 → 11.1
fps and 4.19 → 7.79). Each awake mummy adds about 17
calls. Software WebGL is
pixel-bound, so compare calls and triangles, not milliseconds. The host's
20 Hz timer shares the main thread with drawing: a host whose GPU lags
also simulates and publishes less often, which guests feel as lag.
**Fires** are the shared `engine/fx/fire.js` (`docs/SHARED-ENGINE.md`, "Fire"): every
brazier and the camp's campfire, two draws each. A brazier's bowl now bakes with the
floor (it was four animated cones on top of its own draws), and `brazier({ lit: false })`
is the coal bed under the flame. The flame is premultiplied and partly opaque, because
the headlamp lights the wall behind it to near-white and added light alone burns out to
a white smear there. The view's pool lights keep their fixed number: a source with a
`fire` takes its intensity, wander and colour from `fire.light` every frame, and
lanterns keep the old breathing. Blackouts dim the flames through `world.candles`
(`setLevel`). `world.feedFires` flares the ones nearby when a tunnel caves in and when
la codicia rises, and all of a floor's when a blackout ends. The roar is one looping
noise band in `ambience.js` following `world.fireNear`, and crackles arrive through
`view.onFx` from the moment a spark pops. Candles keep their own instanced shader:
they are tiny, and the library has hundreds of them.

**Cave-ins** break with `engine/fx/rock-crack.js` (`docs/SHARED-ENGINE.md`, "Rock cracks"),
which `syncRubble` in `scene.js` loads with the first cave-in, off the first-load budget.
It reads only `state.rubble[id] / RUBBLE_HOLD`, so guests see it from the snapshot and it
cannot change play: hold time, who can dig and the host's authority are the rules' as
before, and its random numbers are its own. A heap's sides are inside the tunnel walls,
so the cracks are aimed at the two ends (`faces`) and spread over the tunnel's width. The
shared stone goes white under a headlamp, which swallows an emissive crack, so heaps use
darker clones of its materials and each crack has a dark edge round its glow. A blow
knocks your hand (`hands.knock`) and jolts the view a little only while you are the one
holding E within 5 m, never on reduced motion, and the Sustos setting scales it as every shake.

**Carved bricks and rock** are `engine/fx/pom.js` (`docs/SHARED-ENGINE.md`, "Carved surfaces"),
which `scene.js` lazy-loads at every quality, off the first-load budget. A material asks for it with
`userData.relief` (`'brick'` in `ruinShell`, `'rock'` in `camp-cave.js`) and `carve` picks it up. It
touches no rule and no collision.

- **A block has one map.** A ruin block is a box 1.12 × .52 m with UV 0..1 on each face, so the height
  tile is two courses of two bricks. Only ±z is mapped: the top, bottom and ends only show in the
  joints, where a whole map squeezed into a few pixels sparkled, so they take a speck of the map's
  dark corner. That also changes the plain look a little at every quality.
- **The rock has no UVs and one normal per facet.** It uses the world projection, one axis per facet,
  so a facet's edge can show a seam in the pattern; the facet's shading already breaks there.
- **The headlamp sits on the camera, so it casts no relief shadow.** What shows the depth is the shift
  itself and the dark held in the grooves (`cavity`). Self-shadow stays off for this reason.
- **Smooth height noise looks wrong under the lamp.** It read as veins, then as a contour map. The
  rock is now flat tilted chips with sharp creases, and `MAX_SLOPE` stops their edges glinting white.
- **What it costs** (SwiftShader, 1280 × 800 at resolution 1, seed 4242, three rounds interleaved in
  one page, median of nine frames; software GL is pixel-bound, so read the ratios). Draws and
  triangles are the same in all three versions.

  | View | plain ms | normal map ms | POM ms | POM / normal | mean layers (max) | relief on screen |
  |---|---|---|---|---|---|---|
  | Brick, head-on, 1.5 m | 245 | 274 | 396 | ×1.44 | 9.1 (18) | 97 % |
  | Brick, grazing | 272 | 327 | 407 | ×1.25 | 11.1 (18) | 66 % |
  | Rock, head-on, about 2 m | 196 | 243 | 279 | ×1.15 | 9.7 (22) | 36 % |
  | Rock, grazing | 255 | 288 | 312 | ×1.08 | 11.1 (22) | 8 % |

  CPU submit does not move: about 2 to 2.6 ms in every version. No GPU was available, so this
  has not been timed on real hardware. Nítida normally draws at resolution 2, four times the pixels.

**The stone jaguar** (`jaguarStatue`, `engine/models/props/jaguar-stone.js`) is one
mesh with one vertex-coloured, flat-shaded material, painted facet by facet: it bakes
to a single draw, 2.1 k triangles where the old one was 37 meshes and 7.9 k. The headlamp bleaches a pale stone to cream at 3 m, so the stone is
a dark sandstone; moss goes on steep-up facets of the cat and comes as clumps on the
plinth, whose tops are one big facet each. The red ring players see around it in
`derrumbe` is the falling rocks' warning (`rockRings` in `view.js`), not the
statue's own: it has no behaviour of its own and no collision, as before.
Static decor is baked per floor; braziers animate; crystal clusters are
instanced with their own shader and must not go through `bake`. A revealed
hidden room rebuilds that floor's shell once. Every item kind has one
prototype that the map clones. Floors other than yours are hidden.

## The camp's cavern (`camp-cave.js`, `camp-vista.js`, `camp-falls.js`, `camp-gear.js`)

The camp is a terrace in a vast dark hall above a still underground lake: the base camp
of an old expedition, with the mine and the pit as the way down. It is looks only:
`layout.js` still decides where you can walk, from the same `CAMP_RECT` as before, and
`tests/cavern.test.js` checks nothing of the hall stands in that rect. The rock tower that
holds the mine mouth and the low berm stand past the rect's edge, and whatever stands inside
it hangs overhead or lies flat (the pale walkway is a decal), so nothing looks solid and
walks through. Past the berm a pana is stopped by the same invisible rect edge, so the gap
where the road leaves is closed by a low timber barricade.

- **The far plane is the trap.** `setLook` names the camp's look `caverna`, and the far plane
  used to test for `camp`, so it was clamped to the fog's far end (47 m): nothing past that
  drew at all. The look now gets `CAVERN_FAR`; `view.lookName` reads it (`view.look` is the
  turning method, which had silently overwritten a getter of the same name).
- **One unlit draw for the far hall.** `camp-vista.js` is renderer-free and builds triangle
  soup: `MeshBasicMaterial`, no fog, no tone mapping, about 29 k triangles, so a colour
  written there is the colour on screen. Each object takes a stepped tone from its distance
  (`TONES`, darkest nearest), which is what makes the layers read as miles of air; facets
  and warm pools (`POOLS`) are baked per vertex, since no light could reach that far.
- **The reflection is real geometry.** The lower parts of the soup are mirrored below the lake
  (`Reflejos`, about 9 k triangles) and `createLake` is a translucent sheet over them, clearer
  at a grazing look. No render target, no second pass.
- **Keep the roof above what you carve.** An earlier, taller head went through the ceiling and
  read as a face with no top; `ceilingAt` lifts the roof around it, and a test holds it there.
- **The stone guardian's face is dark on purpose.** `buildHead` is navy slate (`SLATE`) that warms
  (`WARM`) only near a spot off-centre toward the beam, so the far cheek stays navy. A gold or round
  face read as a cheerful sun, so the outline is squared, the brow falls toward the nose and the
  mouth's corners turn down. The beam is additive and draws over the face, lifting even its black
  sockets, so judge the palette on screen, with the beam, and keep it darker than looks right in code.
- **Additive tints are display values.** `ShaderMaterial` output has no colour-space step, so
  a beam tinted with a linear amber looks mauve over navy: `createBeams` converts to sRGB first.
  Anything additive near the lift also washes out the view through the gallery, so the warm
  spill down the shaft ends at the floor.
- **No new lights.** `LAMPS` borrows the view's five pool lights while you are at the
  camp, which is also why the campfire no longer brings its own. A lamp past the
  nearest five keeps its emissive glass and halo, and goes dark on the rock. Far lanterns,
  fungi and mist are one `Points` draw with a size per point (`createFarGlows`).
- **No sun at all.** A `castShadow` light whose shadow map has never rendered makes
  every lit material fail to draw, with no error: only unlit materials appear. That
  is what happens once the camp has no sun, so the light was removed, not dimmed.
- **What it costs.** About 91 k triangles and 200 draws at spawn (1280 × 800, `baja`), from 42 k
  and 173; `cavern.browser.mjs` fails above 95 k or 260. Roughly a third is the soup and its image.
- **Coming up.** A level is finished by riding the lift up with the quota; the truck ends the
  run. While you ride at the camp's stop, `view.js` lifts a `veil` (fog, hemisphere, exposure)
  as the cage rises and eases your heading toward the gallery's mouth, so the first thing you
  see is the cavern through the mine's frame. It only touches this screen's picture; the
  mouse still works and rules, timing and arrival are untouched.
- **Rails.** `mineTrack` is sized for a roller coaster; at eye height its sleepers
  fill the screen, hence `RAIL`, a scale of .6 with the points divided to match.
- **Sound.** `ambience.js` plays a low draft, far rock and pebbles, the steady far roar of
  the falls (`roarFor` in `options.js`, quieter on softer Sustos), and each visible
  drop lands with its own sound (`DRIPS`, `dripLands`, on the view's clock). Metal,
  a scrape and the faint whistle go through `scareSound`: half and quieter on
  Suaves, none on Apagados. Eerie events and `presence.js` still never run here.

## El tambor ceremonial

It was a metre tall and 1.5 m across with its sticks, in saturated red and teal with
glowing gold, under the 3.2 m halo of a big treasure: from eye height it blocked the
view and outshone everything in the room, and it is a third of jornada one's big
treasures. It has no sound or mechanic of its own, so looks were the whole problem.
Now knee-high (.68 m, radius .33): dark wood, worn hide, a thin unlit brass band, a
1.3 m halo (`halo` in `items.js`), and a .5 m collision radius. It still takes two
panas and pays Bs. 420, and carrying is exactly as fast as before.

## Biomes, sucesos and el encargo

**Places.** `THEMES` in `deck.js`: `biblioteca`, `mina`, `inundada`, `hongos`,
`templo`. With an `origin` (a dealt expedition), `themeFor(depth, 'alternar',
origin)` walks a shuffle of all five keyed on that seed, so runs open anywhere and
a place only repeats after the other four. `themeOf(state)` reads `state.origin`.
Without an origin (the empty lobby state, old tests) it swaps library and mine. Every
theme except the library plays as the mine (`library` is the only special-cased
one); each has a deck in `BIOME_DECKS`, a palette in `RUIN_PALETTES`, a look in
`view.js` and its wall dressing in `dress()`.

**Fixed along the way: `f` is always 1.** Since jornadas became single floors,
anything that said `f > 1` or `floor > 1` was dead: jaguar reliefs, roots, skulls,
column doorways, spiders in waves and better chest rolls never appeared. They read
`depth` / `this.level` now. When you add depth-driven content, never key it on the
floor number.

**The deck's streams.** Anything added must not shift the library's `R()`: the
hiding-spot tests are tuned to those deals. `dealExtras` (twin plates, cuerda,
flare, parcel) and the `golden` roll have their own streams.

**Pit rooms and the slab trap.** `ruinShell` tilts a 1 m slab from `ground(x +- .5)`,
so a pit or island edge exactly on a half or whole metre turns the slab next to it
into a ramp. Keep edges at `.2`, `.4`, `.7` or `.9` as the existing rooms do (rim
3.2 or 2.2, island half 2.4 or 3.4).
Every new pit room is a ring, so doors on any wall connect: the main path and the
carrito (radius .6) never depend on a plank or a rope. `test: every biome` walks it.

- `sima`: a platform (`pit.low`, 4.2 m) off one wall with a .7 m gap. `groundAt`,
  `lowAt` (crosshair height in `interaction`) and `pitDepth` (when a falling item is
  lost) know it. An item at rest on it stores `y: 0`, like loot: the view adds the
  ground. No enemy spawns there, walkers do not target a pana there or on a rope, big
  treasure is never dealt there (hands and throws only). A throw that clears the gap
  lands on the rim.
- `cornisa`: a 2 m ledge round a pit, corner torches hard against the walls so a
  carrito still rounds them, and a plank (`bridge.beam`, 1.1 m) to an island. A body
  of radius .5 does not fit on a plank, so mummies cannot follow. Planks are flat and
  draw no slabs.
- `cuerdas`: two pits with a causeway. One island's bridge stands; the other's
  (`bridge.needs`) stays open air in the bitmap until `state.strung[id]`; `walkable`
  asks through `floorHere`, which only pays for the lookup over open air.
- `cisterna`: the same ring as black water (`pit.water`). `bosque`: giant mushrooms
  (obstacles) and `run.puffs`. `atrio`: `run.cracks`, solid fallen drums.
- `dorada`: the hidden side room, about one in five (`golden`). `run.twins`: two
  plates at least 5 m apart; a pana or an unsent carrito counts as weight, so it can be
  solved alone. No room for plates: `wall.twin` goes false and it is a plain false wall.

**Ropes.** `run.ropes`, some `needs` a cuerda. `p.rope = { id, down, t }` takes the
pana out of walking (and out of a guest's prediction); `CLIMB`: 2.8 s alone, 1.6 s
with a pana within 3.2 m of either end. Knocked out on one, you land at the nearer
end (`endClimb`).

**`sucesos.js`** ticks after everything else. One suceso at a time, first after 60 to
90 s below, then every 55 to 105 s, never the same twice running, from
`SUCESO_POOL[theme]`:

| Suceso | Rule | Screen |
|---|---|---|
| `apagon` 14 s | `lightOn` ignores `run.lights`: mummies run 35 % faster near torches too | pool, candles, lamp and fog fall; flicker follows Sustos, the rule does not |
| `murcielagos` 10 s | 4 + 2 per pana, up to 12, inside the 18-enemy cap | |
| `derrumbe` 9 s | a corridor caves in (`caveIn`) and a rock every .7 s near a pana | ring, falling stone |
| `creciente` 18 s | stamina does not refill below, 2 cuaimas | water rises to .68 m |
| `esporada` 8 s | a spore cloud every 1.8 s near a pana | green puffs |

Rocks: .9 s warning, 1.5 m, 18 damage, also 40 to enemies; cap 8, instanced in the
view. A puffball reverses controls for 3.5 s within 2.6 m. **Nothing here touches
walking speed**, and the test walks every biome and suceso to prove it.

**Flares** (`bengala`): thrown, burn 28 s on the floor. `lightOn` answers `beam`
within 4.5 m and `glow` within 9, so they freeze mummies and scatter bats even in a
blackout. A flare takes the first of the five pool lights; no light is added.

**`run.encargo`**, one per jornada (`encargoFor`, its own hash): `pedido` (bank the
parcel), `turno` (quota within `turnoSeconds`), `sinBajas`, `todos` (every standing pana
rides up in the cage). Pays `encargoPay(level)` mangos (25 at jornada 1). Shown in the
Tab overlay, announced on the first descent.

**Performance.** No new lights. A flooded floor's water is one mesh and one draw
(`floodSurface`, one 128 px normal map per floor), giant mushrooms and puffballs bake
with the floor, their halos join the floor's single `Points`. Paths that fail
(a pana on a platform) are retried every 3 s rather than every 1.

## La biblioteca sepultada (the library theme)

`themeFor(depth, place)` in `deck.js` deals each jornada a theme from the
room's **Lugar** option (`options.place`, a primary lobby choice the host
sets): one place every jornada, or `'alternar'` (the default), which walks all
five in an order of the expedition's own (see "Biomes, sucesos and el encargo").
`themeOf(state)` reads it from `state.level`, `state.options` and `state.origin`,
which every snapshot already carries, so `run.theme` itself travels nowhere; `generateRun`, `layoutFor`
and `createExpeditionWorld` take the theme, and their caches key on it.
Every seal kind works in both themes, the vault included (the reachability
and quota tests walk both themes at depths 1–8). The start event and the
end-of-jornada event name the place that comes next. The library has its own deck (`estanterias`,
`lectura`, `archivo`, `copistas`, plus the idol, trap, sanctuary and pit rooms
under library names, `roomName(kind, theme)`); the seals work as in the mine.
`jornadaName(level, theme)` is what the HUD and the descent shout call it.

- **Solids.** Bookcases, reading tables and copyists' desks are axis-aligned
  rectangles in `run.solids`, cut out of the walkable bitmap in `layout.js`
  (value 0, like a wall), so `walkable`, `lineClear`, `findPath`, shots and
  thrown loot all treat them as walls with no per-query cost. `furnish()`
  trims a row where a doorway's clear mouth crosses it instead of dropping
  it.
- **Aisles on the path grid.** The stacks put double cases (0.8 m) every
  3 m from the room centre, so each 2.2 m aisle has its centre on a
  `.5` line of the 1 m path grid: enemies (radius 0.5) path into every
  aisle. A 4 m nave crosses the middle; some aisle ends are capped (dead
  ends), some rows have a 2 m gap only panas squeeze through. Chests in the
  stacks sit in the nave on a row line, never in an aisle mouth.
- **Enemies.** Mummies wait in the aisles, one phantom haunts every stack
  room, spiders hang over them; the archive keeps a cuaima by its loot. El
  Lector and La Estatua are the library's own (see Enemies).
- **Secret room.** In the library the fake wall is drawn as a bookcase
  (`bookcaseDoor`) that swings 83° into its passage when the echo mask
  reveals it.
- **Look: old, abandoned, cold (not Halloween).** Desaturated grey-blue:
  `LIBRARY_LOOK` in `view.js` is a thin blue-grey haze (fog 2.5–21 m, colour
  `0x18202a`), a cold hemisphere over a near-black ground, a whiter and dimmer
  headlamp (`lampPower` 25, decay 1.15, so things a metre away do not blow
  out) and a hand farol at a third. Candelabra are small warm accents: the
  pooled point lights use 1.6 power and a 4.5 m reach in the library, and a
  room keeps only two candelabra (two corners stay dark). `RUIN_PALETTES.biblioteca`
  is cold grey-blue stone over dark worn planks (the plank texture has
  scuffs and grit in the seams). Wood is dark plum-brown (`LIBRARY_COLORS`).
- **Shelf variants.** `furnishLibrary` (scene.js) gives every room a main
  variant (arched, plain or between stone pillars) and a shelf density, then
  mixes in ladder sections, low cases and, in half the stacks rooms, one
  collapsed case that leans into an aisle with its books spilled across the
  floor; the case across that aisle gets the ladder somebody was climbing.
  Collision never changes: every variant sits inside its solid rect.
  Books come in runs of a quarter metre (a seven-spine texture), leaning
  books and flat stacks, with gaps and empty shelves.
- **Webs, dust, mist.** `cobwebs()` draws corner fans (room corners, case
  ends, the corners of arches, over trunks and heaps), sheets sagging under
  the ceiling and across aisles from case top to case top, and long drapes
  hanging in the open, over the reading tables and from chandeliers: three
  instanced meshes per floor, Lambert with a faint cold emissive so they read
  in the dark, swaying on one uniform. `dustMotes()` is a pool of 520 pale
  motes around the eye, faint everywhere and bright in the beam. Low ground
  mist (`groundMist`) is an accent, not a fog: always in the reading hall and
  in a stacks room with a collapsed case, never more than one room in three.
- **Furniture.** Lit chandeliers in the big rooms (some dead), lanterns over
  the stacks' nave and in corridors, worn rugs (`rugs`, one draw call),
  piles of books against the wall cases with a candle on some, and in the
  reading hall two tall windows with a faint cold glow (an emissive plane,
  no light), torn curtains and worn armchairs. No skulls, pumpkins or garlands.
- **Budget** (headless Chromium, software WebGL, 1280 × 720, seed 9): a
  stacks aisle went from 235 draw calls / 261 k triangles to 177 / 260 k, the
  reading hall from 320 / 332 k to 345 / 341 k. Arch panels are flat shapes
  (extruded they cost 48 k triangles in one room); hiding-spot models farther
  than 26 m (Manhattan) are not drawn. Long sessions of the library crash
  headless software WebGL after a minute or so on dev too; shoot screenshots
  in short sessions.
- **Sound.** Steps are `wood` boards (others' steps squeal now and then);
  timber groans, page rustles, a falling book, wind through broken windows
  and a clock that ticks and stops replace drips and pebbles.

Try it: `/g/reliquia/?debug&jornada=2` deals jornada 2 at once when the
host starts; `reliquia.jornada(n)` skips ahead from the console and
`reliquia.spot('wardrobe')` (or an index) stands you in front of a hiding spot.

## Hiding spots (the library)

Relics worth searching for (`HIDE_FROM`, Bs. 60 and up, small or hand-sized)
do not lie in plain sight in the library: `furnish()` collects them per room
and `hideSpots()` places the room's spots and deals them with
`engine/play/hiding-spots.js`. Tools, big treasures, cheap coins, the sealed
chamber's scatter and the cursed piece on its lectern stay in sight, plus an
old book or two (`oldBook`, junk worth Bs. 10).

- **Kinds** (`SPOTS` in `deck.js`): trunk, drawer (a writing desk, or a
  copyist's desk), sheet (furniture under a dust sheet), wardrobe, debris (a
  heap of fallen books; at the dead end of a capped aisle it counts as hard),
  shelf and ladder (roll aside off a niche in the wall), lantern (lit, it
  shows its dark corner). Free pieces are obstacle circles placed with
  room around them (in the stacks only in the nave on a row line, never in an
  aisle mouth; around the pit only in the rim's dark corners); wall pieces
  are solid rects with their backs to a wall, kept off doorways, dart lanes
  and each other, and the wall cases are cut around them.
- **Dealing.** Treasures prefer hard spots (the first of a room an easy
  one); a room gets about one spot per 70 m² and never fewer than its relics
  plus one, so extras share a spot. Leftover spots hold junk (35 %), a minor
  find (20 %), a trap (8 %: a spider or a mummy comes out) or nothing.
- **Searching.** Hold E (0.7–1.2 s by kind): `interaction()` offers
  `search` with a progress bar, `update()` steps `searching` and
  `openSpot()` runs once: the contents tumble out toward the pana (a lantern
  lays them in its corner), a trap springs, a lantern by the secret bookcase
  opens the passage (`revealed`). Snapshots carry `spots` (open) and
  `searching` (progress); `completeLevel` clears both. The crooked compass
  also points at unsearched spots that hide treasure. The scene poses each
  model with `userData.open(t)` and keeps it open; a creak plays while you
  hold E on a spot, and "Nada. Solo polvo." only shows to the searcher.

## Scares (all jornadas)

`engine/eerie.js` schedules cosmetic, client-local events (nothing is
synced): flicker then lights out for a second, candles blown out around
you, a slam behind, a thud in the next room, whispers and breath at your
neck, a pale figure 7–12 m ahead that is gone when you look straight at
it, turn away or walk up, a swelling heartbeat, a book thrown off a shelf,
a fog surge, the farol stuttering, and the rare jump scare (lights cut, a
sub swell, the farol comes back on a figure 2.3 m in front with a stinger).
Jump scares are at least 80 s apart, never in the first 20 s of a jornada,
never two in a row, never at the camp, downed or riding the cage.
Intensity rises with la codicia, depth, being alone (no pana within 9 m)
and low health. `eerie-fx.js` turns events into `view.mood` (light, farol,
fog, blow-out), `ambience.eerie(name)` and the shapes. With `?debug`,
`reliquia.scare('silhouette' | 'jumpscare' | 'bookFall' | …)` forces one.

**Sustos** (pause menu, per player, saved in `localStorage`
`pana:reliquia:sustos`): Normales; Suaves (no blackout, a softer stinger,
the figure further away, flicker and shake at 40 %); Apagados (no jump
scares, flicker or shake, only quiet sounds and far shapes; gameplay shakes
off too).

The whole game is darker: the mine's hemisphere 0.7 → 0.5 and fog 5–30 →
3.5–24 m, a tighter headlamp cone (0.44 rad), a heavier vignette and a slow
uneven breathing on every pooled flame. Loot keeps its glow halo and
enemies their eyes, so both read inside the farol's 8 m.

## Sound

`ambience.js` builds once audio is unlocked and replaces `sound.out` for the
page with a split into a dry path and a cave (generated-impulse convolver
plus a 0.34 s feedback echo) whose wet level rises underground, so every
sound in Reliquia echoes below. A brown-noise rumble and a detuned drone
thicken with la codicia; drips, pebbles, creaks, moans and whispers come
every 2–7 s; the camp has its own ("The camp's cavern"). Footsteps follow every
moving pana (0.42 s walking, 0.3 s running), others' panned and faded by
distance. Creatures each have their own clock: mummy groans, spider
skitter, cuaima hiss, bat squeaks and wing flutter (a sleeping one barely chirps),
the Silbón's falling whistle, jaguar growls and a roar on the pounce. The swarm hisses from its cracks (`swarmHiss`) and then from whichever snake is closest (`slither`), more often as it nears. From tier 3 your heartbeat joins in.

Recorded clips (`public/audio/*.mp3`, CC0, credited in `audio/SOURCE.md`)
play through `samples.js` on `engine/sample-bank.js`, after the cave split,
so they echo too. They load when a run starts; until a set has decoded your
own steps stay synthesised (`sfx.step`) and the rest is silent. Your steps
are `step_wood_*` in a library jornada and `step_stone_*` in the mine
and at the camp, on the distance ticker of
`engine/play/footsteps.js`; while the clips play, `ambience.js` skips your
own synthesised board knock so a footfall never doubles (others' steps stay
synthesised). A search makes its spot's sound once, when its progress first
appears in the synced `searching` (`searchesStarted`), so every pana's
search is heard where it stands: wardrobes and ladders creak, trunks and
drawers (rate 1.25) open, shelves and dust sheets rustle pages, a heap of
books thuds then rustles, a lantern chinks; a finished search settles
softly. Underground a drip comes every 8–20 s (half as loud among the
books), a chandelier within 14 m chinks its chain every 6–18 s (positions
in `floor.chandeliers`), and `wind_loop` is a quiet bed (0.03–0.045) that
fades in when a run starts and out on pause, mute or the end. The levels
are low on purpose: only scares should make anyone jump. Scare layers
(whispers 2 m behind a shoulder, a far door creak with a slam, a far book
thud with a library thud, the thrown book landing) go through
`scareSound(mode, e.roll)`: Suaves plays about half of them, quieter and
11 m off, and drops the synth breath; Apagados plays none.

## HUD

On screen during play: vitality (heart, number, bar), the stamina line, the
two hand slots, the aim dot, the E prompt and the passing pieces (toast,
shouts, boss bar, the montacargas vote, downed card). Everything else, the
map, the compass with its tags, the jornada and room, la codicia, the quota,
mangos, the montacargas line, what you carry, artifact effects and the team,
lives in `#intel`, shown only while Tab or the pad's View is held
(`engine/hold-overlay.js`; the pad presses Tab through `createGameMenu({ pad })`),
or toggled by the touch Mapa button. `hud.js` only fills `#intel` while it is
open. While it is open the aim dot, prompt, vote, boss bar and downed card are
`visibility: hidden`, so nothing stacks under it. `engine/tests/hud-layout.browser.js`
checks it closed and held (`HOLD`). Debug: `reliquia.info`,
`reliquia.showInfo(true | false)`.

The minimap paints its own backdrop with `fillRect`. A CSS background on that
2D canvas inside the fixed, transformed panel drew a tall dark box below the
panel under software WebGL.

## Diver rank (`progress.js`)

Each device keeps its own rank on `engine/progress.js` under
`pana:progress:reliquia`. `xpFor(state, playerId)` is pure and reads the finished
state: 10 for the dive plus up to 20 for its length (full at five minutes), 15 a
jornada cleared, 1 per Bs. 100 in the truck (at most 60), 10 per encargo won
(`encargosWon`, kept across jornadas because `encargo` only holds the current
one), 1 per 2 mangos of Sobretiempo (at most 20), 5 per revive (at most 20), and 20 for extracting with something in the
truck. The length part and the truck condition keep a run that leaves at once
at 10 XP, not worth farming. A pana who joined during the results is a spectator
and earns nothing.

`lobby()` calls `settle` on every render of the results screen; the receipt
`seed:level:outcome` makes it pay once, across reloads too. A mix of good runs,
modest runs and wipes reaches Leyenda (4000 XP) in about 50 dives.

The rank-up toast uses its own `.pk-toast` (`#rank-toast`): Fosa's `#toast` has
z-index 5 and sits under the results layer. `#rank-toast` is raised to 8% so it
clears the card's title. The `unlocks` ids in `RANKS` are stable names; the
`pacto:*` ones gate the lobby (below), the rest nothing reads yet.

## Pactos and Calor (`pactos.js`)

Optional rules a squad takes on before a dive. Each has a Calor value; the sum is
the one number shown (a chip in the lobby, `Calor +N %` beside the XP on the
results). Each Calor adds 10 % to `payout` (a wipe's share too) and to the XP.

| Pact | Calor | Rank | Effect | Hook |
|---|---|---|---|---|
| `cuota` Cuota apretada | 1 | 2 | quota ×1.25, at most 80 % of the floor's worth | `pactoQuota` in `start`, `completeLevel` |
| `turno` Turno corto | 1 | 3 | every jornada's encargo is `turno`, clock ×0.7 | `dealEncargo`, first descent |
| `tienda` Tienda cara | 1 | 4 | shop prices ×1.5, rounded up | `interaction`, `buy` |
| `codicia` Codicia voraz | 2 | 5 | codicia rises ×1.35 | `greed()` |
| `enjambre` Enjambre | 2 | 6 | swarm size ×1.5 under `SWARM.most`, chance +20 points | `swarmSize`, `swarmDue` |
| `silbon` Silbón madruga | 3 | 7 | it gets up 20 s after the first descent | `riseSilbon` |

A pact is one boolean room option, `pacto:<id>`, the same string as its rank
unlock. `options.js` `FIELDS` holds them, so the host's `configure` accepts any
real pact whatever the rank: rank only decides what a menu offers. `fieldsFor`
gives a locked pact `visibleWhen` on its own value, so it stays out of the menu
until it is on. Guests therefore see what the host chose, and a new host of lower
rank can turn it off. No engine change was needed.

- **Why the 80 % limit.** The way up needs the quota met, so a raised quota past
  what a floor holds would strand a squad. `floorWorth(run)` is its loot plus
  what its hiding spots keep. The limit only bites deep with a big roster, and
  never takes the quota below the plain one.
- **`silbonAt`.** 0 nothing due, above 0 when it rises, below 0 it has risen. The
  pit room's own wake-up skips the Silbón once it has risen: the cap alone would
  raise a second after the first was dropped.
- **Why these pacts.** Each changes one tunable the host already owns. None
  should give free Calor: a revive-time pact would pay a solo diver for nothing,
  and a shorter `turno` alone would only bite on jornadas that deal that job,
  hence `turno` forces it.
- Bolívar `payout` is what the bonus raises. The `extracted` line still says what
  is in the truck (`haul`), and in-run mangos are not multiplied.
- "¡Otra expedición!" starts straight from the results with the same options,
  since the lobby only shows before a room's first dive.

## Del día and Racha (`daily.js`)

The host presses "Del día" (lobby, or results for a room past its first dive) and the
squad dives `dailySeed('reliquia', day)` with `dailyPactos(day)`: one of the 21 sets of
one or two pacts, each used once before any repeats. Rank is ignored, since the host's
`configure` already takes any real pact.

- **Same cave means every rule.** `dailyPlan` replaces all options with the defaults
  plus the day's pacts; `place` alone would deal another cave. Only `crude` stays.
- **The options come back.** The lobby only shows before a room's first dive, so pacts
  left on after a daily could not be turned off. `plainOptions` holds the host's own
  and `startDive` restores them on the next plain dive; both it and `daily` (the day
  key) travel in snapshots, so a new host keeps them.
- **A daily's seed repeats**, which breaks `receiptFor`: a second try with the same
  level and outcome would pay nothing. A daily's receipt adds the dive's time.
- **The lobby button clicks `#start`** with the day armed (`startOptions`), so
  `game-entry.js`'s "everyone ready" barrier holds it. A button of its own would skip it.
- A guest uses `state.daily`, the host's day, for the best and the bonus, and its own
  local date for the streak, so timezones never split a squad's dive.

The first daily of a day pays +25 % of that dive's XP (receipt `daily:<day>`,
`dive: false` so `dives` stays true). A reload has `gained` 0 and does not spend it.
The day's best is one local key, `pana:reliquia:daily-best`, behind `reportBest`, so a
shared record store can replace it.

**Streak.** `engine/daily.js`, per device. A day counts with a jornada cleared or an
extraction with something in the truck, the same condition that keeps `xpFor` from
paying a run that leaves at once. Any dive counts, daily or not. Kit classes set their
own `display`, which beats `[hidden]`, so these chips and buttons toggle
`style.display`. A rank-up keeps the toast; the streak's waits for it to end.

## Networking

Host simulation at 20 Hz on `LiveRoom` (`reliquia-v3`). Input:
`{ x, z (world move), h (heading), pitch, sprint, hold }`. Actions:
`use {hand}`, `throw {hand}`, `drop`, `drag`, `bark {line}`, `interact`,
plus host-only `configure` and `start`; the expedition's own `ledger` in
snapshots stops a new host replaying them. Guests predict their own
walking with `stepExplorer` unless they grip a treasure or are dragged.

Snapshots go out as deltas (`engine/state-delta.js`): only the fields that
changed, per player, enemy and item by `id`, with a whole state every 40
publishes (2 s), after a join or a hello, after a new host takes over, and
when a guest asks with `{ kind: 'resync' }` because a delta's `base` is not
the one it holds. A 2-pana run sends about 0.3–0.7 KB per publish instead
of 2.7–6 KB (11–12 %); diffing and patching cost about 0.1 ms a tick.
Other panas are drawn up to 0.15 s ahead along their `vx`/`vz` since the
last snapshot, so a host that publishes slowly still looks like walking.
Late arrivals start at the camp; joiners during results wait as
spectators. A departing pana drops both hands.

## Languages

The host's events and `interaction()` prompts carry a Spanish key
(`locKey`) in `text` plus `vars`; every client shows them with `say()` from
`items.js`. An item kind travels as `vars.item`/`vars.other` and becomes its
name in the viewer's language (`{item}` lower case, `{Item}` as written),
numbers are formatted there and `vars.place` is a floor name. Never put an
item name or a formatted amount into an event: the host's language would
reach every client.

## Verification

```powershell
node --test Pana/games/reliquia/tests/rules.test.js Pana/games/reliquia/tests/options.test.js Pana/games/reliquia/tests/library.test.js Pana/games/reliquia/tests/hiding.test.js Pana/games/reliquia/tests/silbon.test.js Pana/games/reliquia/tests/carga.test.js Pana/engine/tests/hiding-spots.test.js
npm run test:browser -- reliquia
```

`tests/daily.test.js` covers the day's plan, restored options, receipts and the best; `tests/daily.browser.mjs` is two panas through the button, the barrier, a retry and a plain dive.

`tests/variety.test.js` covers places, rope work, planks, the golden chamber, sucesos,
flares and el encargo; `tests/variety.browser.mjs` proves ropes, a tied bridge, a
blackout and a flare between two real clients.

`tests/hiding.test.js` covers the spots: same seed same spots, every spot
reachable with its front clear (library at depths 1, 2, 3, 5, 8), plain-sight relics, decoys
and empties, the quota still reachable, a search opening exactly once, the
lantern opening the passage and the opened state in a guest's snapshot.
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
`tests/silbon.browser.mjs` is two panas on a relay: the guest hides, the windup and the
flush reach them, a new host keeps the boss, and it falls and opens the seal.
`tests/silbon.test.js` and `carga.test.js` cover the logic, each difficulty included.
`tests/ecology.test.js` covers the food chain on every place, `tests/ecology.browser.mjs` is two panas on a relay: the guest sees the host's numbers, hides, and a new host keeps it all.
`tests/swarm.test.js` covers the swarm on every place and jornada, `swarm-perf.test.js` its budget; `tests/swarm.browser.mjs` is two panas on a relay: telegraph, guest-side bodies, draw calls, a bite, a machete, a new host.
`tests/studio.browser.mjs` opens the new models and the map in Studio.
`tests/relief.browser.mjs` covers which version each device gets, the live swap with the same draws, every shader variant compiling, `?pom=0` and a phone.
With `?debug`, `window.reliquia` exposes `room`, `view`, `state`, `me`,
`place(id, x, z, h)`, `face(h)`, `step(seconds)` and `interaction`.

Idle panas (no tool, no light) last about 50 s on floor 1 and 45 s deeper;
a group of five on floor 1 often holds two minutes.

Space (gamepad A) jumps; click/V (RT) uses the right hand. Touch has a Saltar
button. A counter carries short taps through the live room and prediction; a
5 m/s impulse with gravity 14 lands in about 0.7 s, with no double jumps.
Existing horizontal collisions still protect pits, shafts and sealed walls.
Heavy carrying, pushing, riding and downed states do not jump.

When a background host catches up a second, newly received jumps are delayed
within that simulation interval to their receive time. Otherwise a full short
jump could take off and land before a single snapshot reached the other panas.
The host assigns this delay; clients cannot supply it.
