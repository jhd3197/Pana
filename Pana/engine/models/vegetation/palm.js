import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { leafBlade } from '/engine/models/core/botanical-shapes.js';
import { bake } from '/engine/models/core/static-batch.js';
import { bark, bladeMat, ribbon, frondMats } from '/engine/models/vegetation/canopy.js';

export function palm({ h = 8, seed = 1 } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const bend = 0.6 + r() * 1.1, turn = r() * Math.PI * 2;
  const dx = Math.cos(turn) * bend, dz = Math.sin(turn) * bend;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.36, h, 12, 18);
  const p = trunkGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h;
    p.setXYZ(i, p.getX(i) + dx * t * t, p.getY(i) + h / 2, p.getZ(i) + dz * t * t);
  }
  trunkGeo.computeVertexNormals();
  g.add(mesh(trunkGeo, bark));
  const collar = M(0xb69a6a, { roughness: 1, flatShading: false });
  for (let i = 1; i < 20; i++) {
    const t = i / 21;
    const ring = mesh(new THREE.TorusGeometry(0.36 - t * 0.18, 0.017, 3, 9), collar, dx * t * t, h * t, dz * t * t);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const n = 8 + seed % 3;
  for (let i = 0; i < n; i++) {
    const frond = new THREE.Group();
    frond.position.set(dx, h - 0.1, dz);
    frond.rotation.y = i / n * Math.PI * 2 + r() * 0.25;
    const length = 3.2 + r() * 1.2, rise = 0.8 + r() * 0.7, droop = 0.85 + r() * 0.75;
    frond.add(mesh(ribbon(length, 0.065, rise, droop), frondMats[2]));
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      const leafletLength = (0.35 + Math.sin(t * Math.PI) * 0.85) * (length / 3.7);
      for (const side of [-1, 1]) {
        const leaf = mesh(ribbon(leafletLength * (1 + side * 0.06), 0.16, 0.04, 0.24 + t * 0.2, k, 5), frondMats[(i + k) % 3], t * length, Math.sin(t * Math.PI * 0.85) * rise - t * t * droop, 0);
        leaf.rotation.y = side * (0.9 + t * 0.35);
        frond.add(leaf);
      }
    }
    g.add(frond);
  }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    g.add(mesh(new THREE.SphereGeometry(0.24, 8, 6), M(0x73502c, { flatShading: false }), dx + Math.cos(a) * 0.28, h - 0.25, dz + Math.sin(a) * 0.28));
  }
  // Upright new growth breaks the flat umbrella silhouette.
  for (let i = 0; i < 3; i++) {
    const spear = mesh(leafBlade(1.45, 0.16, 0.2, 0x92b854, 7), bladeMat, dx, h - 0.1, dz);
    spear.rotation.set(0, i * 2.1, 1.0); g.add(spear);
  }
  const result = bake(g); result.name = 'palm'; g.traverse(o => o.geometry?.dispose()); return result;
}
