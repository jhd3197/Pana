import * as THREE from 'three';
import { mesh, rng } from '/engine/models/core/primitives.js';
import { taperedStem } from '/engine/models/core/botanical-shapes.js';
import { bake } from '/engine/models/core/static-batch.js';
import { bark, branch, leafyCushion, leafSprig } from '/engine/models/vegetation/canopy.js';
import { makeMango } from '/engine/models/props/mango.js';

export function mangoTree({ seed = 1, h = 3.2, fruit = true } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(branch([0, 0, 0], [0.2, h, 0], 0.38, 0.19));
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.4 + seed;
    g.add(mesh(taperedStem([[Math.cos(a) * 0.65, 0.035, Math.sin(a) * 0.65], [Math.cos(a) * 0.3, 0.18, Math.sin(a) * 0.3], [0.02, 0.65, 0]], 0.045, 0.12, 5, 6), bark));
  }
  const tint = [0x64a847, 0x76ac49, 0x4f9b48][seed % 3];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    const rr = 0.95 + r() * 0.35;
    const x = Math.cos(a) * 1.05, z = Math.sin(a) * 1.05, y = h + 0.45 + r() * 0.65;
    g.add(branch([0.1, h * 0.6, 0], [x, y, z], 0.16, 0.06));
    const pad = leafyCushion(rr, seed + i, tint); pad.position.set(x, y, z); pad.scale.y = 0.82; g.add(pad);
    for (let j = 0; j < 3; j++) {
      const turn = a + j * Math.PI * 2 / 3, px = x + Math.cos(turn) * rr * 0.65, pz = z + Math.sin(turn) * rr * 0.65;
      const tuft = leafyCushion(0.58 + j * 0.06, seed + i + j, j % 3 ? tint : 0x79a448, true);
      tuft.position.set(px, y + rr * 0.1, pz); tuft.scale.y = 0.85; g.add(tuft);
      leafSprig(g, px, y + rr * 0.54, pz, -turn, 0.4, seed + i * 6 + j, tint);
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + seed, top = leafyCushion(0.95, seed + 20 + i, tint);
    top.position.set(Math.cos(a) * 0.6, h + 1.2 + i * 0.15, Math.sin(a) * 0.6); top.scale.set(1, 0.85, 0.95); g.add(top);
  }
  if (fruit) {
    for (let i = 0; i < 5; i++) {
      const m = makeMango();
      m.scale.setScalar(0.4);
      const a = i * 2.4 + seed, y = h + (i % 3) * 0.22;
      m.position.set(Math.cos(a) * 1.72, y, Math.sin(a) * 1.72); m.rotation.z = Math.sin(a) * 0.3;
      g.add(branch([m.position.x, y + 0.22, m.position.z], [m.position.x * 0.85, y + 0.65, m.position.z * 0.85], 0.012, 0.018));
      g.add(m);
    }
  }
  const result = bake(g); result.name = 'mangoTree'; g.traverse(o => o.geometry?.dispose()); return result;
}
