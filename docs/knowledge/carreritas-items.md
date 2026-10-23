# Carreritas vehicles, crates and combat

## Race balance

`item-rules.js` owns pure item weights and threat/reaction rules. Race odds use
the active field (excluding finished, retired, disconnected and DNS racers),
lap-aware progress and a fixed 38 m/s reference pace. Comeback strength is
25% normalized placement and 75% smoothed gap: gap assistance starts after
1.5 estimated seconds and reaches its cap at 8. Distant racers receive more
jugo, jarra and totuma, with fewer stationary traps. These are initial tuning
values, not a measured human win-rate target.

Chancleta and Aguacero cannot be drawn during the first 12 racing seconds,
within a 3-second estimated lead gap, or by the leader. Their weights scale
by `min(1, 4 / activeCount)` to limit pressure in larger fields. Ordinary
supplies remain available while stopped or revisiting a crate; comeback odds
require forward speed above 3 m/s, a forward road heading, no active rescue,
and at least 35 m beyond the previous pickup's highest race progress. A new
lap can qualify again. Battle keeps its position-independent item pool.

Item draws use a separate seeded stream, independent of cosmetic random calls.
`createItems({ itemSeed })` supports repeatable comparisons; normal play picks
the seed when creating the item system. `clear()` resets that stream, pickup
history, reaction state and recovery windows. This does not make the entire
race deterministic or coordinate all clients' random streams.

Each victim gets 10 seconds between damaging major attacks, shared between
Aguacero and Chancleta. Repeated rain neither extends the cloud nor drops the
new active item; a repeated chancleta bursts without damage or consuming a
totuma. Ordinary mangoes, rockets, traps and collisions remain active. The
existing feedback line explains a blocked major attack. The victim's client
resolves chancleta protection and relays the blocked hit through the existing
message; other clients remember successful major hits for bot ownership
handoff. Unique rain waves retain their timestamp compensation and duplicate
filter. This is victim recovery, not a server-wide launch lock. Two players
can launch at once, but cannot bypass the target's local recovery window.

Bots recognise approaching trajectories within 40 m and a 1.2-second closest
approach, rejecting departing shots, wide misses and other decks. Reactions
take 0.54 / 0.30 / 0.18 seconds on Fácil / Normal / Difícil. A different threat
restarts the timer. Reserve mangoes defend only against mangoes; totumas wait
for recognition when a shot is approaching. Driving pace and rewards are
unchanged by these item rules.

`item-balance.test.js` covers gap/lap/field eligibility, anti-farming, seeded
distributions and frame-rate-independent reactions. `item-balance.browser.js`
exercises real pickups, mixed major attacks, expiry, ordinary damage, rescue
escape and defensive switching. `feedback-online.browser.js` covers distinct
repeated rain and chancleta launches through two real room clients.

## Wooden supply crates

`pickup-art.js` builds the visible crate as one indexed mesh with normalized
byte vertex colours. Its three-board sides, dark corner posts and four painted
mango silhouettes share a single rough material; no textures or UV attributes are
needed. Outlined fruit and green leaves replace the diagonal braces that hid tiny stamps.
Crate clones share this geometry, including the trap's underlying crate.

The separate fracture template has 19 boards/posts. Keep that template separate
from the merged visible mesh so pickups still break and respawn independently.
The item suite checks pickup, inventory, fragments, respawn and shared geometry.
An isolated normal render changed from six draws / 326 triangles to one draw /
320 triangles. Unique visible geometry buffers decreased from 22,170 to 17,796
bytes (positions, normals, colour/index and former UV buffers counted). These
are per-model costs, not a whole-map FPS or total-memory guarantee.

## Friends playtest: waves, pursuit and recovery

