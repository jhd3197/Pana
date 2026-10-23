import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
export const MAP = {
  name: 'Pana Cosmos',
  seed: 20261023,
  sun: { dir: [-0.42, 0.74, -0.52], color: '#fff1dc', intensity: 2.2, hemi: 0.32, shadow: { center: [60, 0, 60], half: 980 } },
  fog: {
    space: { color: '#07081c', near: 2200, far: 11000 },
    wormhole: { color: '#2a0a3e', near: 30, far: 520 },
  },

  road: {
    width: 13,
    start: [100, 704],
    // Segment types: l la luna, d el despegue, a el anillo, c el cinturón, t la tormenta, g el agujero de gusano.
    tint: { l: '#5c5c66', d: '#545a6c', a: '#80828f', c: '#6c5c56', t: '#5a5a7c', g: '#6a5a80' },
    glow: { l: '#ffd23a', d: '#3ab8ff', a: '#ffe68a', c: '#ff8a3a', t: '#9a8aff', g: '#ff4fd8' },
    bankMax: 0.12,
    // Entries: { p:[x,y,z], seg, w? } a world point
    //          { polar:[deg, r, y], seg, w? } a point around Araguaney
    //          { arc:{ from, to, step, r, y }, seg } points along a circle around Araguaney
    points: [
      { p: [330, 6, 690], seg: 'l' }, { p: [220, 0, 700], seg: 'l' }, { p: [100, 0, 704], seg: 'l' },
      { p: [-20, 0, 700], seg: 'l' }, { p: [-130, 2, 688], seg: 'l' },
      { p: [-240, 8, 664], seg: 'd' }, { p: [-345, 20, 614], seg: 'd' }, { p: [-440, 32, 542], seg: 'd' },
      { p: [-512, 40, 452], seg: 'd' }, { p: [-552, 40, 352], seg: 'd' },
      { p: [-556, 34, 255], seg: 'a' }, { p: [-525, 24, 165], seg: 'a' }, { p: [-462, 13, 92], seg: 'a' }, { p: [-392, 5, 42], seg: 'a' },
      { arc: { from: 186, to: 258, step: 8, r: 330, y: 0.4 }, seg: 'a' },
      { polar: [266, 352, 2], seg: 'a' },
      { polar: [274, 400, 8], seg: 'c' }, { polar: [281, 455, 16], seg: 'c' }, { polar: [288, 510, 24], seg: 'c' },
      { polar: [295, 548, 33], seg: 'c' }, { polar: [302, 522, 41], seg: 'c' }, { polar: [309, 560, 47], seg: 'c' },
      { polar: [316, 602, 46], seg: 'c' }, { polar: [323, 578, 42], seg: 'c' },
      { polar: [331, 620, 46], seg: 't' }, { polar: [340, 665, 53], seg: 't' }, { polar: [350, 700, 57], seg: 't' },
      { polar: [360, 715, 52], seg: 't' }, { polar: [370, 722, 44], seg: 't' }, { polar: [378, 728, 38], seg: 't' },
      { polar: [386, 736, 32], seg: 'g' }, { polar: [394, 745, 26], seg: 'g' }, { polar: [402, 750, 21], seg: 'g' },
      { polar: [410, 752, 16], seg: 'g' }, { polar: [418, 750, 12], seg: 'g' },
    ],
  },
  // The moon under the start: a sphere, a flat-topped mesa for the base, craters. Terrain is procedural around the start.
  moon: {
    center: [100, -600, 700], radius: 600,
    patch: { size: 600, cell: 2.5, fade: [235, 285] },
    mesa: { y: -2, from: 190, to: 270 },
    craters: [[180, 640, 26, 5], [-10, 770, 34, 6], [60, 600, 18, 3], [230, 790, 22, 4], [-60, 640, 15, 3], [150, 830, 40, 7]],
    smallCraters: 90, shoulder: 26, sink: 4,
  },
  // Things on the moon base, placed along the road from the start line: at [metres along, metres to the side].
  base: [
    { kind: 'domo', at: [-30, 34], scale: 11 }, { kind: 'domo', at: [-8, 52], scale: 7 }, { kind: 'domo', at: [26, 40], scale: 9 },
    { kind: 'tubo', from: [-30, 34], to: [-8, 52] }, { kind: 'tubo', from: [-8, 52], to: [26, 40] },
    { kind: 'invernadero', at: [60, 36], scale: 10 },
    { kind: 'plataforma', at: [-70, -40], scale: 13 },
    { kind: 'radar', at: [-50, 26], scale: 6 },
    { kind: 'antena', at: [10, 22], scale: 20 },
    { kind: 'paneles', at: [100, 30], rows: 3, cols: 6 }, { kind: 'paneles', at: [110, -34], rows: 2, cols: 7 },
    { kind: 'rover', at: [-20, -22], rot: 0.6 },
    { kind: 'chiguire', at: [8, -17], scale: 2.4 },
  ],
  planets: {
    araguaney: { center: [0, 0, 0], radius: 180, spin: 0.012, tilt: 0, atmosphere: '#ffd36a',
      ring: { inner: 230, outer: 410, chunks: 3200 } },
    catatumbo: { polar: [350, 1180, 40], radius: 260, spin: 0.02, atmosphere: '#b07aff', bolts: 9, rate: 3 },
    tierraDeGracia: { at: [-2700, 900, -3300], radius: 560, spin: 0.01, atmosphere: '#7ad0ff' },
    cocuy: { orbit: { r: 470, y: -125, speed: 0.025, phase: 2.2 }, radius: 30 },
  },
  belt: {
    // dense where the road weaves, sparse far away all round
    dense: { from: 255, to: 335, r: [450, 780], y: [-45, 100], count: 1500 },
    far: { r: [1350, 2300], y: [-300, 300], count: 380 },
    giants: [{ polar: [300, 650, 30], size: 46 }, { polar: [291, 440, 6], size: 30 }, { polar: [313, 470, 70], size: 28 }, { polar: [326, 700, 80], size: 34 }],
    tumble: 320,
  },
  station: { at: [-1500, 420, -1250], radius: 130, spin: 0.05 },
  satellites: 7,
  comet: { every: 38, distance: 5200 },
  hoops: { every: 70 },
  // dir +1 goes our way (slow, to be overtaken), -1 comes towards us and hugs its side.

};

