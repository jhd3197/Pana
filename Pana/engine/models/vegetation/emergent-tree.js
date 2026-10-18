import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { finish } from '/engine/models/vegetation/plant-kit.js';
import { barkMat, limb, buttress, canopyBlob, hangingVine, bromeliadRosette } from '/engine/models/vegetation/faceted-kit.js';

const BARKS = [0x6b5340, 0x8a6c52, 0x7d7a5c];

// Rainforest emergent: a gently wandering trunk on plank buttresses, boughs
// angled up and out to flat faceted crowns, with lianas and epiphytes.
export function emergentTree({ seed = 1, scale = 1 } = {}) {
  const r = rng(seed), g = new THREE.Group(), s = scale;
  const h = (11 + r() * 10) * s, wood = barkMat(BARKS[(r() * 3) | 0]), roots = barkMat(0x5d4636), vine = barkMat(0x3b6b2a);
  let p = new THREE.Vector3(0, -0.4, 0), radius = 0.72 * s * (0.85 + r() * 0.4);
  const base = radius, dir = new THREE.Vector3((r() - 0.5) * 0.16, 1, (r() - 0.5) * 0.16).normalize();
  for (let i = 0; i < 5; i++) {
    const q = p.clone().addScaledVector(dir, h / 5);
    limb(g, p.toArray(), q.toArray(), radius, radius * 0.86, wood, 8);
    radius *= 0.86; p = q;
    dir.add(new THREE.Vector3((r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12)).normalize();
  }
  const fins = 3 + (r() * 3 | 0);
  for (let i = 0; i < fins; i++) buttress(g, i / fins * Math.PI * 2 + r(), base * 0.75, (1.8 + r() * 1.4) * s, (2.4 + r() * 1.8) * s, 0.26 * s, roots);
  if (r() < 0.4) g.add(mesh(new THREE.CylinderGeometry(base * 0.97, base * 0.97, h * 0.1, 6), M(0x4a6b34, { roughness: 1 }), 0, h * 0.12, 0));
  const top = p.toArray(), n = 3 + (r() * 3 | 0);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + r(), L = (3 + r() * 3.5) * s;
    const d = new THREE.Vector3(Math.cos(a), 0.45 + r() * 0.45, Math.sin(a)).normalize();
    const e = [top[0] + d.x * L, top[1] + d.y * L, top[2] + d.z * L];
    limb(g, top, e, radius * 0.7, radius * 0.4, wood, 6);
    canopyBlob(g, [e[0], e[1] + 0.6 * s, e[2]], (2.2 + r() * 1.6) * s, r, [0x3f8a35, 0x5fae3c, 0x2a6a2c, 0x8cc04a, 0x2f7a52]);
    if (r() < 0.55) hangingVine(g, [e[0] + r() - 0.5, e[1] - 0.5, e[2] + r() - 0.5], 3 + r() * 8 * s, r, vine, [0x5fae3c, 0x3f8a35]);
    if (r() < 0.4) bromeliadRosette(g, e, 0.6 * s, r);
  }
  canopyBlob(g, [top[0], top[1] + 1.2 * s, top[2]], (2.6 + r() * 1.5) * s, r, [0x3f8a35, 0x5fae3c, 0x2a6a2c]);
  return finish(g, 'emergentTree');
}
