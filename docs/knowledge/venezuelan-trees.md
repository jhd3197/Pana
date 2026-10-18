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
| `'full'` | full | Studio close-ups | 79 k / 42 k |
| `'lite'` | lite | Hero trees near the camera | 26 k / 16 k |
| nothing, `'game'` | low | Every map by default | 8.7 k / 7.9 k |
| `'low'`, `'distant'` | far | Roadside rows, distant forests | 1.9 k / 1.8 k |

The low tier skips the clumps along the limbs but makes the tip clumps 1.3×
bigger with a smooth (detail 1) icosahedron core, so the crown stays a soft
cushion. Faceted detail-0 cores read as boulders; only far trees use them.
Low also drops twig tubes under 2 cm and uses 3–6 sides per limb: bark was
over half of a low mango before that. With these tiers every Derrape map's
whole-scene triangle count is at or below its pre-swap value (Chichi 4.73 M,
Plaza 4.54 M, Llanos 3.01 M, Estadio 1.24 M).

Tiers draw from the same seed but grow a different skeleton (fewer segments,
one level less), so a tree's crown width can change between tiers: the far
samán is wider than the low one. Keep placement clearances on the tier the
map actually builds.

## Construction

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

- Plant trees by factory name; never build a one-off tree in a track file.
- Pass `detail: 'low'` for long roadside rows and `'distant'` for forests far
  from the road. Leave it out for normal scenery.
- Measure a placement change with the whole-scene triangle count against the
  map's budget in `venezuela.browser.js` before and after; trees are most of
  every map's triangles.
