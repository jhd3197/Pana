# Coastal objects

`Pana/engine/coastal-props.js` contains ten Pana-authored native Three.js models,
with no new dependencies, downloaded assets or imported recipes. Studio now has
150 resources: nine new `Costa` objects and a sixth `Fauna` entry, the crab.

| Factory / Studio ID | Model | Bululú circuit | Board island |
| --- | --- | --- | --- |
| `fishingBoat` / `fishing-boat` | Open peñero with outboard, oars, seats and bow rope | 5 boats at lagoon jetties | 2 boats beside the harbor dock |
| `coastalLighthouse` / `coastal-lighthouse` | Striped tapered tower with balcony and lantern | Replaces the basic tower on the western crest | — |
| `lifeguardTower` / `lifeguard-tower` | Raised lookout, stairs, seat, roof and rescue ring | Beach at (285,110) | Behind promenade at (17,75) |
| `beachVolleyball` / `beach-volleyball` | Sand court, open sagging net, lines and ball | Beach at (260,20) | — |
| `beachShower` / `beach-shower` | Timber platform, drain, curved pipe and valve | Beach at (230,60) | Behind promenade at (-18,73) |
| `rescueRingStand` / `rescue-ring-stand` | Ring, rescue rope and Spanish sign | Beach at (250,110) | Dock at (154,24) |
| `fishingNetRack` / `fishing-net-rack` | Net, floats, wooden rack and coiled rope | Harbor at (-185,10) | Harbor at (113,-6) |
| `fishCrates` / `fish-crates` | Three slatted crates with stylized silver catch | 2 sets on jetty decks | 1 set on the dock |
| `channelBuoy` / `channel-buoy` | Channel marker with gentle bob and tilt | 2 in the lagoon | 2 outside the harbor |
| `beachCrab` / `beach-crab` | Eight legs, stalk eyes, shell and animated pincers | 4 on the beach | 4 on the beach |

There are 19 placements in the circuit and 13 on the board. Existing reef schools
remain separate live fish; fish inside crates are small static geometry.
The two larger models omitted from the board preserve its scale and camera sightlines.

## Contracts

- Metres, +Z forward, ground origin. The boat's origin is its keel; maps place it
  0.32 m below mean water and verify the hull's footprint is clear of the shore.
- `fishingBoat({color})` accepts a hull color; other factories require no options.
- Each factory owns its geometry and uses shared cached untextured materials.
  Static subassemblies are batched with `architecture-kit.finish`. Its dispose
  callback owns generated sign textures. Consumers release geometry and their
  cloned materials using the usual Studio lifecycle.
- Buoy and crab roots expose absolute-time `userData.tick(t)`. Never merge their
  animated children into scenery batches. Rewinding time restores the pose.
- Map roots retain `assetId` and `footprintRadius` for placement inspection.
  Land furniture sits on terrain-sampled pads; dock props use actual deck tops.
  `groundBeachCrab` aligns planted feet with the local beach slope.
  Board foliage/rock scattering respects new reserved furniture footprints.
- `usedBy` reflects the actual placements above. Lighthouse and court list only
  Derrape. Source dependency fingerprinting invalidates both islands' previews.

## Verification

`Pana/engine/tests/coastal.browser.js` checks all ten factories for finite geometry,
independent geometry ownership, deterministic construction, animation rewind,
ground bounds, per-model budgets, disposal and actual placements in both maps.
It checks road/board-tile clearance, boats against the seabed, and live map ticks.
Images and metrics are written to ignored `art/studio/coastal/`.
The pack uses 3–9 meshes per object and fewer than 10,000 triangles per model.

Also run `web/studio/tests/studio.browser.js` (Costa 9, Fauna 6), the Studio
circuit tour suite, the Bululú native driving regression, and `npm run check`.
Use `PANA_PLAYWRIGHT_PATH` for an installed external Playwright package;
`PANA_MAP_TEST_TRACKS=bululu` scopes the driving regression to the changed map.

Verified on 2026-10-15: all ten native models and both placements passed;
all 150 Studio previews, category filters and mobile layout passed; both islands'
reef schools passed their existing water/seabed regression; the Bululú driving
run finished without road obstructions; all eight walkthroughs passed including
pause/scrub/mobile and warm cache; `npm run check` passed all 178 JS files.
