// Gold-mine pack: rails, carts, ore, timber works and animated machinery.
// Static parts are composed from unit primitives placed by matrix, then baked.
import * as THREE from 'three';
import { M, rng, box as boxMesh } from '/engine/models/core/primitives.js';
import { finish, sign } from '/engine/models/core/architecture-kit.js';
import { miner } from '/engine/models/props/mine-miner.js';

const PAL = {
  rock: 0x7d6a56, rockD: 0x5a4b3d, rockL: 0x94806a,
  wood: 0x7a5233, woodL: 0x9a6c43, woodD: 0x563823, iron: 0x45413d, ironL: 0x6d6862, tin: 0x86888a,
  gold: 0xe3b23c, goldD: 0xb8862a, rope: 0xb79a68, red: 0xb3382c, cream: 0xefe1c0, copper: 0xc98a4c,
  niche: 0x0f0b08, glow: 0xffd36e, bulb: 0xffe7a3,
};
const GLOW = new Set(['glow', 'bulb']);
const METAL = new Set(['iron', 'ironL', 'tin', 'copper']);
const basic = new Map();
function mat(key) {
  if (GLOW.has(key)) {
    if (!basic.has(key)) basic.set(key, new THREE.MeshBasicMaterial({ color: PAL[key] }));
    return basic.get(key);
  }
  if (key === 'gold' || key === 'goldD') return M(PAL[key], { metalness: 0.55, roughness: 0.38 });
  return M(PAL[key], METAL.has(key) ? { metalness: 0.3, roughness: 0.7 } : { roughness: 0.9 });
}

const GEO = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  cyl: () => new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: () => new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: () => new THREE.ConeGeometry(1, 1, 8),
  dod: () => new THREE.DodecahedronGeometry(1, 0),
  oct: () => new THREE.OctahedronGeometry(1, 0),
  tor: () => new THREE.TorusGeometry(1, 0.2, 6, 16),
  hop: () => new THREE.CylinderGeometry(1.7, 0.4, 2.2, 4),
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const I = new THREE.Matrix4();
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
function T(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return new THREE.Matrix4().compose(V(x, y, z), _q.clone(), V(sx, sy, sz));
}
const C = (P, L) => P.clone().multiply(L);

