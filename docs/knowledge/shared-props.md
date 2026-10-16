# Shared fruit and island props

Studio and games use the same constructors. `props.makeMango({gold})` builds a
continuous asymmetric fruit with vertex-colored skin, a curved stem and folded
leaf. The gold variant changes the finish, not the geometry. Preserve the
centered origin and root scale of 1.5: held fruit, projectiles and hanging mangoes
already apply their own placements and scales.

`flora.ceiba({seed})` uses a tapered trunk with flared roots, curved forks and
scalloped canopy cushions. `flora.bush({seed,flowers})` combines layered cushions,
folded leaf clusters and optional five-petal flowers. Seeds control the same
variation on every client. Both remain grounded and support static batching.

`island-house.casita({seed})` owns the plaster house, windows, shutters, tiled
roof and veranda. `flora.js` re-exports it for existing consumers. The front is
+Z, the foundation starts at y = 0, and the footprint stays within the old
scenery envelope. Detail is merged internally into 12 material batches; the
temporary unbatched geometries are disposed before returning.

`botanical-shapes.js` supplies leaves and tapered curves. `static-batch.js` owns
the existing `bake` implementation, also re-exported through `flora.js`.
Material objects are cached/shared. Geometry belongs to each returned instance;
dispose geometry when removing a prop, but retain shared materials. Mango body
templates are cloned rather than mounted directly in scenes. Studio copies
materials before changing wireframe or releasing previews.

## Budgets and verification

For the Studio seed (7), the current triangle/material-batch counts are:

| Model | Triangles | Static batches |
|---|---:|---:|
| Mango / Mango dorado | 1,228 each | 4 |
| Ceiba | 6,272 | 3 |
| Arbusto | 3,440 | 3 |
| Casita de isla | 4,456 | 12 |

Run `node Pana/engine/tests/props.browser.js [absolute-playwright-package]
[browser-executable]` against the local server. It checks finite geometry,
determinism, independent disposable geometry, unchanged bounds after batching,
several seeds, flower variants, dimension/triangle/draw-call budgets and actual
Bululú, Escondidas and Cocina renders. Screenshots and metrics go into ignored
`art/studio/props/`. This is a geometry/render smoke test, not a replacement for
multiplayer interaction suites.

For changes affecting shared scenery footprint or fruit items, also run
Derrape's `tests/maps.browser.js` and `tests/items.browser.js`, plus the repository
`npm run check`. Reload Studio to refresh source-dependent local thumbnails.

## Additional vegetation

`flora-species.js` adds twelve distinct models, re-exported through `flora.js`:

| Factory / Studio label | Shape | Triangles (seed 7) | Batches |
|---|---|---:|---:|
| `araguaney` / Araguaney | Forked trunk, golden flowering crown | 9,736 | 3 |
| `bamboo` / Bambú | Seven jointed culms and leafy sprays | 9,096 | 3 |
| `fern` / Helecho | Feathered fronds and curled shoots | 4,992 | 3 |
| `monstera` / Monstera | Split leaves with true geometric holes | 2,930 | 2 |
| `heliconia` / Heliconia | Red bracts with yellow tips and broad leaves | 3,680 | 4 |
| `cactus` / Cardón | Ribbed columns, curved arms and a flower | 3,776 | 4 |
| `mangrove` / Mangle | Exposed stilt roots and low spreading crown | 7,524 | 3 |
| `papaya` / Lechosa | Scarred trunk, lobed leaves and hanging fruit | 5,034 | 3 |
| `agave` / Agave | Thick curved blades with pale edges in a rosette | 2,016 | 1 |
| `waterLily` / Nenúfar | Notched floating pads and layered pink flower | 3,804 | 4 |
| `hibiscus` / Cayena | Leafy shrub, red petals and projecting stamens | 7,524 | 3 |
| `reeds` / Juncos | Arching blades, upright culms and brown seed heads | 5,272 | 3 |

Each accepts `{seed}` (default 1), returns a grounded THREE.Group, and owns its
geometry while sharing cached materials. Static detail is baked internally;
it is safe to include the result in a larger spatial bake. Selva now consumes
all twelve through `games/derrape/public/tracks/selva-flora.js`. Its sixteen
species include the existing ceiba, palm, banana and bush. Other maps retain
their existing composition; catalog registration alone does not populate them.

