// Lost-temple ruins: Khmer prasat towers, carved heads, columns, stelae and
// abyss bridges. Ported from the "Cueva de Ruinas" and jungle design studies.
// Every factory is deterministic, grounded at y = 0, faces +Z and returns
// baked static batches; brazier flames animate through userData.tick.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { lerp } from '../../random.js';

const PAL = {
  stoneA: 0xa29c84, stoneB: 0xb4a882, stoneC: 0x8f8c77, stoneD: 0x66645a,
  laterite: 0xad5c3e, lateriteD: 0x86452f, moss: 0x6a8e36, mossL: 0x8aab45,
  rock: 0x8c836d, rockD: 0x5d574b, gold: 0xd8ad45, wood: 0x6c4a2f, woodL: 0x8b6542,
  rope: 0xb39766, leaf: 0x4c8c34, leafD: 0x2f6629, niche: 0x181410,
  // grey-green jungle stone for the Olmec head, gate and carved stele
  jungle: 0x9a9a8c, jungleL: 0xb9b8a8, jungleD: 0x74746a, jungleA: 0x8f9a88, jungleMoss: 0x5d8a3a,
};
const GLOW = { fire: 0xff8a2a, glow: 0xffd36e };
const basics = new Map();
const mat = key => GLOW[key] !== undefined
  ? (basics.get(key) ?? basics.set(key, new THREE.MeshBasicMaterial({ color: GLOW[key] })).get(key))
  : M(PAL[key], { roughness: key === 'gold' ? 0.45 : 0.95, metalness: key === 'gold' ? 0.35 : 0 });

// Unit templates; Kit.add always applies its transform to an owned clone.
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
const CONE = new THREE.ConeGeometry(1, 1, 8);
const LEAFC = new THREE.ConeGeometry(1, 1, 4);
const DOD = new THREE.DodecahedronGeometry(1, 0);
const TOR = new THREE.TorusGeometry(1, 0.18, 6, 16);
const HEMI = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
const UP = new THREE.Vector3(0, 1, 0);

