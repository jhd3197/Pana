# Changelog

What changed in Pana, for the people who play it. Newest first. Every change
that players, hosts or contributors will notice adds a line under
`## Unreleased` in the same commit (see `AGENTS.md`). Each merge to `main` releases:
the release workflow stamps Unreleased with the version and date, and that section
becomes the GitHub release's notes.

## Unreleased

### Added

- **Play Bolas Criollas on a shared 3D court, as a full game or a Bululú minigame.**
  Invite up to four panas for red-versus-green matches with bots, eight balls per
  team, arrimes, ground boches and 12- or 24-point house rules. Bululú adds a quick
  two-throws-each contest. Both use saved panas, rolling collisions and a visible
  aiming guide; the court and balls are also available in Pana Studio.

- **Derrape's grass and trees gain procedural surface detail that follows graphics quality.**
  Seeded ground patches, visible 3D grass tufts, leaf mottling and bark grain
  enrich the circuits and their Studio previews. Rápida keeps simple surfaces;
  Equilibrada adds sparse tufts and Nítida fills out nearby grass, fading with distance.

- **Caída lets each dealer cut the deck and choose 1 or 4 before every reparto.**
  The choice now happens at the table, with the previous reparto's score nearby.
  Patrulla and the other cantos explain themselves beside your hand, and Últimas
  announces the final hand and its no-clean-table-bonus rule.

- **Race through Puerto, Derrape's new La Guaira-inspired coastal circuit.**
  Drive past container stacks and harbor cranes, colorful colonial houses and
  a hilltop fort overlooking the bay. The 2.45 km circuit works in local and
  online races; six reusable harbor models are also available in Pana Studio.

- **Pana Studio can generate and customize Venezuelan-inspired colonial houses.**
  Generate collections of 50 houses from six families, six window designs,
  three roof shapes and three facade layouts, with balconies, porches and plants.
  Four wall finishes add soft plaster shading and small painted or exposed-brick
  patches, with their own seeded variation and lock.
  Edit each house, lock choices while rerolling, save or load JSON collections,
  and preview ten houses on Calle de las flores.

- **Derrape adds eleven scenery models to its towns, coasts and countryside.**
  Cafés, fountains, market carts, fishing structures, port equipment and other
  landmarks now appear across six circuits and are available in Pana Studio.
- **Escondidas reshuffles its objects every round and gives you more time to hide.**
  All four maps get fresh prop positions and orientations shared by everyone in
  the room. Hiding now lasts 30 seconds by default; hosts can choose 15, 20, 30,
  45 or 60 seconds in the lobby, including local practice.
- **Choose three new shared maps for Escondidas, Paintball, Billar and Caída.**
  Puerto Coco, Hato del Sol and Ruinas del Mango bring distinct hiding routes,
  paintball cover and scenery. Hosts preview and choose the map in the lobby;
  table games use a clear central courtyard, and friends joining later see
  the same setting. The original plaza and paintball court remain available.
- **Derrape brings five new scenery models from the circuit artwork into the races.**
  Plaza Pana gains an open music pavilion and a boat-repair yard; Salinas gains
  salt-harvesting machinery and flamingos along its pink ponds. El Estadio has
  detailed tire workshops, and Isla Bululú has its own boat yard. All five are
  available in Studio; optional bird colonies follow the shared quality setting.
- **Derrape adds assisted drifting, car specialties, safer recoveries and clearer item counterplay.**
  Aguacero advances toward the leader in timed waves; the faster chancleta
  pursues distant leaders. Car contacts stay grounded, and starts, rescues and
  repeated impacts grant brief ghost protection. Drift, slipstream, jump and
  surface talents make car and tire combinations matter. Gentler drift steering,
  predictive edge help and stable turbo exits make corners easier to learn;
  a release cue shows when a turbo is ready. Road wear and sector
  pennants add circuit detail; shared quality settings now also reduce shadows,
  weather and optional scenery without changing handling or pose frequency.
- **Play paintball and Texas Hold’em with your panas, or practice against bots.**
  ¡Pintura! brings a 3D arena for up to eight players with cover, reloads,
  respawns and two-minute rounds. Póquer seats up to six with private cards,
  free chips, no-limit betting, side pots and showdowns. Both use your saved
  pana, shared invitations and menus, touch controls and local bot practice.
- **Billar brings eight-ball pool to Pana for two friends or solo practice.**
  Aim with mouse, touch or keyboard, choose shot power and pocket your group
  before the eight. Shared rooms keep turns, fouls, ball in hand and rematches
  in sync, including an unfinished shot when the host leaves.
