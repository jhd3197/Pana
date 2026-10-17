import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';

export function pine({ seed = 1, h = 6 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(mesh(natureSurface(new THREE.CylinderGeometry(0.2, 0.28, h * 0.35, 6), 'bark'), M(0x6b4a2a, { roughness: 1 }), 0, h * 0.17, 0));
  const leaf = M(r() < 0.5 ? 0x367854 : 0x488b59, { roughness: 1, flatShading: false });
  for (let i = 0; i < 4; i++) {
    const s = 1 - i * 0.22, ht = h * 0.42;
    const points = [[0, 0], [1.6 * s, 0.07], [1.2 * s, ht * 0.28], [0.65 * s, ht * 0.64], [0, ht]].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(points, 12);
    const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const a = Math.atan2(p.getZ(j), p.getX(j));
      const f = 1 + Math.sin(a * 5 + seed + i) * 0.09;
      p.setXYZ(j, p.getX(j) * f, p.getY(j) + Math.sin(a * 6 + i) * 0.1 * s, p.getZ(j) * f);
    }
    geo.computeVertexNormals();
    g.add(mesh(natureSurface(geo, 'foliage'), leaf, Math.sin(i + seed) * 0.12, h * (0.2 + i * 0.19), 0));
  }
  return g;
}
