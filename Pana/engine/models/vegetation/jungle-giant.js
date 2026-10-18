import * as THREE from 'three';
import { growTree, ellipsoid, figs, tube, addMesh, barkMat, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import { lerp } from '/engine/random.js';

// Caucho de raíces: long horizontal limbs drop aerial roots that reach the
// ground and thicken into new trunks, so one tree becomes a small grove.
// The selva's big canopy tree (factory name kept for every map using it).
const CAUCHO = {
  name: 'jungleGiant',
  height: 11,
  skeleton: s => ({
    trunk: 4.4 * s, trunkR: 0.62 * s, trunkTaper: 0.7, clear: 0.7, lean: 0.05, depth: 3, kids: [7, 4, 3],
    angle: [1.25, 0.7, 0.65], lenRatio: [1.8, 0.5, 0.5], radRatio: [0.5, 0.55, 0.55], upturn: [0, 0.012, 0.03, 0.02],
    minY: -0.02, maxY: 0.35, wobble: 0.16, taper: 0.4, segments: [0, 12, 6, 5],
    envelope: ellipsoid(0, 7.8 * s, 0, 9.5 * s, 3 * s, 9.5 * s, 7 * s),
    trunkShape: (t, a) => 1 + 0.2 * Math.max(0, Math.cos(a * 4 + t * 6)) ** 2 + Math.pow(1 - t, 8) * 0.9,
  }),
  bark: { bark: 0x77705f, barkLight: 0x9a9380, ridges: 8, ridgeTwist: 2.5 },
  foliage: { kind: 'leaf', size: 1.1, tints: [0x2a5c2e, 0x336a34, 0x3b7238], blades: 24, bladeLen: 0.42, bladeWidth: 0.42, flat: 0.55, along: 2, alongFrom: 2 },
  fruit: (parts, r, skeleton, s) => figs(parts, r, skeleton, s, { chance: 0.3, color: 0xb8432c }),
  extra: (group, parts, r, skeleton, s) => {
    const dark = new THREE.Color(0x857d6b), light = new THREE.Color(0x9f9884);
    const colorAt = (c, t, a) => c.copy(dark).lerp(light, 0.5 + 0.5 * Math.sin(a * 3 + t * 8));
    for (const b of skeleton.branches) if (b.depth === 1) for (let i = 3; i < b.pts.length; i += 2) {
      const from = b.pts[i], along = i / b.pts.length;
      if (r() < 0.42) {   // a prop root that reached the ground: a new trunk
        const rad = lerp(0.16, 0.06, along) * s * (0.7 + r() * 0.6), pts = [];
        for (let j = 0; j <= 10; j++) { const t = j / 10; pts.push(new THREE.Vector3(from.x + Math.sin(t * 6 + i) * 0.04, lerp(from.y, rad * 0.6, t), from.z + Math.cos(t * 5 + i) * 0.04)); }
        addMesh(group, tube(pts, pts.map(() => rad), 7, colorAt, t => 1 + Math.pow(t, 8) * 1.1 + 0.08 * Math.sin(t * 20)), barkMat, 'bark');
      } else if (r() < 0.5) {   // a thin root still on its way down
        const len = (0.8 + r() * 2.2) * s, pts = [];
        for (let j = 0; j <= 6; j++) pts.push(new THREE.Vector3(from.x, from.y - len * j / 6, from.z));
        addMesh(group, tube(pts, pts.map(() => 0.015 * s), 3, colorAt), barkMat, 'bark');
      }
    }
  },
};

export function jungleGiant({ seed = 1, scale = 1, detail = 'game', leaves = true, fruit = true } = {}) {
  return growTree(CAUCHO, { seed, detail: treeDetail(detail), leaves, fruit, scale });
}
