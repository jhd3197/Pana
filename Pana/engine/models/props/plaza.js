// A shared, game-independent market kit. Static scenery and disguises use the
// same factories, so a player's barrel is visually identical to a map barrel.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/models/core/primitives.js';
import { banana } from '/engine/models/vegetation/banana.js';
import { finish } from '/engine/models/core/static-batch.js';
export { PLAZA_PROPS, propDefinition } from '/engine/models/props/plaza-definitions.js';

const wood = M(0x96582e), woodLight = M(0xb57840), woodDark = M(0x694025);
const iron = M(0x353a42, { metalness: 0.3 });

export function barrel() {
  const g = new THREE.Group();
  const points = [[0.58, 0], [0.66, 0.15], [0.74, 0.7], [0.73, 1.15], [0.6, 1.8]].map(p => new THREE.Vector2(...p));
  const body = mesh(new THREE.LatheGeometry(points, 12), wood);
  g.add(body);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    g.add(tube([Math.cos(a) * 0.65, 0.2, Math.sin(a) * 0.65], [Math.cos(a) * 0.73, 0.92, Math.sin(a) * 0.73], 0.012, woodDark));
    g.add(tube([Math.cos(a) * 0.73, 0.92, Math.sin(a) * 0.73], [Math.cos(a) * 0.61, 1.73, Math.sin(a) * 0.61], 0.012, woodDark));
  }
  for (const [y, r] of [[0.22, 0.68], [0.86, 0.755], [1.57, 0.655]]) {
    g.add(mesh(new THREE.CylinderGeometry(r, r, 0.15, 12, 1, true), iron, 0, y, 0));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.59, 0.59, 0.07, 12), woodDark, 0, 1.77, 0));
  for (let i = -2; i <= 2; i++) g.add(box(1.02, 0.018, 0.18, woodLight, 0, 1.815, i * 0.2));
  return finish(g);
}

export function crate() {
  const g = new THREE.Group();
  g.add(box(1.42, 1.42, 1.42, woodDark, 0, 0.71, 0));
  for (let i = 0; i < 5; i++) {
    const p = -0.58 + i * 0.29;
    for (const s of [-1, 1]) {
      g.add(box(0.27, 1.3, 0.07, i % 2 ? wood : woodLight, p, 0.73, s * 0.73));
      g.add(box(0.07, 1.3, 0.27, i % 2 ? woodLight : wood, s * 0.73, 0.73, p));
    }
    g.add(box(0.27, 0.07, 1.45, wood, p, 1.43, 0));
  }
  for (const s of [-1, 1]) {
    for (const y of [0.12, 1.33]) g.add(box(1.56, 0.16, 0.09, woodLight, 0, y, s * 0.79));
    const brace = box(0.17, 1.8, 0.09, woodLight, 0, 0.73, s * 0.8);
    brace.rotation.z = s * 0.78;
    g.add(brace);
  }
  return finish(g);
}

export function cooler({ color = 0xe74e4c } = {}) {
  const g = new THREE.Group();
  g.add(box(1.55, 0.84, 1, M(color), 0, 0.43, 0));
  g.add(box(1.66, 0.21, 1.1, M(0xf4eee1), 0, 0.95, 0));
  for (const s of [-1, 1]) {
    g.add(box(0.13, 0.28, 0.42, M(0xf4eee1), s * 0.83, 0.68, 0));
    g.add(box(0.12, 0.27, 0.07, M(0xf4eee1), s * 0.47, 0.74, 0.54));
  }
  return finish(g);
}

export function planter({ seed = 7 } = {}) {
  const g = new THREE.Group(), clay = M(0xcb6748);
  g.add(mesh(new THREE.CylinderGeometry(0.61, 0.43, 0.87, 9), clay, 0, 0.44, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.67, 0.67, 0.17, 9), M(0xe28a5b), 0, 0.88, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.025, 9), M(0x4c3627), 0, 0.975, 0));
  const plant = banana({ seed });
  plant.scale.setScalar(0.43);
  plant.position.y = 0.91;
  g.add(plant);
  return finish(g);
}

export function bench() {
  const g = new THREE.Group();
  for (const x of [-1.05, 1.05]) {
    for (const z of [-0.4, 0.4]) g.add(box(0.16, 0.83, 0.16, iron, x, 0.42, z));
    g.add(box(0.13, 1.52, 0.13, iron, x, 0.81, -0.43));
  }
  for (let i = 0; i < 3; i++) {
    g.add(box(2.8, 0.14, 0.29, wood, 0, 0.85, -0.33 + i * 0.33));
    g.add(box(2.8, 0.22, 0.12, woodLight, 0, 1.08 + i * 0.25, -0.47));
  }
  return finish(g);
}

export function marketStall({ seed = 1, colors = [0xd94f45, 0xf5bc3c] } = {}) {
  const g = new THREE.Group(), random = rng(seed);
  g.add(box(4.5, 1.25, 2.2, woodDark, 0, 0.63, 0));
  for (let i = 0; i < 10; i++) g.add(box(0.42, 1.18, 0.06, i % 2 ? wood : woodLight, -2 + i * 0.445, 0.65, 1.13));
  for (const x of [-2.1, 2.1]) for (const z of [-0.9, 0.9]) g.add(box(0.15, 3.35, 0.15, woodDark, x, 1.68, z));
  g.add(box(4.8, 0.17, 2.5, woodLight, 0, 1.32, 0));
  for (let i = 0; i < 8; i++) {
    const fabric = M(colors[i % colors.length], { side: THREE.DoubleSide });
    const canopy = box(0.66, 0.1, 3.05, fabric, -2.31 + i * 0.66, 3.3, 0);
    canopy.rotation.x = 0.14;
    g.add(canopy, box(0.66, 0.34, 0.07, fabric, -2.31 + i * 0.66, 2.93, 1.5));
  }
  for (let bin = 0; bin < 3; bin++) {
    g.add(box(1.36, 0.24, 1.8, wood, (bin - 1) * 1.5, 1.5, 0));
    const fruit = M([0xefac26, 0x76a943, 0xd85447][bin]);
    for (let i = 0; i < 15; i++) {
      g.add(mesh(new THREE.IcosahedronGeometry(0.19 + random() * 0.07, 1), fruit,
        (bin - 1) * 1.5 + (random() - 0.5) * 1.04, 1.72 + random() * 0.18, (random() - 0.5) * 1.35));
    }
  }
  return finish(g);
}

export function streetLamp() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.3, 0.45, 8), iron, 0, 0.225, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.12, 3.8, 8), iron, 0, 1.9, 0));
  const glass = M(0xffe2a0, { emissive: 0xffbb45, emissiveIntensity: 0.35 });
  g.add(box(0.51, 0.73, 0.51, glass, 0, 4, 0));
  for (const x of [-0.28, 0.28]) for (const z of [-0.28, 0.28]) g.add(box(0.07, 0.82, 0.07, iron, x, 4, z));
  g.add(mesh(new THREE.ConeGeometry(0.52, 0.35, 4), iron, 0, 4.56, 0));
  g.add(box(0.7, 0.12, 0.7, iron, 0, 3.57, 0));
  return finish(g);
}

export const createPlazaProp = (id, options) => {
  const factory = { barrel, crate, cooler, planter, bench }[id];
  if (!factory) throw new Error(`Unknown plaza prop: ${id}`);
  return factory(options);
};
