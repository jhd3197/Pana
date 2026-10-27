# Dominó

The game is `/g/domino/`, discovered through `games/domino/game.json`.
It uses the actual shared Pana sculpt and saved avatar, seated around a 3D
wood-and-felt table in the existing Plaza Pana. The scene animates racks,
placements, arms, head movement and victory gestures. Both physical rack
raycasts and the accessible DOM rack send the same validated action.

## Classic defaults

The default table has four seats, teams 0+2 and 1+3, seven tiles each and no drawing. Double six must
open the first hand. Later hands open from the player who went out; after a
block, the lowest-pip player on the winning team opens. A tied block rotates
the opener one seat. Four consecutive legal passes block the table. The team
with fewer combined pips wins; ties score nothing. The winners score the
opposing team's remaining pips, both on going out and on a block. First to 100
wins. These house rules are described in the shared menu's Controles tab.

## Ownership and recovery

Dominó runs on its own room, `server/room.js`: the server deals (seeded from
`crypto`), runs the cachos, the turn clock and the bots (`DominoGame.tick`) and
sends each member `view(seat)`. A view carries only that seat's tiles; rivals'
hands arrive as `{ id: null }` placeholders of the right length, and the
boneyard, the RNG and the ledger never leave the server until the hand ends.
`DominoGame.accept` checks the revision and a sequence number the room assigns
itself. The room's host deals, configures and arranges. Out-of-turn moves,
impossible passes, duplicates and stale requests have no effect. Bots use only
their own hand and public ends.

`scene.js` keeps one mesh per real tile id, so a face-down rival slot borrows a
mesh nobody can see (`holders`) and keeps it while the slot stays. When a rival
plays a tile lent to another hand, the two face-down meshes trade transforms
first, so the tile leaves from the hand that played it.

Joining replaces the first available bot, retaining its hand. A fifth lobby arrival expands the table to six seats. During an active hand,
additional members watch until a vacancy is available or the host returns to
setup; a hand is never redealt merely because somebody joins. A dropped pana's
chair plays as a bot and stays theirs for the reconnect window; leaving returns
it for good. The menu holds the bots when every connected pana has it open
(`pause`). Local practice runs the same `DominoGame` in the page.

## Choosing partners

The shared `engine/play/table-seating.js` lobby picker swaps table positions, not
room member IDs. Team seats alternate: 0+2 against 1+3 in classic play, or 0+2+4 against
1+3+5 with six. Individual mode uses one score per seat. Guests may submit `seat` actions involving themselves; only the host may
rearrange two other players. These actions are accepted only in the lobby
through the existing revision/sequence ledger. Results
offer `setup` to reopen the same lobby and explicitly start scores from zero;
it preserves roster, map, RNG and ledger while clearing hands and match state.
Never reset the revision or ledger on setup: a delayed old action must remain
invalid. Ordinary next-hand/rematch buttons still work without reopening setup.
Host changes preserve the chosen positions: the table lives on the server.

The shared `engine/tests/table-seating.browser.js` proves two-client seating,
results-to-lobby, host migration and mobile controls in all three table games.

## Rendering

`table-model.js` owns the table, chair and tile factories; Studio adapters use
these exact constructors. Each factory owns its resources and exposes dispose.
Domino faces point +Y, with the first value on the -Z half. Chain layout uses
seven horizontal pieces followed by a vertical connector; every turn is a real
piece. Logical orientation must also rotate the mesh when a tile is reversed.
The scene keeps one mesh group for each tile in the selected deck and tweens its target.
Opponents' racks always use opaque backs, including from the higher camera.
The DOM rack remains available for keyboard, screen readers and small screens.

## Barks

`public/barks.js` turns new history events into speech bubbles over the
seats (`engine/play/seat-bubbles.js`, lines from `engine/play/frases.js`, seeded by the
event so every client agrees). Opening with the 6-6 is la cochina; a double
and the last tile in hand get a line; a pass says ¡Paso! the first time,
then aburrido and salado for the same pana that mano. When a mano ends
(`ended`: the render where the phase leaves `playing`), the winner shouts
¡Dominó! or ¡Capicúa! (or ¡Tranque! on a block), the partner cheers and a
rival grumbles; a finished match adds cierre/derrota. History events carry
an `id` that counts up within the mano for this. The results dialog waits
1.6 s after a live mano ends so those barks are seen; joining an ended
mano shows it at once. Quick chat also appears in the speaker's bubble.

