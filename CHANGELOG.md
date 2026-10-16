# Changelog

What changed in Pana, for the people who play it. Newest first. Every change
that players, hosts or contributors will notice adds a line under
`## Unreleased` in the same commit (see `AGENTS.md`). Each merge to `main` releases:
the release workflow stamps Unreleased with the version and date, and that section
becomes the GitHub release's notes.

## Unreleased

### Added

- **New game: ¡Embuste!, find the mummy among your panas at the camp.**
  Do chores until dawn while one or two secret mummies wrap panas, slip
  through hollow logs, pose as barrels and sabotage the camp. Report the
  statues, argue at the fogata and vote someone down the river. Each pana
  plays on their own screen; practice with bots in the browser.
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
