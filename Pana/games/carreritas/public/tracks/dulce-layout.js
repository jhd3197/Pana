import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
export const MAP = {
  name: 'Pana Dulce',
  seed: 20261023,
  world: { center: [0, 0], size: 900, cell: 3, far: { size: 7000, segs: 160 } },
  sun: { dir: [0.4, 0.75, 0.52], color: '#fff2e6', intensity: 1.8, hemi: 0.38, shadowHalf: 520 },
  fog: { color: '#ffd6ea', near: 900, far: 6500 },
  land: {
    rolling: 2.2,
    // the quesillo: a giant flan with a caramel top that the road climbs round and crosses
    quesillo: { at: [180, -160], top: 30, topR: 95, baseR: 128 },
    pond: { at: [130, 92], rx: 48, rz: 36, level: -1, depth: 3 },
    farHills: 0.16,
  },

  road: {
    width: 13,
    start: [0, 280],
    // Segment types: p la plaza, c el río de chocolate, q el quesillo, k la bajada de caramelo, l las chupetas, t el tequeño, a las arepas.
    shoulder: { p: 10, c: 16, q: 22, k: 22, l: 16, t: 10, a: 14 },
    tint: { p: '#6e6670', c: '#6a5a58', q: '#7a6650', k: '#7a5a48', l: '#6e6274', t: '#6e6050', a: '#6a6666' },
    // { p:[x,y,z] } a point at a set height; { p:[x,z] } a point whose height is spread evenly between the set points either side.
    points: [
      { p: [-150, 0, 280], seg: 'p' }, { p: [-75, 0, 280], seg: 'p' }, { p: [0, 0, 280], seg: 'p' }, { p: [75, 0, 280], seg: 'p' }, { p: [150, 0, 278], seg: 'p' },
      { p: [215, 262], seg: 'c' }, { p: [268, 215], seg: 'c' }, { p: [298, 1, 150], seg: 'c' }, { p: [303, 4, 80], seg: 'c' }, { p: [301, 4, 40], seg: 'c' },
      { p: [305, -40], seg: 'q' }, { p: [312, -112], seg: 'q' }, { p: [318, -184], seg: 'q' }, { p: [287, -250], seg: 'q' }, { p: [228, -292], seg: 'q' },
      { p: [156, 30, -298], seg: 'q' }, { p: [128, 30, -240], seg: 'q' }, { p: [100, 30, -192], seg: 'q' }, { p: [70, 30, -172], seg: 'q' },
      { p: [10, -175], seg: 'k' }, { p: [-80, -185], seg: 'k' }, { p: [-160, -192], seg: 'k' }, { p: [-235, 0, -182], seg: 'k' },
      { p: [-292, -130], seg: 'l' }, { p: [-322, -60], seg: 'l' }, { p: [-318, 10], seg: 'l' },
      { p: [-305, 62], seg: 't' }, { p: [-287, 128], seg: 't' }, { p: [-268, 190], seg: 't' },
      { p: [-235, 242], seg: 'a' }, { p: [-195, 272], seg: 'a' },
    ],
  },
  // the chocolate river: out of the pond, under the marquesa bridge, away to the east
  river: { width: 9, depth: 2.2, bank: 6, level: -1.3, points: [[150, 84], [210, 74], [262, 66], [302, 60], [350, 50], [410, 36], [470, 26]] },
  // the chocolate waterfall pouring off the quesillo into the pond
  waterfall: { from: [182, -66], to: [140, 64], width: 7 },
  plaza: { at: [0, 250], golfeados: [[-40, 236, 9], [38, 232, 7], [-90, 318, 6], [100, 322, 8]], stalls: [[-20, 262], [22, 262], [-60, 262], [62, 262]] },
  arepas: [{ at: [-170, 200], r: 20, open: true }, { at: [-120, 130], r: 15 }, { at: [-370, 250], r: 24 }, { at: [380, 260], r: 18 }, { at: [-60, -280], r: 22, open: true }],
  papelon: [[-200, -260], [20, -330], [-380, -40], [420, -120], [-420, 120]],
  vegetation: { lollipops: 260, canes: 120, cotufas: 140, gummies: 220, sprinkles: 9000, mint: 300 },

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
  const LD = MAP.land, QS = LD.quesillo, PD = LD.pond;

  const ih = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const noise2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(ih(xi, yi), ih(xi + 1, yi), u), lerp(ih(xi, yi + 1), ih(xi + 1, yi + 1), u), v); };
  const fbm2 = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };

  /* ---------------- the land ---------------- */
  const RV = MAP.river, riverPts = [];
  { const P = RV.points; for (let k = 0; k < P.length - 1; k++) { const [ax, az] = P[k], [bx, bz] = P[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 2); for (let j = 0; j < n; j++) riverPts.push({ x: lerp(ax, bx, j / n), z: lerp(az, bz, j / n), y: RV.level - 0.6 * (k + j / n) / (P.length - 1) }); } riverPts.push({ x: P.at(-1)[0], z: P.at(-1)[1], y: RV.level - 0.6 }); }
  const riverQuery = (x, z) => { let best = 1e9, bk = -1; for (let k = 0; k < riverPts.length; k++) { const dd = (riverPts[k].x - x) ** 2 + (riverPts[k].z - z) ** 2; if (dd < best) { best = dd; bk = k; } } return { d: Math.sqrt(best), k: bk }; };
  const pondE = (x, z) => Math.hypot((x - PD.at[0]) / PD.rx, (z - PD.at[1]) / PD.rz);
  const quesilloD = (x, z) => Math.hypot(x - QS.at[0], z - QS.at[1]);
  function baseNat(x, z) {
    let h = LD.rolling * (fbm2(x * 0.008, z * 0.008, 4) - 0.5) * 2 + 0.6 * Math.sin(x * 0.03 + Math.sin(z * 0.02) * 2) * Math.cos(z * 0.025);
    const far = Math.max(0, Math.hypot(x - CX, z - CZ) - 520); h += far * LD.farHills * (0.4 + 1.2 * fbm2(x * 0.003 + 4, z * 0.003, 4));
    h = lerp(h, QS.top + 0.4 * Math.sin(x * 0.08) * Math.cos(z * 0.07), 1 - sstep(QS.topR, QS.baseR, quesilloD(x, z)));
    return h;
  }
  function natural(x, z, rq) {
    let h = baseNat(x, z);
    const e = pondE(x, z); if (e < 1.3) h = Math.min(h, lerp(PD.level - PD.depth * (1 - e * e), h, sstep(0.85, 1.28, e)));
    const q = rq || riverQuery(x, z); if (q.k >= 0 && q.d < RV.width / 2 + RV.bank) { const ry = riverPts[q.k].y; h = Math.min(h, lerp(ry - RV.depth, Math.max(h, ry + 0.6), sstep(RV.width / 2 - 0.5, RV.width / 2 + RV.bank, q.d))); }
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
    for (let i = 0; i < NR; i++) { if (SEG[i] === 'p' || SEG[i] === 't') continue; const a = roadFrame(i - 12).t, b = roadFrame(i + 12).t, f = roadFrame(i); raw[i] = clamp(-b.clone().sub(a).dot(f.n) * 0.08, -0.08, 0.08); }
    for (let i = 0; i < NR; i++) { let s = 0; for (let j = -18; j <= 18; j++) s += raw[wrap(i + j)]; bank[i] = s / 37; }
  }
  const roadAt = (i, lat, dy = 0) => { const k = wrap(i), f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const idxNear = (x, z) => { let b = 0, bd = 1e18; for (let i = 0; i < NR; i++) { const q = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (q < bd) { bd = q; b = i; } } return b; };
  const segRange = s => { let a = -1, b = -1; for (let i = 0; i < NR; i++) if (SEG[i] === s) { if (a < 0) a = i; b = i; } return [a, b]; };
  const isBridge = new Uint8Array(NR);
  for (let i = 0; i < NR; i++) if (riverQuery(RP[i].x, RP[i].z).d < RV.width / 2 + RV.bank + 5) isBridge[i] = 1;
  const i0 = idxNear(...MAP.road.start);

  /* ---------------- terrain carved to the road ---------------- */
  const GR = Math.round(SIZE / W0.cell), CELL = SIZE / GR, X0 = CX - HALF, Z0 = CZ - HALF, GN = GR + 1, vIdx = (ix, iz) => iz * GN + ix;
  const NAT = new Float32Array(GN * GN), HGT = new Float32Array(GN * GN), DMIN = new Float32Array(GN * GN).fill(1e9), NEAR = new Int32Array(GN * GN).fill(-1);
  for (let iz = 0; iz <= GR; iz++) for (let ix = 0; ix <= GR; ix++) NAT[vIdx(ix, iz)] = natural(X0 + ix * CELL, Z0 + iz * CELL);
  {
    const SH = MAP.road.shoulder, carve = []; for (let i = 0; i < NR; i++) if (!isBridge[i]) carve.push(i);
    const visit = fn => carve.forEach(i => { const p = RP[i], R = hwA[i] + SH[SEG[i]], rc = Math.ceil(R / CELL), cx = Math.round((p.x - X0) / CELL), cz = Math.round((p.z - Z0) / CELL); for (let iz = Math.max(0, cz - rc); iz <= Math.min(GR, cz + rc); iz++) for (let ix = Math.max(0, cx - rc); ix <= Math.min(GR, cx + rc); ix++) { const x = X0 + ix * CELL, z = Z0 + iz * CELL, dd = Math.hypot(x - p.x, z - p.z); if (dd <= R) fn(i, vIdx(ix, iz), x, z, dd); } });
    visit((i, v, x, z, dd) => { if (dd < DMIN[v]) { DMIN[v] = dd; NEAR[v] = i; } });
    const SW = new Float32Array(GN * GN), ST = new Float32Array(GN * GN);
    visit((i, v, x, z, dd) => { const w = Math.exp(-(((dd - DMIN[v]) / 3) ** 2)); if (w < 1e-3) return; const f = roadFrame(i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z, hw = hwA[i]; SW[v] += w; ST[v] += w * (roadY[i] + bank[i] * clamp(lat, -hw, hw) - 0.18); });
    for (let v = 0; v < GN * GN; v++) { if (SW[v] <= 0) { HGT[v] = NAT[v]; continue; } const i = NEAR[v], hw = hwA[i], S = SH[SEG[i]]; HGT[v] = lerp(NAT[v], ST[v] / SW[v], 1 - sstep(hw + 0.8, hw + S, DMIN[v])); }
  }
  const inSquare = (x, z, m = 2) => Math.abs(x - CX) < HALF - m && Math.abs(z - CZ) < HALF - m;
  const gridH = (x, z) => { const fx = clamp((x - X0) / CELL, 0, GR - 1e-6), fz = clamp((z - Z0) / CELL, 0, GR - 1e-6), ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz; return lerp(lerp(HGT[vIdx(ix, iz)], HGT[vIdx(ix + 1, iz)], tx), lerp(HGT[vIdx(ix, iz + 1)], HGT[vIdx(ix + 1, iz + 1)], tx), tz); };
  const groundH = (x, z) => (inSquare(x, z, 0) ? gridH(x, z) : natural(x, z));
  const roadDist = (x, z) => { if (!inSquare(x, z)) return 1e9; let dd = DMIN[vIdx(Math.round((x - X0) / CELL), Math.round((z - Z0) / CELL))]; if (dd > 40) for (let i = 0; i < NR; i++) if (isBridge[i]) dd = Math.min(dd, Math.hypot(RP[i].x - x, RP[i].z - z)); return dd; };

  return { PI, TAU, UP, rand, rr, pick, clamp, sstep, lerp, col, V3, d, uTime, W0, CX, CZ, SIZE, HALF, LD, QS, PD, ih, noise2, fbm2, RV, riverPts, riverQuery, pondE, quesilloD, baseNat, natural, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, segRange, isBridge, i0, GR, CELL, X0, Z0, GN, vIdx, NAT, HGT, DMIN, NEAR, inSquare, gridH, groundH, roadDist };
}