class Kit {
  constructor() { this.group = new THREE.Group(); }
  add(key, geo, matrix) {
    const m = new THREE.Mesh(geo.clone().applyMatrix4(matrix), mat(key));
    m.castShadow = GLOW[key] === undefined; m.receiveShadow = m.castShadow;
    this.group.add(m); return m;
  }
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function T(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
const C = (P, L) => P.clone().multiply(L);
const I = new THREE.Matrix4();

function finish(B, name) {
  const out = bake(B.group); out.name = name;
  B.group.traverse(o => o.geometry?.dispose());
  return out;
}
function build(name, seed, fn) { const B = new Kit(); fn(B, rng(seed)); return finish(B, name); }

const SK = ['stoneA', 'stoneB', 'stoneC'];
const sk = R => SK[(R() * 3) | 0];
function box(B, key, P, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { B.add(key, BOX, C(P, T(x, y, z, rx, ry, rz, sx, sy, sz))); }
function cyl(B, key, P, x, y, z, r, h, rx = 0, ry = 0, rz = 0, g = CYL) { B.add(key, g, C(P, T(x, y, z, rx, ry, rz, r, h, r))); }
function rbox(B, key, P, x, y, z, sx, sy, sz, radius) { owned(B, key, new RoundedBoxGeometry(sx, sy, sz, 2, radius), C(P, T(x, y, z))); }
function owned(B, key, geo, matrix) { B.add(key, geo, matrix); geo.dispose(); }
function rock(B, key, P, x, y, z, s, R) {
  B.add(key, DOD, C(P, T(x, y, z, R() * 3, R() * 3, R() * 3, s * (0.8 + R() * 0.5), s * (0.55 + R() * 0.4), s * (0.8 + R() * 0.5))));
}
// A weathered stone block, bottom at y, sometimes wearing a moss slab.
function block(B, P, x, y, z, sx, sy, sz, R, moss = 0.3, key) {
  const j = 0.035;
  box(B, key || sk(R), P, x + (R() - 0.5) * 0.06, y + sy / 2, z + (R() - 0.5) * 0.06, sx, sy, sz, (R() - 0.5) * j, (R() - 0.5) * j * 2, (R() - 0.5) * j);
  if (R() < moss) box(B, R() < 0.5 ? 'moss' : 'mossL', P, x + (R() - 0.5) * sx * 0.2, y + sy + 0.04, z + (R() - 0.5) * sz * 0.2, sx * (0.45 + R() * 0.5), 0.09, sz * (0.45 + R() * 0.5));
}
// Hanging vine from a local point straight down, wobbling a little.
function vine(B, P, x, y, z, L, R) {
  const n = Math.max(2, (L / 0.9) | 0); let px = x, pz = z;
  for (let i = 0; i < n; i++) {
    const nx = px + (R() - 0.5) * 0.15, nz = pz + (R() - 0.5) * 0.15;
    B.add(i % 3 ? 'leafD' : 'leaf', CYL6, C(P, T((px + nx) / 2, y - (i + 0.5) * L / n, (pz + nz) / 2, 0, 0, 0, 0.06, L / n + 0.05, 0.06)));
    if (R() < 0.55) B.add('leaf', LEAFC, C(P, T(nx + (R() - 0.5) * 0.3, y - (i + 1) * L / n, nz + (R() - 0.5) * 0.3, R() * 3, R() * 3, R() * 3, 0.18, 0.35, 0.06)));
    px = nx; pz = nz;
  }
}
function column(B, P, x, y, z, r, h, R, broken) {
  block(B, P, x, y, z, r * 2.7, 0.35, r * 2.7, R, 0.45); block(B, P, x, y + 0.35, z, r * 2.25, 0.25, r * 2.25, R, 0);
  let yy = y + 0.6; const top = y + 0.6 + (broken ? h * (0.15 + R() * 0.6) : h);
  while (yy < top - 0.05) {
    const dh = Math.min(0.9 + R() * 0.35, top - yy), off = (R() - 0.5) * 0.07;
    cyl(B, sk(R), P, x + off, yy + dh / 2, z + off, r * (0.97 + R() * 0.06), dh, (R() - 0.5) * 0.03, R() * 3, (R() - 0.5) * 0.03);
    cyl(B, 'stoneD', P, x, yy + 0.02, z, r * 1.03, 0.05);
    yy += dh;
  }
  if (!broken) {
    cyl(B, 'stoneB', P, x, yy + 0.15, z, r * 1.35, 0.3);
    block(B, P, x, yy + 0.3, z, r * 2.8, 0.38, r * 2.8, R, 0.65);
    return yy + 0.68;
  }
  if (R() < 0.6) cyl(B, R() < 0.5 ? 'moss' : 'mossL', P, x, yy + 0.03, z, r * 0.9, 0.08);
  if (R() < 0.5) { // a drum fallen next to it
    const a = R() * 6.28, d = r * 3 + R() * 2;
    cyl(B, sk(R), P, x + Math.cos(a) * d, y + r * 0.95, z + Math.sin(a) * d, r, 1.0, Math.PI / 2, R() * 3, 0);
  }
  return yy;
}
// Steps climbing toward local -z, starting at z0.
function stairs(B, P, x, y, z0, w, n, rise, run, R, broken = 0) {
  for (let i = 0; i < n; i++) {
    const hh = rise * (i + 1), ww = R() < broken ? w * (0.4 + R() * 0.4) : w, off = (w - ww) / 2 * (R() < 0.5 ? -1 : 1);
    block(B, P, x + off, y, z0 - run * (i + 0.5), ww, hh, run + 0.02, R, 0.15);
  }
}
// Shared carved head: Bayon (tiered crown and finial) or Olmec (moss cap).
function carvedHead(B, P, s, R, { crown, keys }) {
  const [base, face, dark] = keys;
  block(B, P, 0, 0, 0, s * 1.05, s * 0.45, s * 0.95, R, 0.3, base);
  const hy = s * 0.45 + s * 0.58;
  box(B, face, P, 0, hy, 0, s, s * 1.15, s * 0.85);
  box(B, base, P, 0, hy + s * 0.2, s * 0.43, s * 0.9, s * 0.08, s * 0.12);
  for (const sx of [-1, 1]) {
    box(B, dark, P, sx * s * 0.22, hy + s * 0.1, s * 0.43, s * 0.24, s * 0.045, 0.05);
    box(B, base, P, sx * s * 0.53, hy, 0, s * 0.09, s * 0.55, s * 0.2);
  }
  box(B, base, P, 0, hy - s * 0.04, s * 0.46, s * 0.15, s * 0.32, s * 0.14);
  box(B, dark, P, 0, hy - s * 0.3, s * 0.43, s * 0.36, s * 0.06, 0.05);
  box(B, base, P, 0, hy + s * 0.66, 0, s * 0.98, s * 0.18, s * 0.82);
  if (crown) {
    box(B, face, P, 0, hy + s * 0.84, 0, s * 0.72, s * 0.18, s * 0.62);
    B.add(base, CONE, C(P, T(0, hy + s * 1.13, 0, 0, 0, 0, s * 0.3, s * 0.42, s * 0.3)));
    if (R() < 0.7) box(B, 'moss', P, 0, hy + s * 0.94, 0, s * 0.6, 0.08, s * 0.5);
  } else box(B, 'jungleMoss', P, 0, hy + s * 0.77, 0, s * 0.8, 0.1, s * 0.6);
}

function prasatInto(B, P, s, R, { broken = false, laterite = true } = {}) {
  const K = laterite ? 'laterite' : 'stoneA', K2 = laterite ? 'lateriteD' : 'stoneC';
  block(B, P, 0, 0, 0, s * 1.55, 0.5, s * 1.55, R, 0.5); block(B, P, 0, 0.5, 0, s * 1.3, 0.4, s * 1.3, R, 0.25);
  stairs(B, P, 0, 0, s * 1.25, s * 0.45, 3, 0.3, 0.3, R);
  const by = 0.9, bh = s * 0.95;
  box(B, K, P, 0, by + bh / 2, 0, s, bh, s);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(B, K2, P, sx * s * 0.47, by + bh / 2, sz * s * 0.47, s * 0.14, bh, s * 0.14);
  box(B, 'niche', P, 0, by + bh * 0.38, s / 2 + 0.01, s * 0.32, bh * 0.76, 0.06);
  for (const sx of [-1, 1]) cyl(B, 'stoneB', P, sx * s * 0.22, by + bh * 0.38, s / 2 + 0.08, s * 0.05, bh * 0.76);
  box(B, 'stoneB', P, 0, by + bh * 0.8, s / 2 + 0.06, s * 0.62, s * 0.13, s * 0.14);
  box(B, 'stoneB', P, 0, by + bh * 0.92, s / 2 + 0.04, s * 0.4, s * 0.12, s * 0.1);
  for (const a of [Math.PI / 2, Math.PI, -Math.PI / 2]) { // false doors on the other three faces
    const Q = C(P, T(0, 0, 0, 0, a));
    box(B, K2, Q, 0, by + bh * 0.38, s / 2 + 0.02, s * 0.3, bh * 0.7, 0.06);
    box(B, 'stoneB', Q, 0, by + bh * 0.78, s / 2 + 0.04, s * 0.48, s * 0.1, 0.1);
  }
  box(B, 'stoneB', P, 0, by + bh + s * 0.05, 0, s * 1.12, s * 0.1, s * 1.12);
  let y = by + bh + s * 0.1, w = s * 0.92; const tiers = broken ? 1 + ((R() * 2) | 0) : 4;
  for (let i = 0; i < tiers; i++) {
    const th = s * 0.3;
    box(B, K, P, 0, y + th / 2, 0, w, th, w);
    box(B, 'stoneB', P, 0, y + th, 0, w * 1.08, th * 0.18, w * 1.08);
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) if (sx || sz)
      B.add('stoneB', CONE, C(P, T(sx * w * 0.5, y + th + th * 0.35, sz * w * 0.5, 0, 0, 0, s * 0.05, th * 0.6, s * 0.05)));
    y += th * 1.12; w *= 0.78;
  }
  if (!broken) {
    B.add('stoneB', CONE, C(P, T(0, y + s * 0.3, 0, 0, 0, 0, w * 0.5, s * 0.6, w * 0.5)));
    B.add('gold', DOD, C(P, T(0, y + s * 0.66, 0, 0, 0, 0, s * 0.07, s * 0.12, s * 0.07)));
  } else for (let i = 0; i < 8; i++) block(B, P, (R() - 0.5) * s * 2.4, 0, s * 0.9 + R() * s, 0.5 + R() * 0.5, 0.4 + R() * 0.4, 0.5 + R() * 0.5, R, 0.4);
  for (let i = 0; i < 3; i++) if (R() < 0.6) box(B, 'moss', P, (R() - 0.5) * s * 0.5, by + bh + s * 0.12, (R() - 0.5) * s * 0.5, s * 0.4, 0.08, s * 0.3);
}

// Prasat shrine tower: plinth, door niche, false doors, four shrinking tiers
// crowned in gold. Broken towers keep one or two tiers and spill rubble.
export function prasat({ seed = 71, size = 3, broken = false, laterite = true } = {}) {
  return build('prasat', seed, (B, R) => prasatInto(B, I, size, R, { broken, laterite }));
}

// Giant Bayon-style carved head with a tiered crown.
export function bayonFace({ seed = 72, size = 2.2 } = {}) {
  return build('bayonFace', seed, (B, R) => carvedHead(B, I, size, R, { crown: true, keys: ['stoneA', 'stoneB', 'stoneD'] }));
}

// Olmec/Maya stone head half-buried in the jungle floor.
export function olmecHead({ seed = 73, size = 2 } = {}) {
  return build('olmecHead', seed, (B, R) => carvedHead(B, I, size, R, { crown: false, keys: ['jungle', 'jungleL', 'jungleD'] }));
}

// Drum column on a plinth with capital; broken ones end in a mossy stump.
export function ruinColumn({ seed = 74, radius = 0.5, height = 6, broken = false } = {}) {
  return build('ruinColumn', seed, (B, R) => column(B, I, 0, 0, 0, radius, height, R, broken));
}

// Toppled column: drums lying in a row along X, centred on the origin.
export function fallenColumn({ seed = 75, radius = 0.6, length = 5 } = {}) {
  return build('fallenColumn', seed, (B, R) => {
    const n = Math.max(1, Math.round(length / 1.1)), dl = length / n;
    for (let i = 0; i < n; i++) {
      const x = -length / 2 + (i + 0.5) * dl + i * 0.04;
      cyl(B, sk(R), I, x + (R() - 0.5) * 0.1, radius, (R() - 0.5) * 0.1, radius, dl - 0.05, (R() - 0.5) * 0.06, (R() - 0.5) * 0.06, Math.PI / 2);
    }
    if (R() < 0.8) box(B, 'moss', I, -length * 0.1, radius * 2 + 0.03, 0, length * 0.35, 0.08, radius * 0.9);
  });
}

// Pile of tumbled, mossy temple blocks and loose stones.
export function ruinRubble({ seed = 76, count = 8, spread = 2.6 } = {}) {
  return build('ruinRubble', seed, (B, R) => {
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2, d = R() * spread;
      block(B, I, Math.cos(a) * d, 0, Math.sin(a) * d, 0.7 + R() * 0.7, 0.5 + R() * 0.6, 0.7 + R() * 0.7, R, 0.4);
    }
    for (let i = 0; i < 2; i++) block(B, I, (R() - 0.5) * 0.6, 1.0 + i * 0.5, (R() - 0.5) * 0.6, 0.8, 0.5, 0.8, R, 0.5);
    for (let i = 0; i < count; i++) rock(B, 'stoneC', I, (R() - 0.5) * spread * 2.4, 0.1, (R() - 0.5) * spread * 2.4, 0.2 + R() * 0.25, R);
  });
}

// Temple staircase rising toward -Z, centred on the origin; broken steps
// are randomly narrowed.
export function ruinStairs({ seed = 77, width = 4, steps = 8, rise = 0.3, run = 0.45, broken = false } = {}) {
  return build('ruinStairs', seed, (B, R) => {
    stairs(B, I, 0, 0, steps * run / 2, width, steps, rise, run, R, broken ? 0.35 : 0);
    for (const sx of [-1, 1]) {
      const L = Math.hypot(steps * rise, steps * run), ang = Math.atan2(steps * rise, steps * run);
      box(B, 'stoneB', I, sx * (width / 2 + 0.35), steps * rise / 2 + 0.3, 0, 0.6, 0.6, L, ang);
    }
  });
}

// Stela with a rounded crown and a grid of carved glyphs.
export function stela({ seed = 78 } = {}) {
  return build('stela', seed, (B, R) => {
    block(B, I, 0, 0, 0, 1.8, 0.35, 1, R, 0.4);
    box(B, 'stoneB', I, 0, 1.95, 0, 1.4, 3.2, 0.45);
    cyl(B, 'stoneB', I, 0, 3.55, 0, 0.7, 0.45, Math.PI / 2);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (R() < 0.85) box(B, 'stoneD', I, -0.4 + c * 0.4, 0.85 + r * 0.5, 0.24, 0.28, 0.28, 0.06);
    if (R() < 0.6) box(B, 'moss', I, 0, 3.95, 0, 0.8, 0.1, 0.4);
  });
}

// Floor seal: stone dais inlaid with gold rings, rays and corner studs.
export function sunSeal({ seed = 79, size = 2.4 } = {}) {
  return build('sunSeal', seed, (B, R) => {
    const s = size;
    block(B, I, 0, 0, 0, s, 0.4, s, R, 0, 'stoneB');
    box(B, 'stoneD', I, 0, 0.42, 0, s * 0.82, 0.06, s * 0.82);
    cyl(B, 'gold', I, 0, 0.46, 0, s * 0.34, 0.06);
    cyl(B, 'stoneD', I, 0, 0.48, 0, s * 0.28, 0.07);
    cyl(B, 'gold', I, 0, 0.5, 0, s * 0.1, 0.1);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(B, 'gold', I, Math.cos(a) * s * 0.19, 0.52, Math.sin(a) * s * 0.19, s * 0.13, 0.04, 0.08, 0, -a, 0); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(B, 'gold', I, sx * s * 0.36, 0.47, sz * s * 0.36, s * 0.04, 0.06);
  });
}

// Stone brazier on a hexagonal pedestal. Flames flicker in userData.tick;
// `light` adds an optional flickering point light for scenes that budget it.
export function brazier({ seed = 80, lit = true, light = false } = {}) {
  const R = rng(seed), B = new Kit();
  cyl(B, 'stoneC', I, 0, 0.5, 0, 0.32, 1, 0, 0, 0, CYL6);
  block(B, I, 0, 0, 0, 0.9, 0.25, 0.9, () => 0.5, 0, 'stoneB');
  cyl(B, 'stoneD', I, 0, 1.15, 0, 0.62, 0.32);
  if (!lit) for (let i = 0; i < 4; i++) rock(B, 'rockD', I, (R() - 0.5) * 0.5, 1.33, (R() - 0.5) * 0.5, 0.12, R);
  const out = finish(B, 'brazier');
  if (!lit) return out;
  const fire = new THREE.Group(), flames = [];
  fire.position.y = 1.32; out.add(fire);
  for (let i = 0; i < 3; i++) {
    const h = 0.85 - i * 0.1, f = new THREE.Mesh(new THREE.ConeGeometry(0.28, h, 8).translate(0, h / 2, 0), mat('fire'));
    f.position.set((i - 1) * 0.18, 0, (i % 2) * 0.12 - 0.04); f.rotation.y = i; fire.add(f); flames.push(f);
  }
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8).translate(0, 0.25, 0), mat('glow'));
  fire.add(core); flames.push(core);
  let lamp = null;
  if (light) { lamp = new THREE.PointLight(0xffa04a, 1.6, 9, 2); lamp.position.y = 0.9; fire.add(lamp); }
  out.userData.tick = t => {
    flames.forEach((f, i) => {
      const k = 1 + Math.sin(t * 9 + i * 2.1 + seed) * 0.12 + Math.sin(t * 15.3 + i) * 0.07;
      f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
    });
    if (lamp) lamp.intensity = 1.6 * (0.85 + Math.sin(t * 11 + seed) * 0.1 + Math.sin(t * 23) * 0.05);
  };
  out.userData.dispose = () => { fire.traverse(o => o.geometry?.dispose()); };
  out.userData.tick(0);
  return out;
}

