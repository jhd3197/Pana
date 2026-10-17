# 56 — Derrape Grand Prix and four living-water worlds

Status: implementation delivered; final verification in progress. All three cups
and twelve circuits are available. The completion audit below distinguishes
implemented/verified work from outstanding reference-device evidence.

## Outcome

Give Derrape three championships of four races each, with the same rivals,
cumulative points, a final podium, and an online room that stays together from
the first starting grid to the last trophy. Add four substantial environments:
Salto del Tepuy, Delta de los Caños, Cuevas del Río and Salinas del Viento.
Together those four form **Copa del Agua**.

The new maps should be places players remember: water travels through a
landscape, roads respond to that landscape, and each circuit has a clear reveal
from the driver's seat. Their models and effects also improve Pana's shared
library and selected existing worlds. This plan does not require making four
new games or four additional Curiara courses.

Ship the championship improvements on existing tracks first. Build the waterfall
map first to resolve the hardest visual and geometry questions, even though it
is the fourth race in Copa del Agua. A map can ship in Carrera rápida once its
own proof passes; the new cup becomes available only when all four maps pass.

Paths starting with `Pana/` or `docs/` are repository-relative. File groups in
the phases use the abbreviations defined under **File ownership**.

## Starting point: extend what exists

Read these before implementation:

- [Architecture](../ARCHITECTURE.md), [multiplayer kit](../knowledge/pana-net.md)
  and [Derrape online](../knowledge/derrape-online.md).
- [Track contracts](../knowledge/derrape-tracks.md),
  [loading and performance](../knowledge/derrape-performance.md),
  [Venezuelan circuits](../knowledge/venezuela-circuits.md) and
  [surroundings](../knowledge/circuit-surroundings.md).
- [Pana kit](../knowledge/pana-kit.md), [shared UI](../knowledge/pana-ui.md),
  [Studio](../knowledge/pana-studio.md) and
  [model inventory](../knowledge/model-inventory.md).
- [Plan 53](53_derrape-kart-features.md), which already shipped local cups,
  driving features, trophies, shortcuts, hazards, mirror and split screen.
- [Plan 55](55_curiara-river-race.md), which owns Curiara's first river and
  paddling mechanics; [plan 32](32_living-water-and-tides.md) for existing water.

The inspected implementation already has:

| Area | Current behavior | Work needed here |
|---|---|---|
| Cups | `modes.js`: Copa Mango and Copa Arepa, four circuits each | Reorganize into the agreed cups, retain earned progression, add Agua |
| Points | `15, 12, 10, 8, 6, 4, 2, 1` | Keep the scale; replace name-keyed totals with entrant IDs and a result ledger |
| Ties | Last race order | Add race wins before the final-race tiebreak |
| Local flow | `game.js` keeps rivals and advances with Siguiente pista | Separate cup state from race scene lifetime; finish the full presentation |
| Persistence | `derrape:trophies`, wallet and setup in localStorage | Versioned, idempotent migration and rewards without duplicate payment |
| Online | `server/room.js` owns one race's phase, roster and results | Persist cup roster, four stage results and progression in the same room |
| Online adapter | `public/online.js` wraps `engine/net.js` | Extend this adapter; do not create a parallel `network.js` |
| Grid | Local races use four racers; online bots fill to at least four | Grand Prix defaults to eight; preserve ordinary race defaults |
| Online laps | Three; room finish/pose code also uses the fixed `LAPS` constant | Respect each cup stage's validated lap count throughout |
| Maps | Eight registered circuits | Four more, registered in runtime and pure metadata together |
| Water | Shared animated surfaces; opt-in grip/depth hooks and tide effects | Add only the missing capabilities; preserve existing defaults |
| Loading | Incremental construction, cancellation and one retained world | Keep that lifecycle across four consecutive maps |

Inspect live code again at phase 00. Other work, particularly Curiara, may land
while this plan is pending. Older notes mentioning `/ws` or host election are
historical: current room architecture and shared kit take precedence.

## Scope and boundaries

Required outcomes:

- Three named cups, each with exactly four distinct circuits in a fixed order.
- Local solo and existing local split-screen support; online championships for
  up to eight human players, with optional bots filling empty grid places.
- Shared scoring semantics, standings, intermissions, finish handling and podium.
- Four finished, independently selectable circuits, with functioning bots,
  items, rescues, water interactions, touch controls and Studio tours.
- New canonical models/effects where existing assets cannot do the job, plus
  two small, proven integrations into other existing games in phase 19.
- Real two-client championship proof, map geometry checks, actual driving,
  screenshots and measured loading/render budgets.

Outside this plan: accounts, online leaderboards, ranked matchmaking, persistent
server tournaments, seasons, elimination brackets, track voting, custom cup
editors, team scoring, new weapons, a vehicle physics rewrite, boat/car switching,
new Curiara courses and a general-purpose world editor. Online mirror and online
split screen remain outside scope. Existing local mirror and Globos must work.

Plain ES modules, existing CDN dependencies and one backend remain the rule.
Use the shared room, invite, settings, pause, touch, icons and results systems.
Player-facing names and messages are Spanish; code and documentation are English.

## The three championships

| Cup ID | Display name | Race 1 | Race 2 | Race 3 | Race 4 |
|---|---|---|---|---|---|
| `pana` | Copa Pana | El Estadio (`estadio`) | Plaza Pana (`plaza`) | Los Llanos (`llanos`) | Isla Bululú (`bululu`) |
| `aventura` | Copa Aventura | Pana Desierto (`desierto`) | Chi Chi (`chichi`) | Pana Selva (`selva`) | Pana Páramo (`paramo`) |
| `agua` | Copa del Agua | Salinas del Viento (`salinas`) | Delta de los Caños (`delta`) | Cuevas del Río (`cuevas`) | Salto del Tepuy (`salto`) |

Copa Pana introduces the format with familiar landmarks and a beach finish.
Copa Aventura emphasizes terrain, elevation and tighter route reading. Copa del
Agua moves from open shallows to a village, into caves and finally to a giant
waterfall. The final course should feel like the largest occasion in each cup.

At final release, the three cups cover all twelve circuits exactly once.
Intermediate releases may have standalone new maps not yet assigned to an
available cup. Validate completeness against *available cups*, not an assumption
that every newly registered map must immediately belong to a released cup.

### Progression compatibility

`mango` and `arepa` are existing saved mode/trophy IDs. Resolve old setup choices
to `pana` and `aventura`; never let them silently become a different game mode.
Keep an explicit alias table rather than scattered string replacements.

Because the routes change, preserve old trophies as an **earlier edition** of
their successor cup. Do not claim a player has completed the new course order.
Use a versioned profile with separate current-edition and legacy records, retain
the original storage until successful migration, and display a short Spanish
label such as "Edición anterior" where relevant. Old earned unlocks stay earned.
Do not mint coins, remove cosmetics or downgrade a trophy during migration.

Mirror still unlocks from a trophy; gold paint still unlocks from a gold trophy.
The rainbow-flame condition becomes "Gana un trofeo en dos copas diferentes".
Count canonical cup IDs, including legacy credit, so Mango + Pana cannot count
as two different cups. Update `shop.js` and all trophy readers together.
Unavailable Agua in a partial release is not required for existing unlocks.

### Race length and setup

- Target a typical Normal cup at **10–15 minutes**, including short results
  screens and normal loading. This is a tuning target to measure, not a promise
  for every device or skill level.
- Set laps per stage in the pure cup definition. Start testing at two laps,
  use one for long tracks, and choose final values from actual race timings.
  Existing maps range widely in length; four copies of a global lap count will
  not reliably fit the target.
