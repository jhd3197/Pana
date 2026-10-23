// Lost-expedition camp kit: tents, supply props, shelters, jeep and campfire.
// Ported from the "Campamento perdido" Claude Design scene. Every factory
// assembles unit primitives through matrices, then bakes one mesh per colour.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, rng } from '/engine/models/core/primitives.js';
import { finish } from '/engine/models/core/architecture-kit.js';
import { lerp } from '../../random.js';

const PAL = {
  tentY: 0xd9b45a, tentYD: 0xb8933e, tentO: 0x7f8a4c, tentOD: 0x646f38, tentB: 0xd8c8a2, tentBD: 0xb9a882,
  tarp: 0x3aa9a3, tarpD: 0x2b8984, blanketR: 0xc0563a, blanketB: 0x3f7f9a, blanketY: 0xe2b24a, sack: 0xc9ad7c, strap: 0x5b4330,
  wood: 0x8a5e3b, woodL: 0xb07f50, woodD: 0x5e3f27, woodEnd: 0xd9b07a, bark: 0x6b5240, barkL: 0x8d7158,
  stone: 0x9a9a8c, stoneL: 0xb9b8a8, stoneD: 0x74746a, ash: 0x4a4440, clay: 0xc46a3a, clayD: 0x9a4f2a, basket: 0xc8a060,
  iron: 0x3d3b38, ironL: 0x6e6a64, brass: 0xc99a3a, jeep: 0xc0442e, jeepD: 0x93321f, dust: 0xa88a62, tire: 0x2f2a27,
  chrome: 0xc9c6bd, olive: 0x5d6b45, oliveD: 0x46523a, battery: 0x262626,
  paper: 0xf2ead2, parchment: 0xe8d6a6, bookR: 0xa8402e, bookG: 0x3f6a48, bookB: 0x35587a, bookY: 0xc9962e,
  leaf: 0x3f8f3a, leafL: 0x67b443, leafD: 0x2a6a30, vine: 0x3a6e2c, heliR: 0xe0482e, heliO: 0xf28a24, heliY: 0xf6c83a,
  rope: 0xb59a6a, fire: 0xff8a2a, fireY: 0xffd36a, glow: 0xffe2a0, led: 0x7dff9a, glass: 0xcfeef0,
};
const GLOW = new Set(['glow', 'fire', 'fireY', 'led']), METAL = new Set(['iron', 'ironL', 'chrome', 'brass']);
const glowMats = new Map();
function mat(key) {
  if (GLOW.has(key)) {
    if (!glowMats.has(key)) glowMats.set(key, new THREE.MeshBasicMaterial({ color: PAL[key] }));
    return glowMats.get(key);
  }
  if (key === 'glass') return M(PAL.glass, { transparent: true, opacity: 0.35, roughness: 0.08, depthWrite: false });
  return METAL.has(key) ? M(PAL[key], { metalness: 0.4, roughness: 0.55 }) : M(PAL[key], { roughness: 0.92 });
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function T(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, order = 'XYZ') {
  _e.set(rx, ry, rz, order); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
const C = (P, L) => P.clone().multiply(L);
const I = new THREE.Matrix4();
const wp = (P, x, y, z) => V(x, y, z).applyMatrix4(P);
const lathe = (pts, n) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), n);

