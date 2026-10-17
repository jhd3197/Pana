# Map asset rollout — October 2026

Studio registration and map placement are separate. A catalog entry does not
automatically appear in any game. This pass audited the eleven map previews
(eight circuits, Plaza, Cocina and the original Bululú board), added contextual
placements, and corrected consumer labels. This pass originally had 140 entries,
five in Fauna. Later coastal and wildlife work brings the catalog to 154 entries
and ten in Fauna; see `model-inventory.md` for the current complete inventory.

## Actual placement coverage

| Map | Library use after this pass |
| --- | --- |
| Plaza / Escondidas | Existing fountain, market props and plants; now a clock tower, two park benches, two capybara topiaries and three newer streetlights. New garden footprints stay beyond the playable bounds. |
| Cocina | Same shared garden and clock; two arepa kiosks replace the decorative perimeter market stalls. Two newer streetlights mix with the original lamps. Kitchen stations and player routes remain clear. |
| Plaza circuit | Shared clock, benches, topiaries and lights, positioned for the street route; colonial houses mixed into the town's existing blocks; a bus shelter by the park. |
| Original Isla Bululú | Five schools of six fish (30 total), one cayena and one papaya behind the harbor homes. Existing island vegetation, houses, beach furniture, dock and board paths remain. Studio now builds the complete board through `createBoard`, rather than terrain with empty path arrays. |
| Bululú circuit | Four schools of six fish (24 total) in the lagoon; four beach shades, a beach hut, a souvenir kiosk and driftwood. Existing colonial village, mangroves and palms remain. |
| Llanos | All ten ranch-pack types already placed. The eight legacy boxy cows are replaced by `hatoCow`; three horses and eight chickens remain. All 19 animals use native shared factories and stay outside the track. |
| Estadio | Trophy monument by the paddock, two rooftop tanks on flat garage roofs and two basketball hoops on a marked spectator court. Existing bodega, arepa kiosks and palms remain. |
| Selva | All previous habitat plants remain; seven giant jungle trees and six tropical bushes are now placed. Three library ruins (stone totem, vine arch and hollow log) reserve gaps before planting. Giant tree trunks participate in off-road collision. The final scene stays below the existing four-million-triangle budget. |
| Páramo | Frailejones and mountain pines were already placed; their Studio labels were stale. An animated heritage cable-car station and five rocky-cliff modules now supplement the cabins, tents, lookout and signs. Vegetation reserves space around the additions. |
| Desierto | Already uses all ten desert-pack types, including gas station, pickup, dunes, arches, wagon, well, tires, signs, giant cardón and canyon spires. Retained and regression checked. |
| Chi Chi | Already uses all five thermal-pack landmarks, with shared forest vegetation, water and mountain scenery. Retained and regression checked. |

The board and race islands have different geography. Their fish use the same
factory, but each environment owns its placements. The board's existing
`createIslandEnvironment` remains independent of the Los Roques race terrain.

## Iguanas (plan 57)

