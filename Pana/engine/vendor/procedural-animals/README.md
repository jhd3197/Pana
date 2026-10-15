# Selected procedural-animals geometry core

Upstream: https://github.com/majidmanzarpour/threejs-procedural-animals

Revision: `c95ae49346aa8e140a924376cec6cf0073d99512`

License: MIT; the original copyright and full permission notice are in `LICENSE`.

Unmodified source files, with their original relative paths:

- `src/core/math/vec.js` → `core/math/vec.js`
- `src/core/sdf/sdf.js` → `core/sdf/sdf.js`
- `src/core/sdf/mesher.js` → `core/sdf/mesher.js`

`../../farm-animals.js` also adapts the torso/neck/limb shape recipes from
`src/species/horse/sculpt.js`, `src/species/chicken/sculpt.js` and `src/species/cow/sculpt.js`, covered by the
same MIT notice. Its attribution header must remain with derived copies.

Pana simplifies the anatomy and supplies its own native Three.js skinning,
matte vertex colors, geometry cache, detail meshes and absolute-time idle poses.
It does not include upstream photographs, media, coat shaders, behaviour/IK
controllers, workers, package dependencies or the other species. There is no
build step or runtime network dependency on this repository. No claim of a
particular percentage of code reuse is made.

To update, compare these three files against a pinned upstream revision,
preserve the license, review changes, and rerun the farm-animal browser proof.