// Sagging plank bridge spanning X between two stone ledges. Unlike the rope
// bridge, ropes hang loose and a broken bridge loses its middle, leaving
// dangling planks and cut ropes.
export function plankBridge({ seed = 81, length = 12, width = 1.6, broken = false } = {}) {
  if (!Number.isFinite(length) || length < 4 || length > 40) throw new RangeError('plankBridge length must be between 4 and 40');
  return build('plankBridge', seed, (B, R) => {
    const deck = 2.2, a = new THREE.Vector3(-length / 2, deck, 0), b = new THREE.Vector3(length / 2, deck, 0);
    const dir = b.clone().sub(a), ry = Math.atan2(dir.x, dir.z), sag = length * 0.035;
    const side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    const at = t => a.clone().addScaledVector(dir, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0));
    const n = Math.floor(length / 0.36);
    let lastLeft = 0, firstRight = 1;
    if (broken) { lastLeft = 0.36 + R() * 0.08; firstRight = 0.62 + R() * 0.08; }
    for (let i = 0; i <= n; i++) {
      const t = i / n; if (broken && t > lastLeft && t < firstRight) continue;
      if (R() < 0.07) continue;
      const p = at(t);
      box(B, R() < 0.5 ? 'wood' : 'woodL', I, p.x, p.y, p.z, width * (0.9 + R() * 0.15), 0.09, 0.28, (R() - 0.5) * 0.05, ry + (R() - 0.5) * 0.08, (R() - 0.5) * 0.06);
    }
    const segs = 16;
    const rail = (off, dy, key, thick, t0, t1) => {
      for (let i = 0; i < segs; i++) {
        const pa = at(lerp(t0, t1, i / segs)).addScaledVector(side, off), pb = at(lerp(t0, t1, (i + 1) / segs)).addScaledVector(side, off);
        pa.y += dy; pb.y += dy;
        const d = pb.clone().sub(pa), q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
        B.add(key, key === 'rope' ? CYL6 : BOX, new THREE.Matrix4().compose(pa.clone().add(pb).multiplyScalar(0.5), q, new THREE.Vector3(thick, d.length() + 0.02, thick)));
      }
    };
    for (const [t0, t1] of broken ? [[0, lastLeft], [firstRight, 1]] : [[0, 1]])
      for (const sd of [-1, 1]) { rail(sd * width * 0.45, -0.12, 'wood', 0.14, t0, t1); rail(sd * width * 0.55, 1.0, 'rope', 0.04, t0, t1); }
    for (const t of [0, 1]) for (const sd of [-1, 1]) {
      const p = at(t).addScaledVector(side, sd * width * 0.55);
      cyl(B, 'wood', I, p.x, p.y + 0.3, p.z, 0.11, 1.6, 0, 0, 0, CYL6);
    }
    if (broken) for (const t of [lastLeft, firstRight]) {
      const p = at(t), toward = t < 0.5 ? 0.15 : -0.15;
      for (let k = 0; k < 3; k++) if (R() < 0.8)
        box(B, 'woodL', I, p.x + toward + (R() - 0.5) * 0.1, p.y - 0.45 - k * 0.38, p.z + (R() - 0.5) * 0.3, width * 0.8, 0.08, 0.3, Math.PI / 2 + (R() - 0.5) * 0.3, ry, (R() - 0.5) * 0.3);
      for (const sd of [-1, 1]) { const q = p.clone().addScaledVector(side, sd * width * 0.5); cyl(B, 'rope', I, q.x, q.y - 0.8, q.z, 0.035, 1.6, 0, 0, 0, CYL6); }
    }
    // Stone ledges the bridge is anchored to.
    for (const s of [-1, 1]) {
      block(B, I, s * (length / 2 + 1.2), 0, 0, 2.6, deck - 0.05, width + 1.6, R, 0.5, 'stoneC');
      for (let i = 0; i < 3; i++) rock(B, 'rock', I, s * (length / 2 + 1.4 + R()), 0.2, (R() - 0.5) * 3, 0.35 + R() * 0.3, R);
    }
  });
}

