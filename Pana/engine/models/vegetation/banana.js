import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { ribbon, frondMats } from '/engine/models/vegetation/canopy.js';

export function banana({ seed = 1 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6), M(0x6f9a3a, { roughness: 1 }), 0, 1.1, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.5;
    const arm = new THREE.Group();
    arm.position.y = 2.1;
    arm.rotation.set(0, -a, 0);
    const l = mesh(ribbon(2.3 + r() * 0.7, 0.48, 0.9, 0.8, seed + i), frondMats[i % 3]);
    arm.add(l);
    g.add(arm);
  }
  return g;
}
