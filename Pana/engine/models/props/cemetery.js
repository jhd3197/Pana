// Foggy-cemetery pack: graves, crypts, iron fences, lanterns and swamp pieces.
// Ground origin y=0, fronts face +Z. Glowing parts are unlit; `light` adds
// flickering point lights for scenes that can afford them.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { sign } from '/engine/models/core/architecture-kit.js';
import {
  Kit, T, C, I, V, CYL6, CYL4, CONE, CONE4, SPH, DOD, TOR, COLORS,
  gothicShape, candle, pumpkin as pumpkinParts, skull as skullParts, coffin as coffinParts,
  lantern, fenceLine, pillar,
} from '/engine/models/props/cemetery-kit.js';

export { gothicShape };

const GRAVE_TYPES = ['headstone', 'celtic', 'obelisk', 'ledger', 'wooden'];

export function grave({ type = 'headstone', seed = 1, extras = true, tilt = true } = {}) {
  const k = new Kit(), R = rng(seed), t = GRAVE_TYPES.includes(type) ? type : 'headstone';
  const P = tilt ? T(0, 0, 0, (R() - 0.5) * 0.18, (R() - 0.5) * 0.3, (R() - 0.5) * 0.2) : I;
  const key = R() < 0.5 ? 'stone' : (R() < 0.5 ? 'stoneL' : 'stoneD');
  if (t === 'headstone') {
    k.box(key, P, 0, 0.55, 0, 0.9, 1.1, 0.2); k.cyl(key, P, 0, 1.1, 0, 0.45, 0.2, Math.PI / 2);
    for (let i = 0; i < 3; i++) k.box('stoneD', P, 0, 0.85 - i * 0.16, 0.105, 0.5 - i * 0.08, 0.05, 0.02);
    k.box('stoneD', P, 0, 1.15, 0.105, 0.08, 0.3, 0.02); k.box('stoneD', P, 0, 1.18, 0.105, 0.22, 0.06, 0.02);
  } else if (t === 'celtic') {
    k.box(key, P, 0, 0.15, 0, 0.6, 0.3, 0.4); k.box(key, P, 0, 0.95, 0, 0.18, 1.5, 0.18); k.box(key, P, 0, 1.2, 0, 0.85, 0.18, 0.18);
    k.add(key, TOR, C(P, T(0, 1.2, 0, 0, 0, 0, 0.28, 0.28, 0.9)));
  } else if (t === 'obelisk') {
    k.box(key, P, 0, 0.2, 0, 0.8, 0.4, 0.8); k.add(key, CYL4, C(P, T(0, 1.5, 0, 0, 0, 0, 0.25, 2.2, 0.25))); k.add(key, CONE4, C(P, T(0, 2.75, 0, 0, 0, 0, 0.19, 0.3, 0.19)));
  } else if (t === 'ledger') {
    k.box(key, P, 0, 0.3, 0.4, 1.2, 0.6, 2.2); k.box('stoneL', P, 0, 0.66, 0.4, 1.32, 0.12, 2.32);
    k.box('stoneD', P, 0, 0.76, 0.4, 0.12, 0.06, 1.4); k.box('stoneD', P, 0, 0.76, 0.1, 0.6, 0.06, 0.12);
  } else {
    k.box('wood', P, 0, 0.7, 0, 0.12, 1.4, 0.1, 0, 0, 0.08); k.box('wood', P, 0, 1.05, 0, 0.6, 0.1, 0.1, 0, 0, 0.08);
  }
  if (t !== 'ledger' && t !== 'wooden') k.add('dirt', SPH, C(P, T(0, 0.02, 1.15, 0, 0, 0, 0.55, 0.18, 1.0)));
  if (extras) {
    if (R() < 0.35) k.box('moss', P, 0, t === 'headstone' ? 1.22 : 0.33, 0, 0.5, 0.06, 0.25);
    if (R() < 0.3) for (let i = 0; i < 3; i++) candle(k, P, -0.35 + i * 0.32, 0, 0.35 + R() * 0.2, R);
    if (R() < 0.15) pumpkinParts(k, P, 0.6, 0, 0.6, 0.35, { lit: true, ry: R() - 0.5 });
    if (R() < 0.4) k.add('leaves', DOD, C(P, T(R() - 0.5, 0.1, 0.9, R(), R(), R(), 0.25, 0.1, 0.25)));
  }
  return k.done(`grave-${t}`);
}

