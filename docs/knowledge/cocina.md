# Pana Cocina

The game has no build step. Open `/g/cocina/`; `game.json` and `public/card.js`
automatically add it to the hub. All customer-facing text is Spanish.

## Simulation and relay

`rules.js` has no renderer or browser dependencies. A host runs the kitchen at
20 Hz; peers send camera-relative movement and sequenced actions inside `v`.
The discriminator is `cocina-v2` in a `cocina:<code>` relay room. Only the host
can start/replay. The host validates interaction distance, stage and cooldown.
The oldest connected member becomes host. Unlike Hunt, Cocina restores the
latest snapshot instead of discarding a live turn; stale human entries and
station ownership are removed. New arrivals can immediately help.

The menu is the shared one from `engine/ui.js` (see `pana-ui.md`).
In solo or local practice the menu pauses simulation. In multiplayer it only
stops that user's input. Input is cleared on blur and expires on the host after
600 ms. A failed connection offers an explicit local kitchen; it does not
silently move people away from their friends.

## Food and helpers

Each ingredient bin gives a complete recipe kit. It takes 2.4 seconds on a prep
table, then 5–8 seconds on a stove, then serving at the counter. Ready food burns
after another 12 seconds; two interactions extinguish and clear the stove.
The shared counter swaps held items so people can pass dishes. Orders expire
independently. Three stars require 350 / 850 / 1500 points. Helpers fill the team
to three and can be disabled before a turn.

Navigation trap: a helper's goal-node tolerance must be inside the actual
interaction radius. Using a 1.05-unit goal distance and a 1.0-unit interaction
distance made helpers stop forever just outside a table. The helper interaction
threshold is now 1.13, below the simulation's 1.15 limit, with a 0.08 node-arrival
tolerance. Full-turn tests prove helpers actually deliver food.

## Shared assets

The plaza moved to `/engine/plaza.js` and the original map data to
`/engine/plaza-layout.js`; Escondidas keeps compatibility modules. Cooking uses
`createPlaza({cooking:true})` for a cleared courtyard and its own colliders.
Static kitchen props and cached food models are baked by material to keep draw
calls low. Cached food geometry and materials must not be disposed with an actor.

Characters have a raised body and two independent legs by default. Cocina uses
`chef:true`; saved fur, outfit colors, glasses and face remain intact. Derrape's
driver opts into `seated:true` to keep its original seat height. Arms are only
automatically animated when `walk` or `carry` is supplied, preserving existing
manual waving/cheering behavior.

## Verification

`node --test Pana/games/cocina/tests/rules.test.js` exercises all recipes, burning,
handoffs, collisions, helper navigation, order expiry and snapshot recovery.
`tests/browser.mjs` accepts an external Playwright package path, with optional
Chromium path; no runtime package was added. It tests real peers, mobile input,
host departure, replay, offline recovery and existing games. `PANA_QA_OUTPUT`
can point to a local directory for screenshots. `?debug` exposes `window.cocina`
with the host simulation and test placement/advance helpers.

Browser interaction fixtures must await `PANA_LOBBY_LOADING === false`, including
late joins: a connected room can precede prepared shaders. The three-client suite
extends its fixture round to ten minutes so software rendering cannot end it
before the touch and host-migration assertions; it still ends the round explicitly
to test results/replay. `PANA_QA_COMPACT=1` reduces desktop rendering cost.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

- The kitchen is 3D with an isometric (orthographic) camera on purpose: every
  station stays readable at once, like a cooking-rush board. It is the one
  orthographic exception in `tests/conventions.test.js` (`ISOMETRIC`); other
  games use a perspective camera.

Cocina also uses a host simulation at 20 Hz (`cocina-v2`). Host migration
restores the last kitchen snapshot, including orders and active food. See
`docs/knowledge/cocina.md`. Plaza scenery and the original hunt layout now
live in `engine/plaza.js` and `engine/plaza-layout.js`; cooking has its own
station layout and collision rules. Existing Escondidas paths re-export them.


## Room options

The shared lobby panel configures Mercado/Playa, three/five-minute shifts,
customer difficulty, arepas-only orders, customer expiry, fast burning,
combo tips and a move to the other kitchen halfway through the shift. The
beach uses Puerto Coco's shared scenery around the same station footprint;
food, held dishes and orders survive the move. Difficulty sets three/four/five
simultaneous orders and patience multipliers 1.5/1/0.65. Disabling impatient
customers freezes their timers. Fast fire leaves five seconds after cooking
instead of twelve; disabling tips keeps each recipe's base points.

Only the host configures the lobby/results. Options, the current kitchen and
whether the move happened are included in snapshots and restored on host
migration. Starting again preserves room choices while resetting the shift.
Eight humans can still join, replacing helpers as before.
