import * as THREE from 'three';
import { growSkeleton, barkTubes, needleTuft, newParts, finishTree, paint, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import { rng, clamp } from '/engine/random.js';

// Pino caribe: a straight bole with whorls of branches that shorten toward
// the top, needle tufts and cones. `h` is the tree height.
export function pine({ seed = 1, h = 6, detail = 'game', leaves = true, fruit = true, scale = h / 14 } = {}) {
  const r = rng(seed), s = scale, level = treeDetail(detail), lite = level !== 'full', low = level === 'low' || level === 'far', height = (13 + r() * 2) * s;
  const skeleton = growSkeleton(r, {
    trunk: height, trunkR: 0.3 * s, trunkTaper: 0.12, trunkSegments: 18, trunkWobble: 0.02, trunkUp: 0.04, lean: 0.04, clear: 0.36,
    depth: 2, kids: [lite ? 16 : 26, lite ? 3 : 5], angle: [1.4, 0.75], lenRatio: [0.3, 0.42], radRatio: [0.22, 0.45],
    upturn: [0, 0.02, 0.05], wobble: 0.14, taper: 0.25, segments: [0, 7, 4], spawnFrom: [0, 0.25],
    lenAt: (t, depth) => depth === 0 ? 0.22 + Math.pow(1 - t, 1.1) * 0.8 : 1,
  });
  const group = new THREE.Group(), parts = newParts();
  barkTubes(group, skeleton.branches, { bark: 0x6d4a35, barkLight: 0x9a6a48, ridges: 10, ridgeTwist: 0.4, height, trunkSides: lite ? 8 : 12, trunkShape: (t, a) => 1 + Math.pow(1 - t, 16) * 0.6 * (0.6 + 0.4 * Math.cos(a * 5)) });
  if (leaves) {
    const o = { tints: [0x2f5f2c, 0x3a6d30, 0x2a5428], lite, low }, spots = skeleton.tips.map(t => ({ p: t.p, d: t.dir }));
    if (!low) for (const b of skeleton.branches) if (b.depth >= 1) for (let i = 2; i < b.pts.length; i += 2) spots.push({ p: b.pts[i], d: b.pts[i].clone().sub(b.pts[i - 1]).normalize() });
    for (const spot of spots) needleTuft(parts, r, spot.p, spot.d.clone().add(new THREE.Vector3(0, 0.6, 0)), (0.55 + r() * 0.2) * s, o);
    const trunk = skeleton.branches[0], top = trunk.pts[trunk.pts.length - 1];
    for (let i = 0; i < 3; i++) needleTuft(parts, r, top.clone().add(new THREE.Vector3(0, -i * 0.25 * s, 0)), new THREE.Vector3(0, 1, 0), 0.6 * s, o);
  }
  if (fruit) for (const tip of skeleton.tips.filter(() => r() < 0.12)) {
    const cone = new THREE.ConeGeometry(0.06 * s, 0.17 * s, 6);
    cone.rotateX(Math.PI); paint(cone, (c, x, y) => c.set(0x7a5232).multiplyScalar(0.7 + clamp(y * 3)));
    cone.translate(tip.p.x, tip.p.y - 0.12 * s, tip.p.z); parts.fruit.push(cone);
  }
  return finishTree(group, parts, 'pine', { crownRadius: 3 * s, petals: null });
}