- Display each stage's laps and an honest approximate cup duration before start.
  Normal Grand Prix uses the authored preset; Carrera rápida keeps its 1–5 laps.
- Difficulty and bot setting are chosen before starting and fixed for the cup.
  Default GP grid is eight with bots on; bots off uses the actual humans.
- All cups are playable without first winning another cup. Trophies celebrate
  play and retain the existing cosmetic progression; maps are not gated.
- Keep the player's chosen car, wheels and appearance for the whole cup. Local
  player two has a distinct entrant ID and the existing guest setup; guest results
  must not overwrite player one's saved trophies or wallet.
- First grid uses a cup seed. Subsequent grids use prior stage placement, best
  first. Retired/DNS entrants sort last. Freeze each grid before countdown.

## Championship rules and lifecycle

### Identity, standings and rewards

Names are presentation, never keys. Each cup has a unique session ID and each
entrant a stable ID. Store name, avatar, human/bot identity and loadout separately
from the connection that currently owns a car. Two players may share a name.

The ledger has exactly one accepted result per stage. It records entrant ID,
classification, finish time or earned progress, place, points and whether the
entrant actually started. Standings are derived from that ledger, not incremented
again every time a results overlay renders or a client reconnects.

| Classification | Place and points |
|---|---|
| Finished | Ordered by accepted elapsed time; gets the existing place points |
| Started but unfinished at the deadline | After finishers, by valid completed laps/checkpoint progress; labeled "Sin terminar" and gets its classified place points |
| Never started / loading timeout | DNS, "No salió", zero points |
| Explicit withdrawal / permanent departure before finishing | Retired, "Retirado", zero points for that stage |
| Departure after an accepted finish | Keep the earned finish and points |

Earlier stage points are never removed on departure. Future stages for a
permanently absent entrant are DNS. A partial/cancelled cup pays no cup trophy;
already finalized race earnings remain valid. Bound placement to the locked
roster and reject duplicate, missing-ID or foreign-entrant result submissions.

Tiebreak: total points, then number of race wins, then better classification in
race four; if still tied, compare race three, two and one in that order. Use
seeded initial grid order only as the final deterministic fallback. DNS/retired
rank after classified starters. Show the first tiebreak that decides a tied
podium. Do not compare total race time across different lap counts or DNFs.

Award gold, silver and bronze by final cup place through the existing trophy
model. Retain the best saved result; a worse replay never overwrites a better
one. Pay existing race earnings once per finalized stage and cup bonus once per
completed session. A receipt key includes cup session, stage and local profile;
update rewards/profile atomically in one versioned stored value where possible.
If storage is blocked, play and session results still work in memory.

### Flow through four races

```text
garage / room lobby
  -> select cup, difficulty and bots; show four tracks
  -> lock entrants and settings
  -> load stage 1 -> countdown -> race -> race results + overall standings
  -> load stage 2 -> countdown -> race -> race results + overall standings
  -> load stage 3 -> countdown -> race -> race results + overall standings
  -> load stage 4 -> countdown -> race -> championship podium
  -> replay cup / choose another cup / garage
```

Use one pure championship state machine from local play and the server room.
Scene destruction must not destroy the ledger. Each stage has a distinct race
attempt token: retries before racing may change the attempt, but never consume
a stage or award points. Stage index stays in 0–3.

Start with a 12-second intermission showing race points, total points, position
changes and the next track. Local play can continue early or pause through the
shared menu; local pause freezes the intermission. Online uses server time and
advances automatically; the host can continue early after a minimum 5-second
read window. Final cup results wait for an explicit host/local choice.

For Grand Prix, begin with a 240-second per-stage cap and the existing
40-second finish grace after the first human finishes; finish sooner when all
active humans finish. Bot finishes alone do not start the human grace timer.
Tune the cap with lap presets in phase 18, documenting changes. The deadline
always settles a started race; ordinary quick-race timing stays unchanged.

Local restart applies only to the unfinalized current race. Once results have
been accepted, the action is Siguiente pista or a fresh cup, never a second
payment for the same stage. Leaving to the garage abandons the current cup with
clear wording; no durable mid-cup save is promised in this plan.

### Online ownership, loading and failure behavior

The existing `PanaRoom` subclass owns cup selection, frozen entrants, phase,
stage index, per-stage laps, start deadlines, accepted results and totals.
Clients still simulate their own cars; the room host simulates bots. This keeps
Derrape's existing trust-based physics model. Validate message ownership and
state transitions without introducing a new anti-cheat or simulation backend.

Freeze the entire roster and bot identities at cup start. A bot keeps its car,
avatar, skill seed and entrant ID through all four maps. Do not rebuild a new
opponent list with `startRace()` on each stage. Difficulty must use the same
policy on every owner; any online catch-up reference is a defined shared field
position, not a different "local player" on each client.

| Situation | Required behavior |
|---|---|
| Guest selects a cup, advances or changes laps | Server rejects host-only changes |
| Track/car/bot settings change after start | Reject for this cup; apply only after return to lobby |
| Clients load at different speeds | Wait for active entrants' readiness; start countdown only after a rendered frame and race setup |
| One client cannot load within the GP's initial 60-second loading budget | Mark DNS for that stage; let ready entrants race; offer retry/spectate and participation at the next stage |
| No human entrant is ready at the loading deadline | Abort the unstarted stage/cup to the lobby with an explanation; award nothing for it |
| New person arrives after roster lock | Spectate until the next cup; never inherit a bot's points |
| Temporary drop | Keep identity for the kit's reconnection window; ghost the uncontrolled car and retain its last earned progress |
| Successful reconnect/reload through the existing token | Restore the same entrant and authoritative stage/ledger; resume only if that stage is still open |
| Reconnection expires or token is unavailable | New join is a spectator; the previous entrant keeps earlier points and retires/DNS as appropriate |
| Host drops while other humans remain | Kit elects the host; transfer only bot ownership and resume bots from their last accepted state |
| Everyone disconnects | Retain only for the existing room/reconnect lifecycle; no autonomous trophy completion, database or indefinite room |
| Delayed message from an earlier race | Ignore it using cup session + stage + attempt/race token |
| Explicit online withdrawal | Retire the entrant, keep prior points, let others continue; shared menu remains the exit path |
| Local fallback after permanent connection loss | Start a separate local session; never present it as continuation of official room totals |

The kit caps room members at eight, including spectators. This plan does not
expand that cap: a full eight-human room remains full. Bots are grid entries,
not additional room members.

Tag readiness, poses, item effects, finishes, retire requests and advancement
with the current race context, not just `loaded`. Clear pose/effect caches when
the context changes. Existing `finish`/`p`/`fx` messages need particular attention:
the current roster IDs recur, and an old finish must not finish the next map.
Handle the existing bounded `raceId` counter without relying on it as the sole
session identity. Make protocol compatibility explicit: unsupported cached
clients cannot silently join a GP they interpret as an ordinary race.

## Four map briefs

All four are closed Derrape circuits. The river may descend continuously while
the road climbs back by a separate hillside route. These are fictional,
Venezuelan-inspired places, not claims of geographically exact recreations.
Target dimensions below are greybox starting values, to be tuned by driving.

### Salto del Tepuy — the waterfall finale

**Promise:** approach a waterfall, discover its full height, descend beside it,
cross its spray, then drive behind the water you saw from above.

- **Route:** upper river camp → exposed rim and first reveal → sweeping gorge
  descent → bridge across the plunge-pool outlet → rock gallery behind the
  curtain → forested ascent on a separate slope → camp/finish.
- **Starting envelope:** 2.0–2.5 km; 60–90 m of road elevation change; an even
  taller scenic waterfall can continue below the road. No giant car jump.