// Per-build unit geometry, so baking can dispose all of it afterwards.
function kit() {
  const root = new THREE.Group();
  const k = {
    root,
    BOX: new THREE.BoxGeometry(1, 1, 1), CYL: new THREE.CylinderGeometry(1, 1, 1, 10),
    CYL6: new THREE.CylinderGeometry(1, 1, 1, 6), CYL16: new THREE.CylinderGeometry(1, 1, 1, 16),
    CONE: new THREE.ConeGeometry(1, 1, 7), LEAF: new THREE.ConeGeometry(1, 1, 4).scale(1, 1, 0.16),
    SPH: new THREE.SphereGeometry(1, 8, 5), DOD: new THREE.DodecahedronGeometry(1, 0),
    TOR: new THREE.TorusGeometry(1, 0.18, 6, 18),
    POT: lathe([[0, 0], [0.3, 0.02], [0.48, 0.25], [0.5, 0.48], [0.36, 0.72], [0.25, 0.8], [0.3, 0.88], [0, 0.88]], 12),
    PAN: lathe([[0, 0], [0.42, 0], [0.5, 0.1], [0.52, 0.5], [0.56, 0.56], [0, 0.56]], 14),
    BASKET: lathe([[0, 0], [0.32, 0], [0.42, 0.15], [0.5, 0.48], [0.52, 0.52], [0, 0.52]], 12),
    add(key, geo, mtx) {
      const m = new THREE.Mesh(geo, mat(key));
      m.matrixAutoUpdate = false; m.matrix.copy(mtx); m.matrixWorldNeedsUpdate = true;
      m.castShadow = !GLOW.has(key) && key !== 'glass'; m.receiveShadow = !GLOW.has(key);
      root.add(m); return m;
    },
    box(key, P, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { k.add(key, k.BOX, C(P, T(x, y, z, rx, ry, rz, sx, sy, sz))); },
    rbox(key, P, x, y, z, w, h, d, r = 0.06, rx = 0, ry = 0, rz = 0) {
      const rr = Math.max(0.005, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
      k.add(key, new RoundedBoxGeometry(w, h, d, 1, rr), C(P, T(x, y, z, rx, ry, rz)));
    },
    cyl(key, P, x, y, z, r, h, rx = 0, ry = 0, rz = 0, g = k.CYL) { k.add(key, g, C(P, T(x, y, z, rx, ry, rz, r, h, r))); },
    beam(key, a, b, t, g = k.CYL6) {
      const d = b.clone().sub(a), m = a.clone().add(b).multiplyScalar(0.5);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
      k.add(key, g, new THREE.Matrix4().compose(m, q, V(t, d.length(), t)));
    },
    tube(key, pts, r, seg = 7) { k.add(key, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(10, pts.length * 6), r, seg, false), I); },
    extrude(key, P, shape, depth) {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
      g.translate(0, 0, -depth / 2); k.add(key, g, P);
    },
    rock(key, P, x, y, z, s, R) { k.add(key, k.DOD, C(P, T(x, y, z, R() * 3, R() * 3, R() * 3, s * (0.8 + R() * 0.5), s * (0.55 + R() * 0.4), s * (0.8 + R() * 0.5)))); },
  };
  return k;
}
const done = (k, name) => finish(k.root, name);

/* ---------- reusable small props ---------- */
function lanternAt(k, P, x, y, z) {
  k.cyl('iron', P, x, y + 0.02, z, 0.17, 0.06); k.cyl('glass', P, x, y + 0.24, z, 0.13, 0.36);
  k.cyl('glow', P, x, y + 0.22, z, 0.06, 0.16);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; k.cyl('iron', P, x + Math.cos(a) * 0.14, y + 0.24, z + Math.sin(a) * 0.14, 0.018, 0.38, 0, 0, 0, k.CYL6); }
  k.add('iron', k.CONE, C(P, T(x, y + 0.5, z, 0, 0, 0, 0.18, 0.18, 0.18)));
  k.add('iron', k.TOR, C(P, T(x, y + 0.65, z, 0, 0, 0, 0.08, 0.08, 0.08)));
}
function crateAt(k, P, x, y, z, s, ry = 0, key = 'woodL') {
  k.rbox(key, P, x, y + s / 2, z, s, s, s, 0.05, 0, ry);
  const Q = C(P, T(x, y + s / 2, z, 0, ry));
  for (const sd of [-1, 1]) { k.rbox('woodD', Q, 0, 0, sd * s * 0.505, s, s * 0.14, 0.04, 0.015); k.rbox('woodD', Q, sd * s * 0.505, 0, 0, 0.04, s * 0.14, s, 0.015); }
}
function barrelAt(k, P, x, y, z, s = 1) {
  k.add('wood', new THREE.CylinderGeometry(0.4 * s, 0.36 * s, 1.05 * s, 12), C(P, T(x, y + 0.52 * s, z)));
  // Hoops follow the stave taper so they wrap the barrel instead of sinking in.
  for (const h of [0.18, 0.52, 0.86]) k.cyl('iron', P, x, y + h * s, z, (0.372 + 0.04 * h / 1.05) * s, 0.06 * s, 0, 0, 0, k.CYL16);
  k.cyl('woodD', P, x, y + 1.05 * s, z, 0.36 * s, 0.02);
}
function sackAt(k, P, x, y, z, s, ry) {
  k.add('sack', k.SPH, C(P, T(x, y + 0.36 * s, z, 0, ry, 0, 0.42 * s, 0.4 * s, 0.34 * s)));
  k.add('sack', k.CONE, C(P, T(x, y + 0.78 * s, z, 0, ry, 0, 0.15 * s, 0.24 * s, 0.15 * s)));
  k.cyl('strap', P, x, y + 0.72 * s, z, 0.12 * s, 0.05, 0, 0, 0, k.CYL6);
}
function backpackAt(k, P, x, y, z, ry, col) {
  const Q = C(P, T(x, y, z, 0, ry));
  k.rbox(col, Q, 0, 0.42, 0, 0.55, 0.8, 0.32, 0.12); k.rbox(col, Q, 0, 0.32, 0.2, 0.42, 0.35, 0.14, 0.06);
  k.cyl('blanketB', Q, 0, 0.9, 0, 0.12, 0.6, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) k.box('strap', Q, s * 0.17, 0.45, -0.17, 0.06, 0.7, 0.03);
}
function blanketAt(k, P, x, y, z, ry, col) {
  k.cyl(col, P, x, y + 0.14, z, 0.14, 0.75, 0, ry, Math.PI / 2);
  for (const o of [-0.22, 0.22]) k.add('strap', k.CYL, C(P, T(x, y + 0.14, z, 0, ry, Math.PI / 2).multiply(T(0, o, 0, 0, 0, 0, 0.15, 0.04, 0.15))));
}
function shovelAt(k, P, x, y, z, ry, lean = 0.3) {
  const Q = C(P, T(x, y, z, 0, ry, lean));
  k.cyl('woodL', Q, 0, 0.75, 0, 0.03, 1.3, 0, 0, 0, k.CYL6); k.rbox('ironL', Q, 0, 0.08, 0, 0.26, 0.34, 0.03, 0.02); k.box('woodD', Q, 0, 1.42, 0, 0.18, 0.05, 0.05);
}
function pickaxeAt(k, P, x, y, z, ry, lean = 0.3) {
  const Q = C(P, T(x, y, z, 0, ry, lean));
  k.cyl('woodL', Q, 0, 0.55, 0, 0.035, 1.1, 0, 0, 0, k.CYL6);
  k.beam('ironL', wp(Q, -0.42, 1.0, 0), wp(Q, 0, 1.12, 0), 0.05); k.beam('ironL', wp(Q, 0, 1.12, 0), wp(Q, 0.42, 1.0, 0), 0.05);
}
function macheteAt(k, P, x, y, z, ry, rz = 0, rx = 0) {
  const Q = C(P, T(x, y, z, rx, ry, rz));
  k.rbox('strap', Q, 0, 0, 0, 0.11, 0.04, 0.6, 0.015); k.rbox('woodD', Q, 0, 0, -0.4, 0.07, 0.06, 0.22, 0.02); k.box('brass', Q, 0, 0, -0.3, 0.12, 0.05, 0.03);
}
function bucketAt(k, P, x, y, z) {
  k.add('ironL', new THREE.CylinderGeometry(0.24, 0.19, 0.42, 12, 1, true), C(P, T(x, y + 0.21, z)));
  k.cyl('ironL', P, x, y + 0.01, z, 0.19, 0.02);
  k.add('iron', new THREE.TorusGeometry(0.24, 0.012, 4, 16, Math.PI), C(P, T(x, y + 0.42, z, 0, 0.6, 0)));
}
function benchAt(k, P, x, z, ry, len = 2) {
  const Q = C(P, T(x, 0, z, 0, ry));
  k.rbox('woodL', Q, 0, 0.48, 0, len, 0.1, 0.42, 0.04);
  for (const s of [-1, 1]) k.rbox('wood', Q, s * (len / 2 - 0.2), 0.24, 0, 0.1, 0.48, 0.38, 0.02);
  k.rbox('woodD', Q, 0, 0.2, 0, len - 0.4, 0.06, 0.06, 0.02);
}
function stakeAt(k, p) { k.beam('woodD', p.clone().add(V(0, -0.1, 0)), p.clone().add(V(0.05, 0.3, 0)), 0.04); }
function stoolAt(k, P, x, z) {
  const Q = C(P, T(x, 0, z));
  k.rbox('woodL', Q, 0, 0.5, 0, 0.45, 0.06, 0.45, 0.03);
  for (const a of [-1, 1]) for (const b of [-1, 1]) k.beam('wood', wp(Q, a * 0.17, 0, b * 0.17), wp(Q, a * 0.15, 0.48, b * 0.15), 0.03);
}

