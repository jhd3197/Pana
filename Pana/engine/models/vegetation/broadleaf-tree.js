import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { finish } from '/engine/models/vegetation/plant-kit.js';
import { barkMat, limb, bough, canopyBlob, hangingVine } from '/engine/models/vegetation/faceted-kit.js';

const CROWNS = [
  [0x3f8f3a, 0x67b443, 0x2a6a30],
  [0x2a6a30, 0x3f8f3a, 0x2f8a6a],
  [0x67b443, 0x9bc64a, 0x3f8f3a],
  [0x2f8a6a, 0x3f8f3a, 0x2a6a30],
];

// One rainforest broadleaf, four silhouettes:
// 0 spreading boughs, 1 stacked pagoda tiers, 2 short lollipop, 3 tall emergent.
export function broadleafTree({ seed = 1, variant = 0 } = {}) {
  const r = rng(seed), g = new THREE.Group(), v = Math.max(0, Math.min(3, variant | 0)), tints = CROWNS[v];
  const bark = barkMat(0x6b5240), barkL = barkMat(0x8d7158), vine = barkMat(0x3a6e2c);
  const h = [10, 14, 8, 17][v] + r() * 3, r0 = [0.7, 0.75, 0.62, 0.9][v];
  let p = new THREE.Vector3(0, -0.4, 0), radius = r0;
  const dir = new THREE.Vector3((r() - 0.5) * 0.15, 1, (r() - 0.5) * 0.15).normalize();
  for (let i = 0; i < 5; i++) {
    const q = p.clone().addScaledVector(dir, h / 5);
    limb(g, p.toArray(), q.toArray(), radius, radius * 0.86, i < 2 ? bark : barkL, 8);
    radius *= 0.85; p = q;
    dir.add(new THREE.Vector3((r() - 0.5) * 0.15, 0, (r() - 0.5) * 0.15)).normalize();
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + r(), c = Math.cos(a), s = Math.sin(a);
    bough(g, [[0, 0.8, 0], [c, 0.3, s], [c * 2.2, -0.25, s * 2.2]], r0 * 0.4, r0 * 0.12, bark, 8, 5);
  }
  const top = p.toArray();
  if (v === 1) {
    for (let k = 0; k < 3; k++) canopyBlob(g, [(r() - 0.5) * 1.5, h * (0.45 + k * 0.17), (r() - 0.5) * 1.5], 3.4 - k * 0.6, r, tints);
    canopyBlob(g, [top[0], top[1] + 1, top[2]], 2.4, r, tints);
  } else if (v === 2) {
    canopyBlob(g, [top[0], top[1] + 0.8, top[2]], 3.8, r, tints);
    canopyBlob(g, [top[0] + 1.5, top[1] - 0.5, top[2] + 1], 2.6, r, tints);
  } else {
    const n = 3 + (r() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r(), L = 4 + r() * 3.5;
      const e = [top[0] + Math.cos(a) * L * 0.8, top[1] + L * 0.5, top[2] + Math.sin(a) * L * 0.8];
      limb(g, top, e, radius * 0.75, radius * 0.35, barkL, 6);
      canopyBlob(g, [e[0], e[1] + 0.6, e[2]], 2.2 + r() * 1.2, r, tints);
      if (r() < 0.6) hangingVine(g, [e[0] + r() - 0.5, e[1] - 0.5, e[2] + r() - 0.5], 3 + r() * 6, r, vine);
    }
    canopyBlob(g, [top[0], top[1] + 1.4, top[2]], 2.8, r, tints);
  }
  return finish(g, 'broadleafTree');
}