The `iguana` model was built for ¡Chinazo! and placed on six maps without
waiting in the preview-only list. Map iguanas come from
`/engine/placement/iguanas.js`: `iguana({ lite: true })` bakes the pose into two
meshes (body, head) with no shadow, and only `tick` runs (breathing and the
head bob; lite iguanas don't blink). Each map ticks its group from its own
update. They are not in `assetCounts` where a test counts exact pack types
(Desierto); each instance carries `userData.assetId = 'iguana'` and a 0.7 m
footprint for the map-assets audit.

| Map | Placement |
| --- | --- |
| Isla Bululú | Four on the beach rocks nearest the southern shore (rocks already avoid every tile's camera line), one on the lighthouse islet and one clinging to the lighthouse tower. Initial board view: +8 draw calls (+1.5%) and +0.2% triangles; three meshes per iguana measured +2.4%, so the eyes merged into the head. |
| Desierto (Derrape) | One on Pana Gas's canopy roof, one clinging to the station wall beside the door, two on the scree boulders nearest the start line. |
| Curiara | Two in the `perch` pose on bare limbs that lean out over the caño (s = 95 and 205), about 5 m above the water. |
| Galope | Two on course-side ranch-fence posts (`perch`), one in each of two fence runs. |
| Plaza (Escondidas, Cocina, Plaza circuit) | One clinging to the church's front wall above the PLAZA PANA sign, outside the playable bounds. |

## Library models still awaiting placement

These remain honestly marked `Pana Studio`; they were not forced into unsuitable
locations merely to claim complete coverage:

- Emblemas: capybara statue, golden mango statue, welcome arch, Pana flagpole,
  capybara fountain.
- Selva: standalone temple entrance, rope bridge, bamboo bridge.
  Selva's current drivable temple and river crossing are larger route-specific
  constructions, not instances of those catalog models.
- Páramo: mountain guardrail and suspension bridge. The current road barriers and
  cable lift are route-specific constructions.

There are ten preview-only entries. `waterfallRocks` is already used in Chi Chi;
the earlier preview-only label was corrected during the wildlife inventory audit.

## Construction and regression contracts

`farm-animals.js` now includes the cow sculpt adapted from the same pinned MIT
procedural-animals source as the horse/chicken. The license and attribution are
preserved. Cow coats are `pinto` and `brown`. All instances own their native
skinning and GPU resources; cache only CPU templates.

`reef-fish.js` is Pana-authored code, not another imported species. `reefFish`
accepts an integer seed. `reefFishSchool` accepts `seed`, `count` (1–16) and
`radius` (1–8 metres). Default schools contain six fish, 4,116 triangles and
12 meshes. Their swimming and tail motion use absolute time. Fish have no
gameplay interactions or collision. They do not appear in dry maps or plaza
fountains.

`placeReefSchools` checks a sampled swimming envelope against the seabed and
caller-provided path clearance. Centres sit 1.1 m below water; the whole school
stays submerged through the board ocean's wave envelope. Both island seas are
transparent enough to reveal fish. The race water opacity option defaults to
opaque for other consumers, preserving their previous appearance.

Animation roots stay outside static batches. Shared Plaza freezes the fountain's
character, releases its source geometry, and retains texture disposal on the
resulting batch. New animals dispose owned live materials as well as skeletons.

Proof commands (running server, external Playwright package):

```powershell
$env:PANA_PLAYWRIGHT_PATH='C:/Users/Juan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node Pana/engine/tests/farm-animals.browser.js
node Pana/engine/tests/map-assets.browser.js
node Pana/games/derrape/tests/maps.browser.js
node Pana/games/derrape/tests/selva.browser.js
node Pana/games/derrape/tests/selva-driving.browser.js
node Pana/web/studio/tests/studio.browser.js $env:PANA_PLAYWRIGHT_PATH
$env:PANA_QA_TIMEOUT='90000'
$env:PANA_QA_COMPACT='1'
node Pana/games/cocina/tests/browser.mjs $env:PANA_PLAYWRIGHT_PATH
node Pana/games/escondidas/tests/browser.mjs $env:PANA_PLAYWRIGHT_PATH
npm run check
```

Run the interactive multiplayer suites without concurrent heavy map rendering.
On this machine three full-size headless Cocina views stalled the mobile-input
check. A focused two-player phone test received real touch events and moved the
host simulation. The Cocina suite now offers `PANA_QA_COMPACT=1`: desktop clients
render at 900×650 while the phone stays at 390×844. `PANA_QA_TIMEOUT` applies only
to initial connection; gameplay assertions keep their normal timeout. The mobile
test uses a held touch and waits for the host's placement snapshot before measuring.
`art/studio/map-rollout/coverage.json` records constructed placements and metrics;
screenshots there include both islands' fish through their actual water surfaces.
`art/studio/fauna/` contains cow/horse/chicken angles and the actual ranch.

## Verification results

- Native animal proof passed for all three farm species: deterministic geometry,
  absolute-time poses, planted feet, road clearance and owned skeleton disposal.
- Map asset proof passed for all eleven maps and both standalone fish previews.
  It checks actual placements, finite geometry, driving/play-area clearance and
  fish staying above the seabed and below the lowest wave over 90 seconds.
- All eight Derrape circuits passed the existing driving regression, including
  repeated builds of Plaza, Bululú and Estadio.
- Selva's environment and driving suites passed: eighteen plant species,
  3,939,644 triangles, 721 draw calls, giant-tree collision and tunnel/chase-camera
  clearance. Screenshots include the actual driving camera.
- Studio's browser suite passed all 140 previews, the five-item Fauna filter,
  thumbnail generation, inventory export and mobile layout.
- Cocina's full integration suite passed with compact desktop views and a 390px
  phone: three-player late join, shared cooking/score, real touch movement and
  interaction, host migration, pause, replay, offline helpers and room isolation.
  Its Escondidas/Derrape/Bululú startup and hub checks also passed, with no
  uncaught browser errors.
- `npm run check` passed all 174 JavaScript files; `git diff --check` passed.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

See `docs/knowledge/map-asset-rollout.md` for actual map coverage and the
remaining Studio-only models. New Plaza garden props must stay outside player
movement bounds; the race town supplies separate road-safe positions.