For `waterLily`, y=0 is the water surface. Its pads sit just above that plane;
the factory does not include water, a pond base, or submerged roots. Place it
at the map's water height. Agave blades have a closed diamond cross-section,
so their thickness remains visible from underneath. All leaves retain vertex
colors through batching; clone shared materials before changing preview flags.

Monstera leaves are triangulated shapes with holes. Subdivide before bending
so the surface has interior vertices; bending only the outline creates long,
folded triangles. Keep shared midpoint indices to preserve smooth normals and
the holes. Its separate midrib uses the same length and bend as the blade.

Run `node Pana/engine/tests/vegetation.browser.js` with `PANA_PLAYWRIGHT_PATH`
and `PANA_BROWSER_PATH` when using an external browser runtime. The test uses
the real catalog constructors, verifies twenty vegetation registrations,
determinism and seed variation, independent geometry, ground origins, bounds
after batching and render budgets. It renders front/perspective and side views
of all twelve additions into ignored `art/studio/vegetation/`. The two contact
sheets are `new-plants.png` and `six-more-plants.png`.

## Pana signature landmarks

`engine/models/props/monuments.js` holds the shared monuments that give every game the same
identity. Studio lists them under the **Emblemas** category. Each factory is
grounded at y = 0, faces +Z, is deterministic and bakes its static detail.
Text plaques are canvas materials and stay as separate meshes.

| # | Factory / Studio ID | Model | Triangles | Meshes |
|---|---|---|---:|---:|
| 001 | `capybaraStatue` / capybara-statue | Approved character cast in patinated bronze, waving | 44,150 | 6 |
| 002 | `goldenMangoStatue` / golden-mango-statue | Giant mango on a fluted octagonal plinth | 7,102 | 11 |
| 003 | `plazaFountain` (plaza.js) / plaza-fountain | Mosaic frieze, rounded coping, animated droplets/ripples | 43,332 | 39 |
| 004 | `welcomeArch` / welcome-arch | Inset PANA crest, lanterns, hanging welcome sign | 15,304 | 23 |
| 005 | `flora.mangoTree` / mangoTree | Lobed canopy, branching roots, hanging fruit; baked | 14,552 | 7 |
| 006 | `capybaraTopiary` / capybara-topiary | Continuous hedge sculpt in an open soil planter | 19,074 | 7 |
| 007 | `panaFlagpole` / pana-flagpole | Cloth folds, halyard and finial on a marble base | 1,990 | 13 |
| 008 | `trophyMonument` / trophy-monument | Swept handles, laurel detail, capybara finial | 8,674 | 6 |
| 009 | `capybaraFountain` / capybara-fountain | Stone capybara family, mosaic basin and animated water | 20,760 | 14 |
| 010 | `souvenirKiosk` / souvenir-kiosk | Scalloped awning, slatted shutters, shelves of souvenirs | 37,795 | 24 |

The welcome sign's underside is at about 3.9 m, so cars can drive through the
arch (inner width about 7.5 m). `capybaraForm(material, {eyes, leafy, detail})`
is the shared four-legged capybara silhouette (about 2.8 long and 1.6 tall)
used by the topiary, the fountain, the trophy finial and the kiosk plushies.
Do not build another one. The statue bakes a posed `buildCharacter()`, swaps in
one metal material, then disposes the character. Statues therefore follow
sculpt changes without skeleton cost.

`flagPole` and fountain water animate through `userData.tick(t, dt)`.
Studio's generic `object()` entries now forward that tick as `update`. The
shared `water-details.js` batches ripples and droplets into two InstancedMeshes.
All motion uses absolute time, including the waterfall texture offset, so
thumbnails, paused previews and replayed time agree. `flagPole({flag:'pana'})` uses the
`panaFlag()` canvas; the default flag is still Venezuelan. Registration does
not itself place landmarks into maps. The plaza fountain, capybara topiary,
trophy monument and souvenir kiosk now have game consumers; see
`model-inventory.md` for current coverage rather than the original rollout state.

Run `node Pana/engine/tests/landmarks.browser.js` (with `PANA_PLAYWRIGHT_PATH`
and `PANA_BROWSER_PATH` when needed). It checks all ten signature assets (the nine
Emblemas entries plus mangoTree) for determinism, owned geometry, grounding,
size, draw-call budgets, animation replay, adjustable spans and open passages. Renders go
to ignored `art/studio/landmarks/` (`landmarks.png` contact sheet).

