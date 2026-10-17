import * as THREE from 'three';
import { rng } from '../core/primitives.js';
import { paintFinish } from '../core/architecture-kit.js';
import { blade } from './garden-kit.js';

export function gardenRosette({ seed = 7, detail = 'game' } = {}) {
  const group = new THREE.Group(), random = rng(seed), count = detail === 'low' ? 10 : 18;
  for (let i = 0; i < count; i++) {
    const tier = i % 3, angle = i * 2.399 + random() * 0.2;
    blade(group, [0, 0.03 + tier * 0.09, 0], [0, angle, 0.5 + tier * 0.29],
      1.1 + tier * 0.18 + random() * 0.16, 0.22 + random() * 0.055,
      [0x246b21, 0x33872a, 0x559d2d][i % 3], 0.31, detail === 'low' ? 3 : 6);
  }
  return paintFinish(group, 'gardenRosette');
}