- **Driving:** readable downhill braking, one long drift bend before the
  bridge, a visibly damp gallery and a climbing sequence with overtaking room.
  Main route is safe without turbo. The full circuit returns to its starting
  height without crossing itself in X/Z.
- **Signature views:** distant waterfall reveal, opposing racers across the
  gorge, side-on spray bridge, open view through the curtain from the gallery.
- **Water:** upstream river feeds the lip, curtain feeds the plunge pool, foam
  follows the outlet. Mist is strongest near impact; it never blankets a bend.
- **Assets:** shared rocky cliffs, jungle foliage and waterfall rocks first;
  add a properly framed curtain, ledge/gallery pieces and mist anchors only as
  needed. Place normal-sized vegetation against large geology.
- **Optional after the main route passes:** a short dry ridge cut with a safe
  rejoin, if it meets checkpoint and bot rules. No shortcut is required to ship.
- **Future use:** waterfall effects in Bululú; lower rapids and rock formations
  for a later Curiara course. Driving behind the curtain does not imply canoes
  can survive the main drop.

### Delta de los Caños — a village among channels

**Promise:** race through a place built around water, with channels passing
under roads and homes, and a working waterfront visible at driving speed.

- **Route:** village landing → broad raised timber causeway → mangrove island
  bends → high channel bridge → market waterfront → firm bank return.
- **Starting envelope:** 1.6–2.1 km, mostly flat, with low bridge rises and
  occasional long views across connected channels.
- **Driving:** alternate village braking zones and faster bank curves. Raised
  roads are broad enough for racing; ordinary pedestrian docks are scenery.
  Rails agree with collision boundaries and bridge approaches never launch a
  car by accident.
- **Signature views:** a canoe beneath the main bridge, a channel framed by
  stilt houses, mangrove roots close to the water and the village seen from the
  opposite bank. Boats remain scenery outside the driving corridor.
- **Water:** connected slow channels with directional surface cues; reed/mangle
  placement follows actual banks. Avoid repeating the same house and palm at
  equal intervals around the racing spline.
- **Assets:** reuse peñeros, nets, fish crates, buoys, reeds and mangroves.
  Add a small family of palafito homes/shelters, deck sections, bank landings
  and mooring details; preserve the existing coastal model origins.
- **Optional after proof:** an island lane with a clear entrance and rejoin,
  not a straight plank running through homes or skipping multiple checkpoints.
- **Future use:** channels for Curiara; a village space for Escondidas; docking
  structures for Galope's lagoon. Those new gameplay maps remain future work.

### Cuevas del Río — follow the river through the mountain

**Promise:** enter a shaded river cave, cross large daylight-lit chambers,
then emerge into a bright valley without losing the racing line.

- **Route:** forest approach → broad cave mouth → first skylight chamber →
  stone shelf beside the river → bridge over a lower water chamber → root-lit
  exit → outdoor hillside return to the start.
- **Starting envelope:** 1.8–2.3 km; roughly half the driving time underground;
  road elevation change around 20–40 m.
- **Driving:** generous shelf corners, one braking sequence inside a chamber
  and a fast, readable exit. Use side-by-side road sections, never stacked
  drivable floors under the current X/Z projection model.
- **Signature views:** the mouth framing daylight behind the pack, a skylight
  illuminating the river, the low water chamber beneath the bridge and the
  final bright valley reveal.
- **Water:** continuous river height/flow through the cave, small cascades
  where it drops, still pools only where the terrain supports them.
- **Assets:** cave wall/ceiling sections, stalactite clusters, wet rock shelves,
  root curtains and openings. Reuse canonical rocks/plants wherever possible.
  Shell geometry encloses a genuine empty driving/camera corridor.
- **Lighting:** readable mineral colour, daylight openings and restrained
  ambient fill. Avoid pitch-black driving, sudden exposure jumps, many dynamic
  lights or glowing fantasy crystals as the main identity.
- **Future use:** cave structures for Reliquia and compact Bululú arenas;
  underground paddling only in a separately planned Curiara route.

### Salinas del Viento — an open, bright opening race

**Promise:** race across a wide landscape of white salt, shallow pink ponds,
teal channels and sky, then pass a small working salt settlement.

- **Route:** saltworks start → broad flats → pond-edge sweepers → a marked
  shallow crossing → raised causeways → loading sheds and village → flats.
- **Starting envelope:** 1.7–2.2 km; mostly level, broad turns and long sightlines.
- **Driving:** approachable opening race with room to overtake; shallow water
  visibly reduces grip/pace, while a longer dry line stays viable. Crossings
  never become an unavoidable stop or a tide lottery.
- **Signature views:** a low camera seeing sky colour in the shallow crossing,
  pink and turquoise ponds on opposite sides, salt piles against the horizon,
  and the compact working village as a clear route landmark.
- **Water:** distinct pond boundaries, shallow depth cues and culvert/channel
  connections. Sky-tinted shading should produce the reflective impression;
  real-time planar reflections are not a requirement.
- **Assets:** salt piles, timber sluices, drying/loading equipment, modest sheds
  and markers. Reuse existing birds, boats and coastal details where appropriate.
  Dedicated new bird species are optional and cannot block the circuit.
- **Future use:** saltworks/coastal props and shallow-water presentation in
  existing coastal scenes and later Bululú challenges.

## Shared world and driving contracts

### Geometry and race readability

- Retain the spline/runtime API, sector checkpoints and item positions expressed
  as route fractions. New maps must work with rescue, minimap and lap logic.
- No road self-intersection or vertically stacked racing segments under the
  current nearest-X/Z projection. Water can pass beneath a bridge; another
  drivable lane cannot share that footprint. Test nearby parallel segments for
  projection ambiguity as well as literal intersections.
- Start with 18–24 m of full road width, minimum curve radius above 15 m and
  preferably above 20 m; aim for sustained grades below 0.18 and brief grades
  below 0.25. These are authored-route targets, not relaxed replacements for
  existing regression checks. Record measured final values.
- Keep eight-car starting grids, early corners and respawn positions clear.
  Roadside props respect the road plus recovery margin; test at least the
  center and both outside lanes against the *actual built geometry*.
- Cave/gallery ceilings and bridges must clear the full chase-camera segment,
  not merely the car model. Include look-back, boost camera and split screen.
- Sculpt the bed below the visible water; sample actual terrain triangles for
  placement. A road/bridge deck wins over the bed beneath it in ground queries.
  No floating docks, buried planks, false ramp launches or water through roads.
- Main routes work on ordinary tires with no item. Water grip is gradual,
  observable and opt-in. Wetness/depth used by visuals and physics agrees.
- Add optional shortcuts only after normal lanes, bots and checkpoint rules
  pass. Existing bots do not take shortcuts: author an explicit branch-following
  policy and tests before shipping any new one. Omit an unproven shortcut.
- Use natural materials and local landmarks to guide turns; reserve warning
  signs for actual hazards. Each map needs quiet stretches between reveals.

### Assets, water and cross-game reuse

Audit before building: `mountain.js` has rocky cliffs, `jungle.js` has waterfall
rocks, `coastal.js` has boats/nets/crates, and the vegetation/fauna catalogs
already cover many needs. Existing water effects live in
`Pana/engine/models/effects/`; compatibility re-export paths are not new homes.

Model factories have owned geometry, stable IDs, documented metre scale/origin,
shared material discipline and idempotent disposal. Studio previews call those
same factories. Keep fauna animation and water outside static batches; static
scenery uses spatial batching/instancing with bounded culling cells.

World layout, terrain placement, race routes and wet-surface rules stay with
their game. Extract a shared environment only when a second real consumer
needs it; a possible future canoe race is not sufficient reason to generalize
the entire world now. Never copy a whole Derrape map into another game.

