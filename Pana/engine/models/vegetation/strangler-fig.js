import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { finish } from '/engine/models/vegetation/plant-kit.js';
import { barkMat, bough, facet } from '/engine/models/vegetation/faceted-kit.js';

// Strangler fig swallowing ruins: four trunks braid as they climb and lean, boughs
// arch out to drooping clumps, and aerial roots drape over a small stone shrine
// (or bare ground) to one side. The tree stands at the origin; the shrine at
// (-5·scale, 0, 7·scale).
export function stranglerFig({ seed = 1, scale = 1, shrine = true } = {}) {
  const r = rng(seed), g = new THREE.Group(), s = scale, bark = barkMat(0x5c4a3a);
  const crown = [-3 * s, 19.5 * s, 2 * s];
  for (let k = 0; k < 4; k++) {
    const a = k * 1.6 + r(), c = Math.cos(a), n = Math.sin(a);
    bough(g, [[c * 0.6 * s, -0.2, n * 0.6 * s], [c * 0.4 * s, 6 * s, n * 0.4 * s], [-1.5 * s + c * 0.25 * s, 13 * s, s + n * 0.25 * s], crown],
      (0.9 - k * 0.12) * s, (0.5 - k * 0.06) * s, bark, 18, 7);
  }
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + r() * 0.8, c = Math.cos(a), n = Math.sin(a);
    bough(g, [crown, [crown[0] + c * 5 * s, (23 + r() * 3) * s, crown[2] + n * 5 * s], [crown[0] + c * 9 * s, (21 + r() * 4) * s, crown[2] + n * 9 * s]],
      0.38 * s, 0.14 * s, bark, 10, 6);
    for (let i = 0; i < 4; i++) {
      const d = (6.5 + r() * 4.5) * s, w = (2.2 + r()) * s;
      facet(g, [crown[0] + c * d, (21.5 + r() * 4) * s, crown[2] + n * d], [w, 1.3 * s, w], [r(), r() * 3, r()], i % 2 ? 0x4c8c34 : 0x2f6629, k * 9 + i);
    }
  }
  facet(g, [crown[0], crown[1] + 3.5 * s, crown[2]], [3.2 * s, 1.6 * s, 3.2 * s], [0, r() * 3, 0], 0x4c8c34, 77);
  const sx = -5 * s, sz = 7 * s;
  for (let k = 0; k < 9; k++) {
    const a = -2.2 + r() * 2.2 + (k % 2 ? Math.PI : 0), c = Math.cos(a), n = Math.sin(a), sy = shrine ? 1 : 0;
    bough(g, [[0, (3 + r() * 2) * s, 0], [sx * 0.6, (8 + r() * 2) * s, sz * 0.6], [sx + c * 1.5 * s, (6.5 * s) * sy + 2.5 * s, sz + n * 1.5 * s],
      [sx + c * 3.4 * s, 3 * s * (0.5 + sy * 0.5), sz + n * 3.4 * s], [sx + c * (5 + r() * 2) * s, -0.2, sz + n * (5 + r() * 2) * s]],
      (0.16 + r() * 0.14) * s, 0.08 * s, bark, 18, 5);
  }
  if (shrine) {
    const stone = M(0xa29c84, { roughness: 0.95 }), dark = M(0x8f8c77, { roughness: 0.95 }), moss = M(0x6a8e36, { roughness: 1 });
    const add = (geo, mat, x, y, z) => { const m = mesh(geo, mat, sx + x * s, y * s, sz + z * s); m.scale.setScalar(s); g.add(m); return m; };
    add(new THREE.BoxGeometry(4.4, 0.8, 4.4), dark, 0, 0.4, 0);
    add(new THREE.BoxGeometry(3.2, 3.4, 3.2), stone, 0, 2.5, 0);
    add(new THREE.BoxGeometry(1.2, 2.2, 0.2), M(0x181410), 0, 1.9, 1.62);
    add(new THREE.BoxGeometry(3.6, 0.5, 3.6), dark, 0, 4.4, 0);
    add(new THREE.BoxGeometry(2.6, 1.2, 2.6), stone, 0, 5.2, 0);
    add(new THREE.BoxGeometry(1.8, 0.9, 1.8), dark, 0, 6.2, 0);
    add(new THREE.ConeGeometry(0.7, 1.4, 4), stone, 0, 7.35, 0).rotation.y = Math.PI / 4;
    add(new THREE.BoxGeometry(3.3, 0.18, 2.2), moss, 0.2, 4.72, -0.5);
    for (let i = 0; i < 4; i++) {
      const block = add(new THREE.BoxGeometry(0.9 + r() * 0.6, 0.5 + r() * 0.4, 0.8 + r() * 0.5), stone, 2.4 + r() * 1.5, 0.3, (r() - 0.5) * 4);
      block.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
    }
  }
  return finish(g, 'stranglerFig');
}