// Rock pillar rising out of an abyss, banded with stone courses and paved on top.
export function rockTower({ seed = 82, width = 6, depth = 6, height = 14 } = {}) {
  return build('rockTower', seed, (B, R) => {
    const top = height;
    box(B, 'rockD', I, 0, top / 2, 0, width, top, depth);
    for (let k = 1; k < 5 && top - k * 2.2 > 0.4; k++) box(B, 'stoneC', I, 0, top - k * 2.2, 0, width + 0.25, 0.35, depth + 0.25);
    for (let tx = -width / 2 + 0.6; tx < width / 2; tx += 1.2) for (let tz = -depth / 2 + 0.6; tz < depth / 2; tz += 1.2) {
      if (R() < 0.08) continue;
      block(B, I, tx, top - 0.2, tz, 1.12, 0.3, 1.12, R, 0.12);
    }
    for (let i = 0; i < 4; i++) rock(B, 'stoneC', I, (R() - 0.5) * width, top + 0.1, (R() - 0.5) * depth, 0.2 + R() * 0.3, R);
  });
}

// Temple floor of worn tiles, a few missing and some overgrown with moss.
export function ruinPaving({ seed = 83, w = 8, d = 8, tile = 1.2, missing = 0.08 } = {}) {
  return build('ruinPaving', seed, (B, R) => {
    for (let x = -w / 2 + tile / 2; x < w / 2; x += tile) for (let z = -d / 2 + tile / 2; z < d / 2; z += tile) {
      if (R() < missing) continue;
      const mossy = R() < 0.16;
      box(B, mossy ? (R() < 0.5 ? 'moss' : 'mossL') : sk(R), I, x + (R() - 0.5) * 0.05, 0.1 + (mossy ? -0.02 : 0), z + (R() - 0.5) * 0.05,
        tile - 0.07, 0.2, tile - 0.07, (R() - 0.5) * 0.04, (R() - 0.5) * 0.05, (R() - 0.5) * 0.04);
    }
  });
}