export function pumpkin({ size = 0.6, lit = true, face = true, seed = 1, light = false } = {}) {
  const k = new Kit(), R = rng(seed);
  pumpkinParts(k, I, 0, 0, 0, size, { lit, face, ry: (R() - 0.5) * 0.3 });
  return k.done('pumpkin', light && lit);
}

export function skull({ size = 0.5 } = {}) {
  const k = new Kit(); skullParts(k, I, 0, 0, 0, size); return k.done('skull');
}

export function graveCandles({ count = 5, seed = 1 } = {}) {
  const k = new Kit(), R = rng(seed);
  for (let i = 0; i < count; i++) { const a = R() * Math.PI * 2, r = R() * 0.45; candle(k, I, Math.cos(a) * r, 0, Math.sin(a) * r, R); }
  return k.done('grave-candles');
}

export function coffin({ open = false } = {}) {
  const k = new Kit(); coffinParts(k, I, 0, 0, 0, 0, open); return k.done(open ? 'coffin-open' : 'coffin');
}

// Fence runs along X, centred on the origin.
export function ironFence({ length = 8, seed = 1, broken = 0.08 } = {}) {
  const k = new Kit(); fenceLine(k, V(-length / 2, 0, 0), V(length / 2, 0, 0), rng(seed), broken); return k.done('iron-fence');
}

export function stonePillar({ height = 2.4, top = 'urn', light = false } = {}) {
  const k = new Kit(); pillar(k, 0, 0, 0, height, top); return k.done('stone-pillar', light);
}

export function cemeteryLantern({ light = false } = {}) {
  const k = new Kit(); lantern(k, I, 0, 0.31, 0); k.box('iron', I, 0, 0.62, 0, 0.03, 0.3, 0.03); k.add('iron', TOR, T(0, 0.82, 0, 0, 0, 0, 0.08, 0.08, 0.4));
  return k.done('cemetery-lantern', light);
}

export function cemeteryLampPost({ light = false } = {}) {
  const k = new Kit();
  k.box('iron', I, 0, 0.15, 0, 0.5, 0.3, 0.5);
  k.cyl('iron', I, 0, 1.8, 0, 0.07, 3.4, 0, 0, 0, CYL6);
  k.box('iron', I, 0.35, 3.45, 0, 0.75, 0.06, 0.06);
  k.add('iron', TOR, T(0.25, 3.2, 0, 0, 0, 0, 0.22, 0.22, 0.5));
  lantern(k, I, 0.7, 3.0, 0);
  return k.done('cemetery-lamp-post', light);
}

export function mausoleum({ door = 'dark', seed = 1, pumpkins = true, light = false } = {}) {
  const k = new Kit(), R = rng(seed), P = I;
  for (let i = 0; i < 3; i++) k.box('stoneD', P, 0, 0.12 + i * 0.24, 1.1 - i * 0.35, 5.6 - i * 0.4, 0.24, 7.6 - i * 0.7);
  k.box('stone', P, 0, 2.65, -0.5, 4.6, 3.4, 5.6);
  for (const sx of [-1.7, -0.6, 0.6, 1.7]) { k.cyl('stoneL', P, sx, 2.3, 2.6, 0.22, 3.0); k.box('stoneL', P, sx, 0.88, 2.6, 0.55, 0.2, 0.55); k.box('stoneL', P, sx, 3.88, 2.6, 0.6, 0.2, 0.6); }
  k.box('stoneL', P, 0, 4.15, 0.4, 5.2, 0.35, 6.4);
  const tri = new THREE.Shape(); tri.moveTo(-2.7, 0); tri.lineTo(2.7, 0); tri.lineTo(0, 1.3); tri.closePath();
  k.extrude('stoneL', P, tri, 0.4, 0, 4.32, 3.35);
  k.box('slate', P, -1.25, 4.95, 0.4, 2.85, 0.18, 6.6, 0, 0, 0.44); k.box('slate', P, 1.25, 4.95, 0.4, 2.85, 0.18, 6.6, 0, 0, -0.44);
  k.cyl('stoneL', P, 0, 4.85, 3.55, 0.35, 0.08, Math.PI / 2);
  k.add('stoneL', SPH, C(P, T(0, 5.8, 3.1, 0, 0, 0, 0.3, 0.4, 0.3)));
  const dw = 0.85, dh = 1.9;
  if (door === 'glow') {
    k.extrude('green', P, gothicShape(dw, dh), 0.05, 0, 0.74, 2.33);
    k.box('iron', P, -0.55, 1.95, 2.5, 0.85, 2.5, 0.08, 0, 0.9, 0);
    k.light(P, 0, 1.8, 3.2, '#59ff9a', 1.4, 13);
    for (let i = 0; i < 5; i++) candle(k, P, -1.6 + R() * 3.2, 0.74, 2.85 + R() * 0.5, R);
  } else {
    k.extrude('niche', P, gothicShape(dw, dh), 0.05, 0, 0.74, 2.33);
    if (door === 'barred') {
      for (let i = -3; i <= 3; i++) k.box('iron', P, i * 0.24, 1.95, 2.4, 0.05, 2.4, 0.05);
      for (const h of [1.2, 2.4]) k.box('iron', P, 0, h, 2.4, 1.6, 0.05, 0.05);
    } else k.box('woodD', P, 0, 1.55, 2.38, 1.5, 1.6, 0.06);
  }
  k.box('stoneD', P, 0, 3.5, 2.33, 1.8, 0.3, 0.06);
  for (const sx of [-1, 1]) if (R() < 0.6) k.box('moss', P, sx * 1.5, 4.36, 0, 1.6, 0.08, 4);
  if (pumpkins) for (const sx of [-2.4, 2.4]) pumpkinParts(k, P, sx, 0.74, 3.2, 0.45, { lit: R() < 0.6 });
  return k.done(`mausoleum-${door}`, light);
}

