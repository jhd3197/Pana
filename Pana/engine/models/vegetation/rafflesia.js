import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';

// Rafflesia: five fleshy crimson petals with white warts around a deep cup.
export function rafflesia({ seed = 1, scale = 1 } = {}) {
  const r = rng(seed), g = new THREE.Group(), s = scale;
  const crimson = M(0xb8302a, { roughness: 0.8 }), wart = M(0xf5f1e6, { roughness: 0.9 }), well = M(0x14100c, { roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, petal = mesh(new THREE.SphereGeometry(1, 12, 8), crimson, Math.cos(a) * 0.95 * s, 0.18 * s, Math.sin(a) * 0.95 * s);
    petal.rotation.set(-0.08, -a + Math.PI / 2, 0, 'YXZ'); petal.scale.set(0.75 * s, 0.16 * s, 0.62 * s); g.add(petal);
    for (let k = 0; k < 4; k++) {
      const d = (0.5 + r() * 0.6) * s, b = a + (r() - 0.5) * 0.6, w = (0.08 + r() * 0.05) * s;
      g.add(mesh(new THREE.CylinderGeometry(w, w, 0.04 * s, 6), wart, Math.cos(b) * d, 0.33 * s, Math.sin(b) * d));
    }
  }
  g.add(mesh(new THREE.CylinderGeometry(0.55 * s, 0.55 * s, 0.4 * s, 12), crimson, 0, 0.38 * s, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.03 * s, 12), well, 0, 0.59 * s, 0));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    g.add(mesh(new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.08 * s, 6), wart, Math.cos(a) * 0.25 * s, 0.6 * s, Math.sin(a) * 0.25 * s));
  }
  const out = bake(g); out.name = 'rafflesia';
  g.traverse(o => o.geometry?.dispose());
  return out;
}
