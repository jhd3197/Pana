# Shared 3D model library

This is the canonical home for reusable geometry. Games place models; Studio
previews the same factories. Browser ESM, Three.js 0.160.0, no build step.

| Location | Responsibility |
| --- | --- |
| `fauna/birds/` | Species definitions and a shared flight rig |
| `fauna/farm/` | Individual horse, cow and chicken sculpt recipes; shared SDF rig |
| `fauna/capybara/` | Continuous capybara sculpt and natural animal |
| `fauna/aquatic/` | Reef fish and animated school assembly |
| `fauna/beach-crab.js` | Animated crab, independent of coastal furniture |
| `fauna/jaguar.js` | Prowling and sitting jaguar; the stone carvings in `props/jaguar-stone.js` reuse its form |
| `vegetation/` | One module per species; canopy and plant construction helpers |
| `props/` | Cohesive architectural/scenery packs and individual common objects |
| `props/crystals.js` | Instanced, pulsing cave crystal clusters and the rainbow palette |
| `characters/pana/` | Pana sculpt, wardrobe, expressions and avatar adapter |
| `core/` | Materials, primitives, batching, botanical and construction helpers |
| `animation/` | Reusable motion such as bird orbits, separate from anatomy |
| `effects/` | Water surfaces (opt-in foam and rain rings), light shafts and skylights, fountain details and thermal steam |
| `catalog.js` | Aggregates plain model metadata without loading geometry |
| `fauna/catalog.js`, `vegetation/catalog.js`, `props/catalog/` | Category/pack metadata |

Terrain-aware reef/crab placement lives in `../placement/`. World builders remain
in `engine/worlds/plaza.js`, `engine/worlds/island-*.js` and game track modules. Routes,
collisions, state, lights and cameras belong to those consumers.

## Dependency rules

Factories import the smallest module they need. Use a leaf such as
`/engine/models/fauna/birds/scarlet-macaw.js` instead of an all-model barrel.
`vegetation/index.js` is available for habitat code that selects many species.

Core helpers cannot import concrete models. Models cannot import Studio, games,
world builders or terrain placement. The only external local dependencies are
the renderer-independent avatar data in `/engine/avatar.js` and the attributed
SDF vendor library. A capybara statue imports the animal sculpt; the natural
animal never imports the monument pack.

Metadata is plain serializable data. It cannot import Three.js or construct a
model. Studio adds `build`, framing and lifecycle adaptation in
`web/studio/catalog/objects.js`. Characters, outfits, recipes, stations, vehicles
and maps retain specialized adapters in that Studio directory, deriving their
definitions from the real games where appropriate.

## Add or improve a model

1. Search the [inventory](../../../docs/knowledge/model-inventory.md) and this
   library before creating another factory. Edit its canonical module.
2. Give an independent species or complex model its own file. Small props may
   share a cohesive pack and palette. Extract a helper when it has real shared
   use; do not add species branches to a generic global factory.
3. Export a named factory returning a native `THREE.Group`. Keep metres, +Y up,
   +Z forward and ground origin y=0 unless the existing model has an explicit
   carry, keel or water-surface convention. Preserve those exceptions.
4. Add a definition to its category/pack catalog. IDs are stable deep links.
   `source` points to the actual factory file; `usedBy` lists real placements,
   or `['Pana Studio']` until a model is used. `pack` groups a coherent set for
   audits, independently of the user-facing category or source filename.
5. Place it through a world builder with terrain and route clearance. Catalog
   registration does not place anything. Connect the root update exactly once.
6. Check its preview, affected maps and lifecycle, then regenerate the inventory.

For example, the existing macaw definition has this shape:

```js
{
  id: 'scarlet-macaw',
  name: 'Guacamaya roja',
  category: 'Fauna',
  source: '/engine/models/fauna/birds/scarlet-macaw.js',
  factory: 'scarletMacaw',
  usedBy: ['Derrape'],
  previewOptions: { seed: 7 },
  pack: 'wildlife',
}
```

Importing the metadata does not load the macaw. Studio dynamically imports
`source` when constructing it. Normal game code imports the factory directly.
Material/geometry cache templates must not be mounted into a scene: return owned
geometry clones. Cached materials are shared; Studio clones them before controls
or disposal. Preserve idempotent `userData.dispose()` for owned textures and
skeletons. Animated parts stay outside static batches. Use absolute-time
`userData.tick(t, dt)` for pause, scrubbing and reproducible thumbnails.

The farm recipes retain upstream MIT attribution and continue to use
`../vendor/procedural-animals/`; its license is unchanged. Keep provenance with
any imported model, texture or code. Code and asset licenses may differ.

## Compatibility and validation

Every model has one canonical file under `engine/models/`; the old alias URLs
(`/engine/wildlife.js`, `/engine/flora.js`, `/engine/props.js`,
`/engine/soft-character/*`, `/character/*.js`) have been removed. Import the
canonical file directly; never add an alias that re-exports a model.

Run from the repository root with the local server active:

```powershell
npm test -- model-architecture catalog-registry
npm run test:browser -- model-architecture model-library
npm run inventory          # regenerates docs/knowledge/model-inventory.md
```

The browser runner and `npm run inventory` start their own server.
The architecture checks validate import resolution, acyclic dependencies, layer
boundaries, pure metadata, real factory exports, compatibility identity and
selective thumbnail invalidation. Snapshot capture writes to ignored
`art/studio/model-library/`. Use `--baseline` **before** a structural refactor and
`--compare` afterward to check all non-map geometry, materials, poses, bounds and
catalog identity. Do not overwrite the reference to hide an unintended change.

Studio fingerprints include each model's actual module graph and serialized
metadata. Shared preview adapter changes invalidate all thumbnails; a species
edit invalidates that species and its consumers. Do not add entire library
barrels as thumbnail dependencies. Run the Studio cache suite when changing
preview adaptation or dependency discovery, plus relevant fauna/map suites.
