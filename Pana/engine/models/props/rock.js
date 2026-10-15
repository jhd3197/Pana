import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';

export function rock(r, color = 0x8d8d96, seed = 1) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const rand = rng(seed);
  const pos = geo.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => v.toFixed(3)).join(',');
    if (!seen.has(key)) seen.set(key, 0.72 + rand() * 0.5);
    const k = seen.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.75, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return mesh(geo, M(color, { roughness: 1 }));
}
