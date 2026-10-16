# Pueblo and Páramo models

Twenty standalone Three.js factories registered in Pana Studio. The buildings
and props appear under **Pueblo** and **Páramo**; the two new plants remain in
**Vegetación**. Search by the original three-digit number, Spanish name or ID.
These are reusable scenery models; registration does not place them into maps
or supply gameplay collision volumes. Existing houses, benches, lamps and pines
remain available under their original IDs.

## Constructors

Import Pueblo factories from `/engine/pueblo-props.js`, mountain structures
from `/engine/mountain-props.js`, and plants from `/engine/flora.js`.

| # | Factory | Details / options |
|---|---|---|
| 011 | `colonialHouse({seed=11,color=0x529b9d})` | Tiled roof, arched door, grilled shutters, planters and entrance steps. |
| 012 | `cornerBodega({seed=12})` | Two stocked shopfronts, striped awnings, signs and mango crates. |
| 013 | `colonialChurch()` | Whitewashed chapel with rose window, open belfry and modeled bell. |
| 014 | `busStopShelter()` | Open shelter with three seats and route panel. |
| 015 | `streetFoodKiosk()` | Arepa griddle, food from the shared kitchen factory, condiments and canopy. |
| 016 | `plazaClockTower({hour=10,minute=10})` | Four clock faces; hands advance in real seconds via `tick`. |
| 017 | `basketballHoop()` | Rim at 3.05 m; woven net has an open center. |
| 018 | `rooftopWaterTank()` | Ribbed tank, ladder, steel stand, outlet and valve. |
| 019 | `streetlightPole()` | Curved post, ornamental brace and emissive lantern. No dynamic light added. |
| 020 | `parkBench()` | Wood slats, cast-iron feet and curved armrests. |
| 051 | `frailejon({seed=51,h=1.5})` | Silver rosette, shaggy dead leaves, yellow flowers; stem height 0.8–3.5 m. |
| 052 | `mountainCabin({seed=52})` | Timber cabin, stone foundation, porch, tiled roof and capped chimney. |
| 053 | `cableCarStation()` | Boarding platform, ticket hut, sheaves, cable and animated gondola. |
| 054 | `rockyCliff({seed=54,width=8,height=5,depth=3})` | Closed cliff volume; width 3–20, height 2–12, depth 1–8 m. |
| 055 | `mountainGuardrail({span=8})` | W-beam, posts, bolts and reflectors; span 2–30 m. |
| 056 | `stoneLookout()` | Stone terrace with steps, perimeter railing and viewing binoculars. |
| 057 | `mountainPine({seed=57,h=7})` | Layered, lobed boughs and branches; trunk height 3–14 m. |
| 058 | `mountainTent({color=0xba7049})` | Open A-frame canvas tent, bedrolls, guy ropes and stakes. |
| 059 | `mountainSuspensionBridge({span=16,seed=59})` | Steel towers, sagging deck, hangers, cables, stone abutments and stairs; span 6–40 m. |
| 060 | `mountainSignpost({seed=60})` | Three directional arrows, route plaque, blaze and rock footing. |

`h` describes the stem/trunk: flowers and foliage extend above it. Bridge span
is the distance between towers; abutments and stairs add about 7.26 m overall.
Guardrail end returns add about 0.57 m. Cliff dimensions describe the main body;
its sculpted face and top extend slightly beyond nominal depth/height.
Unsupported dimensions throw `RangeError` before geometry is allocated.
Seeds are deterministic integers.

## Placement and lifecycle

Origins are at ground y=0, fronts point +Z, and linear modules span X. Cliff
ends match across seeds with equal height/depth; translate consecutive modules
by half the sum of their widths. Their closed back faces let them meet terrain.
Plant seeds in Studio use the catalog's shared preview seed (7).

`architecture-kit.js` batches static parts by material and releases temporary
geometry. Every factory owns its resulting geometry. Sign textures are owned
by that instance and released through `userData.dispose()`. Materials without
textures use the existing shared `M` cache; clone before changing their look.
Studio already clones preview materials and traverses disposal callbacks.

Call `group.userData.tick(elapsedSeconds)` for the clock and cable car. Updates
use absolute time, so seeking to zero reproduces the thumbnail pose. Keep the
animated groups outside any additional static bake. The gondola's travel stays
inside the station and its cable attachment stays fixed in height.

## Verification

```powershell
$env:PANA_PLAYWRIGHT_PATH = 'absolute/path/to/playwright'
node Pana/engine/tests/settlements.browser.js pueblo
node Pana/engine/tests/settlements.browser.js paramo
node Pana/engine/tests/vegetation.browser.js
node Pana/web/studio/tests/studio.browser.js $env:PANA_PLAYWRIGHT_PATH
npm run check
```

The pack suites verify 20 registrations, deterministic finite geometry,
independent ownership, grounding, absolute-time animation, valid dimension
ranges, joining cliff profiles, outward end faces, continuous bridge planks,
usable stairs, and open tent/rim passages. They save front and rear contact
sheets plus individual renders under ignored `art/studio/pueblo` and
`art/studio/paramo`. Default models use 1–24 meshes and fewer than 29,000 triangles.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

Pueblo 011–020 lives in `engine/models/props/pueblo.js`; Páramo structures 052–060
live in `engine/models/props/mountain.js`. Both use `engine/models/core/architecture-kit.js`.
Frailejón (051) and mountain pine (057) are exported by their vegetation modules and
stay in Vegetación. Several Pueblo and Páramo models now appear in Derrape;
keep Studio consumer metadata aligned with actual placements.
Mountain bridges span 6–40 m, guardrails 2–30 m; their long axis is X.
Cliff end profiles must match across seeds. The clock and cable car use
absolute-time `userData.tick(t)`; dispose owned sign textures when released.
