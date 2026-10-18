import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { finish } from '/engine/models/vegetation/plant-kit.js';
import { barkMat, limb, bough, buttress, canopyBlob, hangingVine, bromeliadRosette } from '/engine/models/vegetation/faceted-kit.js';

// Landmark ceiba: an umbrella crown on curved limbs over a buttressed trunk.
// With `arch`, four roots vault across +X so a trail can pass beneath them,
// landing about 15·scale metres away. The +X buttresses are left out for that path.
export function ceibaGateway({ seed = 1, scale = 1, arch = true } = {}) {
  const r = rng(seed), g = new THREE.Group(), s = scale;
  const trunk = barkMat(0x8d7158), root = barkMat(0x6b5240), vine = barkMat(0x3a6e2c);
  let p = new THREE.Vector3(0, -0.8, 0), radius = 2.1 * s;
  for (let i = 0; i < 6; i++) {
    const q = p.clone().add(new THREE.Vector3((r() - 0.5) * 0.4 * s, 3.4 * s, (r() - 0.5) * 0.4 * s));
    limb(g, p.toArray(), q.toArray(), radius, radius * 0.88, trunk, 10);
    radius *= 0.88; p = q;
  }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + r() * 0.3;
    if (arch && Math.cos(a) > 0.55) continue;
    buttress(g, a, 1.7 * s, (3 + r() * 2.5) * s, (4 + r() * 3) * s, 0.5 * s, root);
  }
  for (let i = 0; i < 6; i++) {
    const a = (arch ? Math.PI * 0.35 + r() * Math.PI * 1.3 : r() * Math.PI * 2), L = (6 + r() * 5) * s;
    bough(g, [[Math.cos(a) * 1.3 * s, 0.6 * s, Math.sin(a) * 1.3 * s], [Math.cos(a) * L * 0.5, 0.35 * s, Math.sin(a) * L * 0.5],
      [Math.cos(a + 0.3) * L, -0.3, Math.sin(a + 0.3) * L]], 0.3 * s, 0.1 * s, root, 12, 6);
  }
  if (arch) for (let k = 0; k < 4; k++) {
    const z = (-4.5 + k * 3 + r()) * s, h = (4.4 + r() * 1.6) * s;
    bough(g, [[1.4 * s, (3 + r()) * s, z - 0.5 * s], [5 * s, h, z], [9 * s, h + 0.4 * s, z + r() * 0.6 * s],
      [12.5 * s, 2 * s, z + 0.4 * s], [(14 + r() * 2) * s, -0.3, z + r() * s]], (0.5 + r() * 0.2) * s, 0.22 * s, root, 20, 7);
  }
  const top = p.toArray();
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + r() * 0.3, L = (7 + r() * 5) * s;
    const e = [top[0] + Math.cos(a) * L, top[1] + (1.5 + r() * 3) * s, top[2] + Math.sin(a) * L];
    const m = [(top[0] + e[0]) / 2, (top[1] + e[1]) / 2 + 1.3 * s, (top[2] + e[2]) / 2];
    bough(g, [top, m, e], 0.5 * s, 0.22 * s, trunk, 10, 6);
    canopyBlob(g, [e[0], e[1] + 0.8 * s, e[2]], 3.4 * s, r, [0x3f8f3a, 0x2a6a30, 0x2f8a6a]);
    if (i % 2) canopyBlob(g, [m[0], m[1] + 1.6 * s, m[2]], 2.6 * s, r, [0x3f8f3a, 0x67b443]);
    if (r() < 0.7) {
      const t = 0.6 + r() * 0.4;
      hangingVine(g, [top[0] + (e[0] - top[0]) * t, top[1] + (e[1] - top[1]) * t - 0.4, top[2] + (e[2] - top[2]) * t], (4 + r() * 10) * s, r, vine);
    }
    if (r() < 0.5) bromeliadRosette(g, [m[0], m[1] + 0.2 * s, m[2]], 0.9 * s, r);
  }
  canopyBlob(g, [top[0], top[1] + 2.6 * s, top[2]], 5 * s, r, [0x3f8f3a, 0x2a6a30, 0x67b443]);
  const tree = finish(g, 'ceibaGateway');
  tree.userData.gateway = arch ? { from: [3 * s, 0, -5 * s], to: [13 * s, 0, 5 * s], clearance: 4 * s } : null;
  return tree;
}
