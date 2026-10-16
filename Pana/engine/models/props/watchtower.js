import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';

export function watchtower({ h = 6.5, roof = 'thatch' } = {}) {
  const g = new THREE.Group();
  const wood = M(0x8a5a33, { roughness: 0.9 });
  const dark = M(0x5c3a20, { roughness: 0.9 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(tube([sx * 1.5, 0, sz * 1.5], [sx * 1.05, h, sz * 1.05], 0.14, wood));
  }
  for (const y of [h * 0.35, h * 0.7]) {
    g.add(box(2.6 - y * 0.12, 0.12, 0.12, dark, 0, y, 1.35 - y * 0.1));
    g.add(box(2.6 - y * 0.12, 0.12, 0.12, dark, 0, y, -1.35 + y * 0.1));
    g.add(box(0.12, 0.12, 2.6 - y * 0.12, dark, 1.35 - y * 0.1, y, 0));
    g.add(box(0.12, 0.12, 2.6 - y * 0.12, dark, -1.35 + y * 0.1, y, 0));
  }
  g.add(box(3, 0.25, 3, wood, 0, h, 0));                      // platform
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(box(0.12, 1.1, 0.12, dark, sx * 1.35, h + 0.55, sz * 1.35));
  }
  g.add(box(2.9, 0.1, 0.1, dark, 0, h + 1.05, 1.35));
  g.add(box(2.9, 0.1, 0.1, dark, 0, h + 1.05, -1.35));
  g.add(box(0.1, 0.1, 2.9, dark, 1.35, h + 1.05, 0));
  g.add(box(0.1, 0.1, 2.9, dark, -1.35, h + 1.05, 0));
  if (roof === 'thatch') {
    const r = mesh(new THREE.ConeGeometry(2.6, 1.5, 4), M(0xc2a35c, { roughness: 1 }), 0, h + 2, 0);
    r.rotation.y = Math.PI / 4;
    g.add(r);
  } else {
    g.add(box(3.4, 0.14, 3.4, M(0xb5462f, { roughness: 0.6 }), 0, h + 1.9, 0));
  }
  return g;
}
