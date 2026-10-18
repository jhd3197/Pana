import { growTree, ellipsoid, treeDetail } from '/engine/models/vegetation/tree-kit.js';

// The Tabebuia family in bloom. Araguaney, the national tree: a twisted trunk
// opening into a cup-shaped crown, all gold. Apamate: taller and straighter,
// an oval crown of pink flowers mixed with leaves. Bucare shares the apamate
// form in coral. `flowers: false` shows the green tree.
const ARAGUANEY = {
  name: 'araguaney',
  height: 7.5,
  skeleton: s => ({
    trunk: 2.6 * s, trunkR: 0.25 * s, trunkTaper: 0.55, clear: 0.62, lean: 0.3, trunkWobble: 0.14, depth: 3, kids: [4, 3, 3],
    angle: [0.62, 0.62, 0.6], lenRatio: [1.5, 0.6, 0.56], radRatio: [0.65, 0.58, 0.55], upturn: [0, 0.05, 0.03, 0.02],
    wobble: 0.3, taper: 0.35, envelope: ellipsoid(0, 5.3 * s, 0, 3.5 * s, 2.5 * s, 3.5 * s),
  }),
  bark: { bark: 0x6f5a46, barkLight: 0x9a8670, ridges: 6, ridgeTwist: 2.4 },
  foliage: { kind: 'leaf', size: 0.95, tints: [0x5f9a3e, 0x6fa846, 0x4f8a38], blades: 14, bladeLen: 0.6, bladeWidth: 0.26, along: 2, alongFrom: 2 },
  blossom: { kind: 'flower', size: 0.9, flowers: [0xf7c71f, 0xffd83a, 0xf0b30e], throat: 0xc98410, blooms: 24, petalBlades: 16, mixLeaves: 0.12 },
  petals: { color: 0xf5c21e, radius: 3.6 },
};
const APAMATE = {
  name: 'apamate',
  height: 9.5,
  skeleton: s => ({
    trunk: 3.4 * s, trunkR: 0.3 * s, trunkTaper: 0.55, clear: 0.6, lean: 0.12, depth: 3, kids: [4, 3, 3],
    angle: [0.55, 0.66, 0.62], lenRatio: [1.25, 0.6, 0.56], radRatio: [0.62, 0.58, 0.55], upturn: [0, 0.045, 0.03, 0.02],
    wobble: 0.24, taper: 0.35, envelope: ellipsoid(0, 6.9 * s, 0, 3 * s, 3.1 * s, 3 * s),
  }),
  bark: { bark: 0x6a5c4c, barkLight: 0x948572, ridges: 7 },
  foliage: { kind: 'leaf', size: 1, tints: [0x4f8e3c, 0x5e9c42, 0x3f7d36], blades: 14, bladeLen: 0.62, bladeWidth: 0.24, along: 2, alongFrom: 2 },
  blossom: { kind: 'flower', size: 0.9, flowers: [0xf09bd0, 0xe47cc0, 0xf9c2e2], throat: 0xa54e8e, blooms: 22, petalBlades: 16, mixLeaves: 0.45 },
  petals: { color: 0xee8fca, radius: 3.4 },
};
const BUCARE = {
  ...APAMATE, name: 'bucare',
  blossom: { ...APAMATE.blossom, flowers: [0xf26a3c, 0xf8834a, 0xe5552e], throat: 0xb8401f, mixLeaves: 0.3 },
  petals: { color: 0xf47a42, radius: 3.4 },
};
const BLOOMS = { gold: ARAGUANEY, pink: APAMATE, coral: BUCARE };

// The default scale keeps the old ~5.5 m roadside size; scale 1 is full grown.
export function araguaney({ seed = 1, detail = 'game', bloom = 'gold', leaves = true, flowers = true, scale = bloom === 'gold' ? 0.75 : 0.65 } = {}) {
  return growTree(BLOOMS[bloom] || ARAGUANEY, { seed, detail: treeDetail(detail), leaves, flowers, scale });
}

export const apamate = (options = {}) => araguaney({ ...options, bloom: 'pink' });
