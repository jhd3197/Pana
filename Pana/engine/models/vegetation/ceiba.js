import * as THREE from 'three';
import { growTree, paint, TAU, treeDetail } from '/engine/models/vegetation/tree-kit.js';

// Ceiba, the giant: plank buttresses, a pale spiny trunk, horizontal tiers of
// limbs and a flat crown. `fruit` turns on the trunk spines. The default
// scale keeps the old ~11 m footprint; scale 1 is the full 16 m ceiba.
const CEIBA = {
  name: 'ceiba',
  height: 16,
  skeleton: s => ({
    trunk: 10.5 * s, trunkR: 0.78 * s, trunkTaper: 0.5, clear: 0.7, lean: 0.06, trunkWobble: 0.03, trunkSegments: 26,
    depth: 3, kids: [7, 3, 3], angle: [1.32, 0.62, 0.6], lenRatio: [0.62, 0.55, 0.52], radRatio: [0.42, 0.55, 0.55],
    upturn: [0, 0.018, 0.03, 0.03], wobble: 0.16, taper: 0.35, minY: -0.05, maxY: 0.42, segments: [0, 9, 6, 5],
    envelope: p => Math.max((p.x * p.x + p.z * p.z) / (7.5 * s) ** 2, (p.y - 13.4 * s) / (3.4 * s)),
    trunkShape: (t, a) => 1 + Math.max(0, 1 - t / 0.2) ** 2.2 * (0.35 + 3.4 * Math.max(0, Math.cos(a * 5 + 0.4)) ** 10) + Math.sin(t * Math.PI) * 0.08,
  }),
  bark: { bark: 0x8e8a72, barkLight: 0xb3ab8c, barkDark: 0.7, ridges: 5, ridgeTwist: 0.2 },
  foliage: { openCrown: true, kind: 'leaf', size: 1.3, tints: [0x5b9841, 0x6ca947, 0x4b8a3b], blades: 16, bladeLen: 0.66, bladeWidth: 0.24, flat: 0.48, lift: 0.25, keep: 0.9, along: 3, alongFrom: 2 },
  fruit: (parts, r, skeleton, s, lite) => {
    const trunk = skeleton.branches[0];
    for (let i = 0; i < (lite ? 20 : 60); i++) {
      const k = 1 + ((r() * (trunk.pts.length * 0.55)) | 0), p = trunk.pts[k], a = r() * TAU, rad = trunk.rads[k] * 0.98;
      const spine = new THREE.ConeGeometry(0.035 * s, 0.13 * s, 4);
      spine.rotateZ(-Math.PI / 2); spine.rotateY(-a); paint(spine, c => c.set(0x7c7660));
      spine.translate(p.x + Math.cos(a) * rad, p.y, p.z + Math.sin(a) * rad);
      parts.fruit.push(spine);
    }
  },
};

export function ceiba({ seed = 1, detail = 'game', leaves = true, fruit = true, scale = 0.7 } = {}) {
  return growTree(CEIBA, { seed, detail: treeDetail(detail), leaves, fruit, scale });
}
