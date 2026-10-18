import * as THREE from 'three';
import { rng } from '../core/primitives.js';
import { paintFinish } from '../core/architecture-kit.js';
import { blade, stem } from './garden-kit.js';

// Grounded preview; attachment is the top, explicitly reported for planters.
export function trailingVine({ seed = 7, height = 2.1, detail = 'game' } = {}) {
  if (!Number.isFinite(height) || height < 0.7 || height > 3) throw new RangeError('height: 0.7–3');
  const group = new THREE.Group(), random = rng(seed), count = detail === 'low' ? 4 : 6;
  for (let branch = 0; branch < count; branch++) {
    const x = (branch - (count - 1) / 2) * 0.13, length = (height - 0.24) * (0.55 + random() * 0.36);
    const sway = (random() - 0.5) * 0.3;
    stem(group, [[0, height, 0], [x, height - 0.16, 0.23], [x + sway, height - length * 0.5, 0.32], [x, height - length, 0.26]], 0.013);
    const leaves = detail === 'low' ? 6 : 10;
    for (let j = 0; j < leaves; j++) {
      const t = j / leaves, side = j % 2 ? 1 : -1;
      const leaf = blade(group, [x + Math.sin(t * Math.PI) * sway, height - 0.12 - t * length, 0.28],
        [Math.PI / 2, 0, 0], 0.4 * (1 - t * 0.35), 0.15,
        [0x4b922a, 0x74ae33, 0x307a25][j % 3], 0.06, 3);
      leaf.rotateY(side > 0 ? -0.65 : Math.PI + 0.65);
    }
  }
  const out = paintFinish(group, 'trailingVine'); out.userData.attachment = [0, height, 0]; return out;
}
