// Expedition camp pieces from ¡Embuste!, shared with Studio. Metres, +Y up,
// grounded at y = 0, facing +Z. Moving parts are exposed on userData.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';

const WOOD = M(0x6b4a30, { roughness: 0.9 }), DARK = M(0x3b2a1d, { roughness: 1 }), IRON = M(0x3a3f3d, { metalness: 0.5, roughness: 0.5 });
const BRASS = M(0xc9a04f, { metalness: 0.6, roughness: 0.35 }), ROPE = M(0xc9a96e, { flatShading: false, roughness: 1 });
const CANVAS = M(0xb9a27a, { side: THREE.DoubleSide, roughness: 1 });

// The camp's meeting bell on a wooden frame; userData.bell swings.
export function campBell() {
  const g = new THREE.Group(); g.name = 'Campana del campamento';
  for (const s of [-1, 1]) { g.add(tube([s * 0.55, 0, 0], [s * 0.38, 2.05, 0], 0.07, WOOD)); g.add(box(0.2, 0.12, 0.5, DARK, s * 0.55, 0.06, 0)); }
  g.add(box(1.05, 0.12, 0.16, WOOD, 0, 2.06, 0));
  const bell = new THREE.Group(); bell.position.set(0, 2, 0); g.add(bell);
  const shell = mesh(new THREE.CylinderGeometry(0.13, 0.3, 0.42, 14, 1, true), BRASS, 0, -0.32, 0); shell.material = M(0xc9a04f, { metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }); bell.add(shell);
  bell.add(mesh(new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), BRASS, 0, -0.11, 0));
  bell.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), IRON, 0, -0.5, 0));
  bell.add(tube([0, -0.5, 0], [0.12, -1.35, 0.1], 0.015, ROPE));
  g.userData.bell = bell;
  g.userData.ring = (t, amount = 1) => { bell.rotation.z = Math.sin(t * 14) * 0.35 * amount; };
  return g;
}

// Field radio on a folding table, antenna up; userData.dial turns.
export function radioSet() {
  const g = new THREE.Group(); g.name = 'Radio de campaña';
  g.add(box(1.5, 0.08, 0.8, WOOD, 0, 0.82, 0));
  for (const x of [-0.65, 0.65]) for (const z of [-0.32, 0.32]) g.add(tube([x, 0, z], [x * 0.92, 0.8, z * 0.9], 0.035, DARK));
  const body = M(0x4a5a3c, { roughness: 0.7 });
  g.add(box(0.9, 0.45, 0.45, body, 0, 1.09, -0.05));
  g.add(box(0.5, 0.2, 0.02, M(0xd8d2a8, { emissive: 0x6a6436, emissiveIntensity: 0.6 }), -0.12, 1.15, 0.18));
  const dial = new THREE.Group(); dial.position.set(0.28, 1.12, 0.19); g.add(dial);
  const knob = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), IRON); knob.rotation.x = Math.PI / 2; dial.add(knob);
  dial.add(box(0.02, 0.06, 0.02, BRASS, 0, 0.04, 0.03));
  g.add(tube([0.35, 1.3, -0.2], [0.42, 2.5, -0.25], 0.012, IRON));
  g.add(mesh(new THREE.SphereGeometry(0.03, 6, 4), M(0xff5b45, { emissive: 0xff2a10, emissiveIntensity: 1 }), 0.42, 2.52, -0.25));
  g.add(box(0.3, 0.06, 0.2, DARK, -0.45, 0.89, 0.15));
  g.userData.dial = dial;
  return g;
}

// River dam: two stone piers and a wooden sluice gate; userData.gate slides.
export function damGate() {
  const g = new THREE.Group(); g.name = 'Compuerta del río';
  const stone = M(0x6e7466, { roughness: 1 });
  for (const s of [-1, 1]) { g.add(box(0.7, 2.2, 1.2, stone, s * 1.35, 1.1, 0)); g.add(box(0.8, 0.15, 1.3, M(0x8a8c78), s * 1.35, 2.25, 0)); }
  g.add(box(3.4, 0.2, 0.3, WOOD, 0, 2.45, 0));
  const gate = new THREE.Group(); g.add(gate);
  for (let i = 0; i < 6; i++) gate.add(box(2, 0.3, 0.14, i % 2 ? WOOD : DARK, 0, 0.2 + i * 0.32, 0));
  g.add(tube([0, 2.55, 0], [0, 3.1, 0], 0.05, IRON));
  const wheel = mesh(new THREE.TorusGeometry(0.32, 0.04, 6, 16), IRON, 0, 3.15, 0); g.add(wheel);
  g.userData.gate = gate; g.userData.wheel = wheel;
  g.userData.setOpen = (k) => { gate.position.y = k * 1.6; wheel.rotation.z = k * Math.PI * 4; };
  return g;
}

// Sleeping tent, open at the front (+Z).
export function campTent({ color = 0xb9a27a } = {}) {
  const g = new THREE.Group(); g.name = 'Carpa de expedición';
  const cloth = color === 0xb9a27a ? CANVAS : M(color, { side: THREE.DoubleSide, roughness: 1 });
  const shape = new THREE.Shape([new THREE.Vector2(-1.3, 0), new THREE.Vector2(0, 1.7), new THREE.Vector2(1.3, 0)]);
  const body = new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: false }); body.translate(0, 0, -1.3);
  const tent = mesh(body, cloth); tent.scale.set(1, 1, 1); g.add(tent);
  g.add(mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.75, 0), new THREE.Vector2(0, 1.25), new THREE.Vector2(0.75, 0)])), M(0x1d1712, { side: THREE.DoubleSide }), 0, 0.01, 1.31));
  g.add(tube([0, 0, 1.35], [0, 1.75, 1.35], 0.04, DARK)); g.add(tube([0, 0, -1.35], [0, 1.75, -1.35], 0.04, DARK));
  for (const s of [-1, 1]) g.add(tube([0, 1.7, s * 1.35], [s * 0.2, 0, s * 2.1], 0.012, ROPE));
  return g;
}
