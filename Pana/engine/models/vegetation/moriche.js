import * as THREE from 'three';
import { palmTrunk, fanFrond, newParts, finishTree, paint, TAU, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import { rng } from '/engine/random.js';
import { dimension } from '/engine/models/core/rural-kit.js';

// Moriche, the llano palm: a straight scarred trunk, pleated fan leaves, a
// skirt of dry leaves and bunches of red-brown fruit. `h` is the trunk height.
export function moriche({ seed = 7, h = 10, detail = 'game', leaves = true, fruit = true } = {}) {
  dimension(h, 4, 16, 'h');
  const r = rng(seed), s = h / 11, level = treeDetail(detail), lite = level !== 'full', low = level === 'low' || level === 'far', group = new THREE.Group(), parts = newParts();
  const trunk = palmTrunk(group, r, { height: (10 + r() * 2) * s, base: 0.36 * s, top: 0.3 * s, lean: 0.02, bend: 0.01, rings: 3.2 / s, bark: 0x6c665a, barkLight: 0x9a9384, scar: 0.45, sides: 12, flare: 0.35 });
  if (leaves) {
    const fans = low ? 7 : lite ? 9 : 15;
    for (let i = 0; i < fans; i++) {
      const y = 1 - (i + 0.5) / fans * 1.2, a = i * 2.39996 + r() * 0.3, ring = Math.sqrt(Math.max(0, 1 - y * y));
      const dir = new THREE.Vector3(Math.cos(a) * ring, y * 0.9 + 0.25, Math.sin(a) * ring).normalize();
      fanFrond(parts, r, trunk.top, dir, { petiole: (1.8 + r() * 0.6) * s, radius: 1.75 * s, segments: 22, color: i % 2 ? 0x4b8a32 : 0x569638, lite, low });
    }
    const skirt = low ? 4 : lite ? 5 : 9;
    for (let i = 0; i < skirt; i++) {
      const a = i / skirt * TAU + r() * 0.5, dir = new THREE.Vector3(Math.cos(a) * 0.35, -1, Math.sin(a) * 0.35).normalize();
      fanFrond(parts, r, trunk.top.clone().add(new THREE.Vector3(0, -0.2 * s, 0)), dir, { petiole: 0.6 * s, radius: 1.4 * s, segments: 14, color: 0x8b6a3c, dry: 1, hang: 0.9, lite, low });
    }
  }
  if (fruit) {
    const bunches = lite ? 2 : 4;
    for (let i = 0; i < bunches; i++) {
      const a = i / bunches * TAU + r(), at = trunk.top.clone().add(new THREE.Vector3(Math.cos(a) * 0.4 * s, -0.4 * s, Math.sin(a) * 0.4 * s)), n = lite ? 14 : 34;
      for (let k = 0; k < n; k++) {
        const t = k / n, ball = new THREE.SphereGeometry(0.075 * s, 7, 5), tint = new THREE.Color(k % 3 ? 0x8a3b22 : 0xa5562c);
        paint(ball, (c, x, y) => c.copy(tint).multiplyScalar(0.7 + y * 3 / s));
        ball.translate(at.x + Math.cos(a) * t * 0.5 * s + (r() - 0.5) * 0.3 * s, at.y - t * 1.3 * s, at.z + Math.sin(a) * t * 0.5 * s + (r() - 0.5) * 0.3 * s);
        parts.fruit.push(ball);
      }
    }
  }
  return finishTree(group, parts, 'MorichePalm', { crownRadius: 3.8 * s, petals: null });
}
