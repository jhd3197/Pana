import * as THREE from 'three';
import { growSkeleton, barkTubes, blade, aim, paint, newParts, finishTree, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import { rng, clamp } from '/engine/random.js';

// Árbol seco: gnarled limbs on four levels, grey cracked bark and Spanish
// moss (barba de palo) hanging from them with `leaves`; bare by default, the
// cemetery, páramo, burnt-savanna tree. `height` is about the tree height.
export function deadTree({ seed = 1, height = 6, detail = 'game', leaves = false, scale = height / 6 } = {}) {
  const r = rng(seed), s = scale, level = treeDetail(detail), lite = level !== 'full', low = level === 'low' || level === 'far';
  const skeleton = growSkeleton(r, {
    trunk: 3.2 * s, trunkR: 0.32 * s, trunkTaper: 0.55, trunkWobble: 0.2, lean: 0.35, clear: 0.45, depth: lite ? 3 : 4, kids: [4, 3, 3, 2],
    angle: [0.8, 0.8, 0.75, 0.7], lenRatio: [1, 0.62, 0.6, 0.55], radRatio: [0.62, 0.6, 0.55, 0.5], upturn: [0, 0.01, 0.03, 0.04, 0.04],
    wobble: 0.6, taper: 0.35, angleJitter: 0.6,
  });
  const group = new THREE.Group(), parts = newParts();
  barkTubes(group, skeleton.branches, { bark: 0x7d7a72, barkLight: 0xa9a59a, barkDark: 0.5, ridges: 13, ridgeTwist: 1.8, height: 8 * s, minRadius: 0.008,
    trunkShape: (t, a) => 1 + Math.pow(1 - t, 8) * (0.4 + 0.7 * Math.max(0, Math.cos(a * 3 + 2)) ** 2) + 0.07 * Math.sin(a * 5 + t * 9) });
  if (leaves) {
    const top = new THREE.Color(0xa7ae8a), tipColor = new THREE.Color(0x6f765c);
    for (const b of skeleton.branches) if (b.depth >= 1 && b.depth <= 3) for (let i = 1; i < b.pts.length; i += 2) if (r() < (lite ? 0.25 : 0.5)) {
      const len = (0.5 + r() * 1.1) * s, strand = blade(len, len * 0.06, len * 0.05, 3);
      paint(strand, (c, x) => c.copy(top).lerp(tipColor, clamp(x / len)));
      parts.leaves.push(aim(strand, new THREE.Vector3((r() - 0.5) * 0.2, -1, (r() - 0.5) * 0.2), b.pts[i]));
    }
  }
  return finishTree(group, parts, leaves ? 'leafyTree' : 'deadTree', { crownRadius: 3 * s, petals: null });
}