export function glassLantern() { const k = kit(); lanternAt(k, I, 0, 0, 0); return done(k, 'GlassLantern'); }
export function supplyCrate({ size = 0.8, olive = false } = {}) { const k = kit(); crateAt(k, I, 0, 0, 0, size, 0, olive ? 'olive' : 'woodL'); return done(k, 'SupplyCrate'); }
export function hoopedBarrel({ scale = 1 } = {}) { const k = kit(); barrelAt(k, I, 0, 0, 0, scale); return done(k, 'HoopedBarrel'); }
export function grainSack({ scale = 1 } = {}) { const k = kit(); sackAt(k, I, 0, 0, 0, scale, 0); return done(k, 'GrainSack'); }
export function expeditionBackpack({ color = 'tentO' } = {}) { const k = kit(); backpackAt(k, I, 0, 0, 0, 0, color); return done(k, 'ExpeditionBackpack'); }
export function rolledBlanket({ color = 'blanketR' } = {}) { const k = kit(); blanketAt(k, I, 0, 0, 0, 0, color); return done(k, 'RolledBlanket'); }
export function campBucket() { const k = kit(); bucketAt(k, I, 0, 0, 0); return done(k, 'CampBucket'); }
export function campBench({ length = 2 } = {}) { const k = kit(); benchAt(k, I, 0, 0, 0, length); return done(k, 'CampBench'); }
export function campTools() {
  // Shovel and pickaxe leaning on a stump with a machete driven into it.
  const k = kit();
  k.cyl('barkL', I, 0, 0.4, 0, 0.45, 0.8); k.cyl('woodEnd', I, 0, 0.81, 0, 0.42, 0.02);
  macheteAt(k, I, 0.05, 1.05, 0.02, 0.4, 0, -Math.PI / 2 + 0.1);
  shovelAt(k, I, 0.75, 0, 0, Math.PI / 2, 0.25); pickaxeAt(k, I, -0.7, 0, 0.2, -Math.PI / 2, 0.28);
  return done(k, 'CampTools');
}
export function campCookware() {
  // Lathe-turned clay pot, iron pan and woven basket set down together.
  const k = kit();
  k.add('clay', k.POT, T(-0.55, 0, 0, 0, 0, 0, 0.7, 0.7, 0.7));
  k.add('iron', k.PAN, T(0.35, 0, -0.2, 0, 0, 0, 0.6, 0.6, 0.6));
  k.add('basket', k.BASKET, T(0.25, 0, 0.65, 0, 0, 0, 0.8, 0.8, 0.8));
  for (let i = 0; i < 3; i++) k.cyl('woodD', I, 0.25, 0.08 + i * 0.12, 0.65, 0.4 - i * 0.02 + 0.01, 0.015, 0, 0, 0, k.CYL16);
  return done(k, 'CampCookware');
}
export function supplyPile({ seed = 5 } = {}) {
  const k = kit(), R = rng(seed);
  crateAt(k, I, -0.6, 0, -0.3, 0.9, R() * 0.3); crateAt(k, I, -0.6, 0.9, -0.3, 0.65, R() * 0.4, 'olive'); crateAt(k, I, 0.4, 0, -0.5, 0.7, R() * 0.3);
  barrelAt(k, I, 1.3, 0, -0.4); barrelAt(k, I, 1.15, 0, 0.5, 0.8);
  for (let i = 0; i < 3; i++) sackAt(k, I, -1.4 + i * 0.5, 0, 0.55 + (i % 2) * 0.3, 0.9, R() * 3);
  backpackAt(k, I, 0.3, 0, 0.6, -0.4, 'blanketR'); blanketAt(k, I, 0.4, 0.7, -0.5, 0.2, 'blanketY');
  return done(k, 'SupplyPile');
}

/* ---------- campfire with tripod pot, seats, embers and smoke ---------- */
export function expeditionCampfire({ seed = 3, light = false } = {}) {
  const k = kit(), R = rng(seed), P = I;
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; k.rock(i % 3 ? 'stone' : 'stoneL', P, Math.cos(a) * 1.65, 0.18, Math.sin(a) * 1.65, 0.42, R); }
  k.cyl('ash', P, 0, 0.04, 0, 1.45, 0.08);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; k.beam('bark', V(Math.cos(a) * 0.95, 0.05, Math.sin(a) * 0.95), V(Math.cos(a) * 0.12, 1.15, Math.sin(a) * 0.12), 0.11, k.CYL); }
  for (let i = 0; i < 2; i++) k.cyl('barkL', P, 0, 0.22, (i - 0.5) * 0.55, 0.13, 1.8, 0, 0, Math.PI / 2);
  for (let i = 0; i < 5; i++) k.add('ash', k.DOD, T((R() - 0.5) * 1.2, 0.12, (R() - 0.5) * 1.2, R(), R(), R(), 0.18, 0.08, 0.18));
  // Tripod, chain and hanging pot.
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; k.beam('woodD', V(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4), V(0, 2.7, 0), 0.06); }
  k.add('iron', k.TOR, T(0, 2.65, 0, Math.PI / 2, 0, 0, 0.1, 0.1, 0.1));
  for (let i = 0; i < 6; i++) k.add('iron', k.TOR, T(0, 2.5 - i * 0.13, 0, i % 2 ? Math.PI / 2 : 0, 0, 0, 0.045, 0.06, 0.045));
  k.add('iron', k.PAN, T(0, 1.25, 0, 0, 0, 0, 0.85, 0.85, 0.85));
  k.add('iron', new THREE.TorusGeometry(0.44, 0.015, 4, 16, Math.PI), T(0, 1.72, 0, 0, 0.4, 0));
  k.cyl('clayD', P, 0, 1.68, 0, 0.4, 0.03);
  // Three log seats and a bench around the ring.
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.35, x = Math.cos(a) * 4.4, z = Math.sin(a) * 4.4;
    if (i === 3) { benchAt(k, I, x, z, -a + Math.PI / 2, 2.4); continue; }
    k.cyl('bark', I, x, 0.36, z, 0.38, 2.6, Math.PI / 2, -a + Math.PI / 2, 0);
    for (const s of [-1, 1]) k.cyl('woodEnd', I, x - Math.sin(a) * s * 1.3, 0.36, z + Math.cos(a) * s * 1.3, 0.34, 0.03, Math.PI / 2, -a + Math.PI / 2, 0);
  }
  for (let i = 0; i < 8; i++) k.cyl(i % 2 ? 'bark' : 'barkL', I, 2.6 + (i % 4) * 0.32, 0.15 + (i / 4 | 0) * 0.28, -3, 0.14, 1.4, Math.PI / 2, 0.1, 0);
  bucketAt(k, I, -2.8, 0, 2.8); k.add('clay', k.POT, T(-3.3, 0, 2.1, 0, 0, 0, 0.7, 0.7, 0.7));
  const g = new THREE.Group(); g.add(done(k, 'CampfireRing')); g.name = 'ExpeditionCampfire';

  // Animated fire: flame cones, rising embers and drifting smoke puffs.
  const fireAt = V(0, 0.5, 0), flameGeo = new THREE.ConeGeometry(1, 1, 7), flames = new THREE.Group();
  flames.position.set(0, 0.4, 0);
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(flameGeo, mat(i < 3 ? 'fireY' : 'fire')), a = i / 7 * Math.PI * 2, r = i < 3 ? 0.12 : 0.32;
    f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); f.userData = { ph: i * 1.7, s: i < 3 ? 0.9 : 1.25 }; flames.add(f);
  }
  g.add(flames);
  const EMB = 90, embGeo = new THREE.BufferGeometry(), embPos = new Float32Array(EMB * 3), embSeed = new Float32Array(EMB * 3);
  for (let i = 0; i < EMB; i++) embSeed.set([(R() - 0.5) * 0.9, R() * 5, (R() - 0.5) * 0.9], i * 3);
  embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
  const embMat = new THREE.PointsMaterial({ color: 0xffb050, size: 0.09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const embers = new THREE.Points(embGeo, embMat); embers.frustumCulled = false; g.add(embers);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(235,230,220,0.5)'); grad.addColorStop(1, 'rgba(235,230,220,0)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  const smokeTex = new THREE.CanvasTexture(canvas), smoke = [];
  for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false })); s.userData.ph = i / 12; g.add(s); smoke.push(s); }
  const fireLight = light ? new THREE.PointLight(0xff9a45, 2.4, 18, 2) : null;
  if (fireLight) { fireLight.position.set(0, 1.7, 0); g.add(fireLight); }
  g.userData.tick = t => {
    flames.children.forEach(m => {
      const f = m.userData, h = f.s * (0.85 + 0.25 * Math.sin(t * 9 + f.ph) + 0.1 * Math.sin(t * 23 + f.ph * 2));
      m.scale.set(0.24 * f.s, h, 0.24 * f.s); m.position.y = h / 2;
    });
    if (fireLight) fireLight.intensity = 2.4 * (1 + 0.12 * Math.sin(t * 11) + 0.07 * Math.sin(t * 27));
    for (let i = 0; i < EMB; i++) {
      const b = i * 3, life = (embSeed[b + 1] + t * 1.5) % 5;
      embPos[b] = fireAt.x + embSeed[b] * (1 + life * 0.4) + Math.sin(t * 2 + i) * 0.15;
      embPos[b + 1] = fireAt.y + 0.4 + life;
      embPos[b + 2] = fireAt.z + embSeed[b + 2] * (1 + life * 0.4) + Math.cos(t * 2 + i) * 0.15;
    }
    embGeo.attributes.position.needsUpdate = true;
    smoke.forEach(s => {
      const f = (s.userData.ph + t * 0.05) % 1;
      s.position.set(Math.sin(f * 6 + s.userData.ph * 9) * 0.5 + f * 2.5, fireAt.y + 1.8 + f * 10, Math.cos(f * 5) * 0.4 - f * 1.5);
      s.scale.setScalar(1.2 + f * 5); s.material.opacity = (1 - f) * 0.5;
    });
  };
  g.userData.tick(0);
  let disposed = false;
  g.userData.dispose = () => {
    if (disposed) return; disposed = true;
    flameGeo.dispose(); embGeo.dispose(); embMat.dispose(); smokeTex.dispose(); smoke.forEach(s => s.material.dispose());
  };
  g.userData.previewBounds = [[-5.4, 0, -5.4], [5.4, 3, 5.4]];
  return g;
}

