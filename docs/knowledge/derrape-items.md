# Derrape vehicles, crates and combat

Implemented 2026-10-14 with the existing Three.js 0.160.0 CDN imports; no new
runtime dependencies. Derrape still runs a local four-car race with bots.

- `item-rules.js` owns two slots (`inventory`, `selected`), each with its own
  `rolling` timer. Picking a reserve must not disable an already-equipped mango.
  Depletion promotes the other slot without resetting its timer. A full inventory
  leaves the crate intact; it never overwrites an existing item.
- Space/E throws forward; S/Down + Space/E or X throws backward. Q switches;
  1/2 selects directly. Matching on-screen buttons work with pointer/touch, with
  independent multi-touch driving controls. Lost focus, cancelled touches, garage
  return and restarting release all movement input.
- Esc (or the on-screen Pausa pill) opens the shared pause menu and freezes the
  fixed-step loop; Reiniciar carrera and Volver al garaje live there. Esc only
  cancels straight to the garage while a track is loading. In the garage, Esc
  and the Ajustes button open the same menu for settings.
- A ready, equipped mango is visibly held behind the car and automatically blocks
  one incoming mango per charge. Reserve items do not defend; juice and peels do
  not defend. Triple mango spends one charge. A block consumes the projectile
  without crashing or removing vehicle parts. Peels remain ground hazards.
- **Backward throws used to turn forward:** road following assumed `s + 10`.
  Projectiles now retain a signed direction relative to the track tangent and aim
  at `s + direction * 10`, while seeking only targets in front of their own travel.
- Coins grant +0.8% top speed each, capped at ten / +8%. `coinsCollected` counts all
  pickups for results, including extras after the cap. Race order remains based
  on laps, progress and finish time. Coin lines respawn after eight seconds;
  crates after 2.5. Both use local terrain height and swept pickup checks.
- Crate visuals bob 6 cm around `anchor.y + 0.86`; the pickup anchor itself stays
  on local ground. Map regressions must check the grounded anchor and bounded
  visual movement, not require the animated mesh to stay at one exact height.
- `pickup-art.js` renders crates in material batches. Its unmerged plank template
  feeds `FragmentBurst`; temporary pieces reuse geometry/materials and are bounded
  to 160, bounce on local terrain, and shrink away. Never dispose shared plank
  geometry when one burst expires. The reusable effect stays in this game until
  a second consumer justifies moving it into `engine/`.
- `items.clear()` resets pickups/effects between races. `dispose()` releases the
  templates and pad texture on map changes. Race cars retain geometry ownership
  so even already-detached parts can be released on restart; cached paints and
  decals stay alive. Car-kit wheel tread is batched by material. Garage thumbnails
  render once with a single short-lived renderer, then become ordinary images.
- Garage camera framing must account for both aspect ratio and panels. A narrow
  portrait screen needs a wider view and an upward shift, not just CSS resizing.
  Inspect phone screenshots: a successful page load doesn't catch cropped cars
  or a minimap covering the position counter.

Verification:

```powershell
npm run check
node --test Pana/games/derrape/tests/items.test.js
node Pana/games/derrape/tests/items.browser.js
node Pana/games/derrape/tests/maps.browser.js
```

Browser scripts accept `PANA_PLAYWRIGHT_PATH`, `PANA_BROWSER_PATH`, and
`PANA_TEST_URL` for an external Playwright runtime, browser and server. Screenshots
from the item regression go to the system temp directory's `derrape-qa` folder,
or `PANA_TEST_ARTIFACTS` when set. Run the server on default port 8461 first.

Passed five rule tests; browser checks for all eight vehicles, consecutive crates,
full inventory, fragments and respawn, independent slot timers, forward/rear hits,
defense versus reserve, triple charges, juice/peels, keyboard/touch use, lost-focus
input, elevated island coins, and restart cleanup. The map regression completed
eleven three-lap simulations covering all eight tracks and repeated switches.
Desktop and phone renders were inspected. A live desktop race also ran without
browser errors; its sampled frame average was about 10 ms on this machine.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Derrape's local race uses two item slots, coin trails and breakable wooden
crates. Inventory/defense/speed rules live in `games/derrape/public/item-rules.js`;
`fragments.js` owns reusable prop bursts. See `docs/knowledge/derrape-items.md`
for controls, ownership and regression commands. Keep these game-local until
another game actually needs them. Garage cards render the real vehicle models.
Garage previews reuse a bounded cache of eight cars and render progressively;
track browsing selects route metadata without building scenery. `startRace()`
is asynchronous: await it in browser tests. `?debug&manual` stops only the game
loop so deterministic tests can still paint loading steps. Keep the last map
for replay, and preserve cancellation between `buildSteps()` stages.
