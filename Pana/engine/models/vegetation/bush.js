import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { leafBlade, taperedStem } from '/engine/models/core/botanical-shapes.js';
import { bark, bladeMat, leafyCushion, leafSprig } from '/engine/models/vegetation/canopy.js';

export function bush({ seed = 1, flowers = false } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const pads = [[-0.55, 0.49, 0.06, 0.68], [0.5, 0.5, 0.12, 0.72], [0, 0.79, -0.16, 0.67], [-0.05, 0.39, 0.56, 0.51], [0.22, 0.46, -0.63, 0.55]];
  pads.forEach(([x, y, z, size], i) => {
    const pad = leafyCushion(size, seed + i, [0x689e42, 0x80ae4b, 0x92ba55][i % 3]);
    pad.position.set(x, y, z); pad.scale.set(1, 0.68, 0.95); g.add(pad);
    if (i < 3) g.add(mesh(taperedStem([[0, 0, 0], [x * 0.4, 0.28, z * 0.4], [x, y, z]], 0.045, 0.014, 4, 5), bark));
    leafSprig(g, x * 1.1, y + size * 0.66, z * 1.1, r() * Math.PI * 2, 0.36 + r() * 0.12, seed + i, 0x8dbd52);
    for (let j = 0; j < 3; j++) {
      const a = j * Math.PI * 2 / 3 + i;
      const leaf = mesh(leafBlade(0.4, 0.14, 0.07, 0x528a38, 6), bladeMat,
        x + Math.cos(a) * size * 0.75, y + size * 0.47, z + Math.sin(a) * size * 0.75);
      leaf.rotation.set(0, -a, -0.4); g.add(leaf);
    }
  });
  if (flowers) {
    const tint = [0xf29eae, 0xffd364, 0xf28a50, 0xfff0d4][Math.floor(r() * 4)];
    const centerMat = M(0xe5a632, { flatShading: false, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const [x, y, z, size] = pads[i], flower = new THREE.Group();
      flower.position.set(x + (r() - 0.5) * 0.2, y + size * 0.68 + 0.02, z);
      flower.rotation.set((r() - 0.5) * 0.6, r() * Math.PI * 2, (r() - 0.5) * 0.5);
      for (let j = 0; j < 5; j++) {
        const petal = mesh(leafBlade(0.23, 0.12, 0.055, tint, 6), bladeMat);
        petal.rotation.y = j / 5 * Math.PI * 2; flower.add(petal);
      }
      const center = mesh(new THREE.SphereGeometry(0.07, 8, 5), centerMat, 0, 0.035, 0); center.scale.y = 0.55;
      flower.add(center); g.add(flower);
    }
  }
  return g;
}