// Cave-floor stalagmites: a cluster of upward cones on a rubble base.
export function stalagmites({ seed = 84, count = 9, height = 3 } = {}) {
  return build('stalagmites', seed, (B, R) => {
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2, d = i ? 0.4 + R() * 2.2 : 0, h = height * (i ? 0.25 + R() * 0.6 : 1), r = 0.25 + h * 0.12;
      B.add(R() < 0.5 ? 'rock' : 'stoneC', CONE, T(Math.cos(a) * d, h / 2, Math.sin(a) * d, (R() - 0.5) * 0.12, R() * 3, (R() - 0.5) * 0.12, r, h, r));
    }
    for (let i = 0; i < count; i++) rock(B, 'rockD', I, (R() - 0.5) * 4, 0.05, (R() - 0.5) * 4, 0.25 + R() * 0.3, R);
  });
}

// Overgrown gate: two stacked-stone pillars, a cracked lintel with moss and
// vines, optionally guarded by two Olmec heads.
export function ruinGate({ seed = 85, width = 7.2, heads = true } = {}) {
  return build('ruinGate', seed, (B, R) => {
    const half = width / 2;
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++)
      box(B, k % 2 ? 'jungle' : 'jungleL', I, s * half, 0.6 + k * 1.2, 0, 1.6, 1.2, 1.6, 0, (R() - 0.5) * 0.1, 0);
    box(B, 'jungleL', I, 0.3, 7.8, 0, width + 1.8, 1.2, 1.8, 0, 0, 0.04);
    box(B, 'jungleMoss', I, 0, 8.45, 0, width - 0.2, 0.12, 1.4);
    for (let i = 0; i < 8; i++) vine(B, I, -half + 0.4 + R() * (width - 0.8), 7.2, 0.95, 2 + R() * 4.5, R);
    if (heads) for (const s of [-1, 1]) carvedHead(B, T(s * (half + 2.9), 0, 1.5, 0, -s * 0.4), 1.8, R, { crown: false, keys: ['jungle', 'jungleL', 'jungleD'] });
    for (let i = 0; i < 6; i++) rock(B, 'jungleD', I, (R() - 0.5) * width * 1.4, 0.05, 1 + R() * 2, 0.3 + R() * 0.3, R);
  });
}