// Add one unit primitive under `g`, positioned by an arbitrary matrix.
function add(g, key, geo, mtx) {
  const m = new THREE.Mesh(GEO[geo](), mat(key));
  m.matrixAutoUpdate = false; m.matrix.copy(mtx);
  m.castShadow = !GLOW.has(key); m.receiveShadow = !GLOW.has(key);
  g.add(m);
  return m;
}
const box = (g, key, P, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => add(g, key, 'box', C(P, T(x, y, z, rx, ry, rz, sx, sy, sz)));
const cyl = (g, key, P, x, y, z, r, h, rx = 0, ry = 0, rz = 0, geo = 'cyl') => add(g, key, geo, C(P, T(x, y, z, rx, ry, rz, r, h, r)));
const rock = (g, key, P, x, y, z, s, R) => add(g, key, 'dod', C(P, T(x, y, z, R() * 3, R() * 3, R() * 3, s * (0.8 + R() * 0.5), s * (0.55 + R() * 0.4), s * (0.8 + R() * 0.5))));
function beam(g, key, a, b, t, geo = 'box') {
  const d = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  return add(g, key, geo, new THREE.Matrix4().compose(mid, q, V(t, d.length(), t)));
}

// Twinkling gold points; kept outside the bake and pulsed in tick.
function sparkles(points, size = 0.16) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.PointsMaterial({ color: 0xfff1a8, size, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(geo, material);
  p.name = 'gold-sparkles';
  return p;
}
function done(g, name, { glints = [], bounds, tick } = {}) {
  const out = finish(g, name);
  let glint;
  if (glints.length) { glint = sparkles(glints); out.add(glint); }
  const dispose = out.userData.dispose;
  out.userData.dispose = () => { dispose?.(); glint?.material.dispose(); };
  if (glint || tick) out.userData.tick = (t, dt) => {
    if (glint) glint.material.opacity = 0.55 + Math.sin(t * 4.2) * 0.35;
    tick?.(t, dt);
  };
  if (bounds) out.userData.previewBounds = bounds;
  return out;
}
function glowLight(out, light, color, x, y, z, intensity = 1.4, distance = 15) {
  if (!light) return;
  const l = new THREE.PointLight(color, intensity, distance, 2);
  l.position.set(x, y, z); out.add(l);
}

// ----- Small builders (shared by the composite props below) -----

function crateAt(g, P, x, y, z, s, R, tnt = false) {
  const ry = R() * 0.6;
  box(g, tnt ? 'red' : 'woodL', P, x, y + s / 2, z, s, s, s, 0, ry);
  const Q = C(P, T(x, y + s / 2, z, 0, ry));
  for (const horizontal of [true, false]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    if (horizontal) box(g, 'woodD', Q, 0, sx * s * 0.45, sz * s * 0.51, s * 1.02, s * 0.1, s * 0.04);
    else box(g, 'woodD', Q, sx * s * 0.45, 0, sz * s * 0.51, s * 0.1, s * 1.02, s * 0.04);
  }
  if (tnt) box(g, 'cream', Q, 0, 0, s * 0.52, s * 0.6, s * 0.25, 0.02);
}
function barrelAt(g, P, x, y, z, gold) {
  cyl(g, 'wood', P, x, y + 0.55, z, 0.42, 1.1);
  for (const h of [0.2, 0.9]) cyl(g, 'iron', P, x, y + h, z, 0.44, 0.07);
  if (gold) add(g, 'gold', 'dod', C(P, T(x, y + 1.15, z, 0.4, 0.7, 0.2, 0.3, 0.2, 0.3)));
}
function lanternAt(g, P, x, y, z) {
  box(g, 'iron', P, x, y + 0.22, z, 0.34, 0.07, 0.34); box(g, 'iron', P, x, y - 0.2, z, 0.28, 0.06, 0.28);
  box(g, 'glow', P, x, y, z, 0.2, 0.32, 0.2); cyl(g, 'iron', P, x, y + 0.34, z, 0.06, 0.18, 0, 0, 0, 'cyl6');
}
function pickaxeAt(g, P, x, y, z, ry) {
  const Q = C(P, T(x, y, z, 0, ry, 0.35));
  cyl(g, 'woodL', Q, 0, 0.55, 0, 0.035, 1.1, 0, 0, 0, 'cyl6');
  box(g, 'ironL', Q, 0, 1.08, 0, 0.8, 0.08, 0.08, 0, 0, 0.1);
}
function shovelAt(g, P, x, y, z, ry) {
  const Q = C(P, T(x, y, z, 0, ry, -0.3));
  cyl(g, 'woodL', Q, 0, 0.7, 0, 0.035, 1.3, 0, 0, 0, 'cyl6');
  box(g, 'ironL', Q, 0, 0.05, 0, 0.3, 0.38, 0.04);
}
function ladderBetween(g, a, b, w = 0.6) {
  const d = b.clone().sub(a), side = V(-d.z, 0, d.x).normalize().multiplyScalar(w / 2);
  if (!(side.lengthSq() > 1e-6)) side.set(w / 2, 0, 0);
  beam(g, 'wood', a.clone().add(side), b.clone().add(side), 0.08); beam(g, 'wood', a.clone().sub(side), b.clone().sub(side), 0.08);
  const n = Math.floor(d.length() / 0.35);
  for (let i = 1; i < n; i++) { const p = a.clone().addScaledVector(d, i / n); beam(g, 'woodL', p.clone().add(side), p.clone().sub(side), 0.05); }
}
function veinAt(g, p, d, n, R, glints) {
  for (let i = 0; i < n; i++) {
    const q = p.clone().add(V((R() - 0.5) * 2.2, (R() - 0.5) * 1.6, (R() - 0.5) * 2.2)).addScaledVector(d, -0.3);
    add(g, R() < 0.75 ? 'gold' : 'goldD', 'oct', T(q.x, q.y, q.z, R() * 3, R() * 3, R() * 3, 0.15 + R() * 0.25, 0.3 + R() * 0.5, 0.15 + R() * 0.25));
    if (R() < 0.5) glints.push(q.clone().addScaledVector(d, 0.25));
  }
}
function pileAt(g, x, z, s, R, glints) {
  for (let i = 0; i < 14; i++) {
    const a = R() * 6.28, r = R() * s, hh = (1 - r / s) * s * 0.7;
    rock(g, R() < 0.5 ? 'rock' : 'rockL', I, x + Math.cos(a) * r, hh * 0.6, z + Math.sin(a) * r, 0.35 + R() * 0.45, R);
  }
  for (let i = 0; i < 9; i++) {
    const a = R() * 6.28, r = R() * s * 0.8, hh = (1 - r / s) * s * 0.75, p = V(x + Math.cos(a) * r, hh * 0.7 + 0.25, z + Math.sin(a) * r);
    add(g, 'gold', 'dod', T(p.x, p.y, p.z, R() * 3, R() * 3, R() * 3, 0.18 + R() * 0.2, 0.14 + R() * 0.12, 0.18 + R() * 0.2));
    glints.push(p);
  }
}

// ----- Catalogued props -----

export function mineCrate({ seed = 11, size = 0.9, tnt = false } = {}) {
  const g = new THREE.Group();
  crateAt(g, I, 0, 0, 0, size, rng(seed), tnt);
  return done(g, tnt ? 'tnt-crate' : 'mine-crate');
}

export function mineBarrel({ gold = true } = {}) {
  const g = new THREE.Group();
  barrelAt(g, I, 0, 0, 0, gold);
  return done(g, 'mine-barrel');
}

export function goldVein({ seed = 21, count = 8, spread = 1 } = {}) {
  // A seam showing through a rock face that faces +Z.
  const g = new THREE.Group(), R = rng(seed), glints = [];
  for (let i = 0; i < 4; i++) rock(g, i % 2 ? 'rockD' : 'rock', I, (R() - 0.5) * 2.6 * spread, 0.8 + R() * 1.4, -0.9 - R() * 0.4, 1.1 * spread, R);
  veinAt(g, V(0, 1.4, 0), V(0, 0, -1), count, R, glints);
  return done(g, 'gold-vein', { glints, bounds: [[-2.5, 0, -2], [2.5, 3, 1.2]] });
}

export function orePile({ seed = 22, radius = 2.4 } = {}) {
  const g = new THREE.Group(), glints = [];
  pileAt(g, 0, 0, radius, rng(seed), glints);
  return done(g, 'ore-pile', { glints });
}

export function mineLantern({ light = false } = {}) {
  // Hangs from a hook; origin at the hook so it can be clipped to any beam.
  const g = new THREE.Group();
  lanternAt(g, I, 0, -0.48, 0);
  box(g, 'iron', I, 0, -0.06, 0, 0.03, 0.12, 0.03);
  const out = done(g, 'mine-lantern', { bounds: [[-0.3, -0.8, -0.3], [0.3, 0.1, 0.3]] });
  glowLight(out, light, 0xffb35c, 0, -0.48, 0);
  return out;
}

export function mineLanternPost({ light = false } = {}) {
  const g = new THREE.Group();
  cyl(g, 'wood', I, 0, 1.6, 0, 0.12, 3.2, 0, 0, 0, 'cyl6');
  box(g, 'wood', I, 0.4, 3.1, 0, 0.9, 0.12, 0.12);
  box(g, 'iron', I, 0.75, 2.98, 0, 0.03, 0.22, 0.03);
  lanternAt(g, I, 0.75, 2.7, 0);
  const out = done(g, 'mine-lantern-post');
  glowLight(out, light, 0xffb35c, 0.75, 2.7, 0);
  return out;
}

export function bulbWire({ span = 10, sag = 0.7, height = 4.2, posts = true } = {}) {
  const g = new THREE.Group(), a = V(-span / 2, height, 0), b = V(span / 2, height, 0), n = 10;
  if (posts) for (const p of [a, b]) cyl(g, 'wood', I, p.x, height / 2 + 0.1, 0, 0.12, height + 0.2, 0, 0, 0, 'cyl6');
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n, p = a.clone().lerp(b, t); p.y -= 4 * sag * t * (1 - t);
    beam(g, 'iron', prev, p, 0.025, 'cyl6');
    if (i < n && i % 2 === 0) add(g, 'bulb', 'dod', T(p.x, p.y - 0.12, p.z, 0, 0, 0, 0.09, 0.12, 0.09));
    prev = p;
  }
  return done(g, 'bulb-wire');
}

export function mineLadder({ height = 4, lean = 0.35 } = {}) {
  const g = new THREE.Group();
  ladderBetween(g, V(0, 0, lean), V(0, height, 0));
  return done(g, 'mine-ladder');
}

export function mineStairs({ steps = 7, rise = 0.29, run = 0.32, width = 1.3 } = {}) {
  // Climbs toward -Z from the origin, with a handrail on both sides.
  const g = new THREE.Group(), w = width, n = steps;
  for (let i = 0; i < n; i++) {
    const hh = rise * (i + 1);
    box(g, 'woodL', I, 0, hh - 0.05, -run * (i + 0.5), w, 0.1, run + 0.02);
    box(g, 'wood', I, 0, hh / 2, -run * (i + 0.5), w * 0.92, hh, 0.06);
  }
  for (const s of [-1, 1]) {
    beam(g, 'wood', V(s * w / 2, 0, 0), V(s * w / 2, rise * n, -run * n), 0.12);
    beam(g, 'woodD', V(s * w / 2, 1, 0), V(s * w / 2, rise * n + 1, -run * n), 0.06);
    beam(g, 'wood', V(s * w / 2, 0, 0), V(s * w / 2, 1.05, 0), 0.08);
    beam(g, 'wood', V(s * w / 2, rise * n, -run * n), V(s * w / 2, rise * n + 1.05, -run * n), 0.08);
  }
  return done(g, 'mine-stairs');
}

export function minePickaxe() {
  const g = new THREE.Group();
  pickaxeAt(g, I, 0, 0, 0, 0);
  return done(g, 'mine-pickaxe');
}

export function mineShovel() {
  const g = new THREE.Group();
  shovelAt(g, I, 0, 0, 0, 0);
  return done(g, 'mine-shovel');
}

export function mineWheelbarrow({ seed = 31, load = true } = {}) {
  const g = new THREE.Group();
  box(g, 'ironL', I, 0, 0.65, 0, 0.9, 0.35, 1.2, 0.08);
  cyl(g, 'iron', I, 0, 0.25, 0.8, 0.25, 0.1, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) box(g, 'wood', I, s * 0.35, 0.55, -0.3, 0.07, 0.07, 1.9, 0.15);
  for (const s of [-1, 1]) box(g, 'wood', I, s * 0.32, 0.25, -0.45, 0.06, 0.5, 0.06);
  if (load) { const R = rng(seed); for (let i = 0; i < 3; i++) rock(g, i ? 'rockL' : 'gold', I, (R() - 0.5) * 0.4, 0.88, (R() - 0.5) * 0.6, 0.24, R); }
  return done(g, 'mine-wheelbarrow');
}

export function mineCart({ seed = 41, load = 'gold' } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  box(g, 'woodD', I, 0, 0.36, 0, 1.0, 0.12, 1.6);
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.62, 0.78, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 1.3), mat(R() < 0.5 ? 'iron' : 'ironL'));
  hopper.position.y = 0.86; hopper.castShadow = hopper.receiveShadow = true; g.add(hopper);
  box(g, 'ironL', I, 0, 1.24, 0, 1.32, 0.1, 1.75);
  for (const z of [-0.55, 0.55]) {
    box(g, 'iron', I, 0, 0.24, z, 1.25, 0.08, 0.08);
    for (const x of [-0.6, 0.6]) cyl(g, 'iron', I, x, 0.24, z, 0.24, 0.12, 0, 0, Math.PI / 2);
  }
  const glints = [];
  if (load !== 'empty') for (let i = 0; i < 9; i++) {
    const gold = load === 'gold' ? i % 3 === 0 : i === 0, p = V((R() - 0.5) * 0.8, 1.25 + R() * 0.25, (R() - 0.5) * 1.1);
    add(g, gold ? 'gold' : 'rockL', 'dod', T(p.x, p.y, p.z, R() * 3, R() * 3, R() * 3, 0.2 + R() * 0.15, 0.15 + R() * 0.1, 0.2 + R() * 0.15));
    if (gold) glints.push(p);
  }
  return done(g, 'mine-cart', { glints });
}

