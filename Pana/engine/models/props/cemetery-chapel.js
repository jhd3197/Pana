// Ruined gothic chapel: rose window, stained glass, a collapsed roof bay and a
// spired bell tower in front of the +Z door.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { Kit, T, C, I, CONE4, TOR, gothicShape, candle, pumpkin, coffin } from '/engine/models/props/cemetery-kit.js';

export function cemeteryChapel({ seed = 1, props = true, light = false } = {}) {
  const k = new Kit(), R = rng(seed), P = I, L = 15, W = 7.6, Hh = 6.5;
  k.box('stoneD', P, 0, 0.3, 0, W + 1, 0.6, L + 1);
  k.box('wall', P, -W / 2 + 0.25, Hh / 2 + 0.5, 0, 0.5, Hh, L); k.box('wall', P, W / 2 - 0.25, Hh / 2 + 0.5, 0, 0.5, Hh, L);
  k.box('wall', P, 0, Hh / 2 + 0.5, -L / 2 + 0.25, W, Hh, 0.5);
  // Front gable with a pointed doorway and a rose-window opening.
  const fw = new THREE.Shape(); fw.moveTo(-W / 2, 0); fw.lineTo(-1, 0); fw.lineTo(-1, 2.6); fw.quadraticCurveTo(-1, 3.7, 0, 4.2); fw.quadraticCurveTo(1, 3.7, 1, 2.6); fw.lineTo(1, 0);
  fw.lineTo(W / 2, 0); fw.lineTo(W / 2, Hh); fw.lineTo(0, Hh + 3.6); fw.lineTo(-W / 2, Hh); fw.closePath();
  const rose = new THREE.Path(); rose.absarc(0, Hh + 0.9, 0.95, 0, Math.PI * 2, true); fw.holes.push(rose);
  k.extrude('wall', P, fw, 0.5, 0, 0.5, L / 2 - 0.25);
  k.cyl('stainA', P, 0, Hh + 1.4, L / 2 - 0.3, 0.95, 0.06, Math.PI / 2);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.box('trim', P, Math.cos(a) * 0.5, Hh + 1.4 + Math.sin(a) * 0.5, L / 2 - 0.22, 0.9, 0.07, 0.07, 0, 0, a); }
  k.add('trim', TOR, C(P, T(0, Hh + 1.4, L / 2 - 0.2, 0, 0, 0, 0.98, 0.98, 1)));
  const back = new THREE.Shape(); back.moveTo(-W / 2, 0); back.lineTo(W / 2, 0); back.lineTo(0, 3.6); back.closePath();
  k.extrude('wall', P, back, 0.5, 0, Hh + 0.5, -L / 2 + 0.25);
  k.extrude('woodD', P, gothicShape(1, 2.6), 0.12, 0, 0.5, L / 2 - 0.4);
  k.add('iron', TOR, C(P, T(0.4, 1.9, L / 2 - 0.3, 0, 0, 0, 0.12, 0.12, 0.6)));
  // Stained-glass lancets between buttresses.
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    const zz = -L / 2 + 2.2 + i * 3.4, glass = ['stainA', 'stainB', 'stainC'][(i + (sx > 0 ? 1 : 0)) % 3];
    k.extrude(glass, P, gothicShape(0.55, 2.2), 0.08, sx * (W / 2 + 0.02), 2.2, zz, 0, Math.PI / 2);
    k.extrude('trim', P, gothicShape(0.7, 2.2), 0.04, sx * (W / 2 + 0.06), 2.05, zz, 0, Math.PI / 2);
    k.box('wallL', P, sx * (W / 2 + 0.45), 2.2, zz + 1.7, 0.9, 4.4, 0.7);
    k.box('wallL', P, sx * (W / 2 + 0.3), 4.9, zz + 1.7, 0.6, 1.2, 0.6, 0, 0, sx * 0.3);
  }
  // Slate roof with one fallen bay: broken rafters and rubble inside.
  const ra = 0.72, rl = W / 2 / Math.cos(ra) + 0.6;
  for (let seg = 0; seg < 5; seg++) {
    if (seg === 1) continue;
    for (const sx of [-1, 1]) k.box('slate', P, sx * W / 4, Hh + 2.3, -L / 2 + 1.5 + seg * 3, rl, 0.25, 3.05, 0, 0, -sx * ra);
  }
  for (let i = 0; i < 4; i++) k.box('woodD', P, (R() - 0.5) * W * 0.7, Hh + 1.2, -L / 2 + 4.5 + (R() - 0.5) * 1.6, 0.18, 0.18, W * 0.9, 0.3, R() * 0.6 + 0.8, 0.2);
  k.box('slateD', P, 0, Hh + 3.65, 0, 0.35, 0.3, L + 0.3);
  for (let i = 0; i < 10; i++) k.rock('slate', P, (R() - 0.5) * W * 0.6, 0.7, -L / 2 + 4.5 + (R() - 0.5) * 2, 0.35, R);
  // Bell tower.
  const tz = L / 2 + 1.6;
  k.box('wallL', P, 0, 5.5, tz, 3.6, 11, 3.2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('wall', P, sx * 1.8, 5.5, tz + sz * 1.6, 0.5, 11, 0.5);
  k.box('trim', P, 0, 11.1, tz, 4, 0.35, 3.6);
  for (let i = 0; i < 4; i++) k.extrude('niche', C(P, T(0, 0, tz, 0, i * Math.PI / 2)), gothicShape(0.6, 1.4), 0.1, 0, 8.2, 1.61);
  const bell = new THREE.CylinderGeometry(0.3, 0.75, 1.1, 12); k.add('bronze', bell, C(P, T(0, 9.2, tz))); bell.dispose();
  k.add('slate', CONE4, C(P, T(0, 15.4, tz, 0, 0, 0, 2.7, 8.4, 2.4)));
  k.box('iron', P, 0, 20.1, tz, 0.1, 1.5, 0.1); k.box('iron', P, 0, 20.3, tz, 0.7, 0.1, 0.1);
  k.light(P, 0, 3, 0, '#a27aff', 1.2, 14);
  if (props) {
    for (let i = 0; i < 8; i++) candle(k, P, -1.6 + R() * 3.2, 0.6, L / 2 + 0.6 + R() * 0.8, R);
    for (const sx of [-2.4, 2.4]) pumpkin(k, P, sx, 0.6, L / 2 + 0.9, 0.5, { lit: true });
    coffin(k, P, W / 2 + 1.1, 0, 2, 0.15, false); coffin(k, P, W / 2 + 1.6, 0, -1.5, -0.2, true);
  }
  return k.done('cemetery-chapel', light);
}