- **Bululú lets up to four panas play the board and minigames together online.**
  Share a room invitation, take your own turns and control your own pana;
  bots fill empty spots, and local practice remains available. If the host
  leaves, another player continues from the current turn or minigame checkpoint.
- **Derrape guides you from your panas to the starting grid in four illustrated steps.**
  Choose solo, split screen or online, customize your real car, browse twelve
  illustrated circuits and three cups, then race. Layered festival artwork adds
  gentle pointer parallax; circuit art accompanies real loading progress, with
  reduced-motion support and a start button that stays visible on phones.
  Returning to the first step in an online room keeps its message above the navigation.
  Earned trophies and older-edition badges remain visible on cup choices after reloading.
- **Water shaders, living weather, and tactile game feel across Pana.**
  Water surfaces and waterfalls add multi-wave displacement, dual caustics, crest foam, counter-scrolling ripples, and wave-synced boat buoyancy; tracks and islands add wind-swaying trees, angled rain with splashes, lightning and thunder, drifting snow, and post-shower rainbows; buttons, dashes, explosions, coin pickups, hold-to-charge triggers, and supply chests gain squash-and-stretch, shockwave rings, scorch decals, magnetic pull-in, flying HUD counters with combo badges, and rarity light and audio.
- **Derrape adds Copa del Agua and four independently playable circuits.**
  Race salt ponds, delta villages, river caves and the Tepuy waterfall in a
  four-stage championship; Studio previews use the same track constructors.
- **Salinas gives racers a dry line beside its shallow-water crossing.**
  Road geometry, tire grip and visible water agree; repeated cups release
  their signs and flag textures, portrait touch controls fit small phones,
  the portrait podium stays above the standings, and full rooms report their
  capacity correctly.
- **Grand Prix keeps each pana's complete appearance through the championship.**
  Paint, horn and flame choices follow the frozen entrant, and podium portraits
  show the actual racers. Bululú shares the waterfall effect and Galope adds a
  shelter to its existing lagoon landing.
- **Derrape draws full racing grids with fewer calls while preserving the cars.**
  Rigid parts share draw batches with their original colors; drivers, wheel
  steering, suspension, flags and breakaway pieces keep their animations, while
  the body paint retains its customization material. The water circuits also
  group their unchanged vegetation into fewer draw batches.
- **Derrape keeps your online Grand Prix together across four races.**
  Copa Pana and Copa Aventura carry the same rivals, official standings and
  one-time rewards through map changes, with synchronized loading and reload recovery.
- **New game: Curiara, race dugout canoes down the Amazonas.**
  Paddle with A and D in rhythm (no throttle): alternate to go straight,
  stroke the same side twice to turn and hit the gold sweet spot for a
  ¡Remazo!. Read the chorro through a jungle caño (or gamble on the igapó
  cut), pick a lane down the raudales under the Autana tepui and cross the
  Río Negro past toninas, caimanes and a remolino to the churuata. Hits,
  bad drops and bumps fill the tip meter until you capsize; Space throws a
  ¡Salpicón! at the canoe beside you. Up to 8 panas online, bots fill in.
- **Curiara has Parejas: two panas share one canoe.** The proa paddles,
  the popa holds the rudder, back-paddles and throws the salpicón, and a
  tap right with the stroke calls ¡Ahora! for 15% more.
- **Bululú has three river minigames: ¡Remada!, ¡Raudal! and ¡Remolino!.**
  Sprint 120 m in rhythm, dodge rocks and jump ledges down four rapids for
  mangos, or paddle away from a growing whirlpool and shove the others in.
- **Bululú has ¡Chinazo!, a slingshot minigame against the iguanas in the mango tree.**
  Aim with the mouse (or WASD, or drag a finger), pull the china and let
  go: stones take a moment to land, so lead the runners. Three mamones a
  load, a golden iguana worth 3, a guacamaya that costs 2 and a ¡Plaga!
  for the last 10 seconds.
- **Iguanas sun themselves around Pana's maps.** Look for them on
  Bululú's beach rocks and lighthouse, Pana Gas in the Desierto, limbs over
  Curiara's caño, Galope's fence posts and the plaza church's wall.
- **Contributors have a phased roadmap for Derrape Grand Prix and four new water maps.**
  Plan 56 specifies three four-race cups, online championship continuity,
  shared scenery and verification across 22 implementation phases.
- **New game: ¡Embuste!, find the mummy among your panas at the camp.**
  Do chores until dawn while one or two secret mummies wrap panas, slip
  through hollow logs, pose as barrels and sabotage the camp. Report the
  statues, argue at the fogata and vote someone down the river. Each pana
  plays on their own screen; practice with bots in the browser.
