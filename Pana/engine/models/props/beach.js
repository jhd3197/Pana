import * as THREE from 'three';
import { M, mesh, box } from '/engine/models/core/primitives.js';

const wood = M(0xb08b5d, { roughness: 1, flatShading: false });
const cream = M(0xffedbd, { roughness: 1 });

export function beachShade(color = 0xe77950) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.065, 0.075, 3.3, 8), wood, 0, 1.65, 0));
  const geo = new THREE.SphereGeometry(2.5, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, 0.36, 1);
  const p = geo.attributes.position, colors = [], accent = new THREE.Color(color), pale = new THREE.Color(0xffeac5);
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)) + Math.PI;
    const c = Math.floor(a / (Math.PI / 4)) % 2 ? accent : pale;
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  group.add(mesh(geo, M(0xffffff, { vertexColors: true, side: THREE.DoubleSide, flatShading: false, roughness: 1 }), 0, 2.5, 0));
  for (const x of [-1.15, 1.15]) {
    group.add(box(0.9, 0.12, 2.1, cream, x, 0.4, 0.6));
    const back = box(0.9, 0.12, 1, cream, x, 0.76, -0.66);
    back.rotation.x = 0.7; group.add(back);
    for (const z of [-0.2, 1.3]) group.add(box(0.75, 0.4, 0.08, wood, x, 0.2, z));
  }
  return group;
}

export function beachHut() {
  const group = new THREE.Group();
  group.add(box(4.6, 0.3, 3.5, wood, 0, 0.35, 0));
  for (const x of [-2, 2]) for (const z of [-1.4, 1.4]) group.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.9, 8), wood, x, 2, z));
  group.add(box(4.2, 1.6, 0.2, M(0x62a6a1, { roughness: 1 }), 0, 1.4, -1.4));
  group.add(box(4.2, 0.15, 0.8, cream, 0, 1.8, 0.7));
  const roof = mesh(new THREE.ConeGeometry(3.9, 1.6, 4), M(0xcbb078, { roughness: 1 }), 0, 4.1, 0);
  roof.rotation.y = Math.PI / 4; roof.scale.z = 0.8; group.add(roof);
  for (let i = 0; i < 3; i++) {
    const board = mesh(new THREE.SphereGeometry(0.55, 12, 12), M([0xf3b348, 0xe8795e, 0x9bd3c5][i], { flatShading: false, roughness: 0.5 }), 2.7 + i * 0.45, 1.5, -0.3);
    board.scale.set(0.6, 2.7, 0.17); board.rotation.z = -0.15 + i * 0.12; group.add(board);
  }
  return group;
}

export function driftwood() {
  const group = new THREE.Group();
  const log = mesh(new THREE.CylinderGeometry(0.24, 0.34, 3.8, 9), wood, 0, 0.28, 0);
  log.rotation.z = Math.PI / 2; log.rotation.y = 0.3; group.add(log);
  const twig = mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.1, 6), wood, -0.3, 0.45, 0.3);
  twig.rotation.x = 0.9; group.add(twig);
  return group;
}
