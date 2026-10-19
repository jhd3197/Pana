# Póquer — Texas Hold'em y Omaha

`/g/poquer/` is six-seat Hold'em or Omaha with free chips and selectable betting limits. The private server
`PokerRoom` extends `PanaRoom`. `Poker` is a DOM-free rules engine also used by
local practice. No accounts, payments, cash-outs or persistent bankrolls.

## Privacy and continuity

Never store the deck or hole cards in Colyseus schema state. Each client gets
only `Poker.view(itsSeat)`: other players' cards are null until a showdown,
and folded cards stay private even then. Bots evaluate their own hand only.
Server hand state survives host departures. A disconnected player folds
immediately unless already all-in; an all-in hand remains eligible to win.
Late arrivals wait until the next hand. Reconnection cannot unfold a hand.

Only the room host deals. Human turns have a host-selected 20- or 40-second deadline; expiry checks
if free or folds if facing a bet. A revision accompanies every action so a
duplicate action cannot consume a later turn. The shared room kit owns seats,
host selection, reconnection and invitations.

## Betting and settlement

- 1,000 or 5,000 initial chips; small/big blinds 10/20 or 50/100. With
  recompras enabled, zero stacks refill to that buy-in on the next hand.
  With recompras disabled, busted players watch and do not receive cards. One human receives three bots; two or more humans play without bots.
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
  ace-low straights, two trips, kickers and board-only ties. Omaha deals four
  private cards and evaluates exactly two of them with exactly three board cards.

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

`engine/worlds/table-world.js` supplies the same sky, plaza, lighting and perspective
framing as Billar. The canvas fills the viewport. Reset inline CSS dimensions
from `bindRenderer` before measuring, and fit game bounds to the space clear of
HUD panels. The shared settings menu offers plaza and overhead cameras.

## Notes for agents

The shared avatar-card roster swaps player order with `seat` messages
validated against the current revision. Guests may swap their own seat; only
the host may arrange two other players. Poker remains individual play.
After results, `setup` returns to the same lobby, clearing dealt cards and bets
while retaining each player's bankroll and the previous dealer's identity.
`reseat` updates the dealer index to follow that identity; otherwise a seat swap
would silently change who pays the next blinds. No seating edits are accepted
during a hand. Only filtered `view()` data is published after setup or swaps.
`engine/tests/table-seating.browser.js` proves this with two real clients.

Never send a complete game snapshot to a client, even the host. Keep the deck
inside the rules instance on the server. Only reveal live showdown hands.
Do not replace side-pot accounting with an equal split of the entire pot.

## Prototype room options

`public/options.js` describes the shared main settings and Más ajustes panel.
The server accepts a strict options patch only from the host, at the current
revision, while in the lobby. Snapshots include the validated options; client
practice uses the same `Poker.configure()` and copies the chosen settings.
Changing the initial stack explicitly resets each seat to that buy-in; returning
to the lobby without changing it retains the bankroll. Configuration never
changes a live hand.
Reset passes the default map alongside the options in the same validated
`options` action. `Poker.configure(patch, mapId)` rejects either invalid input
before changing chips, options or the map, and publishes one new revision.

- Texas uses two hole cards; Omaha uses four and the exact two-plus-three rule.
  The 3D hand fan centers around all four cards; opponents still receive nulls.
- Pot-limit caps the raise total at `currentBet + pot + call`. A raise below the
  minimum is allowed only when it consumes that player's entire stack, not just
  because it hits a pot-limit cap.
- Fixed-limit uses the big blind as the flop/preflop bet and twice the big blind
  on turn/river. A street allows four full bets (the preflop big blind counts as
  the first). Short all-ins retain the existing reopening protection.
- Blind progression doubles the base blinds every 5 or 10 elapsed minutes from
  the first hand, or stays fixed with Nunca. Compute the new level only when
  dealing the next hand; server time and a persistent start timestamp make this
  independent of client clocks and host migration.
- Mostrar cartas al final = No still settles all side pots on the server, but
  opponents' hole cards and evaluated hand names remain private in every view.
- Both practice and online play apply the selected turn deadline. Practice stops
  its timer in the shared pause menu; online play checks or folds on timeout.

`tests/options.test.js` covers every choice, exact Omaha combinations, limits,
blind progression without wall-clock waits, elimination/rebuy, privacy, and 150
randomized six-player hands across both variants and all three limits with chip
conservation. `tests/options.browser.mjs` proves two real clients synchronize
settings, reject guest edits, see four private Omaha cards, settle a hidden
showdown, enforce pot-limit and apply the selected server turn deadline.