- **Bululú has an ¡Embuste! minigame.** One of the four panas is secretly
  a mummy faking the chores; watch for sand, then vote it out.
- **Play Derrape with a controller or with a pana on the same screen.**
  Gamepads drive and fire items, two players can race in split screen,
  and the HUD warns about wrong-way driving and incoming items, shows
  your best lap and lets you look behind with C.
- **Derrape has a taller to spend your coins.** Every race pays into a
  wallet you keep; paint your car, swap the horn or change the turbo
  flame. Cup trophies show in the garage and unlock mirror mode, gold
  paint and a rainbow flame.
- **Derrape's tracks fight back.** Fall off or get stuck and a zamuro
  carries you back (or press R), take plank shortcuts on three tracks,
  dodge cows, a bus and rolling boulders, race to a Venezuelan groove
  per track, and pack rain cauchos for wet Selva and Páramo.
- **Derrape has cups, balloon battles and race options.** Win the Copa
  Mango or Copa Arepa across four tracks for a gold, silver or bronze
  trophy, pop rivals' balloons in Globos, and pick easy, normal or hard
  rivals, 1 to 5 laps and mirror mode before you start.
- **Derrape has six new items.** A cohete that chases the car ahead, the
  chancleta that drops on the leader, a totuma shield, exploding trap
  crates, an aguacero that soaks everyone ahead and a jarra with three
  turbos. Ten coins power up whatever you use next.
- **Derrape has real drifting.** Hold Shift (or the Derrape button) in a
  bend: sparks go blue, orange and purple, and letting go fires a turbo.
  Time the gas on the countdown for a rocket start, do tricks off ramps,
  ride a rival's slipstream, and watch your coins: hits knock them off.
- **Bululú has a new card minigame, ¡Caída!** Cards flip onto the table; slam
  first when one matches the number before it, but a wrong slam costs a point.
  Minigames now come up shuffled instead of always in the same order.
- **¡Un, dos, tres, momia! joins Bululú.** Run for the relic while the temple
  mummy counts and freeze when she turns; hide as a barrel to sneak closer.
- **¡Coleo! comes to Bululú.** Chase bulls down the manga on horseback, get
  right behind one and pull its tail to tumble it; most bulls wins.
- **¡Choque de carritos! brings the Derrape karts to Bululú.** Bump the others
  off a platform over the sea while its edge falls away. On phones, minigames
  that move in every direction show a d-pad.

### Changed

- **Play Billar, Póquer and ¡Pintura! inside Pana's 3D plaza.**
  Pool has a physical table, balls, cue and perspective aiming. Poker deals
  cards onto the felt beside real chip stacks and seated panas. Paintball
  follows your pana through a court built with shared town assets, with camera
  orbit, touch controls and an optional overview. Fullscreen worlds replace
  the inset tables; the new equipment is available in Pana Studio.

- **Derrape's championships are now Copa Pana and Copa Aventura.** Each has a
  new four-track order; Mango and Arepa trophies, coins and cosmetics stay
  earned, with old route wins labeled "Edición anterior" instead of counting as
  wins on the new routes.
- **Derrape Grand Prix now keeps the same eight racers for all four rounds.**
  Rival looks and cars stay fixed, each track has its own lap preset, later grids
  follow championship position, and local split screen and mirror work throughout.
- **Grand Prix garage previews, standings and podiums show the full cup story.**
  Selecting a cup lists all four circuits with lap presets and estimated duration;
  results show stage points, rank changes, tiebreaks, a 12-second next-track
  intermission, a championship podium and one-time coin receipts.
- **Contributors have one shared Grand Prix championship rulebook.** The pure
  renderer-free rules cover stable entrants, seeded grids, stage result ledgers,
  points, DNF/DNS/retirement and championship tiebreaks for local and online play.

### Fixed

- **Bululú's dice show the numbers you rolled instead of always showing two fours.**
  The result faces turn toward the camera when the dice stop, and online guests
  see the correct faces even when consecutive rolls repeat.

## 0.1.0 - 2026-10-16

### Added

- **Race Derrape online with up to 8 panas.** Open a room from the garage or a
  shared link; each pana drives their own car, bots fill the grid, and the room
  keeps the order, finish times and results in sync.
- **Every game ends on the same results card.** Standings, scores and the
  "again" button sit in the same place in every game, and long names wrap instead
  of breaking the layout.
- **Crowns, coins, mangos and hearts are drawn icons.** Phones no longer swap them
  for their own emoji, so Derrape's items, Bululú's winners and Reliquia's health
  look the same everywhere.

### Changed