export function createLayout() {
  const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0), DEG = PI / 180;
  const rand = rng(MAP.seed);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = arr => pickRandom(arr, rand);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const col = hex => new THREE.Color(hex);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const d = new THREE.Object3D();
  const uTime = { value: 0 };
  const hash1 = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const O = V3(...MAP.planets.araguaney.center);
  const polar = (deg, r, y) => V3(O.x + r * Math.cos(deg * DEG), y, O.z + r * Math.sin(deg * DEG));

  /* ---------------- noise (JS for textures, GLSL for shaders) ---------------- */
  const ih = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const a = lerp(lerp(ih(xi, yi, zi), ih(xi + 1, yi, zi), u), lerp(ih(xi, yi + 1, zi), ih(xi + 1, yi + 1, zi), u), v);
    const b = lerp(lerp(ih(xi, yi, zi + 1), ih(xi + 1, yi, zi + 1), u), lerp(ih(xi, yi + 1, zi + 1), ih(xi + 1, yi + 1, zi + 1), u), v);
    return lerp(a, b, w);
  }
  const fbm3 = (x, y, z, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };
  const NOISE_GLSL = `
    float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float noise3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * noise3(p); p *= 2.03; a *= 0.5; } return s / 0.97; }`;

  /* ---------------- the route ---------------- */
  const CTRL = [];
  for (const e of MAP.road.points) {
    const w = e.w ?? MAP.road.width;
    if (e.arc) { const a = e.arc, n = Math.round((a.to - a.from) / a.step); for (let k = 0; k <= n; k++) { const p = polar(a.from + (a.to - a.from) * k / n, a.r, a.y); CTRL.push({ p, seg: e.seg, w }); } }
    else if (e.polar) CTRL.push({ p: polar(...e.polar), seg: e.seg, w });
    else CTRL.push({ p: V3(...e.p), seg: e.seg, w });
  }
  const roadCurve = new THREE.CatmullRomCurve3(CTRL.map(c => c.p), true, 'centripetal');
  const ROAD_LEN = roadCurve.getLength(), NR = Math.round(ROAD_LEN);
  const RP = roadCurve.getSpacedPoints(NR).slice(0, NR);
  fairRoute(RP, 16);
  const SEG = [], hwA = new Float32Array(NR);
  for (let i = 0; i < NR; i++) {
    const t = roadCurve.getUtoTmapping(i / NR) * CTRL.length, a = Math.floor(t) % CTRL.length, b = (a + 1) % CTRL.length;
    SEG.push(CTRL[a].seg); hwA[i] = Math.max(8, lerp(CTRL[a].w, CTRL[b].w, t - Math.floor(t)) / 2);
  }
  const HW0 = MAP.road.width / 2;
  const roadY = new Float32Array(NR), bank = new Float32Array(NR);
  for (let i = 0; i < NR; i++) roadY[i] = RP[i].y;
  const wrap = i => ((i % NR) + NR) % NR;
  fairHeights(RP, roadY);
  for (let i = 0; i < NR; i++) RP[i].y = roadY[i];
  const roadFrame = i => { const p = RP[wrap(i)], q = RP[wrap(i + 1)], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize(); return { p, t, n: V3(-t.z, 0, t.x) }; };
  // banked turns everywhere but on the moon straight: the inside of the turn sits lower
  {
    const raw = new Float32Array(NR), bm = MAP.road.bankMax;
    for (let i = 0; i < NR; i++) {
      if (SEG[i] === 'l') continue;
      const a = roadFrame(i - 14).t, b = roadFrame(i + 14).t, f = roadFrame(i);
      raw[i] = clamp(-b.clone().sub(a).dot(f.n) * 0.09, -bm, bm);
    }
    for (let i = 0; i < NR; i++) { let s = 0; for (let j = -24; j <= 24; j++) s += raw[wrap(i + j)]; bank[i] = s / 49; }
  }
  const roadAt = (i, lat, dy = 0) => { const k = wrap(i), f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const idxNear = (x, z) => { let b = 0, bd = 1e18; for (let i = 0; i < NR; i++) { const q = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (q < bd) { bd = q; b = i; } } return b; };
  const segRange = s => { let a = -1, b = -1; for (let i = 0; i < NR; i++) if (SEG[i] === s) { if (a < 0) a = i; b = i; } return [a, b]; };
  // 3D grid of road samples for clearance checks
  const GC = 24, grid = new Map(), gkey = (x, y, z) => `${Math.floor(x / GC)},${Math.floor(y / GC)},${Math.floor(z / GC)}`;
  RP.forEach((p, i) => { const k = gkey(p.x, p.y, p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  function roadDist3(p) {
    const cx = Math.floor(p.x / GC), cy = Math.floor(p.y / GC), cz = Math.floor(p.z / GC); let best = 1e9, bi = -1;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const l = grid.get(`${cx + a},${cy + b},${cz + c}`); if (!l) continue;
      for (const i of l) { const q = RP[i]; const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2; if (dd < best) { best = dd; bi = i; } }
    }
    return { d: Math.sqrt(best), i: bi };
  }
  const i0 = idxNear(...MAP.road.start);
  const startFrame = roadFrame(i0);
  const atBase = (along, lat) => roadAt(i0 + Math.round(along), lat, 0);

  /* ---------------- the moon: procedural terrain around the start, a sphere beyond ---------------- */
  const MO = MAP.moon, MC = V3(...MO.center), MR = MO.radius, PATCH = MO.patch, PH = PATCH.size / 2;
  const craters = MO.craters.map(c => c.slice());
  for (let k = 0; k < MO.smallCraters; k++) { const a = rand() * TAU, r = Math.sqrt(rand()) * 260; craters.push([MC.x + Math.cos(a) * r, MC.z + Math.sin(a) * r, rr(3, 11), rr(0.6, 2)]); }
  const craterH = (x, z) => {
    let h = 0;
    for (const [cx, cz, r, dep] of craters) {
      const dd = Math.hypot(x - cx, z - cz); if (dd > r * 1.8) continue;
      const q = dd / r; h += q < 1 ? -dep * (1 - q * q) + dep * 0.25 : dep * 0.25 * Math.exp(-(((q - 1) / 0.35) ** 2));
    }
    return h;
  };
  const sphereTop = (x, z) => { const dd = Math.hypot(x - MC.x, z - MC.z); return dd < MR ? Math.sqrt(MR * MR - dd * dd) - MR + MC.y + MR : MC.y; };
  const moonNatural = (x, z) => {
    const dd = Math.hypot(x - MC.x, z - MC.z), sph = sphereTop(x, z);
    const mesa = 1 - sstep(MO.mesa.from, MO.mesa.to, dd);
    // the rim of the disc settles onto the sphere, which sits a little lower so the two never fight
    return lerp(sph, MO.mesa.y, mesa) - MO.sink * sstep(PH - 45, PH - 8, dd) + craterH(x, z) * (1 - sstep(PATCH.fade[0], PATCH.fade[1], dd)) + (1 - sstep(PATCH.fade[0], PATCH.fade[1], dd)) * 0.6 * Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * Math.cos(z * 0.06);
  };
  // 2D raster of the road near the moon for the carve
  const GR = Math.round(PATCH.size / PATCH.cell), CELL = PATCH.size / GR, X0 = MC.x - PH, Z0 = MC.z - PH;
  const R2 = (() => {
    const far = 60, dist = new Float32Array(GR * GR).fill(far), idx = new Int32Array(GR * GR).fill(-1), rc = Math.ceil(far / CELL);
    for (let i = 0; i < NR; i++) {
      const p = RP[i]; if (Math.abs(p.x - MC.x) > PH + far || Math.abs(p.z - MC.z) > PH + far) continue;
      const cx = Math.floor((p.x - X0) / CELL), cz = Math.floor((p.z - Z0) / CELL);
      for (let z = Math.max(0, cz - rc); z <= Math.min(GR - 1, cz + rc); z++) for (let x = Math.max(0, cx - rc); x <= Math.min(GR - 1, cx + rc); x++) {
        const dd = Math.hypot(X0 + (x + 0.5) * CELL - p.x, Z0 + (z + 0.5) * CELL - p.z), k = z * GR + x;
        if (dd < dist[k]) { dist[k] = dd; idx[k] = i; }
      }
    }
    return { dist, idx, far };
  })();
  const sampleR = (x, z) => {
    const fx = (x - X0) / CELL - 0.5, fz = (z - Z0) / CELL - 0.5;
    if (fx < 0 || fz < 0 || fx > GR - 1 || fz > GR - 1) return { dist: 99, i: -1 };
    const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0, k = z0 * GR + x0, x1 = Math.min(1, GR - 1 - x0), z1 = Math.min(1, GR - 1 - z0) * GR;
    return { dist: lerp(lerp(R2.dist[k], R2.dist[k + x1], tx), lerp(R2.dist[k + z1], R2.dist[k + z1 + x1], tx), tz), i: R2.idx[clamp(Math.round(fz), 0, GR - 1) * GR + clamp(Math.round(fx), 0, GR - 1)] };
  };
  function moonH(x, z) {
    let h = moonNatural(x, z);
    const r = sampleR(x, z);
    if (r.i >= 0) {
      const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z, hw = hwA[r.i];
      const target = roadY[r.i] + bank[r.i] * clamp(lat, -hw, hw) - 0.15;
      const w = (1 - sstep(hw + 0.5, hw + MO.shoulder, r.dist)) * (1 - sstep(12, 40, Math.abs(h - target)));
      if (w > 0) h = lerp(h, target, w);
    }
    return h;
  }
  const cMoon = col('#6e6e78'), cMare = col('#3e3e48'), cRim = col('#9a9894'), cDust = col('#847c70');
  const moonColor = (x, z, y, slope, tmp) => {
    const n = fbm3(x * 0.008, 0.3, z * 0.008, 3), m = fbm3(x * 0.05, 1.7, z * 0.05, 2);
    tmp.copy(cMoon).lerp(cMare, sstep(0.45, 0.7, n) * 0.8).lerp(cDust, m * 0.25);
    const ch = craterH(x, z); if (ch > 0.2) tmp.lerp(cRim, clamp(ch * 0.3, 0, 0.5)); if (ch < -0.4) tmp.multiplyScalar(0.85);
    tmp.multiplyScalar(1 - sstep(0.3, 0.8, slope) * 0.25);
    return tmp;
  };

  return { PI, TAU, UP, DEG, rand, rr, pick, clamp, sstep, lerp, col, V3, d, uTime, hash1, O, polar, ih, noise3, fbm3, NOISE_GLSL, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, roadY, bank, wrap, roadFrame, roadAt, idxNear, segRange, GC, grid, gkey, roadDist3, i0, startFrame, atBase, MO, MC, MR, PATCH, PH, craters, craterH, sphereTop, moonNatural, GR, CELL, X0, Z0, R2, sampleR, moonH, cMoon, cMare, cRim, cDust, moonColor };
}