- Aguacero rains on every rival, not only those ahead: the order frozen at
  release, nearest places first, .75 s lead-in then .15 s apart, 5 s each
  (7.5 juiced): top speed ×.74 and grip ×.55 unless on rain cauchos. Each
  soaked car drops its held item (all charges, `dropItem`); every client soaks
  only its own cars, so inventories stay owner-authoritative. There is no
  cloud over each car any more: a soaked car drips, and the local player's
  screen gets the track's own rain lines (`race.rain`, handed to items.js as
  `hooks.rain`). Bots use it even while leading. A pending wave appears in the
  incoming-item HUD; ghosted/finished racers skip the hit.
- The caller relays one bounded schedule with an ID and server-clock timestamp.
  Recipients subtract delivery latency, ignore duplicates and use the same
  target order even if racers overtake. `items.clear()` discards pending waves.
- Chancleta stays locked on its selected leader. Other cars cannot intercept
  it. Pursuit speed is at least 110 m/s, at least 65 m/s faster than its target,
  and initially large enough to close the route gap in roughly seven seconds.
  It never slows during pursuit; its dive also overtakes turboing cars. The
  old 16 s timeout is replaced by a route-aware safety lifetime of at least
  45 s. The target sees the warning from launch, even outside the usual 60 m
  incoming-item radius. It dissipates on approaching within 16 m of a temporarily
  protected target; finished, retired or disconnected targets cancel the projectile.
- `recovery-rules.js` separates temporary protection from disconnected ghosts.
  Launch and rescue grant 3 s; two distinct hard impacts within 3 s grant 2.5 s.
  Expiry waits for space around the car. Ghosts ignore cars, hazards, peels and
  projectiles; track boundaries still contain them. Items cannot fire during
  the rescue itself. Ordinary car contacts trade capped horizontal momentum,
  never call the airborne crash animation, and do not fling lightweight cars.
- Ghost material clones retain original transparency/opacity across repeated
  transitions. The racer owns all clones, including detached parts, for cleanup.

`feedback.browser.js` proves the full-loop moving-target chase (62 m/s target,
2,074 m initial gap, about 7.1 s to impact on Estadio), an interceptor, ordered
rain, grounded contacts, launch/rescue protection, skill payouts and quality
switching. `feedback-online.browser.js` uses two real room clients and a
deliberately delayed rain delivery; it is functional proof, not a bandwidth or
physical-device benchmark.

Implemented 2026-10-14 with the existing Three.js 0.160.0 CDN imports; no new
runtime dependencies. Carreritas still runs a local four-car race with bots.

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
node --test Pana/games/carreritas/tests/items.test.js
node Pana/games/carreritas/tests/items.browser.js
node Pana/games/carreritas/tests/maps.browser.js
```

Browser scripts accept `PANA_PLAYWRIGHT_PATH`, `PANA_BROWSER_PATH`, and
`PANA_TEST_URL` for an external Playwright runtime, browser and server. Screenshots
from the item regression go to the system temp directory's `carreritas-qa` folder,
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

Carreritas's local race uses two item slots, coin trails and breakable wooden
crates. Inventory/defense/speed rules live in `games/carreritas/public/item-rules.js`;
`fragments.js` owns reusable prop bursts. See `docs/knowledge/carreritas-items.md`
for controls, ownership and regression commands. Keep these game-local until
another game actually needs them. Garage cards render the real vehicle models.
Garage previews reuse a bounded cache of eight cars and render progressively;
track browsing selects route metadata without building scenery. `startRace()`
is asynchronous: await it in browser tests. `?debug&manual` stops only the game
loop so deterministic tests can still paint loading steps. Keep the last map
for replay, and preserve cancellation between `buildSteps()` stages.


## Animated green boost strips

Green pads share one procedurally painted 128 by 256 CanvasTexture, used for
both colour and emission. Painted edge bevels and mint chevrons stay stationary;
a shader pulse travels along the strip. Position-based phase offsets prevent
all pads pulsing together. The existing item clock advances the effect and the
existing boost-entry event drives a brief flash. No extra meshes, network image
requests, real lights, bloom passes, timers or sprite-sheet frames are added.
The existing plane follows the ground with its pad height hint. Orange pads
retain their original scrolling texture. Boost dimensions, strength and grounded
detection are unchanged. Disposal releases the shared texture and material once.
