import * as THREE from 'three';
import { growTree, ellipsoid, paint, tube, addMesh, barkMat, TAU, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import { lerp } from '/engine/random.js';

// Mangle: stands on stilt roots arching down into the water, with aerial
// roots dropping from the limbs, a glossy crown and hanging propagules.
const MANGLE = {
  name: 'mangrove',
  height: 6.5,
  skeleton: s => ({
    trunk: 3 * s, trunkR: 0.2 * s, trunkTaper: 0.6, clear: 0.55, minY: 0.05, lean: 0.15, depth: 3, kids: [5, 3, 3],
    angle: [0.95, 0.75, 0.7], lenRatio: [1, 0.6, 0.55], radRatio: [0.6, 0.6, 0.55], upturn: [0, 0.035, 0.02, 0],
    wobble: 0.3, taper: 0.4, envelope: ellipsoid(0, 4.4 * s, 0, 3.6 * s, 1.9 * s, 3.6 * s),
  }),
  bark: { bark: 0x5a4636, barkLight: 0x7d6650, ridges: 6 },
  foliage: { kind: 'leaf', size: 0.95, tints: [0x2d6234, 0x37703a, 0x2a5a30], blades: 26, bladeLen: 0.42, bladeWidth: 0.36, flat: 0.55, along: 2, alongFrom: 2 },
  fruit: (parts, r, skeleton, s, lite) => {
    for (const tip of skeleton.tips) if (r() < (lite ? 0.2 : 0.45)) {
      const len = (0.3 + r() * 0.25) * s, pod = new THREE.CylinderGeometry(0.012 * s, 0.02 * s, len, 5);
      paint(pod, (c, x, y) => c.set(y > 0 ? 0x6f8a3a : 0x5a4a2a));
      pod.translate(tip.p.x, tip.p.y - len / 2 - 0.15 * s, tip.p.z); parts.fruit.push(pod);
    }
  },
  extra: (group, parts, r, skeleton, s, o) => {
    const light = new THREE.Color(0x6b5440), dark = new THREE.Color(0x3d3326);
    const colorAt = (c, t, a, p) => c.copy(dark).lerp(light, Math.min(1, p.y * 0.8 + 0.2) * (0.8 + 0.2 * Math.sin(a * 3)));
    const trunk = skeleton.branches[0], stilts = o.lite ? 7 : 12;
    for (let i = 0; i < stilts; i++) {
      const height = (0.6 + r() * 1.3) * s, a = i / stilts * TAU + r() * 0.4, reach = (1 + r() * 1.3) * s;
      const k = Math.max(1, Math.round(height / trunk.pts[trunk.pts.length - 1].y * (trunk.pts.length - 1))), from = trunk.pts[Math.min(k, trunk.pts.length - 1)];
      const foot = new THREE.Vector3(from.x + Math.cos(a) * reach, 0.04 * s, from.z + Math.sin(a) * reach);
      const knee = new THREE.Vector3(lerp(from.x, foot.x, 0.55), from.y + 0.35 * s, lerp(from.z, foot.z, 0.55));
      const pts = new THREE.QuadraticBezierCurve3(from, knee, foot).getPoints(10);
      addMesh(group, tube(pts, pts.map((p, j) => lerp(0.07, 0.045, j / 10) * s), 6, colorAt, t => 1 + Math.pow(t, 10) * 0.5), barkMat, 'bark');
    }
    for (const b of skeleton.branches) if (b.depth === 1 && r() < 0.8) {
      const from = b.pts[Math.floor(b.pts.length * 0.6)], pts = [];
      for (let j = 0; j <= 6; j++) pts.push(new THREE.Vector3(from.x + Math.sin(j) * 0.04, lerp(from.y, -0.02, j / 6), from.z + Math.cos(j) * 0.04));
      addMesh(group, tube(pts, pts.map(() => 0.025 * s), 4, colorAt), barkMat, 'bark');
    }
  },
};

export function mangrove({ seed = 1, detail = 'game', leaves = true, fruit = true, scale = 0.85 } = {}) {
  return growTree(MANGLE, { seed, detail: treeDetail(detail), leaves, fruit, scale });
}
