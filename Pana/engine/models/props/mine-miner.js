// Rigged gold miner: hierarchical limbs so poses animate without a skeleton.
import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';

const SHIRTS = [0xa83a2e, 0x3d6e9a, 0x6a7d3a, 0xc27a2f, 0x7d4a8a, 0xd9c39a];
const PANTS = [0x3c5a7a, 0x4a3d30, 0x2f4b62, 0x5b4c3c];
const SKINS = [0xc58b62, 0x8d5a3b, 0xe0b08a, 0xa26a45, 0x6f4630];
const HELMS = [0xe8b830, 0xe8b830, 0xe8b830, 0xe9e2cf, 0xc9472f];
const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffd36e });
const leather = M(0x3a2a1e), handleWood = M(0x9a6c43), steel = M(0x6d6862, { metalness: 0.3 }), iron = M(0x45413d, { metalness: 0.3 });
const pick = list => r => list[r() * list.length | 0];

function part(parent, geo, mat, x, y, z) {
  const m = mesh(geo, mat, x, y, z);
  parent.add(m);
  return m;
}

// Poses mirror the source scene: walk, dig, sit (on a 0.5 m seat), push and a breathing idle.
const POSES = {
  walk(m, t, sp = 1) {
    const s = Math.sin(t * 6 * sp);
    m.legL.rotation.x = s * 0.55; m.legR.rotation.x = -s * 0.55;
    m.armL.rotation.x = -s * 0.45; m.armR.rotation.x = s * 0.45;
    m.body.position.y = 0.86 + Math.abs(Math.cos(t * 6 * sp)) * 0.04; m.body.rotation.x = 0;
  },
  dig(m, t, ph) {
    const k = Math.pow((Math.sin(t * 3.2 + ph) + 1) / 2, 0.6);
    m.armR.rotation.x = -2.7 + k * 2.2; m.armL.rotation.x = -2.5 + k * 2.0; m.body.rotation.x = 0.05 + k * 0.25;
    m.legL.rotation.x = 0.15; m.legR.rotation.x = -0.15;
  },
  sit(m, t, ph) {
    m.legL.rotation.x = m.legR.rotation.x = -1.5;
    m.body.position.y = m.legL.position.y = m.legR.position.y = 0.5;
    m.armL.rotation.x = -0.5; m.armR.rotation.x = -0.6 + Math.sin(t * 1.3 + ph) * 0.25; m.body.rotation.x = 0.12;
  },
  push(m, t) {
    POSES.walk(m, t, 0.8);
    m.armL.rotation.x = m.armR.rotation.x = -1.35; m.body.rotation.x = 0.22;
  },
  idle(m, t, ph) {
    m.legL.rotation.x = m.legR.rotation.x = 0;
    m.body.position.y = 0.86 + Math.sin(t * 1.6 + ph) * 0.012;
    m.armL.rotation.x = Math.sin(t * 1.1 + ph) * 0.06; m.armR.rotation.x = -Math.sin(t * 1.1 + ph) * 0.06;
    m.body.rotation.x = 0;
  },
};

export function miner({ seed = 3, pose = 'dig', tool = pose === 'dig' ? 'pick' : 'none', beard } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const shirt = M(pick(SHIRTS)(r)), pants = M(pick(PANTS)(r)), skin = M(pick(SKINS)(r), { flatShading: false });
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.13, 0.86, 0); legR.position.set(0.13, 0.86, 0);
  for (const L of [legL, legR]) {
    part(L, new THREE.BoxGeometry(0.22, 0.82, 0.26), pants, 0, -0.41, 0);
    part(L, new THREE.BoxGeometry(0.25, 0.16, 0.36), leather, 0, -0.8, 0.05);
    g.add(L);
  }
  const body = new THREE.Group(); body.position.y = 0.86; g.add(body);
  part(body, new THREE.BoxGeometry(0.62, 0.72, 0.38), shirt, 0, 0.36, 0);
  part(body, new THREE.BoxGeometry(0.64, 0.11, 0.4), leather, 0, 0.02, 0);
  for (const s of [-1, 1]) part(body, new THREE.BoxGeometry(0.08, 0.7, 0.02), pants, s * 0.17, 0.36, 0.2);
  const head = part(body, new THREE.SphereGeometry(0.21, 12, 10), skin, 0, 0.92, 0);
  part(body, new THREE.BoxGeometry(0.06, 0.08, 0.06), skin, 0, 0.9, 0.21);
  if (beard ?? r() < 0.55) part(body, new THREE.BoxGeometry(0.32, 0.17, 0.14), M(r() < 0.5 ? 0x3a2618 : 0x7a5a3a), 0, 0.78, 0.13);
  const helm = M(pick(HELMS)(r));
  part(body, new THREE.SphereGeometry(0.245, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), helm, 0, 0.98, 0);
  part(body, new THREE.CylinderGeometry(0.32, 0.32, 0.04, 14), helm, 0, 0.99, 0);
  const lamp = part(body, new THREE.CylinderGeometry(0.075, 0.075, 0.09, 10), lampGlow, 0, 1.1, 0.24);
  lamp.rotation.x = Math.PI / 2; lamp.castShadow = false;
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.41, 0.66, 0); armR.position.set(0.41, 0.66, 0);
  for (const A of [armL, armR]) {
    part(A, new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt, 0, -0.29, 0);
    part(A, new THREE.BoxGeometry(0.16, 0.14, 0.16), skin, 0, -0.64, 0);
    body.add(A);
  }
  if (tool === 'pick' || tool === 'shovel') {
    const held = new THREE.Group(); held.position.set(0, -0.64, 0); armR.add(held);
    part(held, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), handleWood, 0, 0, 0.4).rotation.x = Math.PI / 2;
    if (tool === 'pick') part(held, new THREE.BoxGeometry(0.07, 0.82, 0.07), steel, 0, 0, 0.88);
    else part(held, new THREE.BoxGeometry(0.3, 0.04, 0.36), steel, 0, 0, 0.98).rotation.x = -0.3;
  } else if (tool === 'lantern') {
    const held = new THREE.Group(); held.position.set(0, -0.75, 0); armR.add(held);
    part(held, new THREE.BoxGeometry(0.16, 0.14, 0.16), iron, 0, 0.05, 0);
    part(held, new THREE.CylinderGeometry(0.075, 0.075, 0.09, 10), lampGlow, 0, -0.12, 0).scale.set(2, 2.6, 2);
  }
  const rig = { legL, legR, armL, armR, body, head }, phase = r() * 6.28, apply = POSES[pose] || POSES.idle;
  apply(rig, 0, phase);
  g.name = 'miner';
  g.userData.rig = rig;
  g.userData.tick = t => apply(rig, t, phase);
  g.userData.previewBounds = [[-0.8, 0, -0.9], [0.8, 2.2, 1.4]];
  return g;
}
