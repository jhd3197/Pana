# Reliquia · La mina del sol

Browser expedition at `/g/reliquia/`. The hub discovers its metadata and live
card automatically. No production dependency or build step was added.

## Expedition

The authored route connects camp, mine, gallery, a shared rope bridge, two-wheel
chamber, crypt and relic sanctuary. The wheels require a 1.6-second hold and
latch for twelve seconds: simultaneous friends are convenient, but one player
can reach both. Opening the gate establishes a late-join checkpoint. A guardian
blocks relic pickup; collecting it opens the return tunnel. Every connected,
non-spectating player must be revived and near camp, with the carrier inside the
exit circle, while a player holds interaction for three seconds. A team wipe
ends the run. Replay resets the map, enemies and objectives with a fresh seed.

WASD/arrows move relative to the camera; drag rotates it; wheel changes distance;
Q recenters. Space/click attacks with nearby facing assistance. Shift dodges,
R uses a finite healing kit, E interacts or holds a winch/revive/extraction.
Touch has movement, attack, dodge, heal and a contextual hold button. The shared
menu owns Escape, sound, settings and invitations. Solo menus pause simulation;
multiplayer menus clear only the local player's input.

## Simulation and networking

`layout.js` is renderer-free: room unions, obstacles, gate collision, segment
visibility and grid navigation. `rules.js` owns all movement, attacks, damage,
cooldowns, revives, puzzle and objective decisions. `director.js` tracks
build/peak/fade/rest phases. Ambient spawns are occluded from the whole team;
authored room awakenings are visible and have a one-second activation delay.
The guardian encounter suppresses ambient waves. Fourteen living enemies is
the simulation cap. Enemy damage/health do not change with temporary intensity;
guardian health scales with the roster when it spawns.

The oldest peer owns the expedition. Peers send inputs and sequenced actions
through `{t:'state',v:{game:'reliquia-v2',kind,...}}`; only host snapshots render
as authoritative state. Remote inputs expire after 600 ms. Snapshots include
RNG state, Director timers, enemies, winches, supplies, relic ownership, events
and the action sequence ledger. Navigation paths are a derived cache and are
rebuilt after migration. A departing carrier drops the relic before removal.
Replay preserves the action ledger so delayed packets cannot repeat actions.

Late joiners appear at camp, or just beyond the gate after it opens. Once the
relic is taken they appear at camp to avoid stranding a newcomer far behind an
extracting team. Reconnect uses the relay's new identity. Failed connection
offers an explicit local expedition; it never silently separates the friends.
The server retains its global eight-player cap and temporary room lifecycle.
Persistent worlds, accounts and saved inventories are outside this version.

## World and model ownership

`scene.js` builds the world from the same layout and existing jungle/vegetation
factories. Static geometry is spatially batched; floors are instanced. Low walls
and a raised follow camera expose the cavern as a cutaway. Rope bridge geometry
uses the shared constructor; `groundAt` follows its swept deck and ramp ends.
Characters use the canonical saved Pana adapter and dispose their own models;
carried relics are detached first. The five new shared constructors live in
`engine/models/props/reliquia.js`, are previewed in Studio, and are used by the
game/card. Mummy bands are batched by rigid limb before animation, avoiding one
draw call per band. Studio's Reliquia map builds the actual game scene.

## Verification

```powershell
node --test Pana/games/reliquia/tests/rules.test.js
node Pana/games/reliquia/tests/browser.mjs <playwright-package> [chromium-executable]
node Pana/games/reliquia/tests/studio.browser.mjs <playwright-package>
node Pana/engine/tests/model-architecture.test.js
node Pana/engine/tests/model-architecture.browser.js
npm run check
```

`PANA_QA_URL` overrides port 8461 for browser QA. `PANA_QA_OUTPUT` chooses a
screenshot directory. `?debug` exposes `window.reliquia` with room, state,
renderer, actors, layout points, `place()` and deterministic `step()` helpers.
Debug placement deliberately bypasses collision. `?debug&manual` disables the
automatic simulation ticker for deterministic browser diagnostics.

Browser QA must await the simulation's cooldown/state rather than fixed wall
delays: compiling the first animated enemy in a software renderer can delay
ticks. Likewise, the host's successful revive must arrive in the guest snapshot
before asserting the guest's statistics.

