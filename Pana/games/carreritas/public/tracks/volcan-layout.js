// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
export const MAP = {
  name: 'Pana Volcán',
  seed: 20261023,
  world: { center: [80, -130], size: 1100, cell: 3.5, far: { size: 7000, segs: 180 } },
  sun: { dir: [-0.45, 0.62, 0.4], color: '#b8c4ff', intensity: 1.1, hemi: 0.28, shadowHalf: 600 },
  fog: { color: '#3a1a18', near: 500, far: 4200 },
  volcano: { at: [0, -260], rim: 95, rimY: 88, base: 345, lake: { r: 60, y: 64 }, ridges: 7,
    // the high, broken side of the crater wall, where the road never goes: from, to (degrees), extra height
    summit: { from: -130, to: 25, height: 62, inner: 70, outer: 140 } },
  // cones on the horizon, smoking
  farVolcanoes: [[-1500, -1700, 420, 300], [1700, -1300, 360, 240], [-2200, 400, 300, 200], [2300, 900, 280, 180]],

  road: {
    width: 13,
    start: [0, 280],
    // Segment types: b el campamento, r el río de lava, c las columnas, s la subida, k el cráter, d la bajada, t el tubo de lava.
    shoulder: { b: 12, r: 16, c: 14, s: 18, k: 12, d: 20, t: 12 },
    tint: { b: '#5a5452', r: '#56504c', c: '#4e4a4a', s: '#565050', k: '#5e4e48', d: '#565050', t: '#4a4040' },
    // { p:[x,y,z] } a set height; { p:[x,z] } a height spread evenly between the set points either side;
    // { spiral:{ from, to, step, r0, r1, y0, y1 } } points round the volcano (angles in degrees).
    points: [
      { p: [-150, 0, 280], seg: 'b' }, { p: [-75, 0, 282], seg: 'b' }, { p: [0, 0, 280], seg: 'b' }, { p: [75, 0, 278], seg: 'b' }, { p: [150, 0.3, 272], seg: 'b' },
      { p: [215, 250], seg: 'r' }, { p: [270, 205], seg: 'r' }, { p: [300, 3, 140], seg: 'r' }, { p: [310, 3, 80], seg: 'r' },
      { p: [305, 20], seg: 'c' }, { p: [290, -50], seg: 'c' },
      { spiral: { from: 40, to: -185, step: -10, r0: 330, r1: 95, y0: 1, y1: 88 }, seg: 's' },
      { spiral: { from: -198, to: -248, step: -12.5, r0: 95, r1: 95, y0: 88, y1: 88 }, seg: 'k' },
      { p: [-10, -152], seg: 'd' }, { p: [60, -142], seg: 'd' }, { p: [120, -134], seg: 'd' }, { p: [150, -114], seg: 'd' }, { p: [140, -94], seg: 'd' },
      { p: [100, -89], seg: 't' }, { p: [20, -87], seg: 't' }, { p: [-60, -86], seg: 't' }, { p: [-120, -84], seg: 't' },
      { p: [-168, -48], seg: 'd' }, { p: [-198, 30], seg: 'd' },
      { p: [-216, 120], seg: 'd' }, { p: [-200, 210], seg: 'd' },
    ],
  },
  // the lava river: from a fissure, under the basalt bridge, into a lava lake inside the loop
  river: { width: 10, bank: 7, points: [[430, -60], [390, 0], [350, 60], [318, 96], [270, 120], [200, 140], [150, 150]] },
  lavaLake: { at: [110, 152], rx: 50, rz: 36 },
  columns: { count: 520, band: [9, 34] },
  camp: { tents: [[-60, 252], [-35, 248], [40, 250], [70, 255], [-90, 310], [95, 312]], lamps: 12, at: [0, 300] },
  fumaroles: 12,
  eruption: { every: 2.4, flight: 4.2, height: 130, bombs: 5, landings: 40 },
  embers: 900, ash: 1400,

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
  const W0 = MAP.world, CX = W0.center[0], CZ = W0.center[1], SIZE = W0.size, HALF = SIZE / 2;
  const VO = MAP.volcano, VX = VO.at[0], VZ = VO.at[1];
  const ih = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const noise2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(ih(xi, yi), ih(xi + 1, yi), u), lerp(ih(xi, yi + 1), ih(xi + 1, yi + 1), u), v); };
  const fbm2 = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };
  const NOISE_GLSL = `
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1,0)), f.x), mix(h2(i + vec2(0,1)), h2(i + vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ if (uMapDetail < 0.5) return n2(p); float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n2(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
    vec2 cellular(vec2 p){ if (uMapDetail < 0.5) return vec2(0.0, abs(sin(p.x) * cos(p.y)) * 0.5); vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 g = vec2(float(x), float(y)); vec2 o = vec2(h2(i + g), h2(i + g + 17.3)); float d = length(g + o - f); if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      return vec2(d1, d2); }`;

  /* ---------------- the land: black sand, the volcano and its crater ---------------- */
  const RV = MAP.river, riverPts = [];
  { const P = RV.points; for (let k = 0; k < P.length - 1; k++) { const [ax, az] = P[k], [bx, bz] = P[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 2); for (let j = 0; j < n; j++) riverPts.push({ x: lerp(ax, bx, j / n), z: lerp(az, bz, j / n) }); } riverPts.push({ x: P.at(-1)[0], z: P.at(-1)[1] }); }
  const riverQuery = (x, z) => { let best = 1e9, bk = -1; for (let k = 0; k < riverPts.length; k++) { const dd = (riverPts[k].x - x) ** 2 + (riverPts[k].z - z) ** 2; if (dd < best) { best = dd; bk = k; } } return { d: Math.sqrt(best), k: bk }; };
  const LL = MAP.lavaLake, lakeE = (x, z) => Math.hypot((x - LL.at[0]) / LL.rx, (z - LL.at[1]) / LL.rz);
  const volR = (x, z) => Math.hypot(x - VX, z - VZ);
  function baseNat(x, z) {
    let h = 1.2 * (fbm2(x * 0.01, z * 0.01, 4) - 0.5) * 2 + 0.5 * Math.sin(x * 0.04 + Math.sin(z * 0.03) * 2) * Math.cos(z * 0.05);
    const r = volR(x, z), a = Math.atan2(z - VZ, x - VX);
    if (r < VO.base + 20) {
      const t = clamp((r - VO.rim) / (VO.base - VO.rim), 0, 1);
      const ridge = Math.pow(Math.abs(Math.sin(a * VO.ridges * 0.5 + fbm2(a * 2, r * 0.01, 2) * 3)), 3) * 5 * t * (1 - t) * 4;
      const outer = VO.rimY * Math.pow(1 - t, 1.4) + ridge + 2 * (fbm2(x * 0.03, z * 0.03, 3) - 0.5) * (1 - t);
      const inner = lerp(VO.lake.y - 6, VO.rimY + 1, sstep(VO.lake.r - 4, VO.rim - 4, r));
      h = Math.max(h, r >= VO.rim - 4 ? outer : inner);
      if (r < VO.rim - 4) h = inner;
      const SM = VO.summit, ad = ((a / DEG - (SM.from + SM.to) / 2 + 540) % 360) - 180, half = (SM.to - SM.from) / 2;
      const crag = (1 - sstep(half * 0.6, half, Math.abs(ad))) * sstep(SM.inner, VO.rim, r) * (1 - sstep(VO.rim + 5, SM.outer, r));
      h += crag * SM.height * (0.75 + 0.5 * fbm2(a * 3, r * 0.02, 3)) * (0.85 + 0.15 * Math.sin(a * 23));
    }
    const far = Math.max(0, Math.hypot(x - CX, z - CZ) - 650); h += far * 0.06 * fbm2(x * 0.003, z * 0.003, 3);
    for (const [fx, fz, fh, fr] of MAP.farVolcanoes) { const dd = Math.hypot(x - fx, z - fz); if (dd < fr * 2.4) h = Math.max(h, fh * Math.pow(Math.max(0, 1 - dd / (fr * 2.4)), 1.3) - (dd < fr * 0.25 ? (fr * 0.25 - dd) * 0.8 : 0)); }
    return h;
  }
  function natural(x, z, rq) {
    let h = baseNat(x, z);
    const e = lakeE(x, z); if (e < 1.3) h = Math.min(h, lerp(-2.5, h, sstep(0.9, 1.28, e)));
    const q = rq || riverQuery(x, z); if (q.k >= 0 && q.d < RV.width / 2 + RV.bank) h = Math.min(h, lerp(-2.2, Math.max(h, 0.8), sstep(RV.width / 2 - 0.5, RV.width / 2 + RV.bank, q.d)));
    return h;
  }

  /* ---------------- the route ---------------- */
  const CTRL = [];
  for (const e of MAP.road.points) {
    if (e.spiral) {
      // heights spread by distance along the spiral, so the grade stays even as the turns tighten
      const s = e.spiral, n = Math.round((s.to - s.from) / s.step), pts = [];
      for (let k = 0; k <= n; k++) { const u = k / n, a = (s.from + (s.to - s.from) * u) * DEG, r = lerp(s.r0, s.r1, u); pts.push({ x: VX + Math.cos(a) * r, z: VZ + Math.sin(a) * r }); }
      const acc = [0]; for (let k = 1; k <= n; k++) acc.push(acc[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z));
      pts.forEach((q, k) => CTRL.push({ x: q.x, z: q.z, y: lerp(s.y0, s.y1, acc[k] / acc[n]), seg: e.seg, w: MAP.road.width }));
    }
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
    for (let i = 0; i < NR; i++) { if (SEG[i] === 'b' || SEG[i] === 't') continue; const a = roadFrame(i - 12).t, b = roadFrame(i + 12).t, f = roadFrame(i); raw[i] = clamp(-b.clone().sub(a).dot(f.n) * 0.08, -0.08, 0.08); }
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

  return { PI, TAU, UP, DEG, rand, rr, pick, clamp, sstep, lerp, col, V3, d, uTime, hash1, W0, CX, CZ, SIZE, HALF, VO, VX, VZ, ih, noise2, fbm2, NOISE_GLSL, RV, riverPts, riverQuery, LL, lakeE, volR, baseNat, natural, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, segRange, isBridge, i0, GR, CELL, X0, Z0, GN, vIdx, NAT, HGT, DMIN, NEAR, inSquare, gridH, groundH, roadDist };
}
