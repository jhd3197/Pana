import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
export const MAP = {
  name: 'Pana Arrecife',
  seed: 20261023,
  world: { center: [-25, 45], size: 960, cell: 3, far: { size: 7000, segs: 160 } },
  sun: { dir: [0.35, 0.86, 0.36], color: '#fff6e6', intensity: 2.3, hemi: 0.55, shadowHalf: 540 },
  sea: {
    surface: 70,
    above: { color: '#bfe6f2', near: 900, far: 7000 },
    shallow: { color: '#27a9c2', near: 20, far: 330 },
    deep: { color: '#08304e', near: 12, far: 210 },
    deepFrom: -6, deepTo: -26,                         // fog turns from shallow to deep as the camera sinks between these heights
  },
  // The seabed: sand dunes, a reef ledge, a trench, a cay that breaks the surface.
  seabed: {
    base: -2, dunes: 1.6,
    trench: { width: 54, wall: 12, points: [[-170, -230, -4], [-230, -180, -14], [-280, -100, -22], [-302, -30, -30], [-302, 40, -31], [-295, 110, -31], [-268, 160, -28], [-300, 212, -22], [-345, 238, -16], [-385, 285, -9], [-370, 335, -4]] },
    cay: { at: [420, 400], r: 150, top: 75 },
    shelf: { from: 560, to: 1500, drop: 40 },
  },

  road: {
    width: 13,
    start: [0, 300],
    // Segment types: a el banco de arena, r el arrecife, g el galeón, k el bosque de algas, f la fosa, b la subida de la ballena.
    shoulder: { a: 14, r: 14, g: 14, k: 14, f: 18, b: 18 },
    tint: { a: '#8a8478', r: '#6e6a66', g: '#6a6258', k: '#5e6a62', f: '#4e5664', b: '#5e6670' },
    glow: { a: '#7af0ff', r: '#ff7ab0', g: '#ffd23a', k: '#7aff9a', f: '#b07aff', b: '#5ab8ff' },
    // { p:[x,y,z] } a point at a set height; { p:[x,z] } a point whose height is spread evenly between the set points either side.
    points: [
      { p: [-200, 0, 300], seg: 'a' }, { p: [-100, 0, 300], seg: 'a' }, { p: [0, 0, 300], seg: 'a' }, { p: [100, 0, 300], seg: 'a' }, { p: [180, 0.5, 290], seg: 'a' },
      { p: [245, 1, 268], seg: 'r' }, { p: [285, 5, 220], seg: 'r' }, { p: [262, 1, 165], seg: 'r' }, { p: [300, 6, 110], seg: 'r' }, { p: [338, 2, 60], seg: 'r' }, { p: [320, 4, 5], seg: 'r' },
      { p: [290, 4, -60], seg: 'g' }, { p: [262, 4, -115], seg: 'g' }, { p: [215, 4, -160], seg: 'g' },
      { p: [160, 3, -200], seg: 'k' }, { p: [90, 1, -232], seg: 'k' }, { p: [20, -1, -250], seg: 'k' }, { p: [-60, -4, -252], seg: 'k' }, { p: [-140, -8, -238], seg: 'k' }, { p: [-200, -12, -205], seg: 'k' },
      { p: [-245, -160], seg: 'f' }, { p: [-280, -100], seg: 'f' }, { p: [-300, -28, -30], seg: 'f' }, { p: [-305, -30, 40], seg: 'f' }, { p: [-295, -30, 110], seg: 'f' },
      { p: [-262, -27, 165], seg: 'b' }, { p: [-300, 215], seg: 'b' }, { p: [-360, 240], seg: 'b' }, { p: [-390, 290], seg: 'b' }, { p: [-350, 340], seg: 'b' }, { p: [-280, 345], seg: 'b' }, { p: [-230, 320], seg: 'b' },
    ],
  },
  galleon: { road: [262, -115], length: 46, beam: 11, depth: 7, clearance: 9, roll: 0.12, pitch: 0.05 },
  reef: { zone: [[150, 380], [-80, 360]], heads: 260, staghorn: 160, fans: 140, sponges: 120, tables: 60, anemones: 220, starfish: 160, urchins: 140 },
  kelp: { count: 520, zone: { x: [-230, 200], z: [-330, -160] }, height: [22, 62] },
  trench: { jellies: 44, vents: 7, worms: 260 },
  life: { schools: [{ at: [120, 6, 240], r: 40, n: 90, color: '#ffd23a' }, { at: [380, 10, 150], r: 32, n: 80, color: '#3a7aff' }, { at: [330, 14, -20], r: 28, n: 70, color: '#ff8a3a' }, { at: [40, 12, -300], r: 45, n: 90, color: '#c0e0f0' }, { at: [-200, 8, 380], r: 40, n: 80, color: '#7ae0c0' }, { at: [-120, 16, 180], r: 38, n: 70, color: '#ff5a8a' }],
    turtles: 4, mantas: 2, whale: { center: [-300, 22, 70], r: 120, speed: 0.05 } },
  bubbles: 500, snow: 1200,
  hoops: { every: 70 },

};

