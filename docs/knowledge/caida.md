# Caída

The eighth Pana game lives at `/g/caida/`. It uses the existing static server,
Three.js import map, shared Pana avatars and shared menu/settings. No build or
new dependency is required. `game.json` and `public/card.js` supply its hub tile.

## Rules of this table

- Forty Spanish cards: 1–7, 10, 11, 12 in oros/copas/espadas/bastos.
- Two or three individual players, four individual players, or four alternating
  partnership seats. All modes use three cards per hand and four opening cards.
- Match a rank to capture it and the consecutive run above it. 7 → 10 is adjacent;
  12 → 1 is not. Suits do not affect captures. The table has unique ranks.
- A caída scores only against the immediately preceding dropped card. Numbered
  cards score 1; sota/caballo/rey score 2/3/4. No partner caída bonus.
- Clearing the table scores 4 only while the stock is nonempty. It stacks with a
  caída. No clean-table points during the final three-card hand (últimas).
- Opening calls can ascend or descend. Match scores the called value; no match
  awards the next player 1. Duplicate opening ranks go to the bottom and are
  replaced without consuming the call position.
- Optional classic cantos: ronda 1–4, rondín 5, patria 6, vigía 7, registro 8.
  One highest applicable canto, on the player's turn before their first card of
  that hand. Playing forfeits an unannounced canto. No flor, cancellation, or
  automatic rondín win. Announcements publicly expose the ranks; bots use them.
- Last capturer receives table leftovers, without a clean-table bonus. Dealer
  receives them in the degenerate no-capture case. Captured-card count baselines
  are 20 for two players/teams, 13 for three individuals, 10 for four individuals.
- First to 24 wins immediately. Count bonuses resolve in order from mano.

The base reference is [KAMI's beginner tutorial](https://www.youtube.com/watch?v=Ra7xqNsxzYU).
[Caída Club's published rules](https://play.google.com/store/apps/details?id=com.GalliardGames.Caida&hl=es)
clarify mal echada and últimas. The canto values follow the Venezuelan account
[Andanza por nuestro idioma 114](https://calabozotierradedios.blogspot.com/2014/06/andanza-por-nuestro-idioma-114.html).
Regional accounts disagree on canto values; these choices are an explicit house
variant displayed in the game's shared controls menu, not a universal standard.
Stacking, counting order, three-player baseline and leftover fallback are also
explicit implementation choices. Confirm other family variants before changing.

## Structure and networking

`rules.js` is pure data: seeded shuffle, turns, legal captures, scores, cantos,
revision/sequence ledger, snapshots and migration. `previewPlay` is shared by
the rules, hints and display. `chooseMove` uses only the seat's hand and public
table, captured cards and announced ranks; it never consults hidden hands.

`network.js` implements `caida-v1` using the existing event-driven host model.
Oldest connected peer validates actions and publishes full snapshots. Empty
seats become bots; late arrivals inherit bot hands; excess visitors spectate.
Host migration preserves the RNG, stock, scores, hands and sequence ledger.
The menu pauses bots when solo; multiplayer continues while a menu is open.
Disconnected clients may explicitly open an offline local table.

As with Dominó, Pana's relay is trust-based. Full snapshots include hands and
stock for host migration. Opponents' faces stay hidden in the normal interface,
but this is not server-authoritative anti-cheat or cryptographic hand privacy.
Do not present these rooms as suitable for competitive wagers. A secure server
model would be a separate backend change.

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

## Verification

```
node Pana/games/caida/tests/rules.test.js
node Pana/games/caida/tests/browser.mjs <absolute-playwright-package>
node Pana/games/caida/tests/interaction.mjs <absolute-playwright-package>
node Pana/engine/tests/model-architecture.test.js
npm run check
```

The pure suite includes 400 complete seeded matches across four modes, checking
all 40 cards remain unique and conserved after every action. The browser suite
covers two real clients, play/preview/capture, settings, migration, complete
deals, mobile touch, offline fallback, new Studio models and hub discovery.
Screenshots are written to ignored `art/caida/`.

Validated locally on 2026-10-15: rules and browser suites passed, including
the Studio previews; keyboard/preview/camera checks passed at 390, 768, 1280
and 1440 px. Dominó's scene and ten rules tests passed after table extraction.
The model architecture browser suite passed 212 compatibility symbols and
selective cache invalidation. The final syntax check passed 339 JavaScript files.