Water must have an authored source-to-outlet relationship and a consistent
downstream coordinate. Water animation uses absolute scene/race time; gameplay
hazards use agreed race time. Pausing and Studio scrubbing must reproduce it.
If a vertical curtain needs a new shader, add the smallest effect alongside the
existing water surface; do not distort the horizontal-water shader for all maps.

Use bounded local mist/splash pools and cull distant effects. Avoid full-screen
postprocessing, fluid simulation, reflection passes and a light per cave prop.
Reduced-effects settings may lower spray, motion and ambience, but must preserve
the wet-surface cue and racing visibility. Sound follows the shared settings.

### Loading and performance

Cup selection and previews read metadata; they must not construct four worlds.
Keep one built track, build its replacement incrementally, and dispose old
geometry, owned textures, effect buffers, callbacks and audio. Cached shared
materials survive. Stage changes use the existing load-generation cancellation
guard; an abandoned build must never start a countdown later.

Phase 00 records a reproducible desktop/mobile baseline with browser, hardware,
resolution and quality. Phase 08 sets explicit per-map triangle/draw/effect
budgets from those measurements before the art pass. Initial goals are smooth
60 fps desktop and usable 30 fps mobile on the selected reference devices;
software WebGL is suitable for functional/geometry proof, not device FPS claims.
Record p50/p95 frame time, first playable frame, peak transition memory and live
resources after repeated cup cycles. Keep frame-time and GPU-resource budgets
separate; triangle counts alone cannot establish performance.

## File ownership

The following groups are referred to by name in every phase. New filenames are
proposed implementation homes, not files that already exist.

| Group | Existing and proposed files |
|---|---|
| **Cup data** | Existing `Pana/games/derrape/public/modes.js`, `track-definitions.js`; proposed `cup-definitions.js` for pure cup/edition/lap metadata |
| **Cup rules** | Proposed `Pana/games/derrape/public/cup-rules.js` and `tests/cup-rules.test.js`; adapt existing `modes.test.js` |
| **Cup presentation** | Existing `public/game.js`, `index.html`, `style.css`; proposed `public/cup-ui.js`; use `/engine/results.js`, kit, icons and shared UI |
| **Progression** | Existing `public/shop.js`, `tests/shop.test.js`, `tests/shop.browser.js`; proposed `public/cup-profile.js` and `tests/cup-profile.test.js` |
| **Online** | Existing `Pana/games/derrape/server/room.js`, `public/online.js`, `public/online-rules.js`, `tests/online.browser.js`; proposed `tests/cup-online.browser.js` and pure room-transition tests |
| **Track registry/runtime** | Existing `public/tracks.js`, `track-definitions.js`, `track-runtime.js`, `track-kit.js`, `course-rules.js`; change shared runtime only for a proved missing contract |
| **Map files** | Proposed `public/tracks/{salto,delta,cuevas,salinas}.js` and corresponding `*-layout.js`, `*-world.js`; add `*-water.js`, `*-driving.js` or `*-flora.js` only when needed |
| **Map proof** | Extend `tests/maps.browser.js`, `water.browser.js`, `loading.browser.js`; proposed `tests/{salto,delta,cuevas,salinas}.browser.js` and `tests/cup-maps.browser.js` |
| **Models/effects** | Existing `Pana/engine/models/props/{jungle,mountain,coastal,llano-life}.js`, vegetation/fauna leaves, `models/effects/{water-surface,water-details}.js`; proposed cohesive `props/{delta,caves,saltworks}.js` and waterfall effect only for actual gaps |
| **Studio** | `Pana/engine/models/props/catalog/`, other category manifests, `Pana/web/studio/catalog.js`, `web/studio/catalog/` adapters and track-tour/cache/browser suites |
| **Shared consumers** | Existing `Pana/engine/island-landscape.js` for Bululú's waterfall and `Pana/games/galope/public/landscape.js` for its landing; inspect their knowledge notes before edits |
| **Documentation** | This plan, `CHANGELOG.md`, relevant existing knowledge notes; proposed `docs/knowledge/derrape-grand-prix.md` and `docs/knowledge/water-worlds.md`; generated model inventory |

Pure cup definitions/rules are importable by the Node room without Three.js or
DOM. Rendering adapters must not be imported into server code. Keep orchestration
in `game.js` thin when separating the existing cup-specific code.

## Phases

Every phase has a concrete finish gate. Implement in the listed dependency
order; independent map detailing can be scheduled separately after its greybox
passes. Completing a phase means its applicable proof passed and its status,
knowledge notes and player/contributor changelog were updated. A partial map
must not appear as a finished public circuit merely because its file exists.

### Phase 00 — Baseline, compatibility and acceptance fixtures

Status: done (2026-10-16). Proof and the recorded pre-existing online host
assertion failure are in `docs/knowledge/derrape-grand-prix.md`; artifacts are in
`art/grand-prix/baseline/` and `art/surroundings/before/`. Dependencies: none.

**Work:** Re-read current modes, setup, shop, roster and room code; record what
has changed since this plan was written. Capture a local four-track cup and a
two-client quick race. Inventory every name-keyed score, fixed lap constant,
hard-coded count of eight tracks/two cups, restart path and reward write. Save
legacy profile fixtures for no trophies, each trophy rank, both cups, blocked
storage and malformed data. Record eight-racer rendering/loading baselines.

**Files:** Cup data, Cup presentation, Progression, Online and Documentation;
existing mode/shop/loading browser suites. Store visual/measurement output in
ignored `art/grand-prix/baseline/`, not production source.

**Proof / done:** `.\dev.ps1 check` and the applicable existing Derrape browser
suites pass, or each pre-existing failure is reproducibly recorded before work.
List the actual reconnect/reload behavior from the current kit. Agree measured
reference devices and capture the existing maps' driver views. No runtime
behavior changes in this phase.

### Phase 01 — Cup catalogue and saved-progression migration

Status: done (2026-10-16). Pure migration tests, Copa Pana's real four-track
browser run, shop/mirror browser flows and 243 repository tests passed; proof is
in `docs/knowledge/derrape-grand-prix.md`. Dependencies: 00.

**Work:** Introduce pure cup definitions with canonical ID, edition, Spanish
name, ordered stages, per-stage laps/cap and availability. Add Pana and Aventura
using the existing eight tracks; keep Agua unavailable until complete. Centralize
legacy ID resolution. Migrate setup and trophy history without destroying old
data, double-counting cup identities or granting new race rewards. Update shop
unlock text/logic for any two distinct cups and preserve all earned cosmetics.

**Files:** Cup data, Progression, their pure tests and garage setup bindings in
Cup presentation. `modes.js` can re-export the new definitions during the move.

**Proof / done:** Validate four unique known tracks per available cup, aliases,
edition provenance and repeatable migration. Test old/new mixed profiles,
partial/corrupt storage, a lower replay trophy, two equal display names and
blocked localStorage. Existing shop/mirror flows continue to work. No unavailable
map appears as a selectable cup stage.

### Phase 02 — Pure championship state and scoring ledger

Status: done (2026-10-16). Nine ledger tests and all 243 repository tests
passed; the renderer-free contract and invariant proof are documented in
`docs/knowledge/derrape-grand-prix.md`. Dependencies: 01.

**Work:** Implement entrant IDs, frozen roster/loadouts, seeded grids, stage
attempts, accepted results, the standings comparator and completion/abandonment.
Use the rules above for finish/DNF/DNS/retirement. Move points and trophy
decisions onto the ledger. Give every mutation a legal state transition;
duplicate acceptance or advancement is harmless, invalid advancement is rejected.

**Files:** Cup rules, Cup data, existing `modes.js` adapters and pure tests.

