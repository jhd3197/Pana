import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { leafMaterial, finish, stem } from '/engine/models/vegetation/plant-kit.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';

const TINTS = [0x5fae3c, 0x3f8a35, 0x2f7a52];

// Elephant-ear (Colocasia): broad paddle leaves raised on their own petioles,
// each with a dark midrib, tipped up toward the light. `stalk:false` keeps the
// leaves as a low ground rosette.
export function elephantEar({ seed = 1, scale = 1, stalk = true } = {}) {
  const r = rng(seed), g = new THREE.Group(), s = scale, n = 5 + (r() * 4 | 0);
  const rib = M(0x2a6a2c, { roughness: 1 }), petiole = M(0x6f8f45, { roughness: 1, flatShading: false });
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + r() * 0.5, tilt = 0.15 + r() * 0.5, L = s * (1.4 + r() * 0.8);
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(tilt), Math.sin(tilt), Math.cos(a) * Math.cos(tilt));
    const h = stalk ? s * (0.55 + r() * 0.75) : 0.2, foot = new THREE.Vector3(Math.sin(a) * 0.12 * s, h, Math.cos(a) * 0.12 * s);
    if (stalk) stem(g, [[0, 0, 0], [foot.x * 0.4, h * 0.55, foot.z * 0.4], foot.toArray()], 0.06 * s, 0.035 * s, petiole, 6);
    const c = foot.clone().addScaledVector(dir, L * 0.5), roll = (r() - 0.5) * 0.3;
    const geo = new THREE.SphereGeometry(1, 10, 6), p = geo.attributes.position, colors = [];
    const light = new THREE.Color(TINTS[(r() * 3) | 0]), dark = light.clone().multiplyScalar(0.62);
    for (let k = 0; k < p.count; k++) { const col = dark.clone().lerp(light, 0.5 + p.getZ(k) * 0.4); colors.push(col.r, col.g, col.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const leaf = mesh(natureSurface(geo, 'foliage'), leafMaterial, c.x, c.y, c.z);
    leaf.rotation.set(-tilt, a, roll, 'YXZ'); leaf.scale.set(L * 0.3, 0.04, L * 0.5); g.add(leaf);
    const vein = mesh(new THREE.BoxGeometry(0.04, 0.03, L * 0.95), rib, c.x, c.y + 0.03, c.z);
    vein.rotation.set(-tilt, a, 0, 'YXZ'); g.add(vein);
  }
  return finish(g, 'elephantEar');
}
