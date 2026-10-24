# Caída

The eighth Pana game lives at `/g/caida/`. It uses the existing static server,
Three.js import map, shared Pana avatars and shared menu/settings. No build or
new dependency is required. `game.json` and `public/card.js` supply its hub tile.

## Rules of this table

- Forty Spanish cards: 1–7, 10, 11, 12 in oros/copas/espadas/bastos.
- Two, three, four or six individual players, four alternating partnership
  seats, or two alternating teams of three. All modes use three cards per hand and four opening cards.
- Match a rank to capture it and the consecutive run above it. 7 → 10 is adjacent;
  12 → 1 is not. Suits do not affect captures. The table has unique ranks.
- A caída scores only against the immediately preceding dropped card. Numbered
  cards score 1; sota/caballo/rey score 2/3/4. No partner caída bonus.
- Clearing the table scores 4 only while the stock is nonempty. It stacks with a
  caída. No clean-table points during the final three-card hand (últimas).
- Every reparto starts with a `dealing` phase: the dealer chooses 1 (ascending)
  or 4 (descending), with neither preselected. The optional single face-down cut
  rotates the shuffled 40-card stock; it does not reshuffle or expose cards.
  Seat zero deals first, then the dealer rotates after the stock is exhausted.
  Three-card hands within that reparto continue automatically; only the four
  opening table cards use the chosen count.
- Opening calls can ascend or descend. Match scores the called value; no match
  awards the next player 1. Duplicate opening ranks go to the bottom and are
  replaced without consuming the call position.
- Optional classic cantos: ronda 1–4, rondín 5, patrulla (also patria) 6,
  vigía 7, registro 8.
  One highest applicable canto, on the player's turn before their first card of
  that hand. Playing forfeits an unannounced canto. No flor, cancellation, or
  automatic rondín win. Announcements publicly expose the ranks; bots use them.
- Last capturer receives table leftovers, without a clean-table bonus. Dealer
  receives them in the degenerate no-capture case. Captured-card count baselines
  are 20 for two players/teams, 13 for three individuals, 10 for four individuals and 6 for six individuals.
- First to 24 wins immediately. Count bonuses resolve in order from mano.

