import * as THREE from 'three';
import { palmTrunk, pinnateFrond, newParts, finishTree, paint, TAU, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import { rng } from '/engine/random.js';

// Cocotero: a curved ringed trunk, fronds with real leaflets, dry fronds
// hanging below, an upright new spear and a cluster of coconuts. `h` is the
// trunk height.
export function palm({ h = 8, seed = 1, detail = 'game', leaves = true, fruit = true, scale = h / 9.25 } = {}) {
  const r = rng(seed), s = scale, level = treeDetail(detail), lite = level !== 'full', low = level === 'low' || level === 'far', group = new THREE.Group(), parts = newParts();
  const trunk = palmTrunk(group, r, { height: (8.5 + r() * 1.5) * s, base: 0.24 * s, top: 0.16 * s, lean: 0.12 + r() * 0.08, bend: 0.12, rings: 2.6 / s, bark: 0x7d6a55, barkLight: 0xa8957a, flare: 0.6 });
  if (leaves) {
    const fronds = low ? 8 : lite ? 10 : 16;
    for (let i = 0; i < fronds; i++) {
      const a = i * 2.39996 + r() * 0.3, t = i / fronds, dry = i >= fronds - 3 ? 0.7 + r() * 0.3 : 0;
      pinnateFrond(parts, r, trunk.top, a, { length: (3.6 + r() * 0.8) * s * (dry ? 0.9 : 1), rise: dry ? -0.2 : 0.75 - t * 0.75, droop: dry ? 0.9 : 0.85 + t * 0.5, leaflets: 22, leafLen: 1.15 * s, color: i % 3 ? 0x4f8f2f : 0x5c9a34, dry, lite, low });
    }
    pinnateFrond(parts, r, trunk.top, r() * TAU, { length: 1.4 * s, rise: 1.3, droop: 0.5, leaflets: 10, leafLen: 0.55 * s, color: 0x8cbf4a, lite, low });
  }
  if (fruit) {
    const count = lite ? 5 : 9;
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU + r() * 0.4, out = 0.26 * s, y = -0.25 * s - (i % 3) * 0.09 * s, nut = new THREE.SphereGeometry(0.17 * s, 10, 8);
      nut.scale(1, 1.15, 1);
      const tint = new THREE.Color(i % 4 ? 0x6f9a2e : 0x8a6a2a), shade = tint.clone().multiplyScalar(0.6);
      paint(nut, (c, x, yy) => c.copy(shade).lerp(tint, 0.5 + yy * 2));
      nut.translate(trunk.top.x + Math.cos(a) * out, trunk.top.y + y, trunk.top.z + Math.sin(a) * out);
      parts.fruit.push(nut);
    }
  }
  return finishTree(group, parts, 'palm', { crownRadius: 3.5 * s, petals: null });
}