**Proof / done:** Test full four-stage runs, duplicate result delivery, an old
stage result, duplicate/missing entrants, retirement after finishing, DNS,
all-DNF races, tie chains, sparse grids and equal names. Check invariants: stage
never exceeds three, totals equal ledger sums, no entrant gains two awards for
one stage, complete requires four finalized stages, and abandoned cannot award a
cup trophy. Server imports must stay renderer-free.

### Phase 03 — Local four-race flow on the existing circuits

Status: done (2026-10-16). Both four-track cups completed through the real
fixed-step simulation, plus restart, intermission, abandon, replay, quick/battle
switching, split screen and mirror; proof is in `docs/knowledge/derrape-grand-prix.md`.
Dependencies: 02.

**Work:** Replace the inline name-keyed cup object with the pure session. Run
Pana and Aventura end to end with eight entrants by default. Keep bot identity,
appearance and skill seed stable. Apply stage-specific laps, race deadlines and
grids; separate scene reset from championship reset. Support current local player
two and mirror. Keep quick races and Globos outside the GP state machine.

**Files:** Cup presentation, Cup rules, `public/game.js`, existing modes/comfort
browser suites; proposed `tests/cup-local.browser.js`.

**Proof / done:** Complete both cups through the real driving simulation; verify
track order, same rivals, totals and final winner. Test restart before finalizing,
pause during intermission, cancelled loading, exit after race two, replay after
race four and switching back to quick race/battle. Fast fixture finishes can
exercise UI branches but do not replace actual complete-race proof.

### Phase 04 — Cup selection, standings, podium and rewards

Status: done (2026-10-16). Unit tests (`cup-ui.test.js`, `cup-rewards.test.js`)
and browser proof (`cup-local.browser.js`, `modes.browser.js`, `shop.browser.js`)
passed; screenshots and details are in `docs/knowledge/derrape-grand-prix.md`.
Dependencies: 03.

**Work:** Present Carrera rápida, Gran Premio and Globos clearly in the garage.
A selected cup shows four track names/previews, lap presets, difficulty and
approximate duration. Add race X/4 to loading/HUD. Results show this race's
placement/points beside cumulative totals and the upcoming map. Animate rank
changes modestly. Finish with the top three saved panas on a podium, the full
standings, earned trophy and replay/garage actions using existing results/UI.

Use lightweight images/metadata for selection; no four-scene live previews.
Provide the same information in readable DOM text. Respect reduced motion and
sound settings. Connect one-time race and cup reward receipts to Progression.

**Files:** Cup presentation, Progression, shared icon usage, mode/shop browser
suites and `tests/cup-local.browser.js`.

**Proof / done:** Check keyboard focus, controller selection, touch, long names,
two identical names, 390 px portrait setup and playable mobile landscape.
Capture selection, intermediate table, tied podium and guest-player results.
Reopening results and refreshing after completion cannot pay a second bonus.
All saved avatar/vehicle styles remain correct on podium and return to garage.

### Phase 05 — Server-owned online championship lifecycle

Status: done (2026-10-16). Unit tests (`cup-room.test.js`) and all 253 repository
tests passed; server room lifecycle is documented in
`docs/knowledge/derrape-grand-prix.md`. Dependencies: 02; integrate after 04.

**Work:** Extend the existing Derrape room with a cup session, immutable entrant
roster, stage definition, result ledger, deadlines and an explicit final state.
Use Cup rules for transitions/scoring. Host selects before start; the room
advances after results and carries standings without recreating membership.
Replace fixed three-lap uses in GP pose bounds and finish handling with the
validated current stage target. Implement all-DNS abort and human-free behavior.

Retain client-owned car simulation and host-owned bots. Lock settings and
loadouts at start. Define protocol/capability versioning and include race context
on messages; do not accept GP control traffic from an unsupported client.

**Files:** Online, Cup rules/data; proposed
`Pana/games/derrape/tests/cup-room.test.js` for isolated room decisions using the
existing test runtime. Shared room kit changes only if a specific missing hook
is demonstrated, with its own regression coverage.

**Proof / done:** Test host-only selection, exact lap targets, roster persistence,
single result acceptance, late finish/loaded packets, stale attempt tokens,
duplicate next-stage requests, timeout classifications and final-state locking.
Server tests cannot import rendering or create a second networking stack.

### Phase 06 — Online clients, map transitions and recovery

Status: done. Two real clients completed Copa Pana with duplicate names,
readiness gating, real checkpoint driving, relayed mango, stage-two reload and
identical four-stage ledgers. Details: `docs/knowledge/derrape-grand-prix.md`.
Dependencies: 05, 04.

**Work:** Extend `online.js` and race wiring to consume room-owned GP state,
render official standings and transition through four tracks. Clear old poses,
items and pending loaders on context change. Send ready only after the current
track and cars render. Freeze the correct settings/loadout for each owned car.
Apply server intermission/loading clocks and show waiting/spectating states.

Restore the same entrant after successful token reconnect. Transfer bots to the
new host using their last known state and stable skill seed; do not respawn
them or reset their cup scores. Ghost temporarily uncontrolled human cars.
Handle permanent departure, missed loading, late spectators and incompatible
clients according to the contract table. Room membership stays in the kit.

**Files:** Online, Cup presentation, Cup rules and loading integration;
`tests/cup-online.browser.js`.

**Proof / done:** Two real browsers complete an existing-map cup and agree on
all four tracks, entrants, laps, race order, points and champion. Both clients
must drive/send real input, receive rival motion and cross checkpoints. Exercise
at least one item interaction across owners. Verify one slow-loading client,
no premature countdown, reconnect into another stage and no old-world objects
remaining after transition.

### Phase 07 — Online fault coverage and first championship release

Status: done. Two-client four-stage recovery, host handoff, stale packets, real loading timeout, late spectator, retirement, fresh-cup reset and ninth-client capacity checks pass. See art/grand-prix/online-final.log and cup-failures-fixed.log.

**Work:** Complete the failure matrix, refine Spanish state messages and ship
Pana/Aventura as online and local championships. Keep Agua hidden. Document the
room state/protocol, profiles and release behavior before moving into new maps.

**Files:** Online/browser suites, Progression, Cup presentation, Documentation.

**Proof / done:** Exercise host loss during loading, racing and intermission;
guest reconnection inside the kit window; permanent withdrawal; late spectator;
full room; one participant finishing then disconnecting; duplicated/stale
packets; all humans leaving; constructor failure/retry; and new cup in the same
room. Prove no skipped/double-scored stage or reward. Test quick-race online
regressions separately. Run `.\dev.ps1 check` and Derrape's browser suites.

This is **Release A**: useful championship improvements on the eight existing
maps, independent of the art schedule for Copa del Agua.

### Phase 08 — Four greyboxes and the waterfall feasibility gate

Status: done. Four real constructors pass route/projection, car/chase clearance and eight-car two-lap driving. See docs/knowledge/water-worlds.md and art/water-worlds/.

**Work:** Greybox all four routes with banks, coarse terrain, water heights,
bridges, cave/gallery voids, eight-car grids and main landmarks. Keep drafts
behind development selection until they pass their release gate. Drive Salto's
rim/descent/behind-water sequence first. Draft each other map's equivalent
signature moment and a quiet section to establish pacing contrast.

Measure length, radius, slope, lap duration, projection ambiguity and current
render costs. Set explicit per-map budgets and fixed screenshot locations in
the map knowledge note. Test the waterfall and cave sightlines in the actual
chase camera before spending time on foliage or detailed props.

**Files:** Map files, Track registry/runtime development gating, Map proof and
Documentation. Avoid adding incomplete IDs to public selectable metadata.