The base reference is [KAMI's beginner tutorial](https://www.youtube.com/watch?v=Ra7xqNsxzYU).
[Caída Club's published rules](https://play.google.com/store/apps/details?id=com.GalliardGames.Caida&hl=es)
clarify mal echada and últimas. The canto values follow the Venezuelan account
[Andanza por nuestro idioma 114](https://calabozotierradedios.blogspot.com/2014/06/andanza-por-nuestro-idioma-114.html).
Regional accounts disagree on canto values; these choices are an explicit house
variant displayed in the game's shared controls menu, not a universal standard.
Stacking, counting order, three-player baseline and leftover fallback are also
explicit implementation choices. Confirm other family variants before changing.
The [canto table](https://es.scribd.com/doc/213704928/59857882-Cantos-Del-Juego-de-Baraja)
also uses Patrulla for three consecutive ranks worth six points. The UI uses that
name and keeps Patria as an alias in the rules; this is a naming change, not a
new canto or a change to scores.

## Structure and networking

`rules.js` is pure data: seeded shuffle, turns, legal captures, scores, cantos,
revision/sequence ledger, snapshots and migration. `previewPlay` is shared by
the rules, hints and display. `chooseMove` uses only the seat's hand and public
table, captured cards and announced ranks; it never consults hidden hands.

`network.js` implements `caida-v2` using the existing event-driven host model.
Oldest connected peer validates actions and publishes full snapshots. Empty
seats become bots; late arrivals inherit bot hands; excess visitors spectate.
Host migration preserves the RNG, stock, scores, hands and sequence ledger.
The menu pauses bots when solo; multiplayer continues while a menu is open.
Disconnected clients may explicitly open an offline local table.

The host opens the initial table and rematch. Between repartos, either the host
or the next dealer may advance the results. `call`, `cut` and `deal` actions are
validated against the actual dealer seat, not the host, with the usual revision
and sequence checks. `start()` cannot restart a pending deal. `dealCall` resets
to null on every reparto even though `options.call` remembers the last count.
`cutAt`, `dealCall`, the rotated stock and `previousRound` survive migration.
If the dealer leaves, the replacement bot must choose a count even when the
human already cut: a cut alone does not mean the ritual is ready to deal.
Bots preserve a committed human choice and cut. Solo pause also pauses dealing.

`dealer-ui.js` owns the nonmodal dealer panel, accessible range cut, count
buttons and previous-reparto recap, using the same card-back canvas as the table.
The hand shows its available canto and explanation before its turn; only the
acting seat can announce it. Últimas gets both a transient announcement and a
persistent reminder that clean-table points no longer apply.

As with Dominó, Pana's relay is trust-based. Full snapshots include hands and
stock for host migration. Opponents' faces stay hidden in the normal interface,
but this is not server-authoritative anti-cheat or cryptographic hand privacy.
Do not present these rooms as suitable for competitive wagers. A secure server
model would be a separate backend change.

## Choosing partners and returning to setup

The lobby uses `engine/play/table-seating.js` to swap players between seats, with
alternating seats visibly grouped into avatar-card teams. Guests can move or
swap themselves; the host can select a card and arrange any seat. `seat` actions use
the same revision/sequence checks as moves and are rejected outside the lobby.
At results the host may send `setup` to reopen this room with scores reset;
the mode, cantos, difficulty, map, roster, RNG and action ledger survive. A new
deal starts from dealer zero. The usual next-reparto flow is unchanged.
Keep revision monotonic and retain the ledger when resetting a match so delayed
actions cannot apply to the new setup. Network member IDs never change on swaps.

`engine/tests/table-seating.browser.js` exercises the UI over two real clients,
including a full round, changing partners again, host departure and mobile.

## Models and interaction

`cards.js` draws original Spanish card artwork, used identically for the 3D
textures and accessible hand buttons. `models.js` owns the card and score-token
factories, registered in Studio. Cards face +Y with their long dimension on Z.
Factories own/dispose their geometry, materials and textures.

Table and chairs were extracted from Dominó to
`engine/models/props/game-table.js`. Dominó keeps backward-compatible named
re-exports, with identical default construction. Studio references the real
constructors and tracks the shared module as a fingerprint dependency.

Select with tap/click or 1–3, then confirm with the play button or Enter.
C announces a canto; H selects a suggested move. Both table cameras use the
same live scene. Screen-aligned hand buttons preserve touch readability.

## Barks

`public/barks.js` turns new history events into speech bubbles: the dealer
on `dealer` and `opening` (mal echada complains), the singer on a canto
`score`, the capturer and the `victim` on a caída (`salado` once the same
pana has been fallen on twice that reparto), the capturer and the next seat
on a mesa limpia, the `leftovers` recipient (ñapa), and a winner and a loser
when the match ends. Plain drops stay quiet. Lines come from the shared
`engine/play/frases.js` dictionary, picked with a seed built from the event, so
every client shows the same line and nothing extra is sent. Play events carry
`victim` and score events carry `reason` for this. `game.js` skips the first
render so a mid-game arrival does not replay old barks. The scene draws them with
the shared `engine/play/seat-bubbles.js` (`.pk-bubble` in kit.css): one bubble per
seat above its name chip, flipped below when the chip is near the top edge,
and above the HUD because it only lasts a few seconds.

## Verification

```
node Pana/games/caida/tests/rules.test.js
$env:PANA_TEST_URL = 'http://localhost:8470'
npm run test:browser -- caida
.\dev.ps1 check
```

The pure suite includes 600 complete seeded matches across six modes, checking
all 40 cards remain unique and conserved after every action. The browser suite
covers two real clients, play/preview/capture, settings, migration, complete
deals, mobile touch, offline fallback, new Studio models and hub discovery.
`dealing.browser.js` adds dealer-only controls, the actual cut order, a fresh
required choice on every reparto, late spectators, previous-reparto totals,
últimas, a non-host dealer advancing results, migration during preparation,
bot recovery when a dealer leaves after cutting, and Patrulla presentation.
Screenshots are written to ignored `art/caida/`.

Validated locally on 2026-10-15: rules and browser suites passed, including
the Studio previews; keyboard/preview/camera checks passed at 390, 768, 1280
and 1440 px. Dominó's scene and ten rules tests passed after table extraction.
The model architecture browser suite passed 212 compatibility symbols and
selective cache invalidation. The final syntax check passed 339 JavaScript files.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Caída uses event-driven host snapshots (`caida-v2`) with 2/3/4/6 individual
seats, four-seat partnerships or two teams of three. Its pure `games/caida/public/rules.js` owns
rank captures, caídas, optional classic cantos, the últimas exception,
scoring and the revision/sequence ledger. Empty seats are bots; late arrivals
inherit their hands, and the oldest peer preserves the match on migration.
These are trust-based rooms like Dominó, not server-private hands. Card
artwork is shared by physical meshes and accessible controls. The card and
score token are registered in `web/studio/catalog/caida.js`. Table/chair
factories are shared in `engine/models/props/game-table.js`; Dominó preserves
its old exports. See `docs/knowledge/caida.md` for explicit house rules.

## Shared map selection

Puerto Coco, Hato del Sol and Ruinas del Mango are available in the lobby.
The host chooses the setting; the selected map follows snapshots, practice,
late joins and host changes. See [shared-arenas.md](shared-arenas.md) for
layout variants, collision, table clearance, lifecycle and verification.

## Six-person tables and shared settings

The room cap is six. `six` gives six individual scores; `sixTeams` uses
alternating seats 0/2/4 against 1/3/5 and the same 20-card team baseline.
With four opening cards, the remaining 36 divide exactly into two hands of
three cards per person. Five-seat mode is intentionally absent: it would
require a separate uneven-hand house rule. Captures, cantos, últimas and the
24-point finish stay unchanged. The six-seat table scales its surface and
card placements together; all six chairs, saved panas and labels render.

The main mode selector uses the shared segmented controls and preserves the
table-seating controls. Cantos and bot difficulty use the shared Más ajustes
dialog. Host patches are
atomic: an invalid difficulty cannot resize the table as a side effect. The
lobby, practice, reset and migration preserve settings. This remains Caída;
no Truco, envido, flor or alternate-deck rules are implied by the prototype.

The camera-view control keeps a minimum top offset while the shared lobby is
closing: the scoreboard can temporarily measure zero height before its first
visible frame. Keep the scene private until `prepareScene(scene)` completes.
Exposing `world` sooner lets a room snapshot rebuild avatars while the renderer
is still compiling their materials, which can stall preparation.

`six-players.browser.js` connects six real human room clients (two rendered
views and four browser transports), plays all 36 cards through both deals,
checks the 40-card total and team scoring, and migrates the completed round.
The same-browser Billar → Bululú → Caída preparation sequence also passes
without debug mode after the preparation race fix.


### Automatic table size and team cards

The main lobby offers only **Individual** and **Equipos**. The host's chosen
format survives arrivals, departures and setup. `syncMembers()` sizes an
individual table to 2, 3, 4 or 6 seats; five humans use six seats with one bot.
Teams use four seats up to four humans and six seats for five or six. Resizing
only happens in the lobby, keeps every human and compacts occupied outer seats
before reducing the table. Live deals retain their seat count and card order.
Internal `mode` values remain for scoring and deterministic rule fixtures.

`auto-format.test.js` checks growing/shrinking both formats and preserving human
identities. The six-client browser suite chooses Equipos before the other five
players arrive and proves the table expands automatically. Shared table-seating
proof covers self-swaps, host arrangement and round transitions using avatar
cards rather than dropdowns.

## Banderín HUD

The supplied Caída HUD is adapted through `hud-banderin.css` and the opt-in
shared `engine/banderin.css`: compact scores, right-hand activity, a yellow
turn banner and a full-width reparto summary. Result progress bars read the
actual team scores toward 24. Card meshes, accessible hand buttons, dealer
ritual and the shared lobby remain functional. The narrow-screen layout moves
activity back into the action area so it does not obscure the table.