// Rails along a curve; trestle bents rise from `groundHeight` wherever the
// track floats more than 0.9 m above it. Points are [x, y, z] rail heights.
export function mineTrack({
  points = [[-12, 0.32, 0], [-6, 0.6, 1.5], [0, 3.6, 2], [6, 3.2, 0.5], [12, 0.6, -1.5], [16, 0.32, -2]],
  groundHeight = 0, closed = false, bumper = true,
} = {}) {
  const g = new THREE.Group(), curve = new THREE.CatmullRomCurve3(points.map(p => V(...p)), closed);
  const L = curve.getLength(), n = Math.ceil(L / 0.7), pts = curve.getSpacedPoints(n), sides = [];
  for (let i = 0; i <= n; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    const ry = Math.atan2(b.x - a.x, b.z - a.z), s = V(Math.cos(ry), 0, -Math.sin(ry));
    sides.push(s);
    box(g, i % 5 === 0 ? 'woodD' : 'wood', I, p.x, p.y - 0.14, p.z, 1.9, 0.14, 0.34, 0, ry);
    if (i % 5 === 0 && p.y - groundHeight > 0.9) {
      const l = p.clone().addScaledVector(s, -1.1), r = p.clone().addScaledVector(s, 1.1);
      const lg = V(l.x, groundHeight - 0.3, l.z), rg = V(r.x, groundHeight - 0.3, r.z);
      beam(g, 'wood', lg, V(l.x, p.y - 0.2, l.z), 0.26); beam(g, 'wood', rg, V(r.x, p.y - 0.2, r.z), 0.26);
      box(g, 'woodD', I, p.x, p.y - 0.36, p.z, 2.6, 0.28, 0.3, 0, ry);
      for (let y = p.y - 0.4; y > lg.y + 0.6; y -= 2.6) {
        const y1 = Math.max(y - 2.6, lg.y);
        beam(g, 'woodD', V(l.x, y, l.z), V(r.x, y1, r.z), 0.12); beam(g, 'woodD', V(r.x, y, r.z), V(l.x, y1, l.z), 0.12);
        box(g, 'woodD', I, p.x, y1, p.z, 2.4, 0.16, 0.18, 0, ry);
      }
    }
  }
  for (let i = 0; i < n; i++) for (const o of [-0.55, 0.55]) {
    const a = pts[i].clone().addScaledVector(sides[i], o), b = pts[i + 1].clone().addScaledVector(sides[i + 1], o);
    const d = b.clone().sub(a), m = a.clone().add(b).multiplyScalar(0.5); m.y -= 0.02;
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d.clone().normalize());
    add(g, 'ironL', 'box', new THREE.Matrix4().compose(m, q, V(0.1, 0.12, d.length() + 0.03)));
  }
  if (bumper && !closed) {
    const p = curve.getPoint(1), dir = curve.getTangent(1), P = T(p.x, p.y, p.z, 0, Math.atan2(dir.x, dir.z));
    for (const s of [-0.6, 0.6]) box(g, 'wood', P, s, 0.3, 0, 0.25, 0.9, 0.25);
    box(g, 'red', P, 0, 0.7, 0, 1.7, 0.35, 0.3);
  }
  const out = done(g, 'mine-track');
  out.userData.curve = curve;
  return out;
}