**Proof / done:** Every main loop is drivable by all bots; no self-crossing,
buried bridge, unbounded fall or blocked camera. Salto's loop climbs back to the
start; Cuevas has real empty chambers. Capture top-down route plus three driver
views per map. If a signature shot fails, change the route now. Record budgets
as numbers measured on the chosen reference profile, not "optimize later".

### Phase 09 — Water, wet-road and effect contracts

Status: done. Shared depth/crossfall, seven Studio assets, deterministic waterfall and repeated-cup lifetime checks pass. Dependencies: 08.

**Work:** Connect each greybox's bed, flow coordinates, water surface and wet
road sampling. Reuse existing `waterAt`/grip behavior. Add only missing curtain,
local mist or shallow-crossing capabilities and document which map consumes
them. Keep geometry/physics ownership explicit at bridges and galleries.
Set hard particle/draw budgets per effect and share a bounded pool where useful.

Keep global water defaults unchanged. Local pause, Studio scrubbing and online
race clocks must drive effects consistently. Provide a reduced-effects variant
with the same gameplay visibility. Rain tires must interact with wetness through
the existing grip model rather than a second tire rule.

**Files:** Models/effects, Map files, relevant Track runtime hooks and Map proof;
proposed focused effect tests under `Pana/engine/tests/` only for shared effects.

**Proof / done:** Test water flowing in the correct direction, connected levels,
depth/bed agreement, no water over dry decks, wet/dry braking and acceleration,
all tire types, stopped/airborne vehicles, pause/rewind, cloned Studio materials,
pool saturation and disposal. Existing Bululú/Chi Chi/Selva water tests remain
green. No extra render target or global performance regression is introduced.

### Phase 10 — Salto: finished landform and driving route

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: 08, 09.

**Work:** Author continuous upper river, rim, gorge, bridge foundations,
gallery and return ascent. Reserve water/road heights before placing geology.
Set sectors, item rows, safe start/finish, minimap and rescue anchors. Tune
downhill grip/braking and dry passing opportunities. Build legal rails on exposed
main-route edges; open edges only where the actual model has none.

**Files:** `tracks/salto.js`, `salto-layout.js`, `salto-world.js`, optional
`salto-water.js`/`salto-driving.js`, registry entries when ready, and
`tests/salto.browser.js`.

**Proof / done:** Full bot races with eight cars, every item row collected,
finite route queries and all-lane mesh clearance. Verify bridge underpass water,
camera behind the fall, opposing-gorge sightline and uphill return. Crash/reverse
and rescue from every exposed section; check no checkpoint skip on recovery.
No shortcut is necessary for this phase to pass.

### Phase 11 — Salto: waterfall spectacle, habitat and release

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: 10.

**Work:** Finish source river, visible lip, waterfall curtain, spray impact,
pool and downstream outlet. Compose jungle as habitat patches and cliff ledges,
with canopy gaps reserved for the reveal. Add restrained birds, finish camp,
waterfall ambience and music treatment. Give gallery light enough contrast to
read rivals/items without turning the mist into an opaque wall.

**Files:** Salto Map files, Models/effects, Studio metadata/tour support,
`public/music.js` if needed, Map proof and Documentation.

**Proof / done:** Capture rim approach, full waterfall, bridge, gallery and
return at normal race speed and on mobile. Check effects/vegetation culling,
draw/triangle/frame-time budgets, repeated builds and disposal. Run local and
two-client single-race proof on this map. Register it publicly for Carrera
rápida only after its complete gate passes; update changelog and inventory.

This is **Release B**: the waterfall circuit can be played while the other
water worlds are still being completed.

### Phase 12 — Delta: connected channels, village layout and route

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: 08, 09.

**Work:** Author a connected channel network with meaningful banks and firm
islands. Place the village street/deck layout independently of the race spline,
then reserve its driving corridor. Build wide racing causeways, the main bridge,
market corner and firm-bank return. Set road/deck height transitions, minimap,
sectors, item rows and rescue anchors.

**Files:** `tracks/delta.js`, `delta-layout.js`, `delta-world.js`, any required
`delta-water.js`; Models/effects for actual missing deck/landing modules;
`tests/delta.browser.js` and Track registry when ready.

**Proof / done:** Eight-car racing at the narrowest village segment, accurate
bank/deck/water contact, bridge camera clearance and consistent projection near
parallel channels. Cast geometry clearance against the actual deck supports and
building footprints. Bots finish and recover without entering pedestrian docks.
Use a built-world top-down capture to catch shortcuts through batched buildings.

### Phase 13 — Delta: palafitos, working waterfront and release

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: 12.

**Work:** Add a small varied family of stilt homes, shelters, landing/deck
pieces and mooring details. Reuse coast boats, fish crates, nets and buoys.
Plant mangroves by actual root/water habitat; cluster reeds and open clear water
to show boats beneath the bridge. Add village activity as bounded scenery with
no new road-crossing hazard required. Use warm, readable evening light.

**Files:** Delta Map files, proposed `models/props/delta.js`, category manifests,
Studio support, Map proof and Documentation.

**Proof / done:** Preview each new model and verify origins, footprints, owned
resources and variants. Prove boats are afloat, nets/docks are clear of roads,
and houses connect to usable platforms. Capture landing, bridge, village and
mangrove driver views. Complete local/two-client races, budget checks and
repeated track switching before standalone release.

### Phase 14 — Cuevas: hollow geology and a reliable driving corridor

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: 08, 09.

**Work:** Build explicit cave walls/ceilings and portals around the approved
route. Keep the base terrain below the road; enclosing a tunnel by raising a
heightfield across it would bury the track. Author the skylight chambers, lower
river floor, shelf, bridge and outdoor return as one coherent place. Reserve
the complete camera corridor before placing roots or stalactites.

**Files:** `tracks/cuevas.js`, `cuevas-layout.js`, `cuevas-world.js`, a local
shell module if needed, proposed cave models and `tests/cuevas.browser.js`.

**Proof / done:** Trace every lane and the full chase camera through both portals
and every chamber, including look-back and split screen. Verify the mountain
blocks intended sightlines while the route remains open. Run eight-car races,
items, respawns and reverse escape. No surface-height query selects the roof or
the lower river as the driving deck; no stacked racing lanes share X/Z.

### Phase 15 — Cuevas: daylight, water, atmosphere and release

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: 14.

**Work:** Compose daylight openings, mineral-colour variation, wet shelves,
roots and a few readable rock formations. Use restrained ambient fill and
bounded local water effects. Keep an obvious driving line through each chamber
and preserve the final daylight reveal. Set cave/open-air audio transitions
through existing sound settings, without loading a large soundtrack dependency.

**Files:** Cuevas Map files, proposed `models/props/caves.js` only for reusable
pieces, Models/effects, Studio support, Map proof and Documentation.

**Proof / done:** Compare portal/chamber brightness at fixed settings and verify
rivals, items and road edges remain visible. Test transparent water against cave
surfaces, near-camera clipping, shadow/light costs and repeatable tours. Capture
approach, skylight, bridge and exit; complete real local/two-client races and
repeated switching. Release the standalone map after these checks pass.

### Phase 16 — Salinas: ponds, causeways and shallow-water driving

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: 08, 09.

**Work:** Shape irregular salt ponds with separate beds, low banks and visible
channel/sluice connections. Author wide sweepers, the shallow crossing, a viable
dry line and the saltworks return. Use the same depth/wet field for shading,
traction and spray. Preserve a clear view of the far side at the crossing.

**Files:** `tracks/salinas.js`, `salinas-layout.js`, `salinas-world.js`, optional
`salinas-water.js`, `tests/salinas.browser.js` and registry when ready.

