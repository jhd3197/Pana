import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { finish } from '/engine/models/vegetation/plant-kit.js';
import { barkMat, limb, facet } from '/engine/models/vegetation/faceted-kit.js';

// Recursive gnarled tree: every bough splits into two or three thinner, jittered
// children that never droop far below horizontal. Bare by default (cemetery,
// páramo, burnt savanna); `leaves` caps the finest twigs with faceted clumps.
export function deadTree({ seed = 1, height = 6, depth = 4, leaves = false, tint = leaves ? 0x5c4a3a : 0x3b3330,
  leafTints = [0x4f8d3e, 0x67b443, 0x2f6a30] } = {}) {
  const r = rng(seed), g = new THREE.Group(), size = height / 4.6;
  const dark = barkMat(tint), light = barkMat(new THREE.Color(tint).offsetHSL(0, -0.02, 0.07).getHex());
  const grow = (a, dir, len, radius, level) => {
    const b = a.clone().addScaledVector(dir, len);
    limb(g, a.toArray(), b.toArray(), radius, radius * 0.7, level > 2 ? dark : light, level > 2 ? 8 : 6);
    if (level === 0 || len < 0.35) {
      if (leaves) {
        const s = Math.max(0.55, len * 0.9) * (0.9 + r() * 0.5);
        facet(g, [b.x, b.y + s * 0.2, b.z], [s, s * 0.7, s], [r() * 3, r() * 3, r() * 3], leafTints[(r() * leafTints.length) | 0], r() * 40);
      }
      return;
    }
    const n = level > 2 ? 2 + (r() * 2 | 0) : 2;
    for (let i = 0; i < n; i++) {
      const next = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.4, (r() - 0.2) * 0.7, (r() - 0.5) * 1.4)).normalize();
      if (next.y < -0.25) next.y = -0.25;
      grow(b, next.normalize(), len * (0.62 + r() * 0.2), radius * 0.66, level - 1);
    }
  };
  const lean = new THREE.Vector3((r() - 0.5) * 0.4, 1, (r() - 0.5) * 0.4).normalize();
  grow(new THREE.Vector3(0, -0.3, 0), lean, size * (1.6 + r() * 0.8), size * 0.32, depth);
  // Surface roots splay from the collar into the ground.
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + r() * 1.2;
    limb(g, [0, size * 0.45, 0], [Math.cos(a) * size * 0.95, -0.15, Math.sin(a) * size * 0.95], size * 0.15, size * 0.05, dark, 6);
  }
  return finish(g, leaves ? 'leafyTree' : 'deadTree');
}
