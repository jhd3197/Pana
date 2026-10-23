# Venezuelan trees (tree kit)

The shared trees come from the "Árboles Pana" set: eighteen species built on
`engine/models/vegetation/tree-kit.js`. The factory names did not change, so
every map that already planted a tree got the new one.

| Species | Factory (file) | Notes |
|---|---|---|
| Samán | `saman` (`saman.js`) | Wide flat umbrella, pink pompons with `flowers` |
| Mango | `mangoTree` (`mango-tree.js`) | `h` still means the old trunk height (scale `(h + 2) / 7.2`) |
| Araguaney, apamate, bucare | `araguaney({ bloom })`, `apamate` (`araguaney.js`) | gold / pink / coral; bucare uses the apamate form |
| Ceiba | `ceiba` (`ceiba.js`) | Default scale 0.7 (about 11 m); `fruit` toggles the trunk spines |
| Cocotero | `palm` (`palm.js`) | `h` is the trunk height |
| Moriche | `moriche` (`moriche.js`) | `h` is the trunk height (4–16) |
| Pino caribe | `pine` (`pine.js`) | `h` is the tree height |
| Mangle | `mangrove` (`mangrove.js`) | Stilt roots reach below y = 0 into the water |
| Árbol seco | `deadTree` (`dead-tree.js`) | `leaves: true` hangs barba de palo |
| Gigante de la selva | `emergentTree` (`emergent-tree.js`) | 24 m at scale 1 |
| Caucho de raíces | `jungleGiant` (`jungle-giant.js`) | Prop roots spread a 23 m footprint; Selva keeps it clear of the road by its bounds |
| Matapalo | `stranglerFig` (`strangler-fig.js`) | `shrine` adds the stone shrine at (-5, 0, 7)·scale |
| Yagrumo, cacao | `yagrumo`, `cacao` (`selva-trees.js`) | |
| Palma zancona, palma manaca, helecho arborescente | `zancona`, `manaca`, `treeFern` (`selva-palms.js`) | |

`broadleafTree`, `ceibaGateway`, `mountainPine` and the bush-sized plants keep
their own builders.

## Detail tiers

The prototype had Completo and Ligero. Maps need two cheaper tiers, so
`treeDetail` maps the caller's `detail` to four:

| Caller passes | Tier | Use | Mango / ceiba triangles |
|---|---|---|---|
| `'full'` | full | Studio close-ups | 45 k / 32 k |
| `'lite'` | lite | Hero trees near the camera | 20 k / 12 k |
| nothing, `'game'` | low | Every map by default | 7.0 k / 6.0 k |
| `'low'`, `'distant'` | far | Roadside rows, distant forests | 1.2 k / 1.3 k |

Counts are approximate for seed 7 at each factory's default scale. The map
tiers skip foliage sites along the limbs and enlarge the terminal sprays;
far leaves are 1.45× longer to retain coverage with fewer leaves. Low also
drops twig tubes under 2 cm and uses fewer sides per limb. Avoid raising the
tier merely to improve a silhouette: the open foliage recipes work at every
tier and keep map geometry below the former solid-core versions.

Tiers draw from the same seed but grow a different skeleton (fewer segments,
one level less), so a tree's crown width can change between tiers: the far
samán is wider than the low one. Keep placement clearances on the tier the
map actually builds.

## Construction

Araguaney, apamate and bucare use a species-owned `dressCrown` builder: folded two-triangle
sprays distributed around and partway along the terminal branches, instead of
solid ellipsoid cores. Far/game/lite/full use 45/80/100/160 sprays per tip.
The far variants retain 24 tips and fit under 3,100 triangles per tree; the game
variants fit under 6,000. They remain two opaque draws (bark and foliage), with
no textures or per-frame buffer work. Flower colors, occasional green sprays
and the all-green option share the foliage draw and its nature tag. Wind and
Plaza bloom tint therefore use the same material path. `flowering-trees.browser.js` checks seed
repeatability, finite geometry, tiers, toggles, grounding and these budgets.

Mango, samán, ceiba, mangle, jungle giant, emergent tree, strangler fig and cacao
opt into `foliage.openCrown`. Their default crown placement now uses folded
two-triangle leaves instead of an ellipsoid core. Each recipe retains its own
leaf length, width, vertical spread, tint and branch structure. Cacao's reddish
young leaves also opt in, including its far tier. Far/game use 20/48 leaves
per site; lite uses twice the recipe's blade count (up to 60), full uses 100.
Lite/full have additional foliage sites along limbs, so per-site counts alone
do not describe the total detail. All leaves retain the shared opaque wind
material and foliage tags; no textures or frame-time geometry updates are added.
`broadleaf-trees.browser.js` covers the nine changed species, all tiers, seed
repeatability with floating-point tolerance, leaf toggles and draw/triangle caps.
`branchPoints` uses a seeded Fisher–Yates shuffle: the former random sort
comparator could move emergent-tree vines between consecutive builds of seed
19 at far detail, including on the unchanged baseline. Keep randomness out of
sort comparators when selecting attachment sites.

Same-seed gameplay comparisons reduced all nine species' geometry. Whole-map
counts fell from 4.37 M to 4.26 M in Plaza, 3.11 M to 3.03 M in Llanos,
4.78 M to 4.11 M in Chichi and 5.31 M to 5.08 M in Selva, without adding
mesh batches. Both pines, all palms, yagrumo, tree fern, the dead tree,
araguaney/apamate and all five separate broadleaf/gateway variants retained
their geometry hashes. The solid third-row models remain available for distant
scenery; do not replace those or the pines as part of an open-crown adjustment.

- One species is data: `skeleton(scale)` for `growSkeleton` (children per
  level, golden-angle spiral, crown envelope that stops limbs), `bark`,
  `foliage`, optional `blossom`, `fruit(parts, r, skeleton, scale, lite)` and
  `extra(group, parts, r, skeleton, scale, opts)`. Palms and ferns are built
  by hand from `palmTrunk`, `pinnateFrond` and `fanFrond`.
- `finishTree` concatenates all leaves into one geometry and all fruit into
  another, then `bake`s: two or three draws per tree. Bark and leaves carry
  `natureSurface` tags; fruit does not.
- The prototype sank trunks 0.15 m into the ground. Pana's proofs require a
  grounded origin (min y above −0.05), so trunks start a quarter radius up
  and roots, stilts and lianas end at or just above y = 0. Maps sink a tree
  themselves where a slope needs it (Selva plants at ground − 0.12).
- Wind lives in the tree materials' shader and reads plant-kit's uniforms
  (`windUniforms`), so the existing `tickWind` calls move the trees too. The
  phase comes from the instance's world origin, so an instanced grove does not
  sway in lockstep.

## Notes for agents

- Review species at the actual map tier, not only Studio's full tier. The old
  solid-core builder reduced blades to 10% at far detail, exposing the core
  as a visible blob; increasing detail smoothed the blob but did not remove it.
- The Casas Botes approach in Plaza can be reproduced near lap fraction
  `0.455`. The roadside araguaney turns green at bloom time 90 seconds; this
  is the same flowering crown with a shader tint, not a separate green model.
- Plant trees by factory name; never build a one-off tree in a track file.
- Pass `detail: 'low'` for long roadside rows and `'distant'` for forests far
  from the road. Leave it out for normal scenery.
- Measure a placement change with the whole-scene triangle count against the
  map's budget in `venezuela.browser.js` before and after; trees are most of
  every map's triangles.
