// Shared construction for the cemetery pack: purple-grey palette, unit parts
// placed by matrix, and small details reused by graves, crypts and buildings.
import * as THREE from 'three';
import { M } from '/engine/models/core/primitives.js';
import { finish } from '/engine/models/core/architecture-kit.js';

export const COLORS = {
  stone:'#8a8796', stoneL:'#a6a2b2', stoneD:'#5f5c6c', moss:'#5a6b3e',
  slate:'#3a3848', slateD:'#2c2a38', wall:'#7d6f86', wallL:'#9a8ba0', trim:'#c9c0cf',
  bark:'#3b3330', wood:'#5c4636', woodL:'#7a5e48', woodD:'#3e2f25',
  iron:'#26242c', dirt:'#4a3d33', bone:'#e6dfc9', pumpkin:'#e07a24', pumpkinD:'#b85a17', stem:'#4f5a2a',
  cream:'#efe4c8', hay:'#c9a85a', sack:'#9c845e', leaves:'#6b5131', bronze:'#8f6a35', niche:'#0b0910',
  glow:'#ffcf6a', pglow:'#ffb23a', flame:'#ffd88a', green:'#7dffb0', stainA:'#9f7cff', stainB:'#ff9c5a', stainC:'#6fc7ff',
  winY:'#ffd27a', winD:'#2a3150', wispB:'#bff5ff',
};
const GLOW = new Set(['glow','pglow','flame','green','stainA','stainB','stainC','winY','winD','wispB','niche']);
const METAL = new Set(['iron','bronze']);
const basics = new Map();
export function mat(key) {
  if (GLOW.has(key)) {
    if (!basics.has(key)) basics.set(key, new THREE.MeshBasicMaterial({ color: COLORS[key] }));
    return basics.get(key);
  }
  return M(COLORS[key], METAL.has(key) ? { roughness: 0.6, metalness: 0.35 } : { roughness: 0.92 });
}

