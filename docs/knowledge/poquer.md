# Póquer — Texas Hold'em

`/g/poquer/` is six-seat no-limit Hold'em with free chips. The private server
`PokerRoom` extends `PanaRoom`. `Poker` is a DOM-free rules engine also used by
local practice. No accounts, payments, cash-outs or persistent bankrolls.

## Privacy and continuity

Never store the deck or hole cards in Colyseus schema state. Each client gets
only `Poker.view(itsSeat)`: other players' cards are null until a showdown,
and folded cards stay private even then. Bots evaluate their own hand only.
Server hand state survives host departures. A disconnected player folds
immediately unless already all-in; an all-in hand remains eligible to win.
Late arrivals wait until the next hand. Reconnection cannot unfold a hand.

Only the room host deals. Human turns have a 30-second deadline; expiry checks
if free or folds if facing a bet. A revision accompanies every action so a
duplicate action cannot consume a later turn. The shared room kit owns seats,
host selection, reconnection and invitations.

## Betting and settlement

- 1,000 initial chips; small/big blinds 10/20. Zero stacks refill on the next
  hand. One human receives three bots; two or more humans play without bots.
- A raise amount means the player's total contribution in this street.
- Track the last full raise separately from the current bet. A short all-in
  adds pending calls but does not automatically reopen raising. `actedAt`
  allows cumulative short raises to reopen action only at a full-raise size.
- The big blind still gets an option after callers. Heads-up: dealer posts
  the small blind and acts first preflop; the other player acts first later.
- With no further possible betting, burn/deal through the river immediately.
- Side pots use contribution levels, including dead/folded contributions.
  Uncalled excess returns to its owner. Split-pot odd chips go clockwise
  after the dealer. Tests check integer chip conservation.
- Hand ranking examines all five-card combinations out of seven, including
  ace-low straights, two trips, kickers and board-only ties.

## Proof and rendering

`tests/rules.test.js` includes ranking, privacy, blinds, short raises, side
pots, odd chips, departures and 200 deterministic randomized legal hands.
`npm run test:browser -- poquer` proves distinct private views over real rooms,
betting through showdown, conservation, rematch, host departure, new arrivals,
local bots, shared pause, and mobile layouts. `qa/` screenshots stay ignored.

The shared 3D pana is seated around a Three.js felt table. HTML cards and
controls remain sharp and accessible. Card suits use SVG artwork to avoid
platform-dependent emoji glyphs. The canvas resets the inline dimensions
from `bindRenderer` to its container before sizing.

## Notes for agents

Never send a complete game snapshot to a client, even the host. Keep the deck
inside the rules instance on the server. Only reveal live showdown hands.
Do not replace side-pot accounting with an equal split of the entire pot.