/* ---------- A-frame expedition tent with guy ropes ---------- */
const TENT_COLORS = { mustard: ['tentY', 'tentYD'], olive: ['tentO', 'tentOD'], cream: ['tentB', 'tentBD'] };
export function expeditionTent({ color = 'mustard', seed = 2 } = {}) {
  const k = kit(), R = rng(seed), [col, colD] = TENT_COLORS[color] || TENT_COLORS.mustard;
  const P = I, W = 2.4, L = 3.6, Hh = 2.1, a = Math.atan2(Hh, W / 2), sl = Math.hypot(Hh, W / 2);
  k.rbox('tentBD', P, 0, 0.03, 0.1, W + 0.5, 0.05, L + 0.6, 0.02);
  const back = new THREE.Shape(); back.moveTo(-W / 2, 0); back.lineTo(W / 2, 0); back.lineTo(0, Hh); back.closePath();
  k.extrude(colD, C(P, T(0, 0, -L / 2)), back, 0.06);
  // Open entrance: dark interior and door flaps tied back.
  const inner = new THREE.Shape(); inner.moveTo(-W / 2 + 0.15, 0); inner.lineTo(W / 2 - 0.15, 0); inner.lineTo(0, Hh - 0.2); inner.closePath();
  k.extrude('iron', C(P, T(0, 0.02, -L / 2 + 0.25)), inner, 0.02);
  for (const s of [-1, 1]) {
    const f = new THREE.Shape(); f.moveTo(0, 0); f.lineTo(0.55, 0); f.lineTo(0.08, Hh * 0.95); f.closePath();
    k.extrude(col, C(P, T(s * (W / 2 - 0.05), 0, L / 2 + 0.25, 0, s > 0 ? -0.9 : 0.9 + Math.PI, 0)), f, 0.05);
    k.cyl('strap', P, s * (W / 2 + 0.05), 1.05, L / 2 + 0.32, 0.06, 0.08, 0, 0, 0, k.CYL6);
  }
  for (const zz of [-L / 2 - 0.05, L / 2 + 0.05]) k.cyl('woodD', P, 0, Hh / 2, zz, 0.05, Hh + 0.15, 0, 0, 0, k.CYL6);
  k.cyl('woodD', P, 0, Hh, 0, 0.045, L + 0.3, Math.PI / 2, 0, 0, k.CYL6);
  for (const zz of [-L / 2 - 0.05, L / 2 + 0.05]) { const st = wp(P, 0, 0, zz + Math.sign(zz) * 1.3); k.beam('rope', wp(P, 0, Hh, zz), st, 0.018); stakeAt(k, st); }
  for (const s of [-1, 1]) for (const zz of [-L / 3, L / 3]) { const st = wp(P, s * (W / 2 + 1.1), 0, zz); k.beam('rope', wp(P, s * W / 2 * 0.55, Hh * 0.45, zz), st, 0.015); stakeAt(k, st); }
  k.rbox(col, P, W / 4, Hh / 2, 0, 0.07, sl + 0.12, L, 0.03, 0, 0, Math.PI / 2 - a);
  k.rbox(colD, P, -W / 4, Hh / 2, 0, 0.07, sl + 0.12, L, 0.03, 0, 0, -(Math.PI / 2 - a));
  // Bedding inside, pack and lantern by the door.
  blanketAt(k, P, 0.3, 0.05, 0.4, 0.1, 'blanketR'); k.rbox('blanketB', P, -0.3, 0.08, -0.3, 0.9, 0.1, 1.8, 0.05);
  backpackAt(k, P, 0.9, 0, L / 2 + 0.7, 0.4, R() < 0.5 ? 'tentO' : 'blanketB'); lanternAt(k, P, -0.9, 0, L / 2 + 0.6);
  return done(k, 'ExpeditionTent');
}

