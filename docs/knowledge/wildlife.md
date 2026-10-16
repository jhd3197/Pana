# Shared wildlife and inventory audit

Canonical species live in `engine/models/fauna/birds/` and
`engine/models/fauna/capybara/`. `engine/wildlife.js` now only re-exports them.
The common bird rig lives beside the species; orbit motion is separate in
`engine/models/animation/orbit-bird.js`. The natural capybara and monuments import
`fauna/capybara/shape.js`, so an animal no longer imports the monuments pack.
See [the model library](../../Pana/engine/models/README.md) for extension rules.

These are native Pana procedural models, used by Studio and three race worlds.
No additional external source/license was added. The existing farm
animals retain their separate MIT attribution in `procedural-farm-animals.md`.

| Factory | Studio entry | Actual map instances | Triangles / meshes |
| --- | --- | --- | --- |
| `scarletMacaw({seed})` | Guacamaya roja | Selva: 1 | 8,656 / 13 |
| `scarletIbis({seed})` | Corocora roja | Llanos: 4 | 6,000 / 8 |
| `soaringVulture({seed})` | Zamuro planeador | Desierto: 2 | 5,800 / 9 |
| `wildCapybara({seed})` | Chigüire | Selva: 1; Llanos: 3 | 10,120 / 7 |

Birds use distinct bills, tails, heads, legs and feather silhouettes, with a
continuous flight surface joining feather roots. +Z is forward. Their local
pose is airborne above y=0; `previewBounds` covers the full flap, preventing
Studio framing from changing with time. They are intentionally in flight, with
trailing feet rather than a standing/perching pose. The capybara has feet at
y=0 and clones the existing continuous `capybaraForm`; only the ear pivots move.

`orbitBird(model,{cx,cz,cy,r,speed,phase})` wraps the model's absolute-time tick
and initializes time zero immediately. Its heading follows the circular tangent
for either speed sign. The previous `-angle-PI/2` heading made birds fly sideways.
The root owns animation: don't also collect wing callbacks or bake birds. Llanos
owns capybara updates through its environment's existing `moving` list; scenery
birds and Selva's capybara are collected by `makeTrack` normally.

All geometry buffers belong to each instance. Static body and wing subgroups
are batched separately; construction geometry is disposed by `finish`. Cached
untextured materials are shared, so Studio must call `ownMaterials` before
releasing previews, as it does for other props. No skeleton/texture disposer is
needed for these animals.

The old `track-kit.buildBird` and `track-kit.capybara` were removed after migrating
every caller. The latter used `randomAvatar()` and a dressed biped, so it was
neither a natural animal nor deterministic. Do not reintroduce it for scenery.
The old bird's “toucan/seagull” comment did not mean those species existed.

Validation: `engine/tests/wildlife.browser.js` checks owned geometry, same-seed
results, finite transforms, render budgets, animation rewind, clockwise and
counterclockwise flight heading, all seven birds/four capybaras, terrain height
and road clearance. It renders a contact sheet, bird views and road views to
ignored `art/studio/wildlife/`. All 154 Studio previews and the ten-entry Fauna
filter passed; native Selva/Llanos/Desierto race regressions completed all laps.
`npm run check` passed 180 files. These checks do not claim automated clearance
against every tree canopy or certify future changes to terrain/placement.

`model-inventory.md` and `.json` include the generated registry and a reviewed
ledger of models outside Studio, embedded assemblies and dormant factories.
Regenerate with `Pana/scripts/audit-inventory.browser.js`; edit the explicit
ledger in `Pana/scripts/inventory-notes.js` when adding/removing inline scenery.
Counts represent catalog entries or grouped families, not unique meshes.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

`engine/models/fauna/` supplies the Fauna macaw, scarlet ibis, soaring vulture and
natural capybara. Each species has its own module; the shared flight rig and
`models/animation/orbit-bird.js` are separate. `capybaraForm` lives in
`models/fauna/capybara/shape.js`, independent of monuments. Selva uses one macaw/one capybara; Llanos four ibis/three
capybaras; Desierto two vultures. Keep flight roots outside static batches,
preserve +Z tangent heading and absolute-time ticks, and reuse `capybaraForm`.
Fauna now has ten entries (nine animals plus a fish school). The current source
inventory, uncataloged/legacy ledger and priorities live in
`docs/knowledge/model-inventory.md`; regenerate it with
`scripts/audit-inventory.browser.js` after updating `scripts/inventory-notes.js`.
`engine/models/fauna/aquatic/` supplies Pana-authored fish and schools to both islands.
Keep their whole swimming envelope below waves and above the seabed, and pass
path clearance to `placeReefSchools` in `engine/placement/reef-schools.js`. Do not bake animated fish. The Studio
island preview uses the full Bululú board, including scenery and paths.
