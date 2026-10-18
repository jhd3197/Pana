import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';

const CAPS = { red: 0xe0332e, orange: 0xe8743a, tan: 0xb98a55 };

// Clump of toadstools: cream stems, domed caps and white spots.
export function wildMushrooms({ seed = 1, cap, count } = {}) {
  const r = rng(seed), g = new THREE.Group(), n = count ?? 4 + (r() * 4 | 0);
  const tint = CAPS[cap] ?? (r() < 0.6 ? CAPS.red : CAPS.orange);
  const stem = M(0xf2e8cf, { roughness: 0.9 }), top = M(tint, { roughness: 0.7 }), spot = M(0xf5f1e6, { roughness: 0.9 });
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 1.2, z = (r() - 0.5) * 1.2, h = 0.2 + r() * 0.5, w = 0.12 + r() * 0.25;
    g.add(mesh(new THREE.CylinderGeometry(w * 0.26, w * 0.32, h, 6), stem, x, h / 2, z));
    const dome = mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), top, x, h - 0.02, z);
    dome.scale.set(w, w * 0.7, w); dome.rotation.set((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3); g.add(dome);
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2, dot = mesh(new THREE.SphereGeometry(1, 6, 4), spot, x + Math.cos(a) * w * 0.5, h + w * 0.45, z + Math.sin(a) * w * 0.5);
      dot.scale.set(w * 0.13, w * 0.08, w * 0.13); g.add(dot);
    }
  }
  const out = bake(g); out.name = 'wildMushrooms';
  g.traverse(o => o.geometry?.dispose());
  return out;
}
