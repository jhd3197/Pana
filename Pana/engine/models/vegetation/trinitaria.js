import * as THREE from 'three';
import { M, mesh, rng } from '../core/primitives.js';
import { paintFinish } from '../core/architecture-kit.js';
import { blade, stem } from './garden-kit.js';

export function trinitaria({ seed = 7, height = 4.3, detail = 'game' } = {}) {
  if (!Number.isFinite(height) || height < 1 || height > 10) throw new RangeError('height: 1–10');
  const group = new THREE.Group(), random = rng(seed), woody = M(0x705032, { roughness: 0.9 });
  const count = detail === 'low' ? 30 : 58;
  for (let branch = 0; branch < 4; branch++) {
    const x = (branch - 1.5) * 0.19;
    stem(group, [[0, 0, 0], [x * 0.3, height * 0.3, 0.04], [x, height * 0.7, 0.04], [x * 1.6, height, 0.08]], 0.035, woody);
  }
  for (let i = 0; i < count; i++) {
    const t = 0.15 + random() * 0.84, spread = 0.18 + t * 0.65;
    const x = (random() - 0.5) * spread * 2, y = t * height, z = 0.12 + random() * 0.22;
    blade(group, [x, y, z], [random() * 0.7, random() * Math.PI * 2, random() * 0.5], 0.26 + random() * 0.1, 0.13, i % 2 ? 0x438f2d : 0x69a73a, 0.06, 3);
    if (i % 3 === 0 && t < 0.55) continue;
    const flower = new THREE.Group(); flower.position.set(x, y + 0.04, z + 0.12); group.add(flower);
    for (let petal = 0; petal < 3; petal++) {
      const angle = petal * Math.PI * 2 / 3;
      const b = blade(flower, [0, 0, 0], [0, 0, angle], 0.2, 0.13, i % 2 ? 0xde2881 : 0xee4b97, 0.045, 3);
      b.rotation.x = Math.PI / 2;
    }
    flower.add(mesh(new THREE.SphereGeometry(0.027, 4, 3), M(0xffe7ad), 0, 0, 0.04));
  }
  return paintFinish(group, 'trinitaria');
}
