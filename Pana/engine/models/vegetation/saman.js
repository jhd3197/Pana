import * as THREE from 'three';
import { growTree, ellipsoid, paint, treeDetail } from '/engine/models/vegetation/tree-kit.js';

// Samán: a short, thick trunk, huge near-horizontal limbs and a very wide,
// flat umbrella crown dotted with pink powder-puff flowers.
const SAMAN = {
  name: 'saman',
  height: 9,
  skeleton: s => ({
    trunk: 2 * s, trunkR: 0.62 * s, trunkTaper: 0.68, clear: 0.62, lean: 0.1, depth: 3, kids: [5, 4, 3],
    angle: [1.05, 0.7, 0.62], lenRatio: [3.6, 0.5, 0.5], minY: 0.05, radRatio: [0.6, 0.55, 0.55],
    upturn: [0, 0.03, 0.035, 0.02], wobble: 0.18, taper: 0.35, segments: [0, 9, 6, 5],
    envelope: ellipsoid(0, 5.8 * s, 0, 9.2 * s, 2.6 * s, 9.2 * s),
    trunkShape: (t, a) => 1 + Math.pow(1 - t, 6) * (0.5 + 0.9 * Math.max(0, Math.cos(a * 4 + 1)) ** 3),
  }),
  bark: { bark: 0x5e4a38, barkLight: 0x86735e, ridges: 11, mossBand: 1.2 },
  foliage: { openCrown: true, kind: 'leaf', size: 1.15, tints: [0x3f7f34, 0x4f9139, 0x5d9c3f], blades: 28, bladeLen: 0.42, bladeWidth: 0.2, flat: 0.42, lift: 0.3, along: 2, alongFrom: 2 },
  extra: (group, parts, r, skeleton, s, o) => {
    if (!o.leaves || !o.flowers) return;
    for (const tip of skeleton.tips) if (r() < 0.6) {
      const puff = new THREE.IcosahedronGeometry(0.2 * s, 1);
      paint(puff, (c, x, y) => c.set(y > 0 ? 0xffa8d4 : 0xe866a6));
      puff.translate(tip.p.x + (r() - 0.5) * 0.8, tip.p.y + 0.5 * s, tip.p.z + (r() - 0.5) * 0.8);
      parts.leaves.push(puff);
    }
  },
};

export function saman({ seed = 1, detail = 'game', leaves = true, flowers = true, scale = 1 } = {}) {
  return growTree(SAMAN, { seed, detail: treeDetail(detail), leaves, flowers, scale });
}