export function createLayout() {
  const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
  const rand = rng(MAP.seed);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = arr => pickRandom(arr, rand);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const col = hex => new THREE.Color(hex);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const d = new THREE.Object3D();
  const uTime = { value: 0 };
  const W0 = MAP.world, CX = W0.center[0], CZ = W0.center[1], SIZE = W0.size, HALF = SIZE / 2;
  const SEA = MAP.sea, SURF = SEA.surface, SB = MAP.seabed;

  const ih = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const noise2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(ih(xi, yi), ih(xi + 1, yi), u), lerp(ih(xi, yi + 1), ih(xi + 1, yi + 1), u), v); };
  const fbm2 = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };

  /* ---------------- the seabed ---------------- */
  const TRP = SB.trench.points.map(([x, z, y]) => ({ x, z, y }));
  const trenchQ = (x, z) => {
    let best = 1e9, by = 0;
    for (let k = 0; k < TRP.length - 1; k++) {
      const a = TRP[k], b = TRP[k + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1);
      const dd = Math.hypot(x - a.x - dx * t, z - a.z - dz * t); if (dd < best) { best = dd; by = lerp(a.y, b.y, t); }
    }
    return { d: best, y: by };
  };
  function natural(x, z) {
    let h = SB.base + SB.dunes * Math.sin(x * 0.05 + Math.sin(z * 0.03) * 2) * Math.cos(z * 0.045) + 2.2 * (fbm2(x * 0.012, z * 0.012, 4) - 0.5) + 0.6 * (fbm2(x * 0.08, z * 0.08, 2) - 0.5);
    const far = Math.hypot(x - CX, z - CZ); h -= SB.shelf.drop * sstep(SB.shelf.from, SB.shelf.to, far);
    const cay = SB.cay, dc = Math.hypot(x - cay.at[0], z - cay.at[1]); h = lerp(h, cay.top + 1.2 * Math.cos(x * 0.1) * Math.sin(z * 0.08) - (dc / cay.r) ** 2 * 10, 1 - sstep(cay.r * 0.18, cay.r, dc));
    const T = SB.trench, q = trenchQ(x, z);
    if (q.d < T.width / 2 + T.wall) h = lerp(q.y + 1.2 * (fbm2(x * 0.05, z * 0.05, 2) - 0.5), h, sstep(T.width / 2 - 4, T.width / 2 + T.wall, q.d) ** 1.4);
    return h;
  }

  /* ---------------- the route ---------------- */
  const CTRL = MAP.road.points.map(e => ({ x: e.p[0], z: e.p.length === 3 ? e.p[2] : e.p[1], y: e.p.length === 3 ? e.p[1] : null, seg: e.seg, w: e.w ?? MAP.road.width }));
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
    for (let i = 0; i < NR; i++) { if (SEG[i] === 'a') continue; const a = roadFrame(i - 12).t, b = roadFrame(i + 12).t, f = roadFrame(i); raw[i] = clamp(-b.clone().sub(a).dot(f.n) * 0.09, -0.1, 0.1); }
    for (let i = 0; i < NR; i++) { let s = 0; for (let j = -18; j <= 18; j++) s += raw[wrap(i + j)]; bank[i] = s / 37; }
  }
  const roadAt = (i, lat, dy = 0) => { const k = wrap(i), f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const idxNear = (x, z) => { let b = 0, bd = 1e18; for (let i = 0; i < NR; i++) { const q = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (q < bd) { bd = q; b = i; } } return b; };
  const segRange = s => { let a = -1, b = -1; for (let i = 0; i < NR; i++) if (SEG[i] === s) { if (a < 0) a = i; b = i; } return [a, b]; };
  const i0 = idxNear(...MAP.road.start);

  /* ---------------- seabed heights carved to the road ---------------- */
  const GR = Math.round(SIZE / W0.cell), CELL = SIZE / GR, X0 = CX - HALF, Z0 = CZ - HALF, GN = GR + 1, vIdx = (ix, iz) => iz * GN + ix;
  const NAT = new Float32Array(GN * GN), HGT = new Float32Array(GN * GN), DMIN = new Float32Array(GN * GN).fill(1e9), NEAR = new Int32Array(GN * GN).fill(-1);
  for (let iz = 0; iz <= GR; iz++) for (let ix = 0; ix <= GR; ix++) NAT[vIdx(ix, iz)] = natural(X0 + ix * CELL, Z0 + iz * CELL);
  {
    const SH = MAP.road.shoulder;
    const visit = fn => { for (let i = 0; i < NR; i++) { const p = RP[i], R = hwA[i] + SH[SEG[i]], rc = Math.ceil(R / CELL), cx = Math.round((p.x - X0) / CELL), cz = Math.round((p.z - Z0) / CELL); for (let iz = Math.max(0, cz - rc); iz <= Math.min(GR, cz + rc); iz++) for (let ix = Math.max(0, cx - rc); ix <= Math.min(GR, cx + rc); ix++) { const x = X0 + ix * CELL, z = Z0 + iz * CELL, dd = Math.hypot(x - p.x, z - p.z); if (dd <= R) fn(i, vIdx(ix, iz), x, z, dd); } } };
    visit((i, v, x, z, dd) => { if (dd < DMIN[v]) { DMIN[v] = dd; NEAR[v] = i; } });
    const SW = new Float32Array(GN * GN), ST = new Float32Array(GN * GN);
    visit((i, v, x, z, dd) => { const w = Math.exp(-(((dd - DMIN[v]) / 3) ** 2)); if (w < 1e-3) return; const f = roadFrame(i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z, hw = hwA[i]; SW[v] += w; ST[v] += w * (roadY[i] + bank[i] * clamp(lat, -hw, hw) - 0.2); });
    for (let v = 0; v < GN * GN; v++) { if (SW[v] <= 0) { HGT[v] = NAT[v]; continue; } const i = NEAR[v], hw = hwA[i], S = SH[SEG[i]]; HGT[v] = lerp(NAT[v], ST[v] / SW[v], 1 - sstep(hw + 0.8, hw + S, DMIN[v])); }
  }
  const inSquare = (x, z, m = 2) => Math.abs(x - CX) < HALF - m && Math.abs(z - CZ) < HALF - m;
  const gridH = (x, z) => { const fx = clamp((x - X0) / CELL, 0, GR - 1e-6), fz = clamp((z - Z0) / CELL, 0, GR - 1e-6), ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz; return lerp(lerp(HGT[vIdx(ix, iz)], HGT[vIdx(ix + 1, iz)], tx), lerp(HGT[vIdx(ix, iz + 1)], HGT[vIdx(ix + 1, iz + 1)], tx), tz); };
  const groundH = (x, z) => (inSquare(x, z, 0) ? gridH(x, z) : natural(x, z));
  const roadDist = (x, z) => { if (!inSquare(x, z)) return 1e9; return DMIN[vIdx(Math.round((x - X0) / CELL), Math.round((z - Z0) / CELL))]; };
  // 3D distance to the road, for things that swim
  const GC = 24, grid = new Map(), gkey = (x, y, z) => `${Math.floor(x / GC)},${Math.floor(y / GC)},${Math.floor(z / GC)}`;
  RP.forEach((p, i) => { const k = gkey(p.x, roadY[i], p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  const roadDist3 = p => { const cx = Math.floor(p.x / GC), cy = Math.floor(p.y / GC), cz = Math.floor(p.z / GC); let best = 1e9, bi = -1; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const l = grid.get(`${cx + a},${cy + b},${cz + c}`); if (!l) continue; for (const i of l) { const dd = (RP[i].x - p.x) ** 2 + (roadY[i] - p.y) ** 2 + (RP[i].z - p.z) ** 2; if (dd < best) { best = dd; bi = i; } } } return { d: Math.sqrt(best), i: bi }; };

  return { PI, TAU, UP, rand, rr, pick, clamp, sstep, lerp, col, V3, d, uTime, W0, CX, CZ, SIZE, HALF, SEA, SURF, SB, ih, noise2, fbm2, TRP, trenchQ, natural, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, segRange, i0, GR, CELL, X0, Z0, GN, vIdx, NAT, HGT, DMIN, NEAR, inSquare, gridH, groundH, roadDist, GC, grid, gkey, roadDist3 };
}