export function minePortal({ seed = 51, name = 'MINA 1', light = false } = {}) {
  // Tunnel mouth facing +Z: rock face, three timber sets and a lagged roof.
  const g = new THREE.Group(), R = rng(seed);
  box(g, 'niche', I, 0, 2, -5.2, 3.8, 4.2, 10.5);
  box(g, 'rock', I, 0, 2.5, -1.2, 7, 5.6, 1.6);
  for (let i = 0; i < 10; i++) rock(g, R() < 0.5 ? 'rock' : 'rockD', I, (R() - 0.5) * 8, 4.6 + R() * 1.6, -1 - R() * 1.2, 1 + R() * 0.8, R);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) rock(g, 'rockL', I, s * (3.4 + R() * 0.6), 0.8 + i * 1.5, -0.8 - R(), 0.9 + R() * 0.5, R);
  for (let k = 0; k < 3; k++) {
    const z = -k * 2.2;
    for (const s of [-1, 1]) box(g, 'wood', I, s * 1.8, 1.95, z, 0.4, 3.9, 0.4, 0, 0, s * -0.04);
    box(g, 'woodD', I, 0, 4.05, z, 4.6, 0.45, 0.5);
  }
  for (let k = 0; k < 6; k++) box(g, 'woodL', I, 0, 4.33, -k * 0.85 + 0.3, 4.2, 0.1, 0.75);
  const board = sign(name, 2.6, 0.65, { background: '#8a5f38', color: '#f4e3b5' });
  board.position.set(0, 4.75, 0.28); g.add(board);
  for (const s of [-1, 1]) beam(g, 'iron', V(s * 1.1, 4.3, 0.27), V(s * 1.1, 5.1, 0.27), 0.03, 'cyl6');
  lanternAt(g, I, 2.3, 3.2, 0.35); box(g, 'wood', I, 2.1, 3.55, 0.15, 0.5, 0.08, 0.08);
  crateAt(g, I, -2.8, 0, 0.8, 0.9, R, true); barrelAt(g, I, -3.2, 0, 2.2, false);
  pickaxeAt(g, I, 2.6, 0, -0.2, 0.3); shovelAt(g, I, 2.9, 0, 0.1, -0.2);
  const out = done(g, 'mine-portal', { bounds: [[-5, 0, -4], [5, 6.5, 3]] });
  glowLight(out, light, 0xffb35c, 2.3, 3.2, 0.6);
  return out;
}