## Proof

- `npm test -- domino`: rules, options and `room.test.js` (per-seat views, host-only
  deal, a dropped pana's chair).
- `node --test Pana/games/domino/tests/rules.test.js`: 10 rule/invariant tests,
  including 500 complete seeded bot hands, tile conservation, both orientations,
  ties, scoring, stale actions, migration, and non-overlapping full chain layout.
- `node Pana/games/domino/tests/browser.mjs [playwright-package]`: real two-client
  turns, hidden hands, host leaving, pause, scoring and next deal, mobile and local fallback.
- `node Pana/games/domino/tests/interaction.mjs [playwright-package]`: physical
  tile raycasting, rules menu, mobile label bounds and actual Studio factories.
- `npm run check`; model architecture and Studio cache regressions when changing
  model registration. Browser evidence lives under ignored `art/domino/`.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Dominó runs on its own server room with per-seat views, four or six seats and
alternating teams or individual scores. Its pure `games/domino/public/rules.js` owns deals, legal
moves, passes, scoring, the table's tick and a revision/sequence ledger. Empty seats are bots;
late arrivals inherit a bot hand and overflow visitors spectate. `scene.js` uses the shared plaza and real
seated Pana characters; physical tiles and the accessible rack share actions.
The game-local table, chair and tile factories are registered in
`web/studio/catalog/domino.js`. See `docs/knowledge/domino.md`.

## Expanded room options

`options.js` declares the shared room panel's choices. Host-only `options`
actions use the same revision/sequence ledger as moves. Invalid patches reject
atomically; active-hand settings are locked. Returning to room setup preserves
options and the action ledger while clearing match scores. Restoring default
settings keeps six seats when needed to retain seated humans; it never removes
them or silently rejects all defaults. The server connection cap is six.

Four seats/seven tiles retain double six and the old default rules. Six seats
with seven tiles or four seats with ten use double nine (55 pieces); six seats
with ten use double twelve (91). Extra tiles are an undealt reserve, never drawn.
The required opening double six is guaranteed to be dealt. Mesh and accessible
rack faces support values through twelve; six chairs, avatars, racks, labels and
the score HUD follow actual seats. Full chains scale together to remain on felt.

The host chooses teams/individual, 100/200 target, and 15/30-second or unlimited
turns. Expiry makes a deterministic legal move or legal pass; the clock runs on
the server, so a host leaving never restarts it. Pause stops it when every pana has paused.
Opening can force double six every hand, select the previous winner (with double
six only on the first hand), or pick a seeded random player with free opening.

Optional pass scoring awards ten points to the previous seat's group on each
legal pass. The hand still completes before checking the match target. Tranque
can award the opposing remaining pips to the uniquely lowest group or redeal
without hand points. A tied lowest total never picks an arbitrary winner.
Capicúa means the final tile was legal at both ends before placement; it can add
25, double the hand score, or leave scoring normal. Individual winners sum all
other hands; teammates' tiles never count as opposing points.

Quick chat uses three fixed Spanish messages through the validated room action,
not arbitrary HTML or text. Disabling it blocks sending on the host. Keyboard
1–9 and 0 choose up to ten accessible tiles. Spectators cannot chat or play.

`options.test.js` covers every option, deck conservation over 160 expanded bot
hands, protected actions and clock recovery. `options.browser.js` seats six real
clients, changes a live shared menu, checks double-twelve meshes, plays one turn
from every human, then verifies chat, clock expiry and host migration.

Restablecer also returns the table venue to Plaza in the same revisioned options action; it never races a second map action against the first snapshot.

## Bot personalities

`bot-personas.js` defines six fixed weights using only own tiles and public ends.
Thinking takes 0.72–1.40 s, seeded by RNG state, revision and seat, so restore does
not reroll the delay. The 10,000 seeded-hand gate checks completion, conservation
and a 40–60% non-tied team win envelope: seeds 1–10000 yield 5151/4691 wins and
158 ties with the current defaults. This is a regression gate for that fixture,
not a claim of universal balance across all house rules.
