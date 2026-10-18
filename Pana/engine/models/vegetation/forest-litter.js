import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';

const FALL = [0xd9a440, 0xc8692e, 0x8aa040];

// Forest floor scatter: a patch of fallen autumn leaves, optionally with a
// forked dead branch lying across it.
export function forestLitter({ seed = 1, leaves = 14, branch = true, radius = 0.9 } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const leaf = (x, y, z, a) => {
    const m = mesh(new THREE.OctahedronGeometry(1, 0), M(FALL[(r() * 3) | 0], { roughness: 1 }), x, y, z);
    m.rotation.set((r() - 0.5) * 0.3, a, (r() - 0.5) * 0.3); m.scale.set(0.09, 0.01, 0.16); g.add(m);
  };
  for (let i = 0; i < leaves; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius; leaf(Math.cos(a) * d, 0.02, Math.sin(a) * d, r() * 3); }
  if (branch) {
    const wood = M(0x8d7158, { roughness: 1 }), L = 1.6 + r() * 1.2;
    const stick = (a, b, w) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), m = mesh(new THREE.CylinderGeometry(w * 0.8, w, va.distanceTo(vb), 6), wood);
      m.position.copy(va).add(vb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize()); g.add(m);
    };
    stick([-L / 2, 0.07, 0], [L / 2, 0.07, (r() - 0.5) * 0.3], 0.07);
    for (let i = 0; i < 3; i++) {
      const t = r() - 0.5;
      stick([t * L, 0.07, 0], [t * L + (r() - 0.5) * 0.6, 0.06 + r() * 0.15, (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.3)], 0.035);
    }
    for (let i = 0; i < 4; i++) leaf((r() - 0.5) * L, 0.12, (r() - 0.5) * 0.6, r() * 3);
  }
  const out = bake(g); out.name = 'forestLitter';
  g.traverse(o => o.geometry?.dispose());
  return out;
}
