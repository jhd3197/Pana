# Puerto circuit and harbor models

Puerto is a compressed fictional La Guaira-inspired circuit, not a geographic
reconstruction. `tracks/puerto-layout.js` owns its 2,451.5 m loop, independent
town streets, shoreline, dock footprints and hilltop terrace. Sea is +Z and
hills are -Z. The lap climbs 66 m, has a minimum bend radius of 21.5 m and a
maximum grade of 0.337. It uses the normal road confinement and existing race
physics, pickups, saved pana, music, menu, Studio tour and online room flow.
It is explicitly registered in `cup-definitions.js` as a standalone circuit.
The existing four-race cup editions retain their routes and trophy meaning;
validation covers both cup stages and explicitly registered standalone tracks.

`puerto-harbor.js` places 240 containers in six instanced color families, three
cranes, a cargo vessel, transit warehouses, fishing boats and a breakwater.
`puerto-town.js` places 48 low-detail houses from all six shared colonial
families, the church, market, cafe, palm-lined streets and hilltop fort.
`puerto.js` composes them with the shared terrain, sea, vegetation and road
furniture. No reference photograph or generated concept art is shipped.

## Placement traps

- Sampling the highest point under a house produced tall concrete blocks on
  the hillside. Accepted house sites now shape small earth terraces in the
  heightfield before their low foundations are sampled. The terrain cut always
  preserves the race corridor. Use `world.groundAt`, which interpolates actual
  terrain triangles, for final placement; the analytic height alone is not proof.
- Flat boxes made hillside streets into separate steps; wide ribbons then
  intersected the terraces between their two outer edges. `puerto-streets.js`
  samples both axes on a one-metre grid and classifies each junction cell once
  as sidewalk or asphalt. Tree placement reserves these streets. Houses face
  their nearest street.
- A vessel's keel offset must scale with the model. `cargoShip` has a local
  waterline at 2.8 m; its 1.35-scale placement uses y=-3.78 so the sea meets it.
- Keep repeated vegetation and cargo in `instances`, outside `finish`/static
  baking. New model geometry is owned by each instance, while materials use
  the existing cache. The shared distant ceiba profile limits mountain cost.
- The harbor updater composes buoy motion with `waterAnimator` exactly once.
  Neither the ordinary scenery loop nor the map should double-tick the water.

## Shared assets

The `puerto` catalog pack adds six native factories under `engine/models/props/`:
`shippingContainer`, `transitWarehouse`, `portBollard` (`port-cargo.js`),
`portCrane`, `cargoShip`, and `coastalFortress`. They are grounded at y=0 except
the explicitly documented ship keel. Front/boom/bow faces +Z. Studio reads the
same factories from `props/catalog/puerto.js`; the model inventory records the
actual Derrape consumer. These models require no downloaded meshes or textures.

## Proof and maintenance

Run from the repository root with a fresh `PANA_TEST_URL`:

```powershell
$env:PANA_TEST_URL='http://localhost:8470'
npm run test:browser -- puerto
$env:PANA_MAP_TEST_TRACKS='puerto,estadio,puerto'
npm run test:browser -- derrape/tests/maps.browser
Remove-Item Env:PANA_MAP_TEST_TRACKS
.\dev.ps1 check
```

The model suite checks six live Studio constructors for finite geometry,
determinism, independent disposable geometry, ground origins and budgets.
The map suite checks spline crossings/radius/grade/projection, five driving
lanes against actual meshes, low house foundations, ship waterline, rendering
budgets and five actual race-camera views. Its ceiling is 3.2 million scene
triangles and 900 overview draws; this is not an FPS guarantee. The online
suite uses two real clients to select, load and drive Puerto with remote poses.
The general maps suite completes three-lap races, collects every item row and
switches away and back. Run all Derrape browser suites before finishing changes.

Ignored visual proof lives in `art/studio/puerto/`. Set
`PANA_CAPTURE_PUERTO_ART=1` only when refreshing the shipped menu WebPs from the
actual map. Clear the variable afterward. Local plan 71 remains ignored.