export function mineSupport({ width = 2.8, height = 4, lantern = true } = {}) {
  // Freestanding timber set like the ones shoring the cavern walls.
  const g = new THREE.Group(), s = width / 2;
  for (const x of [-s, s]) box(g, 'wood', I, x, height / 2, 0, 0.35, height, 0.35, 0, 0, -Math.sign(x) * 0.03);
  box(g, 'woodD', I, 0, height + 0.1, 0, width + 0.8, 0.4, 0.45);
  if (lantern) lanternAt(g, I, s, height - 1, 0.35);
  return done(g, 'mine-support');
}

export function mineScaffold({ seed = 61 } = {}) {
  // Two-level work scaffold against a seam wall at -Z, with ladders and ore.
  const g = new THREE.Group(), R = rng(seed), glints = [];
  box(g, 'rockD', I, 0, 5, -4.4, 9, 10.5, 1.4);
  for (const sx of [-3, 3]) for (const sz of [-3.4, -0.2]) box(g, 'wood', I, sx, 5, sz, 0.3, 10, 0.3);
  for (const y of [3.5, 7]) {
    for (let x = -3.2; x <= 3.2; x += 0.4) box(g, 'woodL', I, x, y, -1.8, 0.36, 0.1, 3.4);
    for (const sz of [-3.4, -0.2]) box(g, 'woodD', I, 0, y - 0.15, sz, 6.6, 0.2, 0.22);
    box(g, 'woodD', I, 0, y + 1.05, -0.15, 6.4, 0.1, 0.1);
    for (const sx of [-3, 0, 3]) box(g, 'woodD', I, sx, y + 0.55, -0.15, 0.1, 1.1, 0.1);
  }
  for (const sz of [-3.4, -0.2]) { beam(g, 'woodD', V(-3, 0.2, sz), V(3, 3.4, sz), 0.12); beam(g, 'woodD', V(3, 3.6, sz), V(-3, 6.9, sz), 0.12); }
  ladderBetween(g, V(3.5, 0, -1), V(3.5, 3.6, -1.3));
  ladderBetween(g, V(-3.5, 3.5, -1), V(-3.5, 7.1, -1.3));
  lanternAt(g, I, -2.6, 9.4, -0.3);
  for (const y of [2.5, 5, 8]) for (const ox of [-2, 0, 2]) veinAt(g, V(ox, y, -3.7), V(0, 0, -1), 4, R, glints);
  crateAt(g, I, 1.8, 0, 1.2, 0.9, R);
  pileAt(g, -1.5, 1.6, 1.3, R, glints);
  return done(g, 'mine-scaffold', { glints, bounds: [[-5, 0, -5.2], [5, 10.5, 3]] });
}