// Unit prototypes are never mounted: every part is an owned, transformed clone.
export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
export const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
export const CYL4 = new THREE.CylinderGeometry(0.7, 1, 1, 4).rotateY(Math.PI / 4);
export const CONE = new THREE.ConeGeometry(1, 1, 8);
export const CONE4 = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4);
export const SPH = new THREE.SphereGeometry(1, 12, 8);
export const DOD = new THREE.DodecahedronGeometry(1, 0);
export const TOR = new THREE.TorusGeometry(1, 0.12, 6, 20);

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function T(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
export const C = (P, L) => P.clone().multiply(L);
export const I = new THREE.Matrix4();
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function gothicShape(w, h) {
  const s = new THREE.Shape(); s.moveTo(-w, 0); s.lineTo(-w, h);
  s.quadraticCurveTo(-w, h + w * 1.1, 0, h + w * 1.7); s.quadraticCurveTo(w, h + w * 1.1, w, h); s.lineTo(w, 0); s.closePath();
  return s;
}

export class Kit {
  constructor() { this.group = new THREE.Group(); this.lights = []; }
  add(key, geo, matrix) {
    const m = new THREE.Mesh(geo.clone().applyMatrix4(matrix), mat(key)), lit = !GLOW.has(key);
    m.castShadow = lit; m.receiveShadow = lit; this.group.add(m);
  }
  box(key, P, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { this.add(key, BOX, C(P, T(x, y, z, rx, ry, rz, sx, sy, sz))); }
  cyl(key, P, x, y, z, r, h, rx = 0, ry = 0, rz = 0, g = CYL) { this.add(key, g, C(P, T(x, y, z, rx, ry, rz, r, h, r))); }
  rock(key, P, x, y, z, s, R) { this.add(key, DOD, C(P, T(x, y, z, R() * 3, R() * 3, R() * 3, s * (0.8 + R() * 0.5), s * (0.55 + R() * 0.4), s * (0.8 + R() * 0.5)))); }
  beam(key, a, b, t, g = BOX) {
    const d = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    this.add(key, g, new THREE.Matrix4().compose(mid, q, V(t, d.length(), t)));
  }
  extrude(key, P, shape, depth, x, y, z, rx = 0, ry = 0) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
    this.add(key, g, C(P, T(x, y, z - depth / 2, rx, ry))); g.dispose();
  }
  light(P, x, y, z, color, intensity, distance) { this.lights.push({ at: V(x, y, z).applyMatrix4(P), color, intensity, distance }); }
  // Bakes static parts per material; optional lights flicker like flames.
  done(name, light = false) {
    const out = finish(this.group, name);
    if (light && this.lights.length) {
      const lamps = this.lights.map(({ at, color, intensity, distance }) => {
        const l = new THREE.PointLight(color, intensity, distance, 2); l.position.copy(at); l.userData.base = intensity; out.add(l); return l;
      });
      out.userData.tick = t => lamps.forEach((l, i) => { l.intensity = l.userData.base * (1 + Math.sin(t * 11 + i * 3) * 0.08 + Math.sin(t * 27 + i) * 0.05); });
    }
    return out;
  }
}

// ---- Details shared across the pack (they add parts to a Kit) ----

export function candle(k, P, x, y, z, R, h) {
  h = h || 0.18 + R() * 0.25;
  k.cyl('cream', P, x, y + h / 2, z, 0.06, h, 0, 0, 0, CYL6);
  k.add('flame', CONE, C(P, T(x, y + h + 0.08, z, 0, 0, 0, 0.045, 0.14, 0.045)));
}

export function pumpkin(k, P, x, y, z, s, { lit = true, face = true, ry = 0 } = {}) {
  const Q = C(P, T(x, y, z, 0, ry));
  for (const [ox, sc] of [[0, 1], [-0.32, 0.82], [0.32, 0.82]])
    k.add(ox ? 'pumpkinD' : 'pumpkin', SPH, C(Q, T(ox * s, s * 0.62, 0, 0, 0, 0, s * sc * 0.68, s * 0.62, s * 0.85)));
  k.cyl('stem', Q, 0.05 * s, s * 1.28, 0, 0.08 * s, 0.3 * s, 0, 0, 0.25, CYL6);
  if (!face) return;
  const carve = lit ? 'pglow' : 'niche';
  for (const sx of [-1, 1]) k.add(carve, CONE4, C(Q, T(sx * 0.22 * s, s * 0.78, s * 0.8, Math.PI / 2, 0, 0, 0.11 * s, 0.06 * s, 0.11 * s)));
  k.add(carve, CONE4, C(Q, T(0, s * 0.62, s * 0.84, Math.PI / 2, 0, 0, 0.06 * s, 0.05 * s, 0.06 * s)));
  k.box(carve, Q, 0, s * 0.42, s * 0.76, 0.42 * s, 0.08 * s, 0.05 * s);
  for (const sx of [-1, 1]) k.box(carve, Q, sx * 0.12 * s, s * 0.48, s * 0.77, 0.08 * s, 0.08 * s, 0.05 * s);
  if (lit) k.light(Q, 0, s * 0.8, s * 0.9, '#ff9a33', 0.9, 7);
}

export function skull(k, P, x, y, z, s, ry = 0) {
  const Q = C(P, T(x, y, z, 0, ry));
  k.add('bone', SPH, C(Q, T(0, s * 0.55, 0, 0, 0, 0, s * 0.5, s * 0.48, s * 0.52)));
  k.box('bone', Q, 0, s * 0.2, s * 0.12, s * 0.55, s * 0.25, s * 0.5);
  for (const sx of [-1, 1]) k.box('niche', Q, sx * s * 0.18, s * 0.5, s * 0.47, s * 0.18, s * 0.16, 0.03);
  k.box('niche', Q, 0, s * 0.34, s * 0.5, s * 0.08, s * 0.1, 0.03);
}

export function coffin(k, P, x, y, z, ry, open) {
  const s = new THREE.Shape(); s.moveTo(-0.28, -1); s.lineTo(0.28, -1); s.lineTo(0.42, 0.45); s.lineTo(0.3, 1); s.lineTo(-0.3, 1); s.lineTo(-0.42, 0.45); s.closePath();
  const Q = C(P, T(x, y, z, 0, ry));
  const body = new THREE.ExtrudeGeometry(s, { depth: 0.42, bevelEnabled: false }); k.add('woodD', body, C(Q, T(0, 0, 0, -Math.PI / 2))); body.dispose();
  const lid = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false });
  k.add('wood', lid, C(Q, open ? T(0.5, 0.25, 0.1, -Math.PI / 2, 0.5, 0.15) : T(0, 0.42, 0, -Math.PI / 2))); lid.dispose();
  if (open) k.box('niche', Q, 0, 0.43, 0, 0.62, 0.02, 1.7);
  else { k.box('iron', Q, 0, 0.51, -0.2, 0.06, 0.02, 0.6); k.box('iron', Q, 0, 0.51, -0.35, 0.3, 0.02, 0.06); }
}

