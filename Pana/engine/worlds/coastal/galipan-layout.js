import { clamp, lerp } from '/engine/random.js';
import { fairRoute, fairHeights } from './coastal-road.js';
import * as THREE from 'three';
export const MAP = {
  seed: 1567,
  area: { x0: -440, z0: -440, size: 880 },
  // Road control points: [x, y, z, segment, half-width]. Heights are smoothed along the lap.
  // p pueblito (cobbles), m mirador, b bajada del bosque, q Boca de Tigre, c el cañón, a the flight over
  // Caracas (no road drawn, no ground shaped: Derrape flies it as an avioneta), g girasoles, s subida
  road: [
    [-150, 134, -204, 'p', 6.0], [-60, 136, -204, 'p', 6.0], [30, 138, -200, 'p', 6.0], [110, 140, -196, 'p', 6.0], [176, 141, -204, 'm', 6.0],
    [236, 141, -214, 'm', 6.0], [284, 140, -192, 'm', 6.0], [296, 139, -152, 'm', 6.0], [276, 137, -118, 'm', 6.0], [232, 132, -106, 'b', 5.5], [184, 127, -118, 'b', 5.5],
    [148, 122, -98, 'b', 5.5], [160, 117, -62, 'b', 5.5], [210, 112, -44, 'b', 5.5], [246, 108, -14, 'b', 5.5], [234, 104, 20, 'b', 5.5], [190, 100, 30, 'b', 5.5],
    [140, 96, 26, 'b', 5.5], [110, 93, 44, 'b', 5.5], [96, 91, 70, 'q', 6.0], [80, 90.5, 98, 'q', 6.0], [50, 90, 108, 'q', 6.0], [24, 90, 92, 'q', 6.0],
    [18, 90, 64, 'q', 6.0], [0, 90, 48, 'q', 6.0],
    // El cañón: out of the Boca de Tigre hairpin the road dives into a cut down to the cliff's lip.
    [-30, 89, 72, 'c', 6.0], [-28, 86, 120, 'c', 6.0], [-6, 83, 172, 'c', 6.0], [22, 80, 222, 'c', 6.0], [40, 78, 262, 'c', 6.0],
    // Off the lip and out over Caracas, a loop to the west and back onto the girasoles terrace.
    [52, 84, 300, 'a', 6.0], [50, 95, 345, 'a', 6.0], [20, 104, 390, 'a', 6.0], [-50, 108, 416, 'a', 6.0], [-130, 106, 404, 'a', 6.0],
    [-190, 100, 364, 'a', 6.0], [-218, 95, 316, 'a', 6.0], [-216, 92, 276, 'a', 6.0], [-206, 90, 238, 'g', 5.5], [-256, 92.0, 210, 's', 6.0], [-300, 95.6, 172, 's', 6.0], [-290, 99.3, 128, 's', 6.0], [-236, 102.9, 110, 's', 6.0],
    [-212, 106.5, 72, 's', 6.0], [-246, 110.2, 38, 's', 6.0], [-300, 113.8, 20, 's', 6.0], [-330, 117.5, -24, 's', 6.0], [-318, 121.1, -80, 's', 6.0], [-276, 124.7, -112, 's', 6.0],
    [-246, 128.4, -150, 's', 6.0], [-266, 132.0, -184, 's', 6.0], [-230, 132, -200, 'p', 6.0],
  ],
  startAt: [-150, -204],
  // the mountain: past these edges the slope falls away to the city far below; behind (north) it climbs to the crest
  cliff: { east: 322, south: 272, depth: 860, width: 240 },
  crest: { from: -270, rise: 1.0, max: 520 },
  city: { y: -700, center: [1300, 1700], rx: 2800, rz: 1200, lights: 46000, grid: 70, clouds: 46 },
  strip: { seg: 'p', chalets: 26, stringEvery: 13 },
  letters: { wall: [-110, -186], text: 'YO <3 GALIPÁN' },
  bocaDeTigre: { center: [50, 74], letters: 'GALIPÁN', arch: [96, 40], stalls: 7 },
  sunflowerHouse: { seg: 'g', swing: [-120, 266], house: [-70, 272] },
  mirador: { at: [312, -168] },
  // cable car: two stations and the towers between; cabins cross on the race clock
  cable: { from: [-640, 190, 210], to: [60, 330, -440], towers: [0.33, 0.66], cabins: 8, period: 140 },
  zones: { forest: 5200, ferns: 1800, mist: 90, crowd: 70 },
  // Reference camera spots, kept clear of scenery.
  views: {
    pueblito: { pos: [-110, 138, -208] },
    mirador: { pos: [284, 147, -176] },
    girasoles: { pos: [-64, 97, 228] },
    subida: { pos: [-200, 118, 60] },
  },
};
export const noise = (x, z) => 0.5 * Math.sin(x * 0.013 + Math.sin(z * 0.011) * 2) * Math.cos(z * 0.012 - x * 0.004) + 0.3 * Math.sin(x * 0.041 + z * 0.037) + 0.2 * Math.cos(x * 0.09 - z * 0.07);
export function createLayout() {
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ---------------- rasters ---------------- */
  const AR = MAP.area, SIZE = AR.size, CELL = 2, GR = SIZE / CELL, X0 = AR.x0, Z0 = AR.z0;
  function raster(pts, far) {
    const dist = new Float32Array(GR * GR).fill(far), idx = new Int32Array(GR * GR).fill(-1), rc = Math.ceil(far / CELL);
    pts.forEach((p, i) => {
      const cx = Math.floor((p.x - X0) / CELL), cz = Math.floor((p.z - Z0) / CELL);
      for (let z = Math.max(0, cz - rc); z <= Math.min(GR - 1, cz + rc); z++) for (let x = Math.max(0, cx - rc); x <= Math.min(GR - 1, cx + rc); x++) {
        const wx = X0 + (x + 0.5) * CELL, wz = Z0 + (z + 0.5) * CELL, dx = wx - p.x, dz = wz - p.z, q = dx * dx + dz * dz;
        if (q > far * far) continue;
        const k = z * GR + x, dd = Math.sqrt(q);
        if (dd < dist[k]) { dist[k] = dd; idx[k] = i; }
      }
    });
    return { dist, idx, far };
  }
  function sampleR(R, x, z) {
    const fx = (x - X0) / CELL - 0.5, fz = (z - Z0) / CELL - 0.5;
    if (fx < 0 || fz < 0 || fx > GR - 1 || fz > GR - 1) return { dist: R.far, i: -1 };
    const x0 = clamp(Math.floor(fx), 0, GR - 2), z0 = clamp(Math.floor(fz), 0, GR - 2), tx = clamp(fx - x0, 0, 1), tz = clamp(fz - z0, 0, 1);
    const k = z0 * GR + x0;
    const dist = lerp(lerp(R.dist[k], R.dist[k + 1], tx), lerp(R.dist[k + GR], R.dist[k + GR + 1], tx), tz);
    return { dist, i: R.idx[clamp(Math.round(fz), 0, GR - 1) * GR + clamp(Math.round(fx), 0, GR - 1)] };
  }
  const inArea = (x, z, m = 0) => x > X0 + m && x < X0 + SIZE - m && z > Z0 + m && z < Z0 + SIZE - m;

  /* ---------------- the road ---------------- */
  const CTRL = MAP.road;
  const roadCurve = new THREE.CatmullRomCurve3(CTRL.map(([x, y, z]) => V3(x, y, z)), true, 'centripetal');
  const NR = 3000;
  const RP = roadCurve.getSpacedPoints(NR).slice(0, NR);
  // The display reference's hairpins are faired before anything is sampled.
  fairRoute(RP, 30);
  let ROAD_LEN = 0;
  for (let i = 0; i < NR; i++) ROAD_LEN += Math.hypot(RP[(i + 1) % NR].x - RP[i].x, RP[(i + 1) % NR].z - RP[i].z);
  const STEP = ROAD_LEN / NR;
  const ctrlAt = i => CTRL[Math.min(CTRL.length - 1, Math.floor(roadCurve.getUtoTmapping(i / NR) * CTRL.length))];
  const SEG = RP.map((_, i) => ctrlAt(i)[3]);
  const RR = raster(RP, 100);
  const hwL = new Float32Array(NR), hwR = new Float32Array(NR), roadY = new Float32Array(NR), bank = new Float32Array(NR);
  {
    // At least 16 m wide: eight racers fit through the pueblito and the hairpins.
    for (let i = 0; i < NR; i++) hwL[i] = hwR[i] = 8;
    let src = Float32Array.from(RP.map(p => p.y)); const tmp = new Float32Array(NR);
    for (const k of [18, 12]) { for (let i = 0; i < NR; i++) { let a = 0; for (let j = -k; j <= k; j++) a += src[(i + j + NR) % NR]; tmp[i] = a / (2 * k + 1); } src = Float32Array.from(tmp); }
    roadY.set(src);
  }
  const roadFrame = i => { const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize(); return { p, t, n: V3(-t.z, 0, t.x) }; };
  {
    const BANK = { m: 1, b: 1, g: 1, s: 1 }, raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) { if (!BANK[SEG[i]]) continue; const a = roadFrame(i - 12).t, b = roadFrame(i + 12).t, f = roadFrame(i), dd = b.clone().sub(a); raw[i] = clamp(-dd.dot(f.n) * 0.08, -0.07, 0.07); }
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += raw[(i + j + NR) % NR]; bank[i] = a / 33; }
  }
  fairHeights(RP, roadY);
  const roadAt = (i, lat, dy = 0) => { const k = (i % NR + NR) % NR, f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const lateralHW = (i, side) => (side > 0 ? hwR[i] : hwL[i]);
  const idxNear = (x, z) => { let b = 0, bd = 1e9; for (let i = 0; i < NR; i++) { const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };

  /* ---------------- the mountain: a slope through the road heights, the crest behind, the drop to the city ---------------- */
  const CL = MAP.cliff, CR = MAP.crest, CITY = MAP.city;
  const edgeOf = (x, z) => Math.max(x - CL.east, z - CL.south);
  const drop = (x, z) => -CL.depth * Math.pow(sstep(0, CL.width, edgeOf(x, z)), 0.55);
  const crest = (x, z) => Math.min(CR.max, Math.max(0, CR.from - z) * CR.rise) + 0.3 * Math.max(0, -380 - x);
  const farH = (x, z) => Math.max(CITY.y - 4, 120 + 30 * noise(x * 0.6, z * 0.6) + crest(x, z) + drop(x, z) + 60 * sstep(0, 1, -edgeOf(x, z) / 400) * Math.max(0, noise(x * 0.3, z * 0.3)));
  const CG = 8, NG = Math.round(SIZE / CG) + 1, HG = new Float32Array(NG * NG);
  {
    // The flight over Caracas ('a') floats over the drop: it never pulls the ground up.
    const S = []; for (let i = 0; i < NR; i += 6) if (SEG[i] !== 'a') S.push([RP[i].x, RP[i].z, roadY[i]]);
    for (let gz = 0; gz < NG; gz++) for (let gx = 0; gx < NG; gx++) {
      const x = X0 + gx * CG, z = Z0 + gz * CG; let w = 0, a = 0;
      for (const [sx, sz, sy] of S) { const q = (x - sx) ** 2 + (z - sz) ** 2 + 40; const ww = 1 / (q * q); w += ww; a += ww * sy; }
      const r = sampleR(RR, x, z), dist = r.i >= 0 ? r.dist : 100, e = edgeOf(x, z);
      let h = a / w + Math.max(0, dist - 12) * 0.35 * (1 - sstep(-140, -20, e)) + 3 * noise(x * 3, z * 3) * sstep(10, 30, dist) + crest(x, z) + drop(x, z);
      const edge = Math.min(x - X0, X0 + SIZE - x, z - Z0, Z0 + SIZE - z);
      h = lerp(farH(x, z), h, sstep(10, 90, edge));
      HG[gz * NG + gx] = Math.max(CITY.y - 4, h);
    }
  }
  const gridH = (x, z) => {
    const fx = clamp((x - X0) / CG, 0, NG - 1.001), fz = clamp((z - Z0) / CG, 0, NG - 1.001), x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0, k = z0 * NG + x0;
    return lerp(lerp(HG[k], HG[k + 1], tx), lerp(HG[k + NG], HG[k + NG + 1], tx), tz);
  };
  const PADS = [];
  function terrainH(x, z) {
    let h = gridH(x, z);
    const r = sampleR(RR, x, z);
    const shaped = r.i >= 0 && SEG[r.i] !== 'a';
    if (shaped) {
      const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z, hw = lat >= 0 ? hwR[r.i] : hwL[r.i], cl = clamp(lat, -hwL[r.i], hwR[r.i]);
      const w = 1 - sstep(hw + 1, hw + 12, r.dist);
      if (w > 0) h = lerp(h, roadY[r.i] + bank[r.i] * cl - 0.15, w);
    }
    for (const P of PADS) { const dd = Math.hypot(x - P.x, z - P.z) - P.r; if (dd < 8) h = lerp(P.y, h, sstep(0, 8, dd)); }
    // Nothing natural rises through the driving surface.
    if (shaped && r.dist < 10) h = Math.min(h, roadY[r.i] - 0.2);
    return h;
  }
  const groundH = (x, z) => (inArea(x, z, 4) ? terrainH(x, z) : farH(x, z));
  { const B = MAP.bocaDeTigre; PADS.push({ x: B.center[0], z: B.center[1], r: 20, y: roadY[idxNear(B.center[0], B.center[1])] - 0.15 }); }

  return { SIZE, CELL, GR, X0, Z0, CTRL, roadCurve, ROAD_LEN, NR, STEP, RP, ctrlAt, SEG, RR, hwL, hwR, roadY, bank, roadFrame, roadAt, lateralHW, idxNear, edgeOf, farH, groundH, terrainH, PADS, inArea, raster, sampleR };
}