- **Online play runs on Colyseus rooms.** Rooms choose the host, hand it over at
  once when the host leaves, and give a dropped pana 20 seconds to come back to
  the same seat.
- **Invite links carry only the room.** A shared link no longer passes on your
  name, debug switches or the party lead role.
- **Bululú is listed as a solo game.** The hub no longer offers "Crear sala" or
  room links for it.
- **Rules buttons in Caída and Dominó lose their arrow,** since they open a
  dialog rather than another page.

### Fixed

- **"Crear sala" no longer copies a dead link** for single-player games.

**Every merge to `main` is now a release.** The changelog's Unreleased notes become
the GitHub release notes, under a version tag.

For contributors: `npm test` runs every unit test plus `Pana/tests/conventions.test.js`,
`npm run test:browser` runs the Playwright suites, `.\dev.ps1 check` runs both
locally and CI runs the checks on every push to `dev`. `AGENTS.md` now holds only
the rules; per-area notes live in `docs/knowledge/`.

## Before the changelog

The games as they first arrived (dates from the git history).

### Caída (2026-10-15)

A 3D Spanish-card table in Plaza Pana. Reach 24 points with caídas, clean tables,
opening calls and optional classic cantos. Play solo with bots or share a private
room for two, three or four players, including partnerships. Includes capture
previews, touch/keyboard controls, shared Pana characters, card counting, replay,
offline fallback and host migration. The table's exact rule variant is explained
in the controls menu. Spanish cards and score tokens are also available in Pana
Studio.

### Dominó (2026-10-15)

A 3D domino table in Plaza Pana, with your actual saved characters seated around
it, wooden chairs, coffee and animated physical tiles. Play four-seat partnership
dominoes to 100, solo with bots or with up to four human players. Includes
both-end placement, legal passes, blocked-round scoring, touch/keyboard controls,
a table camera, shared invitations and host migration. Additional visitors watch
until a seat opens. The table, chair and domino tile are also available in Pana
Studio.

### Reliquia (2026-10-15)

A cooperative expedition into an abandoned mine and the temple beneath it.
Explore with your saved pana, fight wrapped guardians, activate two timed winches,
retrieve the sun relic and return to camp together. Includes dodging, healing,
revives, adaptive encounter pacing, touch controls, late joining, host migration
and replay. Play solo or share a room with up to 8 panas; the first expedition is
designed around small groups.

### Galope (2026-10-15)

Horse racing around a 482-metre Llanos ranch circuit. Ride your saved pana
through two shallow esteros, jump three logs per lap and manage stamina over two
laps. Choose a horse coat, race against the hato's jinetes or invite up to 8
panas. Includes touch controls, shared settings, ordered checkpoints, results,
replay and host migration. The surrounding hato opens onto an irregular lagoon
with an island and a winding morichal channel, with caneyes, chinchorros, a canoe
landing and native grassland. Thirteen new reusable models are also available in
Pana Studio.

### Pana Cocina (2026-10-14)

A cooperative three-minute cooking rush in Plaza Pana. Collect ingredients,
prepare arepas, cachapas, tequeños and empanadas, mind the stoves, and serve
before orders expire. Play with two bot helpers or invite up to 8 panas. Includes
touch controls, shared counters, fire recovery, team scores and replay. Panas
have animated legs, and the kitchen crew wears chef hats and aprons over their
saved outfits.

### Escondidas · Pana Hunt (2026-10-14)

Hide in a colourful market plaza as a barrel, crate, cooler, plant or bench.
Three transformations per round; 15 seconds to hide, then 100 seconds to hunt.
Play solo with bots or share a room with up to 8 panas. Roles rotate, with four
rounds for a small group and up to eight for a full room. Uses the same saved
character, Bululú foliage, and market props also featured in Derrape's Los
Llanos track.

### Bululú (2026-10-14)

A party board game on Mango Island. Roll the dice, collect monedas, buy the
*Mango de oro*, and win a minigame after every round.

### Derrape (2026-10-14)

A goofy toy-car race. Jump ramps, flip over, lose your bumpers, honk *La
Cucaracha*. Your pana (made in the hub) is the driver. Choose from eight
circuits, including Plaza Pana and Isla Bululú. Collect coins for up to 8% extra
speed, smash wooden supply crates and carry two items. Throw forward with
**Space**, backward with **X**, and switch with **Q** or **1/2**. Keep a mango
equipped to block an incoming mango; each block spends one mango. The garage
previews all eight detailed cars and five swappable wheels (cauchos), and touch
controls are available on phones. The plaza buildings, island terrain, trees and
scenery use the same shared sources as the other games, so asset improvements
carry through everywhere.