// Tilted carved stele with a stepped frame, spiral eyes, a glyph row and a
// cap of moss; it leans out of the ground as if roots pushed it over.
export function carvedStele({ seed = 86, lean = 0.12 } = {}) {
  return build('carvedStele', seed, (B, R) => {
    const P = T(0, -0.25, 0, lean, 0, lean * 0.6);
    rbox(B, 'jungleA', P, 0, 2.1, 0, 2.6, 4.2, 1.6, 0.25);
    rbox(B, 'jungleL', P, 0, 1.8, 0.82, 2.0, 3.0, 0.08, 0.03);
    for (let k = 0; k < 3; k++) rbox(B, 'jungleA', P, 0, 2.4, 0.86 + k * 0.03, 1.5 - k * 0.4, 1.5 - k * 0.4, 0.04, 0.02);
    for (const s of [-1, 1]) {
      B.add('jungleD', TOR, C(P, T(s * 0.55, 3.45, 0.88, 0, 0, 0, 0.22, 0.22, 0.3)));
      B.add('jungleD', TOR, C(P, T(s * 0.55, 3.45, 0.88, 0, 0, 0, 0.1, 0.1, 0.3)));
    }
    for (let i = 0; i < 5; i++) rbox(B, 'jungleD', P, -0.7 + i * 0.35, 1.05, 0.88, 0.22, 0.22, 0.05, 0.02);
    rbox(B, 'jungleD', P, 0, 2.4, 0.95, 0.3, 0.12, 0.04, 0.02);
    B.add('jungleMoss', HEMI, C(P, T(0.2, 4.2, 0, 0.1, 0, 0.1, 1.3, 0.35, 0.85)));
    B.add('moss', HEMI, C(P, T(-0.9, 2.8, 0.6, 0, 0, 1.2, 0.5, 0.15, 0.4)));
    for (let i = 0; i < 6; i++) rock(B, 'jungle', I, (R() - 0.5) * 5, 0.1, (R() - 0.5) * 5, 0.35 + R() * 0.4, R);
  });
}