export function minerShack({ seed = 71, light = false } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  box(g, 'woodL', I, 0, 1.5, 0, 4.6, 3, 3.6);
  for (let h = 0.5; h < 3; h += 0.5) box(g, 'woodD', I, 0, h, 1.81, 4.6, 0.05, 0.03);
  box(g, 'wood', I, -0.8, 1.05, 1.82, 1, 2.1, 0.06);
  box(g, 'glow', I, 1.2, 1.7, 1.83, 0.8, 0.6, 0.03); box(g, 'woodD', I, 1.2, 1.7, 1.85, 0.06, 0.62, 0.03);
  box(g, 'tin', I, 0, 3.25, 0.2, 5.2, 0.12, 4.6, -0.18);
  lanternAt(g, I, 0.3, 2.3, 2.05);
  barrelAt(g, I, 2.8, 0, 1.2, R() < 0.3); crateAt(g, I, -2.9, 0, 1.4, 0.9, R);
  const out = done(g, 'miner-shack');
  glowLight(out, light, 0xffb35c, 0.3, 2.3, 2.3);
  return out;
}

export function assayTable({ seed = 81 } = {}) {
  // Camp table with gold scales and loose nuggets.
  const g = new THREE.Group(), R = rng(seed), glints = [];
  box(g, 'woodL', I, 0, 0.95, 0, 2.4, 0.12, 1.2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 'wood', I, sx * 1.05, 0.45, sz * 0.5, 0.1, 0.9, 0.1);
  cyl(g, 'gold', I, -0.5, 1.06, 0, 0.22, 0.08); cyl(g, 'goldD', I, 0.2, 1.18, 0, 0.04, 0.35);
  box(g, 'goldD', I, 0.2, 1.36, 0, 0.7, 0.03, 0.03);
  for (const s of [-1, 1]) cyl(g, 'gold', I, 0.2 + s * 0.33, 1.27, 0, 0.12, 0.03);
  for (let i = 0; i < 4; i++) {
    const p = V(0.6 + (R() - 0.5) * 0.4, 1.06, (R() - 0.5) * 0.6);
    add(g, 'gold', 'dod', T(p.x, p.y, p.z, R(), R(), R(), 0.08, 0.06, 0.08)); glints.push(p);
  }
  return done(g, 'assay-table', { glints });
}

