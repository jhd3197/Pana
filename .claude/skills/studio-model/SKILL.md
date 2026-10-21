---
name: studio-model
description: Add or improve a 3D model in Pana's shared model library (engine/models) and register it in Pana Studio so every map can use it. Use when asked to "add a model/plant/animal/prop", "put X in Studio", "make a low-poly/LOD version", when a map needs scenery that is not in the library yet, or when a map is about to build a one-off mesh in a track file.
---

# Adding a model to the shared library

Every model a map places comes from `Pana/engine/models/` and is visible in
Pana Studio. Improvements to a library model then reach every map. Read
`Pana/engine/models/README.md` (layout, dependency rules, factory contract)
and `docs/knowledge/pana-studio.md` first; for trees also
`docs/knowledge/venezuelan-trees.md`, for animals `docs/knowledge/wildlife.md`.

## 1. Search before you build

- Look in `docs/knowledge/model-inventory.md` (generated, lists every Studio
  entry with its source) and open Studio (`.\dev.ps1 studio`, then
  `/studio/library`). If a close model exists, extend its canonical file with
  an option (seed, colour, `detail`, variant) instead of a new factory.
- A map never builds its own scenery mesh (blob trees, icosahedron boulders,
  stick flowers). If the library lacks it, add it here first, then place it.

## 2. Write the factory

- One file per species or complex model under the category folder:
  `engine/models/vegetation/`, `fauna/` (`birds/`, `farm/`, `aquatic/`,
  `capybara/`), `props/` (cohesive packs may share a file), `vehicles/`,
  `effects/`. Shared helpers go in `core/` (which may not import concrete
  models) or the category kit (`vegetation/tree-kit.js`,
  `fauna/birds/flight-rig.js`).
- Export a named factory returning a `THREE.Group`: metres, +Y up, +Z
  forward, origin on the ground (min y about 0) unless an existing carry/keel
  /water convention applies. Seeded (`engine/random.js` `rng`), deterministic
  for the same seed, owned geometry (no mounted cache templates).
- Animation uses absolute time: `group.userData.tick(t, dt)` must rewind when
  called with `t = 0`. Owned textures/skeletons get an idempotent
  `group.userData.dispose()`.

## 3. Add a cheap variant for dense use

Roadside rows and far forests need a low-cost version of the same model, not a
separate cheap mesh. Follow the existing `detail` option:

- Trees: `treeDetail(detail)` in `vegetation/tree-kit.js` maps `'full'`,
  `'lite'`, default/`'game'`, and `'low'`/`'distant'` (about 2 k triangles).
- Birds: `detail: 'low'` in `fauna/birds/flight-rig.js` (flocks).
- Houses: `detail: 'game' | 'low'` in `props/colonial-house.js`.

Keep the silhouette and palette; drop small parts and segments. Maps pass
`detail: 'low'` for long rows and `'distant'` far from the road, and keep
placement clearances measured on the tier they actually build.

## 4. Register it

- Shared models: add a plain-data row to the category catalog,
  `engine/models/vegetation/catalog.js`, `engine/models/fauna/catalog.js` or
  a pack in `engine/models/props/catalog/<pack>.js` (aggregated by
  `engine/models/catalog.js`). Fields: stable `id` (a deep link), `name`
  (Spanish), `category` (one of `CATEGORIES` in `web/studio/catalog.js`),
  `source` (the concrete file, not an `index.js`), `factory` (its export),
  `usedBy` (real games, or `['Pana Studio']`), `previewOptions`, `pack`. No
  Three.js, `new`, `async` or dynamic import in a catalog file.
- Game- or scene-specific adapters (cars, tracks, table games, characters)
  live in `web/studio/catalog/<name>.js` with their own `build()`.
- Registration places nothing. Place the model through the map's world
  builder with terrain and route clearance, and update `usedBy`.

## 5. Check it

```powershell
npm test -- catalog-registry model-architecture   # ids, sources, factory exports, layer rules (seconds)
npm run check
npm run test:browser -- vegetation      # a plant: every catalog plant builds; budgets, grounding
npm run test:browser -- wildlife        # an animal in the wildlife pack
npm run test:browser -- water-world     # the water-worlds pack
npm run test:browser -- studio/tests/studio model-library   # Studio pages, previews
npm run test:browser -- <map>           # each map that now places it
npm run inventory                       # regenerate docs/knowledge/model-inventory.md
```

The browser suites read their expected entries from the catalog, so adding a
model needs no count edit in a test. A model that is registered but fails to
build fails them with its id.

Then look at it: `.\dev.ps1 studio` opens `/studio/library`; open the asset,
orbit it, check the side view, the thumbnail and the triangle/mesh numbers,
and drive or tour each map that places it (`npm run shots -- derrape --track
<id>` for a quick look from the real loop).

## 6. Finish

- `usedBy` lists the real consumers; the inventory is regenerated.
- Note non-obvious conventions in the relevant `docs/knowledge/` note.
- Commit only your paths on the current branch (imperative subject, 50 chars).