// Temple facade carved into a rock wall: steps, colonnade, entablature,
// triangular pediment with a gold boss, dark door niches and hanging vines.
export function rockFacade({ seed = 87, columns = 4, height = 6.4 } = {}) {
  return build('rockFacade', seed, (B, R) => {
    const span = columns * 3, w = span + 1.5, top = height + 1.4;
    box(B, 'rock', I, 0, (top + 3.2) / 2, -3.5, w + 2.5, top + 3.2, 6);
    stairs(B, I, 0, 0, 2.8, span * 0.65, 4, 0.35, 0.6, R, 0.2);
    block(B, I, 0, 0, -0.6, w, 1.4, 2.4, R, 0.4);
    for (let i = 0; i < columns; i++) column(B, I, -span / 2 + 1.5 + i * 3, 1.4, -0.2, 0.5, height, R, R() < 0.25);
    box(B, 'stoneB', I, 0, top + 0.4, -0.2, w - 0.5, 1.1, 1.4);
    box(B, 'stoneD', I, 0, top - 0.3, -0.5, w - 1, 0.25, 1.2);
    const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, 2.8); tri.closePath();
    owned(B, 'stoneB', new THREE.ExtrudeGeometry(tri, { depth: 1.2, bevelEnabled: false }), T(0, top + 0.95, -0.8));
    cyl(B, 'gold', I, 0, top + 2, 0.45, 0.55, 0.1, Math.PI / 2);
    box(B, 'niche', I, 0, 1.4 + height * 0.5, -0.7, 2.4, height * 0.9, 0.1);
    for (const cx of [-1, 1]) box(B, 'niche', I, cx * span * 0.25, 1.4 + height * 0.44, -0.7, 1.3, height * 0.5, 0.08);
    for (let i = 0; i < 7; i++) vine(B, I, -w / 2 + R() * w, top + 1.4 + R() * 1.8, 0.4, 3 + R() * (height - 1), R);
  });
}