export function waterWheel({ radius = 3 } = {}) {
  // Axle on X at 2.2 m; the wheel turns in tick. Paddles dip below y=0 into water.
  const g = new THREE.Group(), k = radius / 3, axleY = 2.2 * k;
  for (const s of [-1.3, 1.3]) beam(g, 'wood', V(s, -0.6, 0), V(s, axleY + 0.2, 0), 0.35);
  const static_ = done(g, 'water-wheel-frame');
  const wheel = new THREE.Group();
  for (const s of [-0.6, 0.6]) {
    add(wheel, 'wood', 'tor', T(s, 0, 0, 0, Math.PI / 2, 0, radius, radius, 1.2));
    add(wheel, 'wood', 'tor', T(s, 0, 0, 0, Math.PI / 2, 0, 1.2 * k, 1.2 * k, 1.4));
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    add(wheel, 'woodL', 'box', T(0, Math.cos(a) * radius * 1.05, Math.sin(a) * radius * 1.05, a, 0, 0, 1.5, 0.1, 0.75 * k));
    for (const s of [-0.6, 0.6]) add(wheel, 'woodD', 'box', T(s, Math.cos(a) * radius / 2, Math.sin(a) * radius / 2, a, 0, 0, 0.12, radius, 0.14));
  }
  add(wheel, 'iron', 'cyl', T(0, 0, 0, 0, 0, Math.PI / 2, 0.18, 2.9, 0.18));
  const spinning = finish(wheel, 'water-wheel-rotor');
  spinning.position.y = axleY;
  const out = new THREE.Group(); out.name = 'water-wheel';
  out.add(static_, spinning);
  out.userData.tick = t => { spinning.rotation.x = -t * 0.7; };
  out.userData.previewBounds = [[-2, -0.8, -radius - 0.5], [2, axleY + radius + 0.5, radius + 0.5]];
  return out;
}

export function stampMill({ seed = 91 } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  box(g, 'woodL', I, 0, 0.2, 0, 9, 0.4, 9);
  for (const sx of [-3.8, 3.8]) for (const sz of [-3.8, 3.8]) box(g, 'wood', I, sx, 4.9, sz, 0.45, 9.4, 0.45);
  for (const y of [4.2, 8.6]) for (const s of [-3.8, 3.8]) { box(g, 'woodD', I, 0, y, s, 8, 0.4, 0.4); box(g, 'woodD', I, s, y, 0, 0.4, 0.4, 8); }
  box(g, 'tin', I, 0, 10.1, 0, 9.6, 0.15, 9.6, 0, 0, 0.16);
  box(g, 'woodD', I, -0.6, 2.2, 0, 1.2, 0.5, 6.4);
  box(g, 'iron', I, -1.4, 1.1, 0, 1.6, 1.4, 5.6);
  cyl(g, 'iron', I, -0.4, 6.6, 0, 0.18, 7.2, Math.PI / 2);
  for (let i = 0; i < 5; i++) cyl(g, 'ironL', I, -0.4, 6.6, -2.2 + i * 1.1, 0.45, 0.12, Math.PI / 2);
  add(g, 'woodL', 'hop', T(1.4, 7, 0, 0, Math.PI / 4, 0));
  box(g, 'copper', I, -3.6, 0.9, 0, 2.4, 0.1, 5, 0, 0, 0.22);
  beam(g, 'wood', V(1.5, 5.6, 0), V(0.2, 3, 0), 0.5);
  lanternAt(g, I, -4.2, 3.4, 4.1); box(g, 'wood', I, -4, 3.8, 3.9, 0.5, 0.08, 0.08);
  crateAt(g, I, 3, 0.4, 3, 1, R); crateAt(g, I, 3.3, 0.4, 1.7, 0.8, R, true);
  barrelAt(g, I, 2.9, 0.4, -3, false); barrelAt(g, I, 3.4, 0.4, -2, true);
  const glints = Array.from({ length: 6 }, () => V(-3.6 + (R() - 0.5) * 2, 1.2, (R() - 0.5) * 4.5));
  const out = done(g, 'stamp-mill', { glints });
  const stamps = [];
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Group(); st.position.set(-1.4, 1.85, -2.2 + i * 1.1);
    add(st, 'ironL', 'cyl6', T(0, 2.1, 0, 0, 0, 0, 0.11, 4.2, 0.11));
    add(st, 'iron', 'cyl', T(0, 0.35, 0, 0, 0, 0, 0.32, 0.7, 0.32));
    add(st, 'woodD', 'box', T(0, 3.4, 0, 0, 0, 0, 0.5, 0.2, 0.3));
    const baked = finish(st, 'stamp'); baked.position.copy(st.position);
    out.add(baked); stamps.push(baked);
  }
  const glint = out.userData.tick;
  out.userData.tick = (t, dt) => {
    glint(t, dt);
    stamps.forEach((s, i) => {
      const p = (t * 1.1 + i * 0.37) % 1;
      s.position.y = 1.85 + (p < 0.75 ? p / 0.75 : (1 - p) / 0.25) * 0.9;
    });
  };
  return out;
}

