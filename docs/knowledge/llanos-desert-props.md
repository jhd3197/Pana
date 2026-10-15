# Llanos and desert models

Twenty native Three.js models extend Studio to 135 entries. The `Llanos` and
`Desierto` categories contain 041–050 and 061–070 respectively. Search also
accepts the asset numbers. Front is +Z and ground is y=0. Factories own their
geometry; seeded variants are deterministic. No image downloads or new packages.

`engine/ranch-props.js` exports `llaneroRanchHouse`, `corralGate`, `hayBale`,
`waterWindmill`, `horseStable`, `feedingTrough`, `ranchFence`, `oldTractor`,
`mudPuddle`, and `ranchWaterTower`. The house has a tiled roof, shutters and a
woven chinchorro. The stable's central entrance is open. Machinery has visible
mechanical details; the trough, stable and hay bale share a straw palette.

`engine/desert-props.js` exports `giantCactus`, `sandDune`, `desertRockArch`,
`abandonedGasStation`, `rustedPickup`, `roadsideTirePile`, `canyonSpire`,
`brokenWagon`, `desertWarningSign`, and `desertWell`. The giant cactus reuses
the existing ribbed cardón sculpt. Tires have real holes, the pickup has an
open bed and side windows, and the well has an open stone mouth and hanging bucket.

Shared `rural-kit.js` owns corrugated roofs, wheels, ladders, planks and dimension
validation. Static assemblies use `architecture-kit.finish` to batch compatible
materials and own canvas-label disposal. Do not bake a complete moving model.

## Parameters and lifecycle

| Factory | Options |
| --- | --- |
| `corralGate` | `span` 3–24 m, `open` 0–1; `userData.setOpen(value)` moves both leaves |
| `ranchFence` | `span` 2–30 m, long axis X |
| `waterWindmill` | `height` 5–16 m; absolute-time rotor and pump motion |
| `mudPuddle` | `rx`, `rz` 0.5–12 m; `seed` controls rim stones |
| `giantCactus` | `height` 2–16 m, `seed` |
| `sandDune` | `width`, `depth` 4–40 m, `height` 0.25–10 m, `seed` |
| `desertRockArch` | clear `span` 4–28 m, inner apex `height` 4–18 m, `depth` 1–8 m, `seed` |
| `canyonSpire` | nominal `height` 3–24 m, `seed`; jagged tip varies slightly |

Invalid finite dimensions throw RangeError. Gates do not open automatically.
The dune perimeter stays at ground height across seeds. The water shader stays
outside static batches and updates the live material after Studio cloning.
Studio's `release()` disposes cloned materials as well as factory-owned resources.
Registering a prop does not add collision, mud physics or driving controls.

The rebuilt Los Llanos and Pana Desierto circuits each use all ten factories in
their respective pack; all twenty entries now list Derrape as a consumer.
The ranch circuit has two hatos, an enclosed corral, pasture fences and three
mud patches. Desierto groups its roadside props at Pana Gas and the oasis,
with eight terrain-fitted dunes, two 25 m rock gateways and clustered spires.
Model geometry stays shared through factories; game-local placements, dune
fitting and enlarged geological formations live in the circuit world modules.

## Validation

`engine/tests/rural.browser.js llanos` and `... desierto` verify all twenty models:
independent geometry, deterministic seeds, finite bounds, grounding, repeated-time
animation, live shader updates and disposal, invalid dimensions, real openings,
and dune seams. Each model stays under 13k triangles and 22 meshes. Front/back
contact sheets and individual previews are written to ignored `art/studio/`.
The proof uses the real Studio renderer and shared constructors.

Also run `games/derrape/tests/maps.browser.js` with
`PANA_MAP_TEST_TRACKS=llanos,desierto` for lane-clearance and three-lap checks,
`web/studio/tests/studio.browser.js` for category/search/preview/mobile checks,
and `Pana/dev.ps1 check` from the repository root. Browser suites accept the
existing external Playwright runtime; no testing dependency is added to the game.
