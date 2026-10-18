import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { finish } from '/engine/models/vegetation/plant-kit.js';
import { bromeliadRosette } from '/engine/models/vegetation/faceted-kit.js';

const HEARTS = { red: 0xe0332e, pink: 0xff6fae, orange: 0xff8c1a };

// Ground or branch-fork bromeliad: a ring of stiff green blades around a red heart.
export function bromeliad({ seed = 1, scale = 1, heart } = {}) {
  const r = rng(seed), g = new THREE.Group();
  bromeliadRosette(g, [0, 0, 0], scale, r, HEARTS[heart] ?? Object.values(HEARTS)[(r() * 3) | 0]);
  return finish(g, 'bromeliad');
}