export function liftTower({ height = 14, seed = 5, light = false } = {}) {
  // Braced headframe over a shaft; the cage with a lantern-carrying miner rides
  // between the ground deck and just below the pulley.
  const g = new THREE.Group(), top = height;
  for (const sx of [-1.6, 1.6]) for (const sz of [-1.6, 1.6]) box(g, 'wood', I, sx, top / 2, sz, 0.38, top, 0.38);
  for (let y = 4; y < top; y += 4) {
    for (const s of [-1.6, 1.6]) { box(g, 'woodD', I, 0, y, s, 3.6, 0.25, 0.25); box(g, 'woodD', I, s, y, 0, 0.25, 0.25, 3.6); }
    for (const s of [-1.6, 1.6]) { beam(g, 'woodD', V(-1.6, y - 4, s), V(1.6, y, s), 0.12); beam(g, 'woodD', V(s, y - 4, -1.6), V(s, y, 1.6), 0.12); }
  }
  box(g, 'woodD', I, 0, top - 0.5, 0, 4.2, 0.5, 4.2);
  add(g, 'iron', 'tor', T(0, top - 1.6, 0, 0, Math.PI / 2, 0, 1.1, 1.1, 1.1));
  for (const [x, z, w, d] of [[0, 2.6, 5.6, 1.6], [0, -2.6, 5.6, 1.6], [2.6, 0, 1.6, 3.6], [-2.6, 0, 1.6, 3.6]]) box(g, 'woodL', I, x, 0.15, z, w, 0.2, d);
  box(g, 'niche', I, 0, 0.02, 0, 3.6, 0.04, 3.6);
  const out = done(g, 'lift-tower', { bounds: [[-3.6, 0, -3.6], [3.6, top + 0.2, 3.6]] });

  const cage = new THREE.Group();
  box(cage, 'woodL', I, 0, 0.05, 0, 2.5, 0.12, 2.5); box(cage, 'iron', I, 0, 2.45, 0, 2.5, 0.12, 2.5);
  for (const sx of [-1.18, 1.18]) for (const sz of [-1.18, 1.18]) box(cage, 'iron', I, sx, 1.25, sz, 0.08, 2.4, 0.08);
  for (let i = -2; i <= 2; i++) for (const s of [-1.18, 1.18]) { box(cage, 'ironL', I, i * 0.45, 1.25, s, 0.04, 2.4, 0.04); box(cage, 'ironL', I, s, 1.25, i * 0.45, 0.04, 2.4, 0.04); }
  const car = new THREE.Group(); car.add(finish(cage, 'lift-cage'));
  const rider = miner({ seed, pose: 'idle', tool: 'lantern' });
  rider.position.set(0.4, 0.1, 0.2); rider.rotation.y = -0.6; car.add(rider);
  if (light) glowLight(car, true, 0xffb35c, 0.6, 1.4, 0.6, 1, 8);
  out.add(car);
  const rope = new THREE.Mesh(GEO.cyl6(), mat('rope')); out.add(rope);
  const travel = Math.max(0, top - 5);
  out.userData.tick = (t, dt) => {
    const y = travel * (0.5 - 0.5 * Math.cos(t * 0.35));
    car.position.y = y; rider.userData.tick(t, dt);
    const ropeTop = top - 1.6;
    rope.position.y = (y + 2.5 + ropeTop) / 2; rope.scale.set(0.05, Math.max(0.01, ropeTop - (y + 2.5)), 0.05);
  };
  out.userData.tick(0, 0);
  return out;
}

// A road-width timber gate for a mine shaft entrance: braced posts, a double
// lintel, a hanging sign and lanterns. `span` is the clear half-width.
export function mineGate({ span = 14, height = 11, name = 'MINA DE SAL' } = {}) {
  const g = new THREE.Group(), wood = mat('woodL'), dark = mat('woodD');
  for (const x of [-span, span]) {
    g.add(boxMesh(1.4, height, 1.4, wood, x, height / 2, 0));
    const brace = boxMesh(.6, 6, .6, dark, x - Math.sign(x) * 2, height - 2.6, 0); brace.rotation.z = Math.sign(x) * .7; g.add(brace);
  }
  g.add(boxMesh(span * 2 + 3.5, 1.6, 1.8, wood, 0, height + .4, 0), boxMesh(span * 2 + 1, .7, 1.3, dark, 0, height - .8, .1));
  const board = sign(name, 12, 2.2, { background: '#7a3f2a', color: '#ffe9c4' }); board.position.set(0, height - 2.4, 1.1); g.add(board);
  for (const x of [-span + 1.6, span - 1.6]) { const l = mineLantern({ light: false }); l.position.set(x, height - 2, .9); l.scale.setScalar(2.2); g.add(l); }
  g.name = 'mine-gate'; g.userData.previewBounds = [[-span - 3, 0, -1.5], [span + 3, height + 2, 2]];
  return g;
}
