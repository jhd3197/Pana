import { growTree, ellipsoid, hangingFruit, treeDetail } from '/engine/models/vegetation/tree-kit.js';

// Mango: a dense, round, dark green crown on five strong limbs, with mangos
// hanging from green to red. `h` is the old trunk height (3.2 → a ~6 m tree).
const MANGO = {
  name: 'mangoTree',
  height: 7,
  skeleton: s => ({
    trunk: 2.6 * s, trunkR: 0.34 * s, trunkTaper: 0.6, clear: 0.68, minY: 0.08, lean: 0.12, depth: 3, kids: [5, 4, 3],
    angle: [0.8, 0.72, 0.7], lenRatio: [1.6, 0.58, 0.55], radRatio: [0.62, 0.58, 0.55], upturn: [0, 0.035, 0.02, 0],
    wobble: 0.22, taper: 0.4, envelope: ellipsoid(0, 5 * s, 0, 4.2 * s, 2.6 * s, 4.2 * s),
    trunkShape: (t, a) => 1 + Math.pow(1 - t, 7) * (0.45 + 0.8 * Math.max(0, Math.cos(a * 5)) ** 2),
  }),
  bark: { bark: 0x6b4f37, barkLight: 0x8a6c4f, ridges: 9 },
  foliage: { openCrown: true, kind: 'leaf', size: 1.05, tints: [0x2f6b2c, 0x3c7d33, 0x4c8c38], blades: 26, bladeLen: 0.6, bladeWidth: 0.22, flat: 0.62, along: 2, alongFrom: 2 },
  fruit: (parts, r, skeleton, s, lite) => hangingFruit(parts, r, skeleton, { count: lite ? 8 : 18, size: 0.11 * s, colors: [0x7aa63a, 0xf2b52c, 0xe0472b] }),
};

export function mangoTree({ seed = 1, h = 3.2, fruit = true, leaves = true, detail = 'game', scale = (h + 2) / 7.2 } = {}) {
  return growTree(MANGO, { seed, detail: treeDetail(detail), leaves, fruit, scale });
}
