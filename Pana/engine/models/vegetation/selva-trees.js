import * as THREE from 'three';
import { growTree, growSkeleton, barkTubes, dressCrown, umbrellaLeaf, ellipsoid, tube, paint, newParts, finishTree, TAU, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import { rng, clamp } from '/engine/random.js';

// Yagrumo: a pale ringed trunk, candelabra branches and parasols of huge
// palmate leaves, green on top and silver underneath.
export function yagrumo({ seed = 1, detail = 'game', leaves = true, fruit = true, scale = 1 } = {}) {
  const r = rng(seed), s = scale, level = treeDetail(detail), lite = level !== 'full', low = level === 'low' || level === 'far';
  const skeleton = growSkeleton(r, {
    trunk: (8 + r() * 2) * s, trunkR: 0.19 * s, trunkTaper: 0.6, trunkSegments: 16, trunkWobble: 0.03, lean: 0.14, clear: 0.62,
    depth: 2, kids: [4, 2], angle: [0.8, 0.5], lenRatio: [0.42, 0.5], radRatio: [0.62, 0.7], upturn: [0, 0.1, 0.09],
    wobble: 0.1, taper: 0.62, segments: [0, 8, 5], minY: -0.25,
  });
  const group = new THREE.Group(), parts = newParts();
  barkTubes(group, skeleton.branches, { bark: 0xa8a391, barkLight: 0xccc6b2, barkDark: 0.78, ridges: 3, ridgeTwist: 0, height: 10 * s, trunkSides: lite ? 8 : 12, trunkShape: (t, a) => 1 + Math.pow(1 - t, 12) * 0.7 * (0.6 + 0.4 * Math.cos(a * 4)) });
  const trunk = skeleton.branches[0], crowns = skeleton.tips.map(t => ({ p: t.p, d: t.dir }));
  crowns.push({ p: trunk.pts[trunk.pts.length - 1], d: new THREE.Vector3(0, 1, 0) });
  if (leaves) for (const crown of crowns) for (let i = 0, n = low ? 3 : lite ? 4 : 7; i < n; i++) {
    const a = i / n * TAU + r() * 0.4, dir = new THREE.Vector3(Math.cos(a), 0.35 - r() * 0.5, Math.sin(a)).normalize(), len = (0.6 + r() * 0.4) * s;
    const end = crown.p.clone().addScaledVector(dir, len);
    parts.leaves.push(tube([crown.p, crown.p.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.08 * s, 0)), end], [0.02 * s, 0.017 * s, 0.014 * s], 3, c => c.set(0x8a8a52)));
    umbrellaLeaf(parts, r, end, new THREE.Vector3(dir.x * 0.5, 1, dir.z * 0.5), (0.62 + r() * 0.2) * s, lite);
  }
  if (fruit) for (const crown of crowns) for (let i = 0; i < 4; i++) {
    const len = (0.3 + r() * 0.2) * s, spike = new THREE.CylinderGeometry(0.018 * s, 0.012 * s, len, 5), a = r() * TAU;
    paint(spike, (c, x, y) => c.set(0x8c8a48).multiplyScalar(0.8 + y / len * 0.4));
    spike.translate(crown.p.x + Math.cos(a) * 0.12 * s, crown.p.y - len / 2 - 0.05, crown.p.z + Math.sin(a) * 0.12 * s); parts.fruit.push(spike);
  }
  return finishTree(group, parts, 'yagrumo', { crownRadius: 3.2 * s, petals: null });
}

// Cacao: a small shade tree. The trunk opens into a whorl of branches, long
// leaves hang down (some new and reddish) and pods grow straight from the
// trunk and the main limbs.
const POD_COLORS = [0xe8c13a, 0xd9792a, 0xb8332a, 0x7a2e4a, 0x8aa23a];
const CACAO = {
  name: 'cacao',
  height: 5,
  skeleton: s => ({
    trunk: 1.7 * s, trunkR: 0.13 * s, trunkTaper: 0.75, clear: 0.94, lean: 0.12, depth: 3, kids: [5, 3, 2],
    angle: [0.95, 0.75, 0.7], lenRatio: [1.6, 0.6, 0.55], radRatio: [0.72, 0.6, 0.55], upturn: [0, 0, 0.02, 0], minY: -0.25,
    wobble: 0.22, taper: 0.4, envelope: ellipsoid(0, 3.4 * s, 0, 3.3 * s, 1.8 * s, 3.3 * s, 2.5 * s),
  }),
  bark: { bark: 0x6e5a48, barkLight: 0x8e7a63, ridges: 5, mossBand: 0.8 },
  foliage: { openCrown: true, kind: 'leaf', size: 0.75, tints: [0x2f5f2a, 0x3b6d30, 0x2a5426], blades: 20, bladeLen: 0.62, bladeWidth: 0.24, bladeBend: 0.6, flat: 0.5, lift: -0.1, along: 2, alongFrom: 1 },
  fruit: (parts, r, skeleton, s, lite) => {
    const spots = [];
    for (const b of skeleton.branches) if (b.depth <= 1) for (let i = 1; i < b.pts.length - 1; i++) if (b.pts[i].y > 0.35) spots.push({ p: b.pts[i], rad: b.rads[i] });
    for (let i = 0, n = Math.min(spots.length, lite ? 7 : 16); i < n; i++) {
      const spot = spots.splice((r() * spots.length) | 0, 1)[0], a = r() * TAU, tint = new THREE.Color(POD_COLORS[(r() * POD_COLORS.length) | 0]);
      const pod = new THREE.SphereGeometry(0.075 * s, 12, 8);
      pod.scale(1, 2.2, 1);
      paint(pod, (c, x, y, z) => { const groove = Math.pow(0.5 + 0.5 * Math.cos(Math.atan2(z, x) * 10), 2); c.copy(tint).multiplyScalar(0.7 + 0.3 * groove + clamp(y * 2 / s) * 0.15); });
      pod.rotateZ((r() - 0.5) * 0.6);
      pod.translate(spot.p.x + Math.cos(a) * (spot.rad + 0.08 * s), spot.p.y - 0.12 * s, spot.p.z + Math.sin(a) * (spot.rad + 0.08 * s));
      parts.fruit.push(pod);
    }
  },
  extra: (group, parts, r, skeleton, s, o) => {   // a flush of young reddish leaves
    if (o.leaves) dressCrown(parts, r, skeleton, { openCrown: true, kind: 'leaf', size: 0.5 * s, tints: [0x9a4632, 0xb2603e, 0x8a5a3a], blades: 12, bladeLen: 0.6, bladeWidth: 0.24, bladeBend: 0.8, flat: 0.5, lift: -0.2, keep: 0.25, lite: o.lite, low: o.low, far: o.far, offset: 0.4 });
  },
};

export function cacao({ seed = 1, detail = 'game', leaves = true, fruit = true, scale = 1 } = {}) {
  return growTree(CACAO, { seed, detail: treeDetail(detail), leaves, fruit, scale });
}