export function lantern(k, P, x, y, z) {
  k.box('iron', P, x, y + 0.3, z, 0.4, 0.06, 0.4); k.add('iron', CONE4, C(P, T(x, y + 0.45, z, 0, 0, 0, 0.26, 0.25, 0.26)));
  k.box('iron', P, x, y - 0.28, z, 0.34, 0.06, 0.34);
  k.box('glow', P, x, y, z, 0.24, 0.5, 0.24);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('iron', P, x + sx * 0.15, y, z + sz * 0.15, 0.03, 0.56, 0.03);
  k.light(P, x, y, z, '#ffbe6a', 1.1, 12);
}

// Straight iron fence from a to b (y is ground); some bars missing or bent.
export function fenceLine(k, a, b, R, broken = 0.08) {
  const d = b.clone().sub(a), len = d.length(), n = Math.max(1, Math.round(len / 0.45)), ry = Math.atan2(d.x, d.z);
  for (let i = 0; i <= n; i++) {
    if (R() < broken) continue;
    const p = a.clone().addScaledVector(d, i / n), lean = R() < 0.06 ? (R() - 0.5) * 0.6 : 0;
    const P = T(p.x, p.y, p.z, lean, ry, lean * 0.5);
    k.box('iron', P, 0, 0.85, 0, 0.05, 1.7, 0.05); k.add('iron', CONE4, C(P, T(0, 1.8, 0, 0, 0, 0, 0.07, 0.22, 0.07)));
  }
  const spans = Math.max(1, Math.ceil(len / 6));
  for (let s = 0; s < spans; s++) {
    if (R() < broken * 1.5) continue;
    const p0 = a.clone().addScaledVector(d, s / spans), p1 = a.clone().addScaledVector(d, (s + 1) / spans);
    for (const h of [0.35, 1.45]) k.beam('iron', V(p0.x, p0.y + h, p0.z), V(p1.x, p1.y + h, p1.z), 0.05);
  }
}

export function pillar(k, x, y, z, h, top) {
  k.box('stoneD', I, x, y + 0.25, z, 1.1, 0.5, 1.1); k.box('stone', I, x, y + h / 2 + 0.4, z, 0.8, h - 0.2, 0.8); k.box('stoneL', I, x, y + h + 0.35, z, 1.05, 0.25, 1.05);
  if (top === 'urn') { k.add('stoneL', SPH, T(x, y + h + 0.75, z, 0, 0, 0, 0.32, 0.4, 0.32)); k.cyl('stoneL', I, x, y + h + 1.15, z, 0.2, 0.08); }
  else if (top === 'skull') skull(k, I, x, y + h + 0.48, z, 0.6, 0);
  else if (top === 'lantern') lantern(k, I, x, y + h + 0.9, z);
}
