# Dominó

The game is `/g/domino/`, discovered through `games/domino/game.json`.
It uses the actual shared Pana sculpt and saved avatar, seated around a 3D
wood-and-felt table in the existing Plaza Pana. The scene animates racks,
placements, arms, head movement and victory gestures. Both physical rack
raycasts and the accessible DOM rack send the same validated action.

## Rules of this table

Four seats, teams 0+2 and 1+3, seven tiles each and no drawing. Double six must
open the first hand. Later hands open from the player who went out; after a
block, the lowest-pip player on the winning team opens. A tied block rotates
the opener one seat. Four consecutive legal passes block the table. The team
with fewer combined pips wins; ties score nothing. The winners score the
opposing team's remaining pips, both on going out and on a block. First to 100
wins. These house rules are described in the shared menu's Controles tab.

## Ownership and recovery

The lowest connected relay ID is host. Snapshots are event-driven, not 20 Hz:
this is a turn-based game. `DominoGame.accept` checks both the current revision
and a per-player monotonically increasing sequence number. Only the host can
deal. Out-of-turn moves, impossible passes, duplicates and stale requests have
no effect. Bots use only their own hand and public ends when choosing a move.

The snapshot includes every hand so another client can restore the game after
host departure. This follows Pana's existing trusted-friends architecture;
hidden opponent hands are presentation privacy, not server-enforced anti-cheat.
Do not advertise this as competitive hidden-information security.

Joining replaces the first available bot, retaining its hand. With four human
seats occupied, additional members watch and fill a vacancy in arrival order.
Leaving returns a seat to a bot. Reconnect gets a new relay ID and occupies
the first available seat; it does not guarantee the old seat. A new empty room
starts fresh rather than restoring stale disconnected state. Local fallback
creates a fresh solo table and disables the network invite button.

## Choosing partners

The shared `engine/table-seating.js` lobby picker swaps table positions, not
room member IDs. Teams remain seats 0+2 and 1+3. Only the host can submit `seat`
actions, in the lobby, through the existing revision/sequence ledger. Results
offer `setup` to reopen the same lobby and explicitly start scores from zero;
it preserves roster, map, RNG and ledger while clearing hands and match state.
Never reset the revision or ledger on setup: a delayed old action must remain
invalid. Ordinary next-hand/rematch buttons still work without reopening setup.
Snapshots and host migration preserve the chosen positions.

The shared `engine/tests/table-seating.browser.js` proves two-client seating,
results-to-lobby, host migration and mobile controls in all three table games.

## Rendering

`table-model.js` owns the table, chair and tile factories; Studio adapters use
these exact constructors. Each factory owns its resources and exposes dispose.
Domino faces point +Y, with the first value on the -Z half. Chain layout uses
seven horizontal pieces followed by a vertical connector; every turn is a real
piece. Logical orientation must also rotate the mesh when a tile is reversed.
The scene keeps one mesh group for each of the 28 tiles and tweens its target.
Opponents' racks always use opaque backs, including from the higher camera.
The DOM rack remains available for keyboard, screen readers and small screens.

## Proof

- `node --test Pana/games/domino/tests/rules.test.js`: 10 rule/invariant tests,
  including 500 complete seeded bot hands, tile conservation, both orientations,
  ties, scoring, stale actions, migration, and non-overlapping full chain layout.
- `node Pana/games/domino/tests/browser.mjs [playwright-package]`: real two-client
  turns, host migration, pause, scoring and next deal, mobile and local fallback.
- `node Pana/games/domino/tests/interaction.mjs [playwright-package]`: physical
  tile raycasting, rules menu, mobile label bounds and actual Studio factories.
- `npm run check`; model architecture and Studio cache regressions when changing
  model registration. Browser evidence lives under ignored `art/domino/`.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Dominó uses event-driven host snapshots (`domino-v1`), with four seats and
alternating teams. Its pure `games/domino/public/rules.js` owns deals, legal
moves, passes, scoring and a revision/sequence ledger. Empty seats are bots;
late arrivals inherit a bot hand and overflow visitors spectate. Host migration
preserves all hands, RNG and scores. `scene.js` uses the shared plaza and real
seated Pana characters; physical tiles and the accessible rack share actions.
The game-local table, chair and tile factories are registered in
`web/studio/catalog/domino.js`. See `docs/knowledge/domino.md`.
