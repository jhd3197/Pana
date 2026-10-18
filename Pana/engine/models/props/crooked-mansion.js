// Haunted hilltop mansion: each block leans a little, shutters hang loose and a
// few windows glow. Porch faces +Z; the optional fence stands 13 m in front.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { Kit, T, C, I, V, CYL6, lantern, pumpkin, fenceLine, pillar } from '/engine/models/props/cemetery-kit.js';

export function crookedMansion({ seed = 1, fence = true, light = false } = {}) {
  const k = new Kit(), R = rng(seed), P = I;
  k.box('stoneD', P, 0, 0.4, 0, 22, 0.8, 14);
  const Mb = C(P, T(0, 0, 0, 0, 0, 0.015));
  k.box('wall', Mb, 0, 4.4, 0, 15, 7.2, 10);
  k.box('trim', Mb, 0, 4.2, 5.05, 15.2, 0.25, 0.15); k.box('trim', Mb, 0, 8.05, 0, 15.6, 0.3, 10.6);
  const win = (Q, x, y, z, lit) => {
    k.box(lit ? 'winY' : 'winD', Q, x, y, z, 1.1, 1.7, 0.06); k.box('trim', Q, x, y + 0.95, z + 0.02, 1.4, 0.18, 0.12);
    k.box('trim', Q, x, y - 0.95, z + 0.04, 1.4, 0.14, 0.2); k.box('trim', Q, x, y, z + 0.03, 0.07, 1.7, 0.04); k.box('trim', Q, x, y + 0.25, z + 0.03, 1.1, 0.06, 0.04);
    if (R() < 0.5) { const sx = R() < 0.5 ? -1 : 1; k.box('woodD', Q, x + sx * 0.85, y - (R() < 0.3 ? 0.3 : 0), z + 0.05, 0.5, 1.7, 0.05, 0, 0, R() < 0.3 ? sx * 0.35 : 0); }
  };
  for (const y of [2.6, 6.1]) for (const x of [-5.6, -2.8, 2.8, 5.6]) win(Mb, x, y, 5.02, R() < 0.4);
  for (const x of [-5.6, -2.8, 0, 2.8, 5.6]) win(C(Mb, T(0, 0, 0, 0, Math.PI)), x, 6.1, 5.02, R() < 0.2);
  for (const s of [-1, 1]) for (const z of [-2.5, 2.5]) win(C(Mb, T(0, 0, 0, 0, s * Math.PI / 2)), z, 6.1, 7.52, R() < 0.3);
  // Main roof, gable ends, front dormer and leaning chimneys.
  const ra = 0.62, rl = 5 / Math.cos(ra) + 0.7;
  for (const s of [-1, 1]) k.box('slate', Mb, 0, 10.15, s * 2.55, 15.8, 0.28, rl, s * ra);
  for (const s of [-1, 1]) {
    const tri = new THREE.Shape(); tri.moveTo(-5, 0); tri.lineTo(5, 0); tri.lineTo(0, 3.6); tri.closePath();
    k.extrude('wall', C(Mb, T(0, 0, 0, 0, Math.PI / 2)), tri, 0.4, 0, 8.2, s * 7.3);
  }
  k.box('slateD', Mb, 0, 11.8, 0, 15.9, 0.25, 0.4);
  const dorm = new THREE.Shape(); dorm.moveTo(-2.4, 0); dorm.lineTo(2.4, 0); dorm.lineTo(0, 2.6); dorm.closePath();
  k.extrude('wallL', Mb, dorm, 0.4, 0, 8.2, 5.1); k.box('winY', Mb, 0, 9.2, 5.32, 0.8, 1, 0.04);
  for (const s of [-1, 1]) k.box('slate', Mb, s * 1.25, 9.5, 4.2, 2.9, 0.22, 2.4, 0, 0, -s * 0.82);
  for (const [cx, cz, h] of [[-5.5, -1.5, 4.5], [4.8, 1.8, 3.6]]) { k.box('stoneD', Mb, cx, 10.5 + h / 2, cz, 1.1, h, 1.1, 0, 0, R() * 0.08); k.box('stone', Mb, cx, 10.6 + h, cz, 1.35, 0.3, 1.35); }
  // Lower side wing leaning the other way.
  const Wg = C(P, T(-10.5, 0, 1, 0, 0, -0.02));
  k.box('wallL', Wg, 0, 3, 0, 7, 5.4, 8);
  for (const x of [-1.6, 1.6]) win(Wg, x, 3.2, 4.02, R() < 0.4);
  for (const s of [-1, 1]) k.box('slate', Wg, 0, 7.25, s * 2.1, 7.6, 0.25, 4.9, s * 0.65);
  // Round tower with a witch-hat roof and weathervane.
  const Tw = C(P, T(8.2, 0, 4.2, 0, 0, 0.03));
  k.cyl('wallL', Tw, 0, 7.5, 0, 2.6, 15, 0, 0, 0, new THREE.CylinderGeometry(1, 1, 1, 10));
  for (const y of [2.8, 6.8, 10.8]) for (const a of [0.3, 1.6, -1.0]) { const Q = C(Tw, T(0, 0, 0, 0, a)); k.box(R() < 0.5 ? 'winY' : 'winD', Q, 0, y, 2.58, 0.9, 1.5, 0.08); k.box('trim', Q, 0, y + 0.85, 2.6, 1.2, 0.16, 0.16); }
  k.cyl('trim', Tw, 0, 15.1, 0, 2.9, 0.35);
  k.add('slate', new THREE.ConeGeometry(1, 1, 10), C(Tw, T(0, 19.6, 0, 0, 0, 0.04, 3.1, 8.8, 3.1)));
  k.box('iron', Tw, 0, 24.4, 0, 0.08, 1.6, 0.08); k.box('iron', Tw, 0.25, 24.7, 0, 0.5, 0.25, 0.03);
  // Porch, steps, door and cobweb.
  k.box('woodD', P, 0, 0.95, 7, 8, 0.3, 4);
  for (let i = 0; i < 3; i++) k.box('stoneD', P, 0, 0.25 + i * 0.3, 9.4 - i * 0.45, 4, 0.3 + i * 0.3, 1);
  for (const sx of [-3.6, -1.2, 1.2, 3.6]) k.cyl('trim', P, sx, 2.6, 8.7, 0.16, 3.2, 0, 0, 0, CYL6);
  k.box('slate', P, 0, 4.5, 7.2, 8.6, 0.25, 4.4, -0.22);
  for (let i = -3; i <= 3; i++) if (i !== 0) k.box('woodL', P, i * 0.6, 1.55, 8.75, 0.07, 0.9, 0.07);
  k.box('woodL', P, 0, 2.0, 8.75, 8, 0.1, 0.1);
  k.box('woodD', P, 0, 2.3, 5.08, 1.5, 2.6, 0.08);
  k.box('winY', P, 0, 3.75, 5.08, 1.4, 0.4, 0.05);
  lantern(k, P, 1.8, 3.2, 8.3);
  for (const sx of [-1.5, 1.5]) pumpkin(k, P, sx, 1.1, 8.2, 0.5, { lit: true });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI / 2; k.beam('bone', V(-3.6, 4.1, 8.7), V(-3.6 + Math.cos(a) * 1.2, 4.1 - Math.sin(a) * 1.2, 8.7), 0.012, CYL6); }
  for (const r of [0.4, 0.8]) for (let i = 0; i < 5; i++) {
    const a0 = i / 6 * Math.PI / 2, a1 = (i + 1) / 6 * Math.PI / 2;
    k.beam('bone', V(-3.6 + Math.cos(a0) * r, 4.1 - Math.sin(a0) * r, 8.7), V(-3.6 + Math.cos(a1) * r, 4.1 - Math.sin(a1) * r, 8.7), 0.01, CYL6);
  }
  if (fence) {
    fenceLine(k, V(-16, 0, 13), V(-3, 0, 13), R, 0.05); fenceLine(k, V(3, 0, 13), V(16, 0, 13), R, 0.05);
    pillar(k, -2.4, 0, 13, 2.4, 'skull'); pillar(k, 2.4, 0, 13, 2.4, 'skull');
  }
  return k.done('crooked-mansion', light);
}