// Open pit with a coffin beside it, a mound of dug earth and a shovel.
export function openGrave({ seed = 1 } = {}) {
  const k = new Kit(), R = rng(seed);
  k.box('niche', I, 0, 0.03, 0, 1.2, 0.06, 2.3);
  for (let i = 0; i < 7; i++) k.rock('dirt', I, 1.6 + (R() - 0.5) * 0.8, 0.3, (R() - 0.5) * 1.6, 0.5, R);
  coffinParts(k, I, -1.6, 0, 0, 0.2, R() < 0.5);
  k.add('woodL', CYL6, T(1.2, 1, 1.2, 0.4, 0, -0.4, 0.035, 1.6, 0.035));
  k.box('iron', I, 1.55, 0.25, 1.55, 0.3, 0.4, 0.05, 0.4, 0.8, -0.4);
  return k.done('open-grave');
}

// Entrance with skull pillars, an iron arch sign and two swung-open gates.
export function cemeteryGate({ text = 'CEMENTERIO', walls = 6, seed = 1, light = false } = {}) {
  const k = new Kit(), R = rng(seed);
  pillar(k, -3.4, 0, 0, 4, 'skull'); pillar(k, 3.4, 0, 0, 4, 'skull');
  const arch = new THREE.Shape(); arch.absarc(0, 0, 3.4, 0, Math.PI, false); arch.lineTo(-3.2, 0); arch.absarc(0, 0, 3.2, Math.PI, 0, true); arch.closePath();
  k.extrude('iron', I, arch, 0.08, 0, 4.3, 0);
  for (const sx of [-1, 1]) k.beam('iron', V(sx * 1.6, 5.25, 0), V(sx * 1.9, 6.6, 0), 0.04);
  for (const [sx, ang] of [[-1, -0.9], [1, 0.25]]) {
    const P = T(sx * 2.9, 0, 0, 0, ang * sx);
    for (let i = 0; i < 7; i++) { const x = -sx * (0.1 + i * 0.4); k.box('iron', P, x, 1.7, 0, 0.05, 3.2, 0.05); k.add('iron', CONE4, C(P, T(x, 3.4, 0, 0, 0, 0, 0.07, 0.25, 0.07))); }
    for (const h of [0.4, 1.6, 2.9]) k.box('iron', P, -sx * 1.3, h, 0, 2.7, 0.06, 0.06);
    k.add('iron', TOR, C(P, T(-sx * 1.3, 2.25, 0, 0, 0, 0, 0.4, 0.4, 0.5)));
  }
  for (const sx of [-1, 1]) for (let x = 4.6; x < 4 + walls; x += 1.4) {
    if (R() < 0.12) continue;
    const h = 0.8 + R() * 1.6;
    k.box(R() < 0.5 ? 'stone' : 'stoneD', I, sx * x, h / 2, 0, 1.4, h, 0.7, (R() - 0.5) * 0.05, 0, (R() - 0.5) * 0.05);
  }
  for (const sx of [-1, 1]) pumpkinParts(k, I, sx * 4.6, 0, 1.5, 0.7, { lit: true });
  const out = k.done('cemetery-gate', light);
  const board = sign(text, 4.6, 0.86, { background: '#1d1a22', color: '#d9d2e6' });
  board.position.set(0, 5.7, 0.06); out.add(board);
  const map = board.material.map;
  out.userData.dispose = () => { map.dispose(); board.material.dispose(); board.geometry.dispose(); };
  return out;
}

