# Derrape Grand Prix

Implementation note for `docs/plans/56_derrape-grand-prix-and-water-worlds.md`.

## Phase 00 baseline

Source revision: `3448e6d` plus the pre-existing, unrelated root package edits.
The baseline made no runtime changes. Compatibility inputs live in
`Pana/games/derrape/tests/cup-profile-fixtures.js`; screenshots and measurements
are ignored under `art/grand-prix/baseline/`.

### Current implementation inventory

- `public/modes.js` has two cups, Mango and Arepa. `awardPoints()` and
  `cupStandings()` key totals by display name; the only tiebreak is the latest
  race order. Points are `15, 12, 10, 8, 6, 4, 2, 1`.
- `public/game.js` owns the inline cup object and its `results` array. Local
  races use `RACERS = 4`; cups use the same global lap choice for every stage.
  Restart calls `startRace()` directly. Results call `scoreCup()`, write
  `derrape:trophies`, and pay `derrape:wallet` through an in-memory `race.paid`
  flag. There is no durable receipt key.
- Setup, trophies and wallet are three independent localStorage values:
  `derrape:setup`, `derrape:trophies` and `derrape:wallet`. Garage trophy badges
  and shop unlocks read the old cup IDs directly.
- `public/online-rules.js` fixes quick races at three laps and a minimum grid of
  four. `server/room.js` also uses that constant for pose bounds and finishes.
  One room owns one race; its 16-bit `raceId` is the only race context on loaded,
  finish, pose and effect traffic.
- The track registry has eight circuits. The old cup IDs cover those eight once;
  there is no cup edition metadata or per-stage lap/cap definition.

### Reconnection and reload behavior before the change

The shared kit gives Derrape a 20-second reconnection window. A reconnection
token is stored in tab-scoped `sessionStorage` under
`pana:reconnect:derrape:<room>`. A normal reload reuses that token, the Colyseus
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

`public/cup-profile.js` owns `derrape:profile` version 2: setup, current-edition
trophies, earlier-edition records, wallet and one-time receipts share one stored
value. Migration reads but never deletes `derrape:setup`, `derrape:trophies` or
`derrape:wallet`. Old cup wins become `{ source, edition: 1, label: 'Edición
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

