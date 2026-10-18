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

The shared 3D pana sits on the same chairs as Caída around a physical oval table
in the plaza. `engine/models/props/poker.js` owns the table, textured cards and
batched chip stacks, all registered in Studio. Community cards and dealt hands
are meshes on the felt; the private hand also has a readable HUD copy. The
community DOM representation remains available to assistive technology.

Only the player's private server view reaches the renderer. A `null` card
creates a back texture, never a concealed face; folded hands leave the table.
Chip stacks reflect the current bankroll, wagers and pot. Stack geometry is
batched to two material draws, avoiding hundreds of tiny draws on phones.

`engine/table-world.js` supplies the same sky, plaza, lighting and perspective
framing as Billar. The canvas fills the viewport. Reset inline CSS dimensions
from `bindRenderer` before measuring, and fit game bounds to the space clear of
HUD panels. The shared settings menu offers plaza and overhead cameras.

## Notes for agents

The shared lobby seating picker swaps player order with host-only `seat`
messages validated against the current revision. Poker remains individual play.
After results, `setup` returns to the same lobby, clearing dealt cards and bets
while retaining each player's bankroll and the previous dealer's identity.
`reseat` updates the dealer index to follow that identity; otherwise a seat swap
would silently change who pays the next blinds. No seating edits are accepted
during a hand. Only filtered `view()` data is published after setup or swaps.
`engine/tests/table-seating.browser.js` proves this with two real clients.

Never send a complete game snapshot to a client, even the host. Keep the deck
inside the rules instance on the server. Only reveal live showdown hands.
Do not replace side-pot accounting with an equal split of the entire pot.
