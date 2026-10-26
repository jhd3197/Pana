// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
export const MAP = {
  name: 'Pana Nubes',
  seed: 20261023,
  sun: { dir: [-0.62, 0.36, -0.7], color: '#ffd6a8', intensity: 2.4, hemi: 0.5, shadow: { center: [40, 10, -20], half: 460 } },
  fog: { color: '#eaa086', near: 700, far: 5600 },
  clouds: { level: -70, puffs: 160 },

  // Floating islands: centre, radius, height of the top, depth of the rocky underside.
  islands: [
    { name: 'A', at: [0, 240], r: 135, top: 0, depth: 150, kind: 'pueblo' },
    { name: 'B', at: [320, 150], r: 72, top: 6, depth: 90, kind: 'bosque' },
    { name: 'C', at: [330, -65], r: 88, top: 14, depth: 110, kind: 'cascada' },
    { name: 'D', at: [25, -270], r: 78, top: 44, depth: 120, kind: 'globos' },
    { name: 'F', at: [-225, 55], r: 55, top: 3, depth: 80, kind: 'papagayos' },
  ],
  // Little islands with no road, just for the view.
  islets: 14,
  spire: { at: [-250, -110], r: 30, top: 56, bottom: -170 },
  road: {
    width: 13,
    start: [0, 250],
    // Segment types: i la isla, p el puente colgante, c la cascada, a el arcoíris, g los globos, e la espiral, f los papagayos.
    tint: { i: '#6a6460', p: '#8a6a48', c: '#646058', a: '#ffffff', g: '#6a6268', e: '#5e5a58', f: '#6a6460' },
    // { p:[x,y,z] } a set height; { p:[x,z] } a height spread evenly between the set points either side;
    // { spiral:{ center, r, from, to, step, y0, y1 } } points round the stone needle (angles in degrees).
    points: [
      { p: [-110, 0, 248], seg: 'i' }, { p: [-40, 0, 250], seg: 'i' }, { p: [40, 0, 250], seg: 'i' }, { p: [110, 0, 240], seg: 'i' },
      { p: [170, 218], seg: 'p' }, { p: [225, 203], seg: 'p' }, { p: [272, 192], seg: 'p' }, { p: [325, 178], seg: 'p' }, { p: [358, 135], seg: 'p' }, { p: [360, 90], seg: 'p' },
      { p: [400, 30], seg: 'c' }, { p: [335, -30], seg: 'c' }, { p: [305, -90], seg: 'c' }, { p: [272, 16, -135], seg: 'c' },
      { p: [250, -210], seg: 'a' }, { p: [215, -280], seg: 'a' }, { p: [170, -330], seg: 'a' }, { p: [125, -345], seg: 'a' }, { p: [100, 44, -305], seg: 'a' },
      { p: [60, 44, -278], seg: 'g' }, { p: [0, 44, -265], seg: 'g' }, { p: [-55, 44, -262], seg: 'g' },
      { p: [-130, -240], seg: 'e' }, { p: [-210, -190], seg: 'e' },
      { spiral: { center: [-250, -110], r: 48, from: 239, to: -564, step: -11, y0: 42, y1: 4 }, seg: 'e' },
      { p: [-272, -40], seg: 'f' }, { p: [-245, 25], seg: 'f' }, { p: [-215, 85], seg: 'f' }, { p: [-185, 150], seg: 'f' }, { p: [-150, 215], seg: 'f' },
    ],
    shoulder: 16,
  },
  waterfall: { island: 'C', from: [362, -62], to: [430, -64], width: 6, drop: 150 },
  village: { houses: 18, windmills: [[-70, 190], [80, 300], [-30, 330]], plaza: [0, 215] },
  balloons: { count: 7, around: 'D', r: [120, 200], y: [80, 140] },
  kites: { count: 9, island: 'F' },
  macaws: { flocks: 3, perFlock: 6 },
  vegetation: { trees: 520, flowers: 900, grass: 6000, rocks: 160, roots: 700 },

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
  const ih = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const noise2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(ih(xi, yi), ih(xi + 1, yi), u), lerp(ih(xi, yi + 1), ih(xi + 1, yi + 1), u), v); };
  const fbm2 = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };

  /* ---------------- the route ---------------- */
  const CTRL = [];
  for (const e of MAP.road.points) {
    if (e.spiral) { const s = e.spiral, n = Math.round((s.to - s.from) / s.step); for (let k = 0; k <= n; k++) { const a = (s.from + (s.to - s.from) * k / n) * DEG; CTRL.push({ x: s.center[0] + Math.cos(a) * s.r, z: s.center[1] + Math.sin(a) * s.r, y: lerp(s.y0, s.y1, k / n), seg: e.seg, w: MAP.road.width }); } }
    else CTRL.push({ x: e.p[0], z: e.p.length === 3 ? e.p[2] : e.p[1], y: e.p.length === 3 ? e.p[1] : null, seg: e.seg, w: e.w ?? MAP.road.width });
  }
  {
    const n = CTRL.length, anchors = CTRL.map((c, i) => (c.y !== null ? i : -1)).filter(i => i >= 0);
    for (let a = 0; a < anchors.length; a++) {
      const i0 = anchors[a], i1 = anchors[(a + 1) % anchors.length], run = [];
      for (let k = i0; ; k = (k + 1) % n) { run.push(k); if (k === i1 && run.length > 1) break; }
      let total = 0; const acc = [0]; for (let k = 1; k < run.length; k++) { total += Math.hypot(CTRL[run[k]].x - CTRL[run[k - 1]].x, CTRL[run[k]].z - CTRL[run[k - 1]].z); acc.push(total); }
      for (let k = 1; k < run.length - 1; k++) CTRL[run[k]].y = lerp(CTRL[i0].y, CTRL[i1].y, acc[k] / total);
    }
  }
  const roadCurve = new THREE.CatmullRomCurve3(CTRL.map(c => V3(c.x, c.y, c.z)), true, 'centripetal');
  const ROAD_LEN = roadCurve.getLength(), NR = Math.round(ROAD_LEN);
  const RP = roadCurve.getSpacedPoints(NR).slice(0, NR);
  fairRoute(RP, 16);
  const SEG = [], hwA = new Float32Array(NR);
  for (let i = 0; i < NR; i++) { const t = roadCurve.getUtoTmapping(i / NR) * CTRL.length, a = Math.floor(t) % CTRL.length, b = (a + 1) % CTRL.length; SEG.push(CTRL[a].seg); hwA[i] = Math.max(8, lerp(CTRL[a].w, CTRL[b].w, t - Math.floor(t)) / 2); }
  const HW0 = MAP.road.width / 2, wrap = i => ((i % NR) + NR) % NR;
  const roadY = new Float32Array(NR), bank = new Float32Array(NR);
  for (let i = 0; i < NR; i++) roadY[i] = RP[i].y;
  fairHeights(RP, roadY);
  for (let i = 0; i < NR; i++) RP[i].y = roadY[i];
  const roadFrame = i => { const p = RP[wrap(i)], q = RP[wrap(i + 1)], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize(); return { p, t, n: V3(-t.z, 0, t.x) }; };
  {
    const raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) { if (SEG[i] === 'i') continue; const a = roadFrame(i - 12).t, b = roadFrame(i + 12).t, f = roadFrame(i); raw[i] = clamp(-b.clone().sub(a).dot(f.n) * 0.08, -0.09, 0.09); }
    for (let i = 0; i < NR; i++) { let s = 0; for (let j = -18; j <= 18; j++) s += raw[wrap(i + j)]; bank[i] = s / 37; }
  }
  const roadAt = (i, lat, dy = 0) => { const k = wrap(i), f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const idxNear = (x, z) => { let b = 0, bd = 1e18; for (let i = 0; i < NR; i++) { const q = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (q < bd) { bd = q; b = i; } } return b; };
  const i0 = idxNear(...MAP.road.start);
  // 3D grid of road samples for clearance checks
  const GC = 24, grid = new Map(), gkey = (x, y, z) => `${Math.floor(x / GC)},${Math.floor(y / GC)},${Math.floor(z / GC)}`;
  RP.forEach((p, i) => { const k = gkey(p.x, roadY[i], p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  const roadDist3 = p => { const cx = Math.floor(p.x / GC), cy = Math.floor(p.y / GC), cz = Math.floor(p.z / GC); let best = 1e9, bi = -1; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const l = grid.get(`${cx + a},${cy + b},${cz + c}`); if (!l) continue; for (const i of l) { const dd = (RP[i].x - p.x) ** 2 + (roadY[i] - p.y) ** 2 + (RP[i].z - p.z) ** 2; if (dd < best) { best = dd; bi = i; } } } return { d: Math.sqrt(best), i: bi }; };
  // 2D distance to the road, for things on the ground of an island at height y
  const roadDistAt = (x, z, y) => { let best = 1e9; const cx = Math.floor(x / GC), cy = Math.floor(y / GC), cz = Math.floor(z / GC); for (let a = -2; a <= 2; a++) for (let b = -1; b <= 1; b++) for (let c = -2; c <= 2; c++) { const l = grid.get(`${cx + a},${cy + b},${cz + c}`); if (!l) continue; for (const i of l) best = Math.min(best, Math.hypot(RP[i].x - x, RP[i].z - z)); } return best; };

  return { PI, TAU, UP, DEG, rand, rr, pick, clamp, sstep, lerp, col, V3, d, uTime, ih, noise2, fbm2, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, i0, GC, grid, gkey, roadDist3, roadDistAt };
}
