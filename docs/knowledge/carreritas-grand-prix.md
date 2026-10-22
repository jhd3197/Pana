# Carreritas Grand Prix

Implementation notes for the four-race Grand Prix cups and their water worlds.

## Standalone circuit additions

Puerto is available for normal local/online races and is explicitly listed in
`cup-definitions.js` as a standalone track. Adding a circuit no longer requires
changing an existing four-stage cup edition. `validateCups` still checks unique,
known stages and now rejects any circuit missing from both the cup stages and
the standalone list, or registered in both. Existing cup routes and profile
migration remain unchanged.

## Phase 00 baseline

Source revision: `3448e6d` plus the pre-existing, unrelated root package edits.
The baseline made no runtime changes. Compatibility inputs live in
`Pana/games/carreritas/tests/cup-profile-fixtures.js`; screenshots and measurements
are ignored under `art/grand-prix/baseline/`.

### Historical implementation inventory at baseline

- `public/modes.js` has two cups, Mango and Arepa. `awardPoints()` and
  `cupStandings()` key totals by display name; the only tiebreak is the latest
  race order. Points are `15, 12, 10, 8, 6, 4, 2, 1`.
- `public/game.js` owns the inline cup object and its `results` array. Local
  races use `RACERS = 4`; cups use the same global lap choice for every stage.
  Restart calls `startRace()` directly. Results call `scoreCup()`, write
  `carreritas:trophies`, and pay `carreritas:wallet` through an in-memory `race.paid`
  flag. There is no durable receipt key.
- Setup, trophies and wallet are three independent localStorage values:
  `carreritas:setup`, `carreritas:trophies` and `carreritas:wallet`. Garage trophy badges
  and shop unlocks read the old cup IDs directly.
- `public/online-rules.js` fixes quick races at three laps and a minimum grid of
  four. `server/room.js` also uses that constant for pose bounds and finishes.
  One room owns one race; its 16-bit `raceId` is the only race context on loaded,
  finish, pose and effect traffic.
- The track registry has eight circuits. The old cup IDs cover those eight once;
  there is no cup edition metadata or per-stage lap/cap definition.

### Reconnection and reload behavior before the change

The shared kit gives Carreritas a 20-second reconnection window. A reconnection
token is stored in tab-scoped `sessionStorage` under
`pana:reconnect:carreritas:<room>`. A normal reload reuses that token, the Colyseus
session ID and the seat; `public/game.js` reloads the active track and resumes
the last pose held by the room. A dropped member is marked disconnected, the
host is handed to another connected member immediately, and bot ownership moves
to that host. If reconnection expires, `onLeave` removes the member and the room
retires their unfinished car. Without a valid token, a new join receives a new
seat; it does not inherit the previous entrant.

### Baseline proof

- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./dev.ps1 check`:
  227 tests passed at phase 00. `loading.browser.js`, `modes.browser.js`,
  `surroundings.browser.js` (baseline capture) and `maps.browser.js` passed;
  maps completed three laps on all eight circuits and repeated switches.
- The unchanged `online.browser.js` failed twice at line 38: the `lead=1`
  player was not host when the two-client assertion ran. This is a recorded
  pre-existing failure, not a Grand Prix regression; phase 07 must prove the
  repaired flow. Its two-client race was exercised, but is not listed as passed.
- Reference browser profile for automated geometry/performance comparisons:
  headless Chromium through the external Playwright runtime, 1440 × 900,
  default quality, 32 logical processors. Software WebGL numbers are
  functional/render-submission measurements, not physical-device FPS claims.
  Mobile layout captures use 390 × 844 portrait and 844 × 390 landscape
  emulation; no physical mobile device is represented by that profile.
- `art/grand-prix/baseline/loading-metrics.json`: garage ready 3.537 s, first
  four-car Estadio race 9.568 s, warm replay 5.030 s. Twenty-four metadata-only
  track selections built no world. These wall timings belong to this profile.
- `art/surroundings/before/report.json` has three actual route-camera views per
  circuit and render counts. Driving views ranged from 15–714 submissions and
  about 0.16–3.07 million submitted triangles in this capture.
- `art/grand-prix/baseline/eight-racers.json`: the eight-car Estadio loading
  baseline reached its first countdown frame in 5.635 s, with 2,028 calls and
  946,223 triangles at 1440 × 900. The 844 × 390 capture submitted 2,113 calls
  and 962,751 triangles. Eight concurrent browsers exceeded the capture budget,
  so this baseline uses one local race with response-only `RACERS=8`
  instrumentation and no production source edit; its script and method string
  are stored beside the metrics. It is not eight-human networking proof.

Reference-device FPS, physical mobile thermals and real GPU frame-time claims
remain separate from these software-browser measurements and must not be
inferred from them. Phase 20 still requires an actual eight-human cup.

## Phase 01 — catalogue and profile migration

`public/cup-definitions.js` is the pure catalogue. Available cups have four
`{ track, laps, capSeconds, estimatedSeconds }` stages; Agua exists only as
unavailable metadata and has no garage button. `cupById` resolves the explicit
`mango → pana` and `arepa → aventura` aliases. `modes.js` re-exports the
catalogue during the transition.

`public/cup-profile.js` owns `carreritas:profile` version 2: setup, current-edition
trophies, earlier-edition records, wallet and one-time receipts share one stored
value. Migration reads but never deletes `carreritas:setup`, `carreritas:trophies` or
`carreritas:wallet`. Old cup wins become `{ source, edition: 1, label: 'Edición
anterior' }` records, not wins on the new route order. Unlock credit is
canonical, so Mango and Pana cannot count as two cups. The best current trophy
is retained on replay. Storage denial leaves a working in-memory profile.

`createProfileStore.save()` deliberately preserves the loaded object reference:
the garage holds `profile.setup` and `profile.wallet` directly. Cleaning belongs
on load/migration, not on every save where replacing those nested objects would
stale the UI's references.

Proof: `cup-profile.test.js` covers every legacy fixture, mixed current/legacy
data, lower replay trophies, malformed JSON, blocked storage and idempotent
receipts. `modes.browser.js` completed Copa Pana in its new order;
`shop.browser.js` passed wallet, paint, horn and legacy-mirror flows. The pure
shop tests also prove Mango + Pana is one unlock credit.

## Phase 02 — pure championship ledger

`public/cup-rules.js` is renderer-free and shared by browser and Node. A session
freezes entrant IDs, names, bot/human identity, avatar, loadout and skill seed;
display names are never keys. Stage context is `(stageIndex, attempt)`. Only
`ready → loading → racing → intermission/complete` mutations are legal, and all
context/ownership/cardinality validation happens before the ledger changes.

A finalized stage has one record per roster entrant. Finished cars sort by time,
started DNFs by progress, then retired and DNS. Only finished/DNF records earn
place points; earlier points are immutable. `acceptFinish` is separate from
finalization so leaving after an accepted finish keeps that finish, while a
permanent absence becomes DNS on later stages. Standings are derived from the
ledger every time: points, wins, classifications from race four back to race
one, then the seeded initial grid. `decidedBy`/`explainTie` expose the deciding
rule to the UI.

Proof: `cup-rules.test.js` completes a four-stage session and covers duplicate
names, duplicate/missing/foreign submissions, stale attempts, all-DNF races,
DNS/retirement, departure after finishing, sparse grids, tie chains and
abandonment. `assertCupInvariants` checks bounded stages, unique stage/entrant
records and totals equal to ledger sums. No DOM or Three.js import is present.

## Phase 03 — local four-race lifecycle

`game.js` keeps `race.cup = { definition, session, mirror }` across scene resets.
The session owns entrants and the ledger; `clearRace()` only releases the current
cars and world. A new local cup locks eight entrants: `local-player`, optional
`local-guest`, and stable bot IDs with frozen cars, wheels, avatars and skill
seeds. Ordinary races and Globos retain their four-car defaults. Grid order comes
from the frozen session grid, so later stages start with prior placement best
first rather than rebuilding rivals.

`beginStage()` runs before construction and `markRacing()` after the first
rendered frame. `launchGrid()` records actual starters. Restart uses
`retryStage()`: it increments the attempt and clears only unaccepted current
stage data. `finalizeStage()` runs once in `finish()`, never in the results
renderer. Garage exit abandons the session; accepted stages cannot be restarted
from the menu. Per-stage laps come from the cup definition. A 240-second cap and
40-second first-human grace settle every local GP stage; quick-race timing is
unchanged.

Proof: `cup-local.browser.js` covers restart, exit after race two, replay,
quick/battle switching, split screen and mirror, then drives every stage of both
cups through the actual fixed-step simulation. No lap numbers are assigned in
that proof. `art/grand-prix/cup-local/actual-cups.json` records Pana stage times
148.2, 162.6, 150.5 and 116.5 seconds, and Aventura times 153.6, 153.9, 73.3 and
145.0 seconds. Chichi uses its authored one-lap stage; all stages stay below the
240-second cap. `modes.browser.js`, `loading.browser.js`, `comfort.browser.js`
and `shop.browser.js` also passed.

## Phase 04 — cup selection, standings, podium and rewards

`public/cup-ui.js` formats approximate cup duration, stage-by-stage standings
with rank movement (`Sube N`, `Baja N`, `Mantiene`), tiebreak explanations and
the 12-second intermission countdown (`Siguiente: <pista> · <N> vueltas`).
`public/cup-rewards.js` gates stage and cup-bonus payouts through
`claimReceipt(profile, receiptKey(sessionId, ...))` so reopening results or
refreshing after completion never pays a second bonus.

In the garage, selecting a cup populates `#cup-stages` with four lightweight
metadata-only stage buttons showing track order and lap presets without
constructing additional 3D worlds. During a cup race, `#stage-pill` displays
`1/4`..`4/4` alongside the lap counter. On stage completion, `#result-board`
shows stage classifications and points while `#cup-board` shows cumulative
standings, rank changes and tiebreaks, and the final podium displays the top
three championship finishers.

## Phase 05 — server-owned online championship lifecycle

`server/room.js` (`CarreritasRoom`) owns the authoritative Grand Prix session when
`state.mode` is an available cup (`pana`, `aventura` or `agua`). Before starting, the
host can select `mode` and `difficulty` (`facil`, `normal`, `dificil`); track
selection messages are ignored while a cup mode is active because the cup's
first stage (`cup.stages[0]`) determines the initial track and lap count.

- **Protocol & race context**: `GP_PROTOCOL = 2` in `public/online-rules.js`.
  Legacy clients (`protocol < 2`) cannot switch the room into or start a cup;
  the room sets `state.notice` explaining that a player is on an older version.
  Control and race traffic (`loaded`, `p`, `fx`, `finish`, `retire`, `next`)
  validates `matchesContext(m)` against `raceId`, `sessionId`, `stage` and
  `attempt`.
- **Roster & stage authority**: `startCup()` locks up to `GP_GRID = 8` entrants
  (connected humans plus seeded bots with stable `skillSeed` values) and creates
  `this.cupSession` via `createCupSession()`. `openCupStage()` sets `state.track`
  and `state.laps` from `cupDef.stages[stageIndex]`, clamps pose laps to
  `state.laps + 1`, and uses `stage.capSeconds` for finish validation and the
  stage timer.
- **Timeouts, host handoff & intermission**: Unready humans after
  `GP_LOAD_TIMEOUT_MS` (60 s) are marked `dns` while ready humans race; if no
  human is ready, `toLobby()` abandons the cup with a Spanish notice. Host
  departure (`hostChanged`) reassigns bot `owner` in both `state.racers` and
  `cupSession.entrants` without resetting `skillSeed` or ledger records. After
  stages 1–3, `state.phase = 'results'` with `intermissionEndsAt = now + 12000`;
  the room advances automatically or on host `next`/`start` after
  `GP_MIN_READ_MS` (5 s), and enters `state.phase = 'complete'` after stage 4.

Proof: `tests/cup-room.test.js` verifies host-only mode/difficulty selection,
legacy protocol rejection, 8-entrant roster persistence, stage-specific lap
bounds, duplicate/stale packet rejection, DNS/all-DNS loading timeouts, and
mid-cup host handoff.

## Phase 06 — client continuity and recovery

The client adapter now carries the full `(raceId, sessionId, stage, attempt)`
context on readiness, poses, effects, finishes, withdrawal and advancement.
The server rejects missing GP context as well as mismatched context; legacy
array poses remain quick-race-only. Server-to-client snapshots and effects carry
the same context, and the adapter clears its pose cache on every context change.
Session IDs use UUIDs: a same-millisecond replay must not collide with receipts.

The game keeps the official ledger outside scene lifetime, loads each next map,
renders before readiness, restores poses on reload, transfers bot ownership,
ghosts disconnected humans, and shows server-timed intermission and standings.
Frozen room avatars are parsed before model construction. Reloaded finished
players retain their accepted finish. Cancelling a loading stage withdraws the
entrant rather than letting the next patch start the abandoned loader again.

Proof during takeover: the repository check passed 253 tests. The focused
ledger/room suites subsequently passed 18 tests, including missing context,
ownership, departures after finishing, late spectators and fresh-cup resets.
`cup-online.browser.js` completed all four Copa Pana stages with two independent
browser contexts, duplicate names, an intentionally held readiness packet,
remote motion, a mango throw and a stage-two token reload. Both clients agreed
on all four ledgers and repeated final rendering did not pay twice.
Manual-render test mode drives the actual steering, car and checkpoint simulation
at 60 Hz and sends real poses; it is functional proof, not a frame-rate measure.
The expanded host-loss/stale-message scenario subsequently passed in the final
two-client suite (201 seconds). The quick-race suite also passed (170 seconds). Its two independent browser
contexts now warm assets before testing the shared 15-second party-leader join
window; cold CDN/model load time must not silently change that test's premise.

Subsequent starting grids now follow the immediately preceding race placement,
not cumulative cup points; a regression proves the two orders can differ.


Frozen entrants now include paint, horn and flame identifiers. Podium images borrow the actual car hierarchy through one short-lived render target; they do not use the local garage's avatar for remote racers.

## Final balance and lifetime measurements

`cup-balance.browser.js` ran 30 full-cup seeds per difficulty (Easy, Normal,
Hard): 90 championships per cup, 270 in total, 1,080 eight-car stage races.
Every entrant finished within its stage cap. Pana and Agua recorded zero
rescues. Aventura recorded 36 Selva recoveries across 720 car-runs on that
existing off-road track (14 Normal, 22 Hard; at most two for one car). The
main cluster is near (-88, -35), with isolated riverbank departures elsewhere;
all recovered and finished, with no repeated rescue loop. Keep that location
in future Selva handling work instead of hiding it with stronger catch-up.

Normal mean car times by stage (seconds): Pana 140.0 / 161.8 / 145.3 / 126.7;
Aventura 140.0 / 155.1 / 74.3 / 140.4; Agua 113.1 / 151.5 / 111.7 / 167.7.
Normal first-to-last gaps are 18.6–23.3 s, 13.9–24.3 s and 15.0–26.3 s
respectively. Leaders before the last race won 83%, 77% and 74% of cups; the
champion's mean points per stage stayed between 13.0 and 14.1. These are seeded
AI outcomes with the existing vehicle tunes and items, not human skill claims.
Raw results: ignored `art/grand-prix/balance-{pana,aventura,agua}.json` and
`balance-summary.json`.

Unaccelerated Normal runs consumed elapsed wall time only, including loading,
countdowns and three 12-second intermissions: Pana 11.37 minutes, Aventura
9.98 minutes, Agua 10.50 minutes. Agua uses the final Salinas crossfall. Stage
presets remain Pana 2/2/2/2, Aventura 2/1/2/2 and Agua 2/3/2/2. Proof files
are `duration-<cup>.json`; the dedicated `cup-duration.proof.js` runs outside
the regular ten-minute browser-suite timeout. Its 1 Hz render sampling proves
timing, not frame performance.

Three consecutive full Agua cups (the last two split-screen and mirrored)
returned to the same warmed garage with 147 geometries, 17 textures, 27 global
listeners and zero intervals after every cup. Both humans finished every stage.
Cancellation returned to the garage with no racers; `lifetime.json` records all
12 stage ledgers. Keyboard, controller, held touch, mango and rescue checks
also passed separately on each new map with reduced quality.

## Release acceptance evidence

The final eight-human run (`PANA_GP_CLIENTS=8 PANA_GP_CUPS=agua`) completed
all four Agua stages with eight independent browser contexts, no bots, real
steering/checkpoint simulation and identical accepted ledgers on every client.
The four ledgers are in `art/grand-prix/8-human-cups.json`; the five-suite release
batch, including model architecture, water assets, presentation and the existing
Venezuela worlds, passed.

The full Carreritas sweep and focused repairs cover all 30 current browser suites.
The initial failures (cup failures, online, quick race, items) were fixed and
rerun, not skipped; map-control, crossing, lifetime, presentation and
car-batching proofs were added. The repository release check passed 260 tests.
After car batching, lifetime, the two-client championship, results, items and
loading were rechecked. Its shop failure was fixed by retaining the primary
paint material, verified with all eight car appearances and the unchanged shop
test. Galope's corrected Studio URL and riding input were rechecked too.

Presentation fixtures deliberately exercise duplicate long names, a points tie,
all four finish classifications, an absent champion's fallback portrait and
reduced motion. They do not establish race playability. The portrait podium
needs intrinsic grid rows: two long standings tables otherwise squeeze its
row to zero height and let it overlap the classification. On desktop, align the
podium column to the start so a long results column cannot push it below the
first screen. Screenshot and rectangle checks cover both layouts.

The physical-phone benchmark was explicitly waived by the user during the
final audit. A Samsung SM-S134DL was detected over USB, but no phone frame-rate
result was produced. Desktop GPU timings and mobile-layout/touch proof remain
separate evidence; see `carreritas-performance.md` for that distinction.