## Jungle and tropical set

`engine/jungle-props.js` holds jungle ruins and traversal pieces; Studio lists
them under **Selva**. The two plants are in `flora-species.js` and re-exported
by `flora.js` (Studio category Vegetación, now twenty species). All are seeded,
grounded at y = 0 and baked. Structures face +Z; bridges span X.

| # | Factory / Studio ID | Model | Triangles | Meshes |
|---|---|---|---:|---:|
| 031 | `jungleGiant` | 16 m emergent tree: scalloped crown, leaf tips, lianas and bromeliads | 13,368 | 4 |
| 032 | `palm` | Fuller fronds, ringed trunk and upright new growth; baked | 5,406 | 7 |
| 033 | `templeEntrance` / temple-entrance | Beveled masonry, cracks, vines and an open 3.2 m passage | 23,240 | 12 |
| 034 | `ropeBridge({span:14})` / rope-bridge | Complete sagging deck, bound posts and netted rope rails | 10,692 | 9 |
| 035 | `waterfallRocks` / waterfall-rocks | Moving rivulets, grounded plants, foam, spray and ripples | 20,614 | 14 |
| 036 | `vineArch` / vine-arch | Beveled voussoir arch (4.4 m opening) with climbing vines | 16,628 | 10 |
| 037 | `bambooBridge({span:10})` / bamboo-bridge | Lashed deck, visible culm ends, trestles and ramps | 14,432 | 5 |
| 038 | `stoneTotem` / stone-totem | Weathered, beveled jaguar, owl and capybara carvings | 10,204 | 11 |
| 039 | `tropicalBush` | Layered, veined leaves and overlapping red ginger bracts | 11,220 | 3 |
| 040 | `hollowLog({length:6})` / hollow-log | Longitudinal bark ridges, open ends, fungi and moss | 9,328 | 9 |

`liana(group, top, length, seed)` is exported for hanging vines; reuse it
rather than writing another. `boulder()` lifts each displaced rock so its
lowest vertex sits on the ground. The hollow log's lathe surface is
double-sided, so its interior shows through the open ends (inner radius
0.68 m). The waterfall sheet owns a canvas texture scrolled by
`userData.tick`. Selva's in-race temple portal and waterfall remain game-local
in Derrape and are unchanged. Registration does not place these into maps.

`node Pana/engine/tests/landmarks.browser.js selva` checks all ten assets,
including the palm, and writes renders to ignored `art/studio/jungle/`. Without an argument it
checks Emblemas.

The four-legged sculpt uses a small MarchingCubes template cache at two detail
levels. Clone its geometry before editing or disposing; leafy color and attached
leaf sprigs belong to each instance. Small pups and the trophy finial use the
lighter template. Never sample another sculpt per souvenir.

Bridge spans are validated from 4 to 40 m and log lengths from 3 to 20 m.
Waterfall moss, plants and creepers raycast against the actual displaced rocks;
fixed decoration heights can leave vegetation visibly floating. Stone primitives
must all receive vertex colors before batching when using the weathered palette.
The Studio waterfall owns and disposes its animated canvas texture.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

The vegetation catalog has twenty-four models. New plant factories live in
individual files in `engine/models/vegetation/`; keep their seeds
deterministic and their ground origin at y=0. Registration does not place
plants into maps; list actual consumers in `usedBy`.
Pana landmarks (statues, arch, fountains, kiosk) live in `engine/models/props/monuments.js`
under the Studio category `Emblemas`. Reuse `capybaraForm` for any new
four-legged capybara shape. Jungle ruins, bridges and the waterfall live in
`engine/models/props/jungle.js` (Studio category `Selva`).
`capybaraForm` clones a cached continuous sculpt; preserve geometry ownership.
Shared water motion lives in `engine/models/effects/water-details.js` and uses absolute time
so pausing, scrubbing and thumbnail capture agree. Bridge spans accept 4–40 m;
hollow logs accept 3–20 m. Keep their passages empty and ground origins stable.

`engine/models/effects/water-surface.js` supplies animated oceans, directional rivers, canals
and ponds to Derrape and Studio. Its depth textures use actual sampled terrain;
update the live shader material and dispose cloned uniform textures too.
Environment owners compose `waterAnimator(group)` with their existing update;
scenery water is already collected by the track runtime. Keep animated water
outside static batches and preserve pond surface height inside a wrapper group.