**Proof / done:** Normal tires can complete all laps without getting stuck.
Measure wet versus dry line times for representative cars/tires; no crossing
requires turbo or randomly changes passability. Verify water does not cover dry
causeways and banks do not create accidental jumps. Eight-car bot, item,
checkpoint and rescue proof passes on the actual built world.

### Phase 17 — Salinas: saltworks, horizon and release

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: 16.

**Work:** Add salt piles, sluices, simple working sheds, loading details and
road markers. Keep the large sky/open-flat composition; use colour to distinguish
pink ponds, teal channels and drivable white ground. Join the distant terrain
without visible seams. Reuse appropriate birds and coastal props; give ambience
wind and water without introducing a new wind-force mechanic.

**Files:** Salinas Map files, proposed `models/props/saltworks.js`, Models/effects,
Studio support, Map proof and Documentation.

**Proof / done:** Check readability on a small screen, horizon seams, glare,
long-view draw cost, water overdraw and shadows. Capture the low shallow-crossing
view, two-colour ponds, causeways and village. Finish local/two-client races and
repeated switching. Register the complete circuit for Carrera rápida.

Phases 13, 15 and 17 are **Releases C–E**: each map ships on its own proof,
without advertising an unfinished Copa del Agua.

### Phase 18 — Assemble Copa del Agua and tune all three cups

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: 07, 11, 13, 15, 17.

**Work:** Enable Agua in the exact agreed order: Salinas → Delta → Cuevas →
Salto. Set its final lap/cap presets, stage titles, selection previews and podium
identity. Recheck Pana/Aventura timing with the same measurement method.
Tune item-row placement, overtaking space and bot line/speed choices where
eight-car races expose a problem. Avoid increasing rubber-banding to conceal
a broken line, impassable corner or road collision.

Use at least 30 deterministic full-cup simulation seeds per difficulty for
completion/balance checks, plus unaccelerated browser runs to measure actual
duration. Log pace per stage, finishing gaps, repeated rescue spots, leading
entrant advantage and stage contributions to total points. Bot simulation time
is not a loading or frame-rate measurement. All normal routes must work without
shortcuts; any shipped optional branch needs its own AI/checkpoint proof.

**Files:** Cup data/rules, all four Map files and existing track configuration
only where evidence warrants it; `tests/cup-maps.browser.js`, focused simulation
harness and Documentation.

**Proof / done:** Complete all three cups locally and online; verify exactly
twelve canonical tracks across three cups, identical points on both clients and
the intended final track. Measure the 10–15 minute target on the reference
profile including intermissions/loading, documenting any realistic variance.
No bot has a repeatable route failure, infinite rescue loop or accidental
checkpoint advantage. New maps work independently in Carrera rápida as well.

### Phase 19 — Prove reuse in other games and finish Studio coverage

Status: implemented and functionally verified; reference-device release evidence is tracked in phase 20. Dependencies: relevant finished map/effect phases; after 18
for final inventory and release accounting.

**Work:** Deliver two bounded second-consumer integrations: use the Salto
waterfall effect on Bululú's existing waterfall, and use a Delta landing/shelter
piece at Galope's existing lagoon landing. Preserve those games' routes,
collision rules, board tiles and finish behavior. Adjust the shared factories
with explicit options where their scales differ; do not copy geometry.

Coordinate with plan 55 before adding anything to Curiara. Its first river
can use the already finished assets once that work is ready, but changes there
are not required for this plan to finish and must not expand its one-river scope.
Do not move `paddle.js` or duplicate its physics as part of a scenery task.

Finish each new model's catalog metadata, real `usedBy` values, previews and
disposal. All four map previews/tours must call the actual track constructors,
with playable framing bounds and correct dependency invalidation. Regenerate
the inventory. Record future reuse ideas separately from actual placements.

**Files:** Models/effects, Shared consumers, Studio, model inventory and the
Bululú/Galope knowledge notes; their affected browser suites and model tests.

**Proof / done:** Compare before/after board/riding views, exact route/collision
contracts and effect pause/scrub behavior. Play the affected games, including
their required multiplayer suites. Preview every new model, switch/tour all new
maps repeatedly, and prove owned resources release. A catalog entry alone is
not second-game reuse. No unrelated Curiara work is overwritten.

### Phase 20 — Full accessibility, performance and regression pass

Status: in progress. Geometry, controls, repeated lifetime, balance and software-browser regressions are verified; final hardware and multiplayer reruns remain. Dependencies: 18, 19.

**Work:** Review the full championship from first click to final trophy on the
reference desktop and mobile devices. Fix measured slow transitions, excessive
water overdraw, unreadable cave/white-salt sections, focus problems and stale
scene state. Check current controller/touch/split-screen paths and local mirror
on every new map. Keep quality reductions cosmetic rather than changing rules.

Run at least three consecutive full cups in one browser session, then alternate
old/new tracks and cancel a partially loaded next stage. Track renderer memory,
effect counts, DOM listeners, timers, audio and retained worlds after warmup;
there must be no monotonic retained-scene growth. Use resource accounting where
browser heap readings are noisy. Recheck loading input remains responsive.

**Files:** Relevant runtime/UI/map/effect files justified by failures; all
affected browser suites and Documentation. Do not broaden into unrelated visual
redesigns or alter test thresholds to hide a regression.

**Proof / done:** All planned geometry and render budgets pass. Capture 390 px
portrait menus/results, mobile landscape driving, desktop, split screen,
reduced effects, long names, duplicate names, DNF table and tied podium. No page,
shader or network errors. Existing eight maps, quick races, Globos, shop,
customization, invites and settings remain covered. Record honest device/frame
measurements alongside the screenshot locations.

In addition to the detailed two-client suites, complete one cup with eight
independent human-client sessions and no bots, with input generated for every
client. Prove full grids, all standings and transitions; an eight-car bot race
does not establish the advertised eight-human room behavior.

### Phase 21 — Documentation, final release and completion audit

Status: in progress. Changelog, knowledge notes and reproducible proof suites are delivered; final acceptance awaits phase 20. Dependencies: 20.

**Work:** Consolidate final data, remove development-only public selections,
finish Spanish copy and publish accurate player-facing changelog entries for
Grand Prix and Copa del Agua. Keep technical traps in their knowledge notes.
Update this plan's phase statuses and record final source changes/proof rather
than deleting the plan. Add game/README information only where it is actually
missing; these maps do not constitute four new hub games.

**Files:** Documentation, Cup/Track metadata and any final copy corrections.

**Proof / done:** Run `.\dev.ps1 check`, all Derrape browser suites and suites
for the shared consumers touched. Review the acceptance matrix below with actual
results, artifact paths and any unresolved failures. Every required checkbox
must be satisfied before marking this plan complete. Record remaining optional
ideas as deferred; never label an unimplemented required phase done.

This is **Release F**: three complete championships, twelve circuits, the four
new water worlds, online continuity and verified shared asset reuse.

## Dependency and release summary

| Work package | Phases | Prerequisite | Shippable result |
|---|---|---|---|
| Existing-map championships | 00–07 | Current plan 53/51 behavior | Pana and Aventura, solo/local split screen/online |
| Route and water foundation | 08–09 | Baseline; existing map runtime | Four proved greyboxes, measured budgets, shared effect contracts |
| Waterfall world | 10–11 | 08–09 | Salto in Carrera rápida and Studio |
| Delta world | 12–13 | 08–09 | Delta in Carrera rápida and Studio |
| Cave world | 14–15 | 08–09 | Cuevas in Carrera rápida and Studio |
| Saltworks world | 16–17 | 08–09 | Salinas in Carrera rápida and Studio |
| Full cup composition | 18 | 07 and all four finished maps | Copa del Agua; all cup pace/balance tuned |
| Wider Pana benefit | 19 | Required effects/models finished | Bululú/Galope reuse and complete catalog/tours |
| Final confidence and release | 20–21 | 18–19 | Complete release with measured proof |

