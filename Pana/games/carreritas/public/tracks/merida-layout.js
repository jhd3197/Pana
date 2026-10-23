import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
export const MAP = {
  name: 'Pana Mérida',
  seed: 20261023,
  world: { center: [-10, 0], size: 900, cell: 3, far: { size: 7000, segs: 230 } },
  sun: { dir: [0.45, 0.72, 0.52], color: '#fff3e0', intensity: 2.2, hemi: 0.42, shadowHalf: 520 },
  fog: { color: '#c4d4e6', near: 700, far: 6200 },
  // The land: a flat valley floor for the town, a slope up to the páramo, the lake under a wall of snowy peaks.
  terrain: {
    plateau: 76, valleyEdge: 230,
    plateauEdge: { east: -60, west: -200 },            // where the slope tops out (z), east and west of the valley
    northWall: { from: -380, to: -760, height: 340 },
    sideHills: { from: 430, to: 780, height: 240 },
    southHills: { from: 480, to: 820, height: 110 },
    bumps: [{ at: [330, -330], r: 120, h: 110 }],      // the shoulder carrying the teleférico's top station
    cliffs: [{ at: [-418, 40], r: 70, edge: 8, h: 55 }],  // a rock step (higher to the west) with a waterfall, seen from la bajada
    snowLine: 330, noise: 3,
  },

  road: {
    width: 13,
    start: [0, 300],
    // Segment types: p el pueblo, f los frailejones, c el teleférico, w la laguna (the cars become lanchas), b la bajada, r el puente.
    shoulder: { p: 10, f: 22, c: 22, w: 0, b: 22, r: 14 },
    tint: { p: '#6c675f', f: '#5f5d58', c: '#5f5d5a', w: '#5f6060', b: '#5a5a54', r: '#6a6258' },
    // { p:[x,y,z] } a point at a set height; { p:[x,z] } a point whose height is spread evenly
    // (by distance) between the set points either side, so climbs keep a steady grade. w? overrides the width.
    points: [
      { p: [-150, 0, 300], seg: 'p' }, { p: [-75, 0, 300], seg: 'p' }, { p: [0, 0, 300], seg: 'p' }, { p: [75, 0, 300], seg: 'p' }, { p: [150, 0.3, 298], seg: 'p' },
      { p: [200, 286], seg: 'f' }, { p: [240, 270], seg: 'f' }, { p: [330, 232], seg: 'f' },
      { p: [352, 222], seg: 'f' }, { p: [356, 205], seg: 'f' }, { p: [341, 190], seg: 'f' },
      { p: [320, 184], seg: 'f' }, { p: [200, 150], seg: 'f' },
      { p: [180, 145], seg: 'f' }, { p: [167, 130], seg: 'f' }, { p: [177, 114], seg: 'f' },
      { p: [200, 108], seg: 'f' }, { p: [320, 74], seg: 'f' },
      { p: [341, 67], seg: 'f' }, { p: [353, 51], seg: 'f' }, { p: [345, 36], seg: 'f' },
      { p: [325, 30], seg: 'f' }, { p: [210, -4], seg: 'f' },
      { p: [190, -10], seg: 'f' }, { p: [177, -26], seg: 'f' }, { p: [187, -42], seg: 'f' },
      { p: [215, 66, -52], seg: 'c' }, { p: [250, -95], seg: 'c' }, { p: [252, -150], seg: 'c' }, { p: [224, -206], seg: 'c' },
      { p: [182, -246], seg: 'c' }, { p: [142, 74.6, -264], seg: 'c' },
      { p: [112, 74, -275], seg: 'w', w: 16 }, { p: [60, 74, -296], seg: 'w', w: 16 }, { p: [0, 74, -303], seg: 'w', w: 16 },
      { p: [-60, 74, -297], seg: 'w', w: 16 }, { p: [-112, 74, -277], seg: 'w', w: 16 },
      { p: [-142, 74.6, -263], seg: 'b' }, { p: [-205, -236], seg: 'b' }, { p: [-272, -188], seg: 'b' }, { p: [-322, -125], seg: 'b' },
      { p: [-345, -55], seg: 'b' }, { p: [-325, 12], seg: 'b' }, { p: [-277, 60], seg: 'b' }, { p: [-262, 118], seg: 'b' },
      { p: [-290, 172], seg: 'b' }, { p: [-300, 215], seg: 'b' },
      { p: [-275, 7.5, 248], seg: 'r' }, { p: [-238, 7, 270], seg: 'r' }, { p: [-205, 5.5, 286], seg: 'r' }, { p: [-178, 296], seg: 'r' },
    ],
  },
  lake: { name: 'Laguna', center: [0, -270], rx: 125, rz: 85, level: 74, depth: 9, buoyEvery: 10 },
  // The river leaves the lake, runs down beside la bajada, under the stone bridge and past the town.
  river: {
    width: 5, depth: 2.2, bank: 7,
    points: [[-60, -196], [-112, -128], [-145, -50], [-170, 30], [-195, 110], [-220, 190], [-236, 262], [-205, 330], [-120, 352], [0, 360], [150, 365], [320, 372], [470, 382]],
  },
  waterfall: { from: [-462, 40], to: [-385, 40], width: 6 },
  town: {
    street: { from: -140, to: 140, z: 300 },
    rows: [{ lat: 15, depth: [9, 12] }, { lat: 36, depth: [8, 11] }],
    gaps: [[-32, 32, 'n'], [-70, -62], [58, 66]],      // the plaza on the north side, two side streets
    colors: ['#f4efe4', '#f6d36a', '#7ab8e0', '#f2a7a0', '#b8e0a8', '#ffffff', '#e8c39a', '#f7f0c8'],
    plaza: { at: [0, 263], size: [60, 38] },
    church: { at: [0, 231], scale: 1 },
    flag: { at: [-22, 252] },
  },
  teleferico: { from: [60, 222], to: [330, -330], fromY: 30, toY: 14, sag: 9, towers: [0.24, 0.5, 0.78], cabins: 2, period: 70 },
  vegetation: {
    frailejones: 3400, pajonal: 8000, rocks: 420,
    cloudForest: { trees: 420, ferns: 520, pines: 80 },
    valley: { eucalyptus: 120, bushes: 160, bougainvillea: 46 },
    fields: 16, reeds: 260,
  },
  life: { condors: 3 },

  // dir +1 goes our way (slow, to be overtaken), -1 comes towards us and hugs its side. On the lake they turn into lanchas too.

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
  const TER = MAP.terrain, TOP = TER.plateau;

  /* ---------------- noise ---------------- */
  const ih = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const noise2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(ih(xi, yi), ih(xi + 1, yi), u), lerp(ih(xi, yi + 1), ih(xi + 1, yi + 1), u), v); };
  const fbm2 = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };

  /* ---------------- the land ---------------- */
  const LK = MAP.lake, LCX = LK.center[0], LCZ = LK.center[1];
  const lakeE = (x, z) => Math.hypot((x - LCX) / LK.rx, (z - LCZ) / LK.rz);
  // the valley, the slope, the páramo and the mountains around it
  function baseNat(x, z) {
    const zTop = lerp(TER.plateauEdge.east, TER.plateauEdge.west, sstep(-100, -300, x)), zB = TER.valleyEdge;
    const t = clamp((zB - z) / (zB - zTop), 0, 1);
    let h = TOP * (0.25 * t * t * (3 - 2 * t) + 0.75 * t);
    const nw = TER.northWall, sh = TER.sideHills, so = TER.southHills;
    const ridge = 0.55 + 0.9 * fbm2(x * 0.004 + 3, z * 0.004, 4);
    h += nw.height * sstep(nw.from, nw.to, z) * ridge;
    h += sh.height * sstep(sh.from, sh.to, Math.abs(x - CX)) * (0.5 + 0.9 * fbm2(x * 0.005, z * 0.005 + 7, 4));
    h += so.height * sstep(so.from, so.to, z) * (0.5 + fbm2(x * 0.006 + 1, z * 0.006, 3));
    const far = Math.max(0, Math.hypot(x - CX, z - CZ) - 900);
    h += far * 0.32 * (0.4 + 1.1 * fbm2(x * 0.0018 + 9, z * 0.0018, 5));
    for (const b of TER.bumps) h += b.h * Math.exp(-((x - b.at[0]) ** 2 + (z - b.at[1]) ** 2) / (b.r * b.r));
    for (const c of TER.cliffs) h += c.h * sstep(-c.edge / 2, c.edge / 2, c.at[0] - x) * (1 - sstep(c.r * 0.5, c.r, Math.abs(z - c.at[1]))) * (1 - sstep(140, 220, c.at[0] - x));
    const paramo = sstep(30, 60, h);
    h += TER.noise * (fbm2(x * 0.02, z * 0.02, 3) - 0.5) * 2 * (0.4 + paramo) + 1.5 * (fbm2(x * 0.07 + 5, z * 0.07, 2) - 0.5);
    return h;
  }
  // river samples: height follows the land just below it, always running downhill
  const RV = MAP.river, riverPts = [];
  {
    const P = RV.points;
    for (let k = 0; k < P.length - 1; k++) { const [ax, az] = P[k], [bx, bz] = P[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 2); for (let j = 0; j < n; j++) { const t = j / n; riverPts.push({ x: lerp(ax, bx, t), z: lerp(az, bz, t) }); } }
    riverPts.push({ x: P.at(-1)[0], z: P.at(-1)[1] });
    let prev = LK.level - 0.3;
    riverPts.forEach((p, k) => { const raw = baseNat(p.x, p.z) - 1.6; p.y = k === 0 ? prev : Math.min(prev - 0.01, raw); prev = p.y; });
    for (let pass = 0; pass < 3; pass++) for (let k = 1; k < riverPts.length - 1; k++) riverPts[k].y = Math.min(riverPts[k - 1].y - 0.005, (riverPts[k - 1].y + riverPts[k].y + riverPts[k + 1].y) / 3);
  }
  const GR = Math.round(SIZE / W0.cell), CELL = SIZE / GR, X0 = CX - HALF, Z0 = CZ - HALF, GN = GR + 1;
  const vIdx = (ix, iz) => iz * GN + ix;
  // nearest river sample per terrain vertex
  const riverNear = new Int32Array(GN * GN).fill(-1), riverD = new Float32Array(GN * GN).fill(1e9);
  {
    const R = RV.width / 2 + RV.bank + 6, rc = Math.ceil(R / CELL);
    riverPts.forEach((p, k) => {
      const cx = Math.round((p.x - X0) / CELL), cz = Math.round((p.z - Z0) / CELL);
      for (let iz = Math.max(0, cz - rc); iz <= Math.min(GR, cz + rc); iz++) for (let ix = Math.max(0, cx - rc); ix <= Math.min(GR, cx + rc); ix++) {
        const dd = Math.hypot(X0 + ix * CELL - p.x, Z0 + iz * CELL - p.z), v = vIdx(ix, iz); if (dd < riverD[v]) { riverD[v] = dd; riverNear[v] = k; }
      }
    });
  }
  const riverQuery = (x, z) => { let best = 1e9, bk = -1; for (let k = 0; k < riverPts.length; k += 2) { const dd = (riverPts[k].x - x) ** 2 + (riverPts[k].z - z) ** 2; if (dd < best) { best = dd; bk = k; } } return { d: Math.sqrt(best), k: bk }; };
  function natural(x, z, rv) {
    let h = baseNat(x, z);
    const e = lakeE(x, z);
    if (e < 1.35) h = Math.min(h, lerp(LK.level - LK.depth * (1 - e * e), h, sstep(0.82, 1.32, e)));
    if (e < 1) h = Math.min(h, LK.level - LK.depth * (1 - e * e) - 0.4);
    const q = rv || riverQuery(x, z);
    if (q.k >= 0 && q.d < RV.width / 2 + RV.bank) { const ry = riverPts[q.k].y; h = Math.min(h, lerp(ry - RV.depth, Math.max(h, ry + 0.5), sstep(RV.width / 2 - 0.5, RV.width / 2 + RV.bank, q.d))); }
    return h;
  }

  /* ---------------- the route ---------------- */
  const CTRL = MAP.road.points.map(e => ({ x: e.p[0], z: e.p.length === 3 ? e.p[2] : e.p[1], y: e.p.length === 3 ? e.p[1] : null, seg: e.seg, w: e.w ?? MAP.road.width }));
  // spread heights evenly between set points, by distance along the control polygon (wrapping round the loop)
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
  for (let i = 0; i < NR; i++) roadY[i] = SEG[i] === 'w' ? LK.level : RP[i].y;
  fairHeights(RP, roadY);
  for (let i = 0; i < NR; i++) RP[i].y = roadY[i];
  const roadFrame = i => { const p = RP[wrap(i)], q = RP[wrap(i + 1)], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize(); return { p, t, n: V3(-t.z, 0, t.x) }; };
  {
    const raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) { if (SEG[i] === 'p' || SEG[i] === 'w' || SEG[i] === 'r') continue; const a = roadFrame(i - 12).t, b = roadFrame(i + 12).t, f = roadFrame(i); raw[i] = clamp(-b.clone().sub(a).dot(f.n) * 0.08, -0.08, 0.08); }
    for (let i = 0; i < NR; i++) { let s = 0; for (let j = -18; j <= 18; j++) s += raw[wrap(i + j)]; bank[i] = s / 37; }
  }
  const roadAt = (i, lat, dy = 0) => { const k = wrap(i), f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const idxNear = (x, z) => { let b = 0, bd = 1e18; for (let i = 0; i < NR; i++) { const q = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (q < bd) { bd = q; b = i; } } return b; };
  const segRange = s => { let a = -1, b = -1; for (let i = 0; i < NR; i++) if (SEG[i] === s) { if (a < 0) a = i; b = i; } return [a, b]; };
  const [w0, w1] = segRange('w');
  // the bridge: road samples over the river
  const isBridge = new Uint8Array(NR);
  for (let i = 0; i < NR; i++) if (SEG[i] === 'r' && riverQuery(RP[i].x, RP[i].z).d < RV.width / 2 + RV.bank + 6) isBridge[i] = 1;
  const i0 = idxNear(...MAP.road.start);

  /* ---------------- terrain heights: natural land, carved to the road ---------------- */
  // Every road sample pulls the ground toward its surface over a shoulder; where two stretches of road
  // share a hillside (the hairpins) the ground takes a weighted mix of both, so it never steps.
  const NAT = new Float32Array(GN * GN), HGT = new Float32Array(GN * GN), DMIN = new Float32Array(GN * GN).fill(1e9), NEAR = new Int32Array(GN * GN).fill(-1);
  for (let iz = 0; iz <= GR; iz++) for (let ix = 0; ix <= GR; ix++) { const v = vIdx(ix, iz), x = X0 + ix * CELL, z = Z0 + iz * CELL; NAT[v] = natural(x, z, riverNear[v] >= 0 ? { d: riverD[v], k: riverNear[v] } : { d: 1e9, k: -1 }); }
  {
    const SH = MAP.road.shoulder, carve = [];
    for (let i = 0; i < NR; i++) { const s = SH[SEG[i]] ?? 10; if (s > 0 && !isBridge[i]) carve.push(i); }
    const visit = (fn) => carve.forEach(i => {
      const p = RP[i], R = hwA[i] + SH[SEG[i]], rc = Math.ceil(R / CELL), cx = Math.round((p.x - X0) / CELL), cz = Math.round((p.z - Z0) / CELL);
      for (let iz = Math.max(0, cz - rc); iz <= Math.min(GR, cz + rc); iz++) for (let ix = Math.max(0, cx - rc); ix <= Math.min(GR, cx + rc); ix++) {
        const x = X0 + ix * CELL, z = Z0 + iz * CELL, dd = Math.hypot(x - p.x, z - p.z); if (dd <= R) fn(i, vIdx(ix, iz), x, z, dd, R);
      }
    });
    visit((i, v, x, z, dd) => { if (dd < DMIN[v]) { DMIN[v] = dd; NEAR[v] = i; } });
    const SW = new Float32Array(GN * GN), ST = new Float32Array(GN * GN);
    visit((i, v, x, z, dd) => {
      const w = Math.exp(-(((dd - DMIN[v]) / 3) ** 2)); if (w < 1e-3) return;
      const f = roadFrame(i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z, hw = hwA[i];
      SW[v] += w; ST[v] += w * (roadY[i] + bank[i] * clamp(lat, -hw, hw) - 0.18);
    });
    for (let v = 0; v < GN * GN; v++) {
      if (SW[v] <= 0) { HGT[v] = NAT[v]; continue; }
      const i = NEAR[v], hw = hwA[i], S = SH[SEG[i]];
      const k = 1 - sstep(hw + 0.8, hw + S, DMIN[v]);
      HGT[v] = lerp(NAT[v], ST[v] / SW[v], k);
    }
  }
  const inSquare = (x, z, m = 2) => Math.abs(x - CX) < HALF - m && Math.abs(z - CZ) < HALF - m;
  const gridH = (x, z) => {
    const fx = clamp((x - X0) / CELL, 0, GR - 1e-6), fz = clamp((z - Z0) / CELL, 0, GR - 1e-6), ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    return lerp(lerp(HGT[vIdx(ix, iz)], HGT[vIdx(ix + 1, iz)], tx), lerp(HGT[vIdx(ix, iz + 1)], HGT[vIdx(ix + 1, iz + 1)], tx), tz);
  };
  const roadDist = (x, z) => {
    if (!inSquare(x, z)) return 1e9;
    const ix = Math.round((x - X0) / CELL), iz = Math.round((z - Z0) / CELL); let dd = DMIN[vIdx(ix, iz)];
    if (dd > 60) { // the lake crossing and the bridge do not carve: measure them directly
      for (let i = 0; i < NR; i += 2) if (SEG[i] === 'w' || isBridge[i]) dd = Math.min(dd, Math.hypot(RP[i].x - x, RP[i].z - z));
    }
    return dd;
  };
  const groundH = (x, z) => (inSquare(x, z, 0) ? gridH(x, z) : natural(x, z));

  return { PI, TAU, UP, rand, rr, pick, clamp, sstep, lerp, col, V3, d, uTime, W0, CX, CZ, SIZE, HALF, TER, TOP, ih, noise2, fbm2, LK, LCX, LCZ, lakeE, baseNat, RV, riverPts, GR, CELL, X0, Z0, GN, vIdx, riverNear, riverD, riverQuery, natural, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, segRange, w0, w1, isBridge, i0, NAT, HGT, DMIN, NEAR, inSquare, gridH, roadDist, groundH };
}
