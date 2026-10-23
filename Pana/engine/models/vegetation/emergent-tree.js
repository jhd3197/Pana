import * as THREE from 'three';
import { growTree, ellipsoid, buttress, spiralVine, liana, bromeliad, hangingVine, branchPoints, treeDetail } from '/engine/models/vegetation/tree-kit.js';

// Gigante de la selva: the emergent that rises above everything. Huge plank
// buttresses, a pale bole, a high crown, lianas spiralling up the trunk and
// slung between limbs, bromeliads on the branches.
const GIGANTE = {
  name: 'emergentTree',
  height: 24,
  skeleton: s => ({
    trunk: 17 * s, trunkR: 0.85 * s, trunkTaper: 0.45, clear: 0.8, lean: 0.05, trunkWobble: 0.03, trunkSegments: 32,
    depth: 3, kids: [7, 4, 3], angle: [1.05, 0.65, 0.6], lenRatio: [0.46, 0.55, 0.55], radRatio: [0.45, 0.55, 0.55],
    upturn: [0, 0.04, 0.03, 0.02], wobble: 0.2, taper: 0.35, maxY: 0.75, minY: -0.1, segments: [0, 9, 6, 5],
    envelope: ellipsoid(0, 20.5 * s, 0, 8.5 * s, 3.4 * s, 8.5 * s, 6 * s),
    trunkShape: buttress({ height: 0.15, count: 5, amp: 4.2, sharp: 12 }),
  }),
  bark: { bark: 0x9a9480, barkLight: 0xc0baa3, barkDark: 0.72, ridges: 4, mossBand: 2.5 },
  foliage: { openCrown: true, kind: 'leaf', size: 1.4, tints: [0x356f33, 0x427d39, 0x4f8a3e], blades: 24, bladeLen: 0.5, bladeWidth: 0.32, flat: 0.5, along: 2, alongFrom: 2, keep: 0.85 },
  extra: (group, parts, r, skeleton, s, o) => {
    const trunk = skeleton.branches[0];
    for (let i = 0; i < (o.lite ? 2 : 3); i++) spiralVine(group, r, trunk, { from: 0.06, to: 0.78 + r() * 0.15, turns: 1.2 + r() * 1.6, radius: (0.035 + r() * 0.02) * s, pad: 1 });
    for (const spot of branchPoints(skeleton, r, 2)) {
      const foot = new THREE.Vector3(spot.p.x * 0.35 + (r() - 0.5) * 2, -0.02, spot.p.z * 0.35 + (r() - 0.5) * 2);
      liana(group, r, spot.p, foot, { sag: 0.3, radius: 0.035 * s, wiggle: 0.25, swing: (1.5 + r() * 1.5) * s, n: 24 });
    }
    for (let i = 0; i < (o.lite ? 2 : 4); i++) {
      const [a, b] = branchPoints(skeleton, r, 2);
      if (b && a.branch !== b.branch) liana(group, r, a.p, b.p, { sag: (2 + r() * 3) * s, radius: 0.03 * s, wiggle: 0.1 });
    }
    if (!o.leaves) return;
    for (const spot of branchPoints(skeleton, r, o.lite ? 4 : 9)) bromeliad(parts, r, spot.p.clone().add(new THREE.Vector3(0, spot.rad, 0)), 0.55 * s);
    for (const spot of branchPoints(skeleton, r, o.lite ? 4 : 10, 2)) hangingVine(parts, r, spot.p, (3 + r() * 6) * s, { s, lite: o.lite });
  },
};

export function emergentTree({ seed = 1, scale = 1, detail = 'game', leaves = true } = {}) {
  return growTree(GIGANTE, { seed, detail: treeDetail(detail), leaves, scale });
}