/* ---------- investigation table with a hand-drawn treasure map ---------- */
function mapMaterial() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 368;
  const x = c.getContext('2d'), r = rng(9);
  x.fillStyle = '#ead9aa'; x.fillRect(0, 0, 512, 368);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(140,100,50,${r() * 0.08})`; x.beginPath(); x.arc(r() * 512, r() * 368, 10 + r() * 60, 0, 7); x.fill(); }
  x.fillStyle = 'rgba(80,140,70,0.35)'; for (let i = 0; i < 90; i++) { x.beginPath(); x.arc(r() * 512, r() * 368, 6 + r() * 12, 0, 7); x.fill(); }
  x.strokeStyle = '#3e9aa8'; x.lineWidth = 6; x.beginPath(); x.moveTo(400, 0); x.bezierCurveTo(340, 120, 440, 230, 370, 368); x.stroke();
  x.strokeStyle = 'rgba(120,90,60,0.6)'; x.lineWidth = 2; for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(110, 90, 30 + i * 16, 20 + i * 11, 0.3, 0, 7); x.stroke(); }
  x.strokeStyle = '#6a3e22'; x.lineWidth = 3; x.setLineDash([9, 8]); x.beginPath(); x.moveTo(250, 360);
  x.bezierCurveTo(230, 280, 300, 220, 250, 170); x.bezierCurveTo(210, 130, 150, 120, 110, 90); x.stroke(); x.setLineDash([]);
  x.strokeStyle = '#b8302a'; x.lineWidth = 7; x.beginPath(); x.moveTo(98, 78); x.lineTo(122, 102); x.moveTo(122, 78); x.lineTo(98, 102); x.stroke();
  x.fillStyle = '#b8302a'; x.beginPath(); x.arc(250, 180, 7, 0, 7); x.fill();
  x.strokeStyle = '#3a2a18'; x.lineWidth = 2; x.beginPath(); x.arc(450, 310, 28, 0, 7); x.stroke(); x.fillStyle = '#3a2a18';
  x.beginPath(); x.moveTo(450, 276); x.lineTo(457, 310); x.lineTo(450, 344); x.lineTo(443, 310); x.closePath(); x.fill();
  x.strokeStyle = '#5a4128'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 360);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}
export function investigationTable() {
  const k = kit(), P = I;
  k.rbox('woodL', P, 0, 0.95, 0, 2.6, 0.12, 1.4, 0.04);
  for (const a of [-1, 1]) for (const b of [-1, 1]) k.rbox('wood', P, a * 1.15, 0.46, b * 0.58, 0.12, 0.92, 0.12, 0.03);
  k.rbox('woodD', P, 0, 0.28, 0, 2.3, 0.06, 0.08, 0.02);
  ['bookR', 'bookG', 'bookB', 'bookY'].forEach((bk, i) => k.rbox(bk, P, -1.0, 1.04 + i * 0.075, -0.4, 0.42 - i * 0.02, 0.07, 0.55 - i * 0.03, 0.015, 0, 0.1 * (i % 2 ? 1 : -1), 0));
  for (const s of [-1, 1]) k.rbox('paper', P, 0.75 + s * 0.2, 1.04, -0.45, 0.38, 0.03, 0.5, 0.01, 0, 0.15, s * -0.06);
  k.rbox('bookR', P, 0.75, 1.02, -0.45, 0.82, 0.02, 0.54, 0.008, 0, 0.15, 0);
  // Compass, magnifier, parchment rolls, lantern, machete and pencil.
  k.cyl('brass', P, 0.3, 1.04, 0.45, 0.13, 0.05, 0, 0, 0, k.CYL16); k.cyl('paper', P, 0.3, 1.07, 0.45, 0.11, 0.01, 0, 0, 0, k.CYL16);
  k.box('heliR', P, 0.33, 1.08, 0.43, 0.015, 0.01, 0.12, 0, 0.6, 0); k.cyl('glass', P, 0.3, 1.08, 0.45, 0.11, 0.015, 0, 0, 0, k.CYL16);
  k.add('brass', k.TOR, C(P, T(-0.35, 1.03, 0.45, Math.PI / 2, 0, 0, 0.12, 0.12, 0.12))); k.beam('woodD', wp(P, -0.24, 1.03, 0.53), wp(P, -0.05, 1.03, 0.68), 0.025);
  for (let i = 0; i < 3; i++) k.cyl('parchment', P, 1.05, 1.07 + i * 0.11, 0.4 - i * 0.05, 0.055, 0.7 - i * 0.08, 0, 0.2, Math.PI / 2);
  lanternAt(k, P, -1.05, 1.01, 0.35); macheteAt(k, P, 0.85, 1.05, 0.05, 1.3, 0);
  k.cyl('heliY', P, -0.55, 1.03, -0.05, 0.012, 0.22, 0, 0.8, Math.PI / 2, k.CYL6);
  for (const s of [-1, 1]) stoolAt(k, P, s * 0.7, 0.95);
  for (const [px, pz] of [[-0.75, -0.4], [0.42, 0.4]]) k.cyl('stoneL', P, px + 0.1, 1.04, pz + 0.05, 0.05, 0.04, 0, 0, 0, k.CYL6);
  const map = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.9), mapMaterial());
  map.matrixAutoUpdate = false; map.matrix.copy(T(-0.15, 1.016, 0.02, -Math.PI / 2, 0, 0.06)); map.matrixWorldNeedsUpdate = true; map.receiveShadow = true; k.root.add(map);
  return done(k, 'InvestigationTable');
}

/* ---------- radio lean-to with antenna mast ---------- */
export function commShelter() {
  const k = kit(), P = I, W = 4, D = 3;
  k.rbox('woodD', P, 0, 0.1, 0, W + 0.4, 0.2, D + 0.4, 0.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const h = sz < 0 ? 3.2 : 2.5; k.rbox('wood', P, sx * W / 2, h / 2, sz * D / 2, 0.18, h, 0.18, 0.04); }
  const roofA = Math.atan2(0.7, D); k.rbox('tarp', P, 0, 2.95, 0, W + 0.8, 0.08, D + 1.0, 0.03, roofA, 0, 0);
  for (let i = -2; i <= 2; i++) k.cyl('tarpD', P, i * 0.95, 3.0, 0, 0.05, D + 1.0, Math.PI / 2 + roofA, 0, 0, k.CYL6);
  k.rbox('woodL', P, 0, 0.9, -0.6, 3, 0.1, 1.1, 0.03);
  for (const a of [-1, 1]) for (const b of [-1, 1]) k.rbox('wood', P, a * 1.35, 0.43, -0.6 + b * 0.45, 0.1, 0.86, 0.1, 0.02);
  // Field radio with dials, tuning scale and status LED.
  k.rbox('olive', P, -0.4, 1.27, -0.8, 1.1, 0.62, 0.5, 0.06); k.rbox('oliveD', P, -0.4, 1.27, -0.54, 1.0, 0.52, 0.04, 0.02);
  for (let i = 0; i < 3; i++) k.cyl('chrome', P, -0.75 + i * 0.22, 1.12, -0.51, 0.055, 0.05, Math.PI / 2, 0, 0, k.CYL16);
  k.cyl('paper', P, 0, 1.38, -0.51, 0.13, 0.02, Math.PI / 2, 0, 0, k.CYL16); k.box('heliR', P, 0, 1.4, -0.5, 0.02, 0.1, 0.01, 0, 0, 0.5);
  for (let i = 0; i < 5; i++) k.box('iron', P, -0.62 + i * 0.07, 1.38, -0.515, 0.03, 0.24, 0.01);
  k.box('led', P, 0.17, 1.5, -0.515, 0.05, 0.05, 0.01); k.beam('chrome', wp(P, 0.05, 1.58, -0.9), wp(P, 0.35, 2.6, -1.0), 0.015);
  // Headphones, microphone and notebook.
  k.add('iron', new THREE.TorusGeometry(0.16, 0.02, 5, 12, Math.PI), C(P, T(0.6, 1.0, -0.4, Math.PI / 2, 0, 0)));
  for (const s of [-1, 1]) k.cyl('iron', P, 0.6 + s * 0.16, 0.99, -0.4, 0.07, 0.06, 0, 0, 0, k.CYL16);
  k.cyl('iron', P, 0.95, 0.99, -0.75, 0.08, 0.04, 0, 0, 0, k.CYL16); k.beam('chrome', wp(P, 0.95, 1.0, -0.75), wp(P, 0.95, 1.3, -0.7), 0.015);
  k.add('iron', k.SPH, C(P, T(0.95, 1.33, -0.69, 0, 0, 0, 0.06, 0.08, 0.06)));
  k.rbox('paper', P, 1.1, 0.97, -0.35, 0.35, 0.03, 0.45, 0.01, 0, -0.3, 0);
  // Batteries and cables.
  k.rbox('battery', P, -1.6, 0.25, 0.2, 0.6, 0.42, 0.38, 0.04);
  k.cyl('heliR', P, -1.75, 0.5, 0.2, 0.04, 0.06, 0, 0, 0, k.CYL6); k.cyl('iron', P, -1.45, 0.5, 0.2, 0.04, 0.06, 0, 0, 0, k.CYL6);
  for (let i = 0; i < 4; i++) k.cyl(i % 2 ? 'heliY' : 'battery', P, -1.1 + i * 0.15, 0.14, 0.55, 0.06, 0.24, 0, 0, 0, k.CYL6);
  k.tube('battery', [wp(P, -1.75, 0.52, 0.2), wp(P, -1.6, 0.7, -0.2), wp(P, -1.1, 0.92, -0.6), wp(P, -0.9, 1.2, -0.8)], 0.025, 5);
  k.tube('heliR', [wp(P, -1.45, 0.52, 0.2), wp(P, -1.2, 0.3, -0.1), wp(P, -1.0, 0.95, -0.7), wp(P, -0.85, 1.1, -0.82)], 0.025, 5);
  // Antenna mast with crossbars and three guy wires.
  const base = wp(P, 2.6, 0, -1.6), top = base.clone().add(V(0, 9, 0));
  k.beam('ironL', base, top, 0.07);
  for (let i = 0; i < 3; i++) { const yy = 5 + i * 1.3; k.beam('ironL', top.clone().setY(yy).add(V(-0.8 + i * 0.15, 0, 0)), top.clone().setY(yy).add(V(0.8 - i * 0.15, 0, 0)), 0.03); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28 + 0.3, st = base.clone().add(V(Math.cos(a) * 3.5, 0, Math.sin(a) * 3.5)); k.beam('iron', top.clone().add(V(0, -1.5, 0)), st, 0.012); stakeAt(k, st); }
  k.tube('battery', [wp(P, -0.4, 1.6, -1.05), wp(P, 0.5, 2.4, -1.4), wp(P, 1.6, 2.0, -1.7), base.clone().add(V(0, 2.5, 0))], 0.022, 5);
  stoolAt(k, P, -0.3, 0.5); crateAt(k, P, 1.7, 0, 0.6, 0.7, 0.2, 'olive');
  return done(k, 'CommShelter');
}

/* ---------- tarp-roofed storage shelter ---------- */
export function storageShelter({ seed = 4 } = {}) {
  const k = kit(), R = rng(seed), P = I, W = 6, D = 4;
  k.rbox('woodD', P, 0, 0.08, 0, W + 0.4, 0.16, D + 0.4, 0.04);
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) { const h = sz < 0 ? 3.4 : 2.7; if (sx === 0 && sz > 0) continue; k.rbox('wood', P, sx * W / 2, h / 2, sz * D / 2, 0.2, h, 0.2, 0.05); }
  const roofA = Math.atan2(0.7, D);
  for (let i = 0; i < 3; i++) k.rbox(i === 1 ? 'tarpD' : 'tarp', P, -W / 3 + i * W / 3, 3.08 - 0.08 * (i === 1), 0, W / 3 + 0.05, 0.07, D + 1.1, 0.03, roofA, 0, 0);
  for (const sz of [-1, 1]) k.rbox('woodD', P, 0, sz < 0 ? 3.3 : 2.62, sz * D / 2, W + 0.3, 0.16, 0.16, 0.04);
  [[-2.3, -1.2, 1], [-1.2, -1.3, 0.9], [-2.2, -0.1, 0.85], [-2.3, -1.2, 1, 1], [-1.15, -1.25, 0.7, 0.9]]
    .forEach(([cx, cz, s, lev]) => crateAt(k, P, cx, lev ? (lev === 1 ? 1 : 0.9) : 0, cz, s, R() * 0.3, R() < 0.3 ? 'olive' : 'woodL'));
  for (const [bx, bz] of [[0.2, -1.4], [1.0, -1.45], [0.6, -0.6]]) barrelAt(k, P, bx, 0, bz);
  barrelAt(k, P, 2.4, 0, 1.3, 0.8);
  for (let i = 0; i < 3; i++) sackAt(k, P, 1.7 + i * 0.55, 0, -1.3 + (i % 2) * 0.4, 1, R() * 3);
  sackAt(k, P, 1.9, 0.72, -1.1, 0.8, 0.4);
  for (let i = 0; i < 4; i++) k.add('rope', k.TOR, C(P, T(2.6, 0.12 + i * 0.11, 0.2, Math.PI / 2, 0, 0, 0.38, 0.38, 0.5)));
  backpackAt(k, P, -0.6, 0, 0.9, 0.5, 'tentO'); backpackAt(k, P, 0.1, 0, 1.1, -0.3, 'blanketR');
  blanketAt(k, P, -1.5, 0, 1.2, 0.3, 'blanketY'); blanketAt(k, P, -1.5, 0.28, 1.2, 0.25, 'blanketB');
  // Shelf of tins and two jerrycans.
  k.rbox('wood', P, 0, 1.0, -1.85, 2.2, 0.06, 0.5, 0.02); k.rbox('wood', P, 0, 1.7, -1.85, 2.2, 0.06, 0.5, 0.02);
  for (const s of [-1.05, 1.05]) k.rbox('woodD', P, s, 1.0, -1.85, 0.06, 2, 0.5, 0.02);
  for (let i = 0; i < 8; i++) k.cyl(i % 3 ? 'chrome' : 'heliO', P, -0.85 + i * 0.24, 1.13 + (i % 2) * 0.7, -1.85, 0.08, 0.2);
  for (const jx of [1.6, 2.05]) { k.rbox('olive', P, jx, 0.35, 1.7, 0.38, 0.7, 0.2, 0.04); k.box('oliveD', P, jx, 0.75, 1.7, 0.18, 0.08, 0.08); }
  shovelAt(k, P, W / 2 - 0.15, 0, D / 2 - 0.35, Math.PI / 2, 0.22); pickaxeAt(k, P, W / 2 - 0.2, 0, D / 2 - 0.75, Math.PI / 2, 0.25);
  shovelAt(k, P, -W / 2 + 0.2, 0, D / 2 - 0.35, -Math.PI / 2, 0.2);
  macheteAt(k, P, -1.2, 1.05, -1.25, 0.6, 0); bucketAt(k, P, 1.3, 0, 0.6); lanternAt(k, P, -2.2, 1.0, -0.6);
  return done(k, 'StorageShelter');
}

/* ---------- red Willys-style expedition jeep ---------- */
export function expeditionJeep() {
  const k = kit(), P = I;
  k.rbox('iron', P, 0, 0.62, 0, 1.7, 0.22, 4.1, 0.06);
  k.rbox('jeep', P, 0, 1.1, 0.2, 2.1, 0.72, 3.7, 0.18);
  k.rbox('jeep', P, 0, 1.36, 1.45, 1.95, 0.5, 1.25, 0.16);
  k.rbox('jeepD', P, 0, 1.15, 2.08, 1.75, 0.55, 0.08, 0.03);
  for (let i = -3; i <= 3; i++) k.box('iron', P, i * 0.2, 1.17, 2.13, 0.07, 0.42, 0.02);
  for (const s of [-1, 1]) { k.cyl('chrome', P, s * 0.68, 1.22, 2.12, 0.15, 0.06, Math.PI / 2, 0, 0, k.CYL16); k.cyl('glow', P, s * 0.68, 1.22, 2.15, 0.11, 0.02, Math.PI / 2, 0, 0, k.CYL16); }
  k.rbox('iron', P, 0, 0.66, 2.25, 2.2, 0.18, 0.18, 0.06); k.rbox('iron', P, 0, 0.66, -1.95, 2.2, 0.18, 0.18, 0.06);
  for (const s of [-1, 1]) for (const zz of [-1.25, 1.35]) k.rbox('jeep', P, s * 1.05, 1.0, zz, 0.42, 0.16, 1.15, 0.07);
  for (const s of [-1, 1]) k.rbox('dust', P, s * 1.06, 0.82, 0.2, 0.02, 0.22, 3.5, 0.01);
  // Windshield frame, seats, steering wheel and mirrors.
  for (const s of [-1, 1]) k.rbox('jeepD', P, s * 0.92, 1.95, 0.78, 0.07, 0.9, 0.07, 0.02, -0.15, 0, 0);
  k.rbox('jeepD', P, 0, 2.38, 0.72, 1.92, 0.07, 0.07, 0.02); k.rbox('glass', P, 0, 1.95, 0.78, 1.78, 0.82, 0.03, 0.01, -0.15, 0, 0);
  for (const s of [-1, 1]) { k.rbox('strap', P, s * 0.45, 1.42, 0.05, 0.7, 0.14, 0.6, 0.05); k.rbox('strap', P, s * 0.45, 1.75, -0.25, 0.7, 0.6, 0.12, 0.05); }
  k.rbox('strap', P, 0, 1.42, -1.1, 1.7, 0.14, 0.6, 0.05);
  k.add('iron', k.TOR, C(P, T(-0.45, 1.78, 0.6, -1.0, 0, 0, 0.19, 0.19, 0.3))); k.beam('iron', wp(P, -0.45, 1.55, 0.75), wp(P, -0.45, 1.78, 0.6), 0.03);
  for (const s of [-1, 1]) { k.beam('chrome', wp(P, s * 1.05, 1.6, 0.9), wp(P, s * 1.25, 1.85, 0.9), 0.02); k.rbox('chrome', P, s * 1.28, 1.9, 0.9, 0.05, 0.16, 0.22, 0.02); }
  // Roll bar and roof rack with cargo.
  for (const s of [-1, 1]) { k.beam('iron', wp(P, s * 0.98, 1.45, -0.6), wp(P, s * 0.98, 2.45, -0.6), 0.05); k.beam('iron', wp(P, s * 0.98, 1.45, -1.7), wp(P, s * 0.98, 2.45, -1.7), 0.05); }
  for (const zz of [-0.6, -1.15, -1.7]) k.beam('iron', wp(P, -1, 2.45, zz), wp(P, 1, 2.45, zz), 0.04);
  for (const s of [-1, 1]) k.beam('iron', wp(P, s, 2.45, -0.6), wp(P, s, 2.45, -1.7), 0.04);
  crateAt(k, P, -0.45, 2.48, -1.15, 0.62, 0.1); k.rbox('olive', P, 0.4, 2.73, -1.0, 0.36, 0.5, 0.2, 0.04); blanketAt(k, P, 0.45, 2.48, -1.5, 0, 'blanketY');
  // Dusty wheels and the spare on the tailgate.
  const wheel = (wx, wy, wz, rx = 0, rz = Math.PI / 2) => {
    k.cyl('tire', P, wx, wy, wz, 0.46, 0.34, rx, 0, rz, k.CYL16); k.cyl('dust', P, wx, wy, wz, 0.47, 0.16, rx, 0, rz, k.CYL16);
    k.cyl('chrome', P, wx + (rz ? Math.sign(wx) * 0.17 : 0), wy, wz + (rx ? -0.17 : 0), 0.22, 0.03, rx, 0, rz, k.CYL16);
  };
  for (const s of [-1, 1]) for (const zz of [-1.25, 1.35]) wheel(s, 0.46, zz);
  wheel(0, 1.15, -2.15, Math.PI / 2, 0); k.rbox('iron', P, 0, 1.15, -2.0, 0.3, 0.3, 0.12, 0.03);
  k.rbox('olive', P, 0.85, 1.15, -2.05, 0.36, 0.55, 0.18, 0.04);
  return done(k, 'ExpeditionJeep');
}

/* ---------- braced lookout tower with canvas roof and ladder ---------- */
export function expeditionWatchtower({ height = 6.2 } = {}) {
  const k = kit(), P = I, Hh = height, b = 1.6, tp = 1.15;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.beam('barkL', wp(P, sx * b, -0.3, sz * b), wp(P, sx * tp, Hh, sz * tp), 0.16, k.CYL);
  for (let i = 1; i < 3; i++) {
    const yy = i * Hh / 3, w = lerp(b, tp, yy / Hh);
    for (const s of [-1, 1]) { k.rbox('woodD', P, 0, yy, s * w, w * 2 + 0.3, 0.14, 0.14, 0.04); k.rbox('woodD', P, s * w, yy, 0, 0.14, 0.14, w * 2 + 0.3, 0.04); }
  }
  for (const s of [-1, 1]) { k.beam('woodD', wp(P, -b, 0.2, s * b), wp(P, tp, Hh - 0.3, s * tp), 0.07); k.beam('woodD', wp(P, s * b, 0.2, -b), wp(P, s * tp, Hh - 0.3, tp), 0.07); }
  k.rbox('woodL', P, 0, Hh, 0, tp * 2 + 0.9, 0.16, tp * 2 + 0.9, 0.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.rbox('wood', P, sx * (tp + 0.35), Hh + 1.2, sz * (tp + 0.35), 0.1, 2.4, 0.1, 0.02);
  for (const s of [-1, 1]) { k.rbox('woodD', P, 0, Hh + 0.9, s * (tp + 0.35), tp * 2 + 0.8, 0.08, 0.08, 0.02); k.rbox('woodD', P, s * (tp + 0.35), Hh + 0.9, 0, 0.08, 0.08, tp * 2 + 0.8, 0.02); }
  for (const s of [-1, 1]) k.rbox('tentO', P, s * 0.85, Hh + 2.75, 0, 1.85, 0.08, tp * 2 + 1.5, 0.03, 0, 0, -s * 0.5);
  for (const s of [-0.28, 0.28]) k.beam('woodL', wp(P, s, 0, b + 1.3), wp(P, s, Hh + 0.4, tp + 0.45), 0.045);
  for (let i = 1; i < 18; i++) { const t = i / 18, z = lerp(b + 1.3, tp + 0.45, t); k.beam('wood', wp(P, -0.28, t * Hh, z), wp(P, 0.28, t * Hh, z), 0.03); }
  lanternAt(k, P, 0.6, Hh + 0.08, -0.6); blanketAt(k, P, -0.5, Hh + 0.08, 0.3, 0.4, 'blanketR');
  return done(k, 'ExpeditionWatchtower');
}

/* ---------- arched plank footbridge for streams ---------- */
export function plankFootbridge({ length = 10, seed = 6 } = {}) {
  const k = kit(), R = rng(seed), n = Math.max(8, Math.round(length * 2.6)), half = length / 2;
  const at = u => V(0, 0.3 + Math.sin(Math.PI * u) * 0.7, lerp(-half, half, u));
  for (let i = 0; i <= n; i++) { const p = at(i / n); k.rbox(R() < 0.5 ? 'woodL' : 'wood', I, p.x, p.y, p.z, 1.9, 0.12, 0.32, 0.03, (R() - 0.5) * 0.04, (R() - 0.5) * 0.05, 0); }
  for (const sd of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = at(i / n).add(V(sd * 0.8, 0, 0)), b = at((i + 1) / n).add(V(sd * 0.8, 0, 0));
      k.beam('woodD', a.clone().add(V(0, -0.13, 0)), b.clone().add(V(0, -0.13, 0)), 0.12); k.beam('woodL', a.clone().add(V(0, 0.95, 0)), b.clone().add(V(0, 0.95, 0)), 0.05);
    }
    for (let i = 0; i <= n; i += 5) { const p = at(i / n).add(V(sd * 0.85, 0, 0)); k.beam('woodD', p.clone().add(V(0, -0.1, 0)), p.clone().add(V(0, 1.0, 0)), 0.07, k.CYL); }
    for (const u of [0.35, 0.65]) { const p = at(u).add(V(sd * 0.75, 0, 0)); k.beam('woodD', V(p.x, -1.4, p.z), p.clone().add(V(0, -0.12, 0)), 0.12, k.CYL); }
  }
  return done(k, 'PlankFootbridge');
}

/* ---------- log gateway with a carved trail sign ---------- */
export function logGateway({ text = 'CAMPAMENTO PERDIDO', seed = 8 } = {}) {
  const k = kit(), R = rng(seed);
  const bromeliad = (x, y, z) => {
    const base = V(x, y, z);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + R() * 0.4; k.beam(i % 2 ? 'leafL' : 'leaf', base, base.clone().add(V(Math.cos(a) * 0.55, 0.3, Math.sin(a) * 0.55)), 0.14, k.LEAF); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; k.beam('heliR', base, base.clone().add(V(Math.cos(a) * 0.15, 0.4, Math.sin(a) * 0.15)), 0.08, k.LEAF); }
  };
  const vine = (x, y, z, len) => {
    let p = V(x, y, z);
    for (let i = 0; i < 8; i++) {
      const q = p.clone().add(V((R() - 0.5) * 0.25, -len / 8, (R() - 0.5) * 0.25)); k.beam('vine', p, q, 0.025); p = q;
      if (i % 2) { const a = R() * 6.28; k.beam(i % 4 === 1 ? 'leafL' : 'leafD', p, p.clone().add(V(Math.cos(a) * 0.3, 0.08, Math.sin(a) * 0.3)), 0.1, k.LEAF); }
    }
  };
  for (const s of [-1, 1]) {
    k.cyl('barkL', I, s * 3.2, 2.6, 0, 0.32, 5.6, 0, 0, s * 0.04);
    for (let i = 0; i < 2; i++) bromeliad(s * 3.2 + (i - 0.5) * 0.3, 5.2, (i - 0.5) * 0.3);
    vine(s * 3.2, 5.2, 0.3, 2.5 + R() * 2);
  }
  k.cyl('barkL', I, 0, 5.2, 0, 0.3, 7.6, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) k.cyl('woodEnd', I, s * 3.8, 5.2, 0, 0.28, 0.02, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) k.beam('rope', V(s * 1.9, 5.1, 0.2), V(s * 1.9, 4.4, 0.2), 0.03);
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#8a5f38'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#6d4729'; for (let i = 0; i < 5; i++) x.fillRect(0, i * 20 + 6, 512, 3);
  x.fillStyle = '#f6e7bd'; x.font = 'bold 46px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50, 480);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.82, 0.08), [
    ...Array(4).fill(mat('woodD')), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), mat('woodD'),
  ]);
  sign.matrixAutoUpdate = false; sign.matrix.copy(T(0, 4.0, 0.2)); sign.matrixWorldNeedsUpdate = true; sign.castShadow = sign.receiveShadow = true; k.root.add(sign);
  const out = done(k, 'LogGateway');
  let disposed = false;
  out.userData.dispose = () => { if (!disposed) { disposed = true; tex.dispose(); sign.material[4].dispose(); } };
  return out;
}