Nine deterministic tests cover combat/cooldowns, duplicate actions, reviving,
solo and cooperative wheels, closed-gate navigation, guardian/relic handoff,
extraction, wipe/replay, Director cycles and migration. A movement-driven route
test traverses camp, both wheels, sanctuary and the return tunnel without
teleporting; invulnerability isolates navigation from combat in that test.

The browser suite uses real relay connections for two desktop clients and a
390 × 844 touch client. Encounter setup uses debug placement; attacks, held
interactions, snapshots, host migration and replay use the normal game paths.
It also checks game/room isolation, local fallback, solo versus multiplayer
pause and hub discovery. This is functional coverage, not a full balance or
eight-player performance study.

The Studio suite opens the actual five model previews and full map, checks
finite nonempty bounds and saves screenshots. The shared architecture checks
passed for 104 modules, 138 model definitions and 177 Studio resources.
QA screenshots are stored outside the checkout in
`C:\Users\Juan\Downloads\pana-reliquia-qa`.

Validation completed 2026-10-15: the gameplay, relay browser, native Studio and
shared architecture suites passed; the repository syntax check covered 320
files. A sampled gameplay frame reported 124 draw calls and 163,226 triangles.
Those counts describe that view, not a worst-case performance guarantee.

The final visual pass corrected bridge landing height, added solid banks below
entrance foliage, gave health text a dark backing and kept the compass clear of
the guardian bar. Ambient wave offsets are individually checked for visibility
and navigation so an anchor hidden behind a corner cannot expose its companions.

## Notes for agents

The shared `createChargeRing` exposes `mesh`, `set` and `hide`, not `group`.
Attach `chargeRing.mesh` to the scene so held-interaction progress is visible.
Headless two/three-client checks use the player's low-quality setting and await
actual scene preparation: heavy software rendering can stretch a 2.4-second
revive beyond 25 wall-clock seconds. Studio checks must return to the library
between model previews, since asset detail views hide the library tiles.

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Reliquia uses a host simulation at 20 Hz (`reliquia-v2`). Its game-local
`layout.js` owns walkability/navigation, `rules.js` owns combat, winches,
revives and extraction, and `director.js` owns the seeded encounter schedule.
Snapshots preserve RNG state and the action sequence ledger across host migration.
Late arrivals join the camp or opened-gate checkpoint. Both wheels latch for
twelve seconds; all non-spectating players must be revived and back at camp to
extract. The mummy, guardian, sun relic, winch and lantern factories live in
`engine/models/props/reliquia.js` and are registered in Studio. Keep rigid mummy
parts batched independently of their animation pivots. The shared rope bridge's
sag is mirrored by `groundAt()` in the game scene. See `docs/knowledge/reliquia.md`.


## Expedition options

The shared lobby configures Selva/Tepuy temple variants, difficulty, shared or
individual carried lanterns, one/two/three simultaneous ordinary mummies,
pressure-plate density, revives, the minimap, objective hints and lanterns.
Both temple variants preserve the authored route; Tepuy has cooler stone and
a shifted plate pattern rather than a renamed unrelated map. Pressure plates
are real mesh hazards: they are safe for three seconds and active for two,
with staggered phases. Three/six/nine plates implement density. Their positions
and timing come from the same pure rules used for damage. A hit has a
1.2-second per-player trap cooldown. Dodging also protects against plate hits.

Difficulty changes enemy health, damage and movement speed. The mummy choice
caps ordinary mummies independently of the guardian. With revives disabled,
fallen teammates remain out and surviving panas can extract without them.
Turning hints off removes the mission steps and objective compass, but nearby
interaction prompts remain usable. A shared carried lantern follows the first
standing pana; individual lanterns follow each pana. Disabling lanterns hides
both carried lanterns and the temple lamps/light pools.

Only the host changes these options before a run. Snapshots, practice, replays
and lobby or live host migration preserve the choices. Rooms retain eight
human seats. The action ledger also covers configure messages so stale room
choices cannot be replayed after migration.

The mission steps and minimap container have explicit `[hidden]` display rules.
The steps grid would otherwise override the browser hidden style and reveal
hints when that option is off.