export function scarecrow({ seed = 1, light = false } = {}) {
  const k = new Kit(), P = I;
  k.box('woodD', P, 0, 1.6, 0, 0.14, 3.2, 0.14); k.box('woodD', P, 0, 2.4, 0, 2.4, 0.12, 0.12);
  k.box('sack', P, 0, 2.15, 0, 0.8, 1.0, 0.35); k.add('sack', CONE, C(P, T(0, 1.45, 0, 0, 0, 0, 0.55, 0.5, 0.3)));
  for (const sx of [-1, 1]) {
    k.box('sack', P, sx * 0.85, 2.4, 0, 0.7, 0.26, 0.26);
    for (let i = 0; i < 4; i++) k.add('hay', CONE, C(P, T(sx * 1.28, 2.38, 0, 0, 0, sx * (1.4 + i * 0.15), 0.06, 0.32, 0.06)));
  }
  pumpkinParts(k, P, 0, 2.65, 0, 0.42, { lit: true, ry: (rng(seed)() - 0.5) * 0.4 });
  k.add('slateD', CONE, C(P, T(0, 3.55, 0, 0.1, 0, 0.1, 0.32, 0.75, 0.32))); k.cyl('slateD', P, 0, 3.2, 0, 0.6, 0.05);
  return k.done('scarecrow', light);
}

export function graveyardWell({ seed = 1 } = {}) {
  const k = new Kit(), R = rng(seed);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; k.box(i % 2 ? 'stone' : 'stoneD', I, Math.cos(a) * 1.1, 0.45, Math.sin(a) * 1.1, 0.6, 0.9, 0.4, 0, -a, 0); }
  k.cyl('niche', I, 0, 0.85, 0, 0.9, 0.05);
  for (const s of [-1, 1]) k.box('woodD', I, s * 1.2, 1.4, 0, 0.18, 2.8, 0.18);
  k.box('woodD', I, 0, 2.6, 0, 2.8, 0.16, 0.16); k.cyl('woodL', I, 0, 2.2, 0, 0.15, 1.8, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) k.box('slate', I, 0, 3.1, s * 0.55, 3, 0.12, 1.3, s * 0.6);
  k.beam('hay', V(0, 2.2, 0), V(0, 1.3, 0), 0.02, CYL6); k.cyl('woodD', I, 0, 1.1, 0, 0.18, 0.35, 0, 0, 0, CYL6);
  if (R() < 0.7) k.rock('moss', I, 1.4, 0.1, 0.6, 0.3, R);
  return k.done('graveyard-well');
}

// Swamp boardwalk along +X with a gentle S bend; stilts sink to y=-depth.
export function boardwalk({ length = 16, seed = 1, deck = 0.55, depth = 0.6 } = {}) {
  const k = new Kit(), R = rng(seed);
  const pts = Array.from({ length: 6 }, (_, i) => V(-length / 2 + length * i / 5, 0, Math.sin(i * 1.3 + seed) * length * 0.06));
  const curve = new THREE.CatmullRomCurve3(pts), n = Math.floor(curve.getLength() / 0.42), P2 = curve.getSpacedPoints(n);
  for (let i = 0; i <= n; i++) {
    const p = P2[i], q = P2[Math.min(n, i + 1)], r = P2[Math.max(0, i - 1)], ry = Math.atan2(q.x - r.x, q.z - r.z);
    const missing = R() < 0.07 && i % 6 !== 0;
    if (!missing) k.box(R() < 0.5 ? 'wood' : 'woodL', I, p.x, deck, p.z, 1.8, 0.08, 0.36, (R() - 0.5) * 0.08, ry, (R() - 0.5) * 0.08);
    if (i % 6 !== 0) continue;
    const s = V(Math.cos(ry), 0, -Math.sin(ry));
    for (const o of [-0.95, 0.95]) { const b = p.clone().addScaledVector(s, o); k.beam('woodD', V(b.x, -depth, b.z), V(b.x, deck + (o > 0 ? 1.0 : 0), b.z), 0.14, CYL6); }
    if (i + 6 <= n) {
      const b1 = p.clone().addScaledVector(s, 0.95), b2 = P2[i + 6].clone().addScaledVector(s, 0.95);
      k.beam('woodL', V(b1.x, deck + 0.95, b1.z), V(b2.x, deck + 0.95, b2.z), 0.06, CYL6);
    }
  }
  return k.done('boardwalk');
}