The normal implementation order follows the phase numbers. Phase 08's small
waterfall/cave feasibility prototypes can happen earlier if needed to settle
scope, but they do not delay Release A. Map development order is independent
of the cup's fixed race order.

## Verification matrix

| Area | Required evidence | Primary suite/home |
|---|---|---|
| Cup definitions | Unique IDs, aliases, four stages, known tracks, final twelve-track coverage | `modes.test.js`, proposed cup definition/rule tests |
| Ledger | Stable IDs, all classifications, ties, bounded stage index, idempotency | `cup-rules.test.js` |
| Save compatibility | Old fixtures, legacy provenance, no lost unlocks/duplicate rewards, storage errors | `cup-profile.test.js`, shop tests/browser |
| Local flow | Actual four-map driving, same rivals, local player two, mirror, pause/restart/replay | `cup-local.browser.js`, modes/comfort suites |
| Online flow | Two real clients, real input/movement, all four results, same champion | `cup-online.browser.js` |
| Online failure | Host drop, token reload, late spectator, timeouts, stale messages, empty room | Room tests and `cup-online.browser.js` |
| Each new map | Geometry/road/camera clearance, bot laps, items, checkpoints, rescue, water | Four named map browser suites plus `maps.browser.js` |
| Water/effects | Depth/flow/grip agreement, deterministic time, pool budgets, disposal | `water.browser.js`, focused shared-effect tests |
| Rendering | Actual driver views and reference-device frame/loading measurements | Named map suites, `cup-maps.browser.js`, `loading.browser.js` |
| Studio | Same constructors, catalog metadata, tours, scrubbing, cache invalidation, disposal | Studio/model architecture/browser suites |
| Shared consumers | Actual second-game placements with unchanged gameplay | Bululú/Galope affected suites and knowledge notes |
| Regression | All old maps, quick races, Globos, shop/items, touch/controller, invites | Existing Derrape suites and repository checks |

Suggested commands from the repository root:

```powershell
.\dev.ps1 check
npm run test:browser -- derrape
npm run test:browser -- galope bululu
npm run test:browser -- model-architecture track-tour
```

The browser runner accepts `PANA_PLAYWRIGHT_PATH` and `PANA_TEST_URL`, and starts
the server if needed. Use the focused suites during each phase, then the full
affected-game suite at release gates. New suite names above are proposals and
must be created before being reported as passing. Where supported,
`PANA_MAP_TEST_TRACKS` scopes map regressions; preserve all-track coverage for
the final release.

Save reproducible screenshots/metrics under ignored `art/grand-prix/` and
`art/water-worlds/<map>/`, or the runner's configured artifact directory. Record
the source revision, seed, viewport, camera position, quality and race time.
For every map include overview, route diagram, at least four actual driver
views, its signature moment and mobile. Studio flyovers alone are insufficient.

### Minimum two-client championship scenarios

1. Two humans plus stable bots complete all four races; compare roster, stage
   laps, race classifications, totals and final podium on both clients.
2. Both humans share a display name; their scores, avatars and reward receipts
   remain separate throughout the cup.
3. Host drops mid-race and between races; the successor continues bots and the
   same ledger, and the reconnecting player sees the current stage.
4. A client loads slowly/fails, receives DNS for that stage, then loads and races
   the next stage as the same entrant without inherited points or double starts.
5. Join after roster lock, spectate, and enter only a fresh cup. Check full-room
   handling separately; spectator capacity is not unlimited.
6. Replay an earlier `finish`, `loaded`, pose and item event during the next
   stage; all are rejected or ignored without corrupting live state.
7. Retire before finishing, leave after finishing, reload during results and
   return after reconnect expiry; verify each specified ledger behavior.
8. Finish a cup, inspect one-time rewards, choose another cup in the same room,
   and verify no old map resources, totals, poses or clocks carry across.

Use accelerated/manual stepping for targeted protocol assertions where useful,
but include actual complete races through the driving/checkpoint simulation.
Directly setting a player's lap number is not proof of a playable circuit or
reliable four-map multiplayer experience.

## Risk register and implementation decisions

| Risk | Decision / mitigation |
|---|---|
| Rebuilding an already shipped cup system | Extend plan 53 modules and tests; centralize only cup-specific responsibilities |
| Existing trophies misrepresented after reordering | Preserve earlier-edition records and unlock credit; new edition has its own result |
| Duplicate names or reconnects merge scores | Stable entrant IDs and immutable roster, separate from names/connections |
| Delayed race packets affect the next map | Full race-context token on every race-specific message; clear client/server caches |
| Slow loading splits the group or stalls forever | Readiness after rendered frame, bounded GP load deadline, explicit DNS/abort policy |
| Four maps make startup or memory four times heavier | Metadata-only selection, one world retained, incremental build/disposal |
| Spectacular cliff/cave route breaks X/Z projection | No stacked/self-crossing roads; route greybox and camera gate before art |
| Water looks good but disagrees with grip/depth | Shared authored bed/flow/wet samples; bridge-specific deck priority |
| Transparent spray hides racers or dominates GPU time | Local bounded pools, readable sightlines, measured overdraw and reduced-effects option |
| Cave/white salt scene loses contrast | Driver-view/mobile review before detail; explicit light and material targets |
| Existing bots cannot take a clever shortcut | Main-route proof first; branch AI/checkpoints required or shortcut omitted |
| New shared models become an unused asset pack | Every required model appears in a finished map; real usedBy and second-game proof |
| Parallel Curiara work changes assets | Inspect current canonical factories, coordinate ownership, keep plan 55 independent |
| Polished screenshots hide bad racing | Eight-car full races, two-client input proof and measured pace are release gates |

## Final acceptance checklist

- [ ] Copa Pana, Copa Aventura and Copa del Agua each have the agreed four maps.
- [ ] Final catalogue contains twelve independently playable circuits.
- [ ] Existing trophy/cosmetic progress survives migration with honest provenance.
- [ ] Points, wins/tiebreaks and classification are identical locally and online.
- [ ] Same entrants, avatars, loadouts and bot identities persist across four races.
- [ ] Eight-human online cup works within the existing room cap; optional bots
      fill to eight when space remains on the starting grid.
- [ ] Local player two and local mirror remain functional on the new maps.
- [ ] Real two-client cups pass progression, reconnect, host-loss and stale-event proof.
- [ ] The typical-duration target is measured and per-stage laps are documented.
- [ ] Each map delivers its promised signature moment from the chase camera.
- [ ] Road, camera, items, checkpoints, rescue, bots and water all pass per-map proof.
- [ ] New models/effects have real Studio previews, tours and correct ownership.
- [ ] Two bounded second-game integrations are shipped and tested.
- [ ] Loading, repeated transitions, resource lifetime and reference-device budgets pass.
- [ ] Keyboard, touch, controller, mobile results and reduced-effects paths pass.
- [ ] `.\dev.ps1 check` and every affected game's required browser suites pass.
- [ ] Changelog and knowledge notes describe implemented behavior; all phases
      have honest status and proof links/paths before the plan is marked complete.

## Deferred ideas after this plan

Potential later plans can add Curiara river variants through Delta/the lower
Salto, Reliquia cave exploration, an Escondidas palafito village or saltworks
Bululú minigames. Their game-specific routes, balance, collisions and networking
need their own proof. Reusing a model is not the same as having built those games.

Other possible follow-ups: authored optional shortcuts on more tracks,
player-created cups, online track voting, online mirror or cooperative team
championships. None is required to ship the three cups in this plan.