// Swamp shack on stilts; the stilts start at ground y=0.
export function stiltShack({ light = false } = {}) {
  const k = new Kit(), P = T(0, 1.4, 0);
  for (const sx of [-1.6, 1.6]) for (const sz of [-1.4, 1.4]) k.box('woodD', P, sx, 0.3, sz, 0.25, 3.4, 0.25);
  k.box('woodL', P, 0, 2.0, 0, 4, 0.15, 3.6);
  k.box('wood', P, 0, 3.4, 0, 3.6, 2.6, 3.0); k.box('woodD', P, -0.6, 3.1, 1.52, 0.9, 1.9, 0.05); k.box('winY', P, 0.9, 3.6, 1.52, 0.7, 0.6, 0.03);
  for (const s of [-1, 1]) k.box('slateD', P, 0, 5.0, s * 0.9, 4.2, 0.15, 2.2, s * 0.5);
  lantern(k, P, 1.9, 3.8, 1.9);
  for (let i = 0; i < 3; i++) k.add('hay', TOR, C(P, T(-1.5, 2.15 + i * 0.06, 1.4, Math.PI / 2, 0, 0, 0.3, 0.3, 0.4)));
  for (let i = 0; i < 5; i++) k.box('woodL', P, 2.25, 1.75 - i * 0.4, 0.6, 0.5, 0.06, 0.12);
  for (const z of [0.38, 0.82]) k.box('woodD', P, 2.25, 0.95, z, 0.06, 2.1, 0.06);
  return k.done('stilt-shack', light);
}

// Crude plank rowboat, keel at y=0 and bow toward +Z; `sunk` lists it.
export function rowboat({ sunk = false } = {}) {
  const k = new Kit(), P = sunk ? T(0, 0.05, 0, 0.12, 0, 0.08) : T(0, 0.06, 0);
  k.box('woodD', P, 0, 0, 0, 1.2, 0.12, 3.2);
  for (const s of [-1, 1]) k.box('wood', P, s * 0.62, 0.32, 0, 0.1, 0.65, 3.1, 0, 0, s * 0.25);
  k.box('wood', P, 0, 0.45, 0, 1.3, 0.08, 0.4); k.add('wood', CONE4, C(P, T(0, 0.3, 1.75, Math.PI / 2, 0, 0, 0.6, 0.7, 0.35)));
  k.beam('woodL', V(-0.5, 0.55, -0.4).applyMatrix4(P), V(1.3, 0.75, 0.9).applyMatrix4(P), 0.06);
  return k.done(sunk ? 'rowboat-sunk' : 'rowboat');
}

// Will-o'-the-wisp: a glowing core with an additive halo circling its home.
export function wisp({ seed = 1, color = 'green', radius = 3, height = 1.4, light = false } = {}) {
  const R = rng(seed), g = new THREE.Group(), tint = color === 'blue' ? COLORS.wispB : COLORS.green;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const coreGeo = new THREE.SphereGeometry(0.16, 12, 8), coreMat = new THREE.MeshBasicMaterial({ color: tint });
  const haloMat = new THREE.SpriteMaterial({ map, color: tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const orb = new THREE.Group(), core = new THREE.Mesh(coreGeo, coreMat), halo = new THREE.Sprite(haloMat);
  halo.scale.set(1.6, 1.6, 1); orb.add(core, halo); g.add(orb);
  let lamp = null;
  if (light) { lamp = new THREE.PointLight('#8dffd0', 0.9, 9, 2); orb.add(lamp); }
  const phase = R() * 10, speed = 0.3 + R() * 0.4;
  g.userData.tick = t => {
    const a = t * speed + phase;
    orb.position.set(Math.cos(a) * radius, height + Math.sin(a * 2.1) * 0.5, Math.sin(a * 1.3) * radius);
    halo.material.opacity = 0.85 + Math.sin(t * 6 + phase) * 0.15;
  };
  g.userData.tick(0);
  g.userData.previewBounds = [[-radius - 0.8, 0, -radius - 0.8], [radius + 0.8, height + 1.3, radius + 0.8]];
  let disposed = false;
  g.userData.dispose = () => { if (disposed) return; disposed = true; map.dispose(); haloMat.dispose(); coreMat.dispose(); coreGeo.dispose(); };
  g.name = 'wisp';
  return g;
}
