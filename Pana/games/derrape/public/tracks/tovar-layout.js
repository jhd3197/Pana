import { clamp, lerp } from '/engine/random.js';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
import * as THREE from 'three';
// Pana Colonia Tovar. Metres, +x east, +z south (toward the valley), y up.
export const MAP = {
  seed: 1843,
  area: { x0: -440, z0: -440, size: 900 },
  // Road control points: [x, y, z, segment, half-width]. Heights are smoothed along the lap.
  // e entrada, p pueblo alemán, m mercado de fresas, h hortensias, f bosque de neblina, l mirador
  road: [
    [-215, 62.0, 110, 'e', 6.5], [-205, 58.7, 62, 'e', 6.5], [-170, 55.3, 34, 'e', 6.5], [-120, 52.0, 22, 'e', 6.5], [-70, 51.0, 20, 'p', 6.0], [-10, 50.8, 20, 'p', 6.0], [44, 50.6, 20, 'p', 6.0],
    [66, 50.4, 17, 'p', 6.0], [76, 50.2, 6, 'p', 6.0], [78, 50.0, -14, 'p', 6.0], [78, 50.2, -42, 'm', 4.5], [78, 50.6, -80, 'm', 4.5], [78, 51.1, -118, 'm', 4.5], [81, 51.5, -150, 'm', 4.8],
    [94, 53.0, -180, 'h', 6.0], [124, 56.0, -196, 'h', 6.0], [138, 59.0, -226, 'h', 6.0], [120, 62.0, -254, 'h', 6.0], [126, 65.0, -286, 'h', 6.0], [158, 68.0, -302, 'h', 6.0], [196, 71.0, -300, 'h', 6.0],
    [246, 72.0, -292, 'f', 5.5], [300, 69.2, -284, 'f', 5.5], [324, 66.4, -260, 'f', 5.5], [302, 63.7, -234, 'f', 5.5], [252, 60.9, -222, 'f', 5.5], [232, 58.1, -198, 'f', 5.5], [250, 55.3, -172, 'f', 5.5],
    [300, 52.5, -160, 'f', 5.5], [324, 49.8, -136, 'f', 5.5], [304, 47.0, -110, 'f', 5.5], [258, 47.5, -98, 'f', 5.5], [238, 49.9, -74, 'f', 5.5], [254, 52.2, -48, 'f', 5.5], [298, 54.6, -36, 'f', 5.5],
    [318, 56.9, -10, 'f', 5.5], [314, 59.3, 22, 'f', 5.5], [300, 61.6, 60, 'f', 5.5], [276, 64.0, 100, 'f', 5.5], [240, 66.0, 130, 'l', 6.5], [196, 70.0, 152, 'l', 6.5], [150, 74.5, 166, 'l', 6.5],
    [90, 78.0, 178, 'l', 6.5], [30, 79.0, 184, 'l', 6.5], [-30, 78.0, 182, 'l', 6.5], [-90, 76.0, 170, 'l', 6.5], [-140, 72.0, 160, 'l', 6.5], [-182, 68.0, 150, 'l', 6.5], [-208, 65.0, 136, 'l', 6.5],
  ],
  startAt: [-208, 82],
  // the valley drops away south of the mirador ridge; mountains all round, cloud forest in the hollows
  valley: { from: 212, to: 420, depth: 360, farRise: [950, 1500, 560] },
  hills: { base: 70, amp: 45, slope: [0.25, 0.6] },
  // fog banks: [x, z, radius, strength]; they sit low and roll in and out on the race clock
  fog: { patches: [[290, -150, 120, 1.0], [250, -270, 70, 0.8], [140, -270, 70, 0.7], [-190, 120, 70, 0.55], [300, 40, 70, 0.6], [60, -60, 160, 0.25]],
    roll: { periods: [64, 23], min: 0.3 }, sitHeight: 22, sprites: 160 },
  town: { street: 'p', cross: { from: [10, 30], to: [10, 120], half: 4.5 }, houses: 70, zone: [-150, 150, -170, 150] },
  church: { x: 106, z: 34, rot: -Math.PI / 2 },
  plaza: { x: 98, z: 4, r: 15 },
  market: { seg: 'm', stallEvery: 7.5 },
  aframe: { at: [150, -232], side: 1 },
  hangingBridge: { at: [324, -136], span: 40, height: 10 },
  entrance: { letters: [-232, 60, Math.PI / 2 - 0.25] },
  mirador: { x: 30, z: 205, r: 30 },
  paragliders: [{ c: [40, 420], r: 90, h: 150, period: 60 }, { c: [-120, 520], r: 120, h: 190, period: 80 }, { c: [200, 480], r: 70, h: 120, period: 50 }, { c: [60, 120], r: 160, h: 260, period: 110 }],
  zones: { pines: 4200, cloudTrees: 1700, hydrangeas: 2600, far: 2200, forest: [210, 360, -320, 130] },
  signs: [{ at: [228, -292], side: -1, lines: ['¡Precaución!', 'Neblina'] }, { at: [60, 20], side: 1, lines: ['Mercado'] }, { at: [230, 132], side: 1, lines: ['Mirador'] }],
};

export const noise = (x, z) => 0.5 * Math.sin(x * 0.013 + Math.sin(z * 0.011) * 2) * Math.cos(z * 0.012 - x * 0.004) + 0.3 * Math.sin(x * 0.041 + z * 0.037) + 0.2 * Math.cos(x * 0.09 - z * 0.07);

export function createLayout() {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

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
  // The lap starts under the carved arch: rotate the samples so index 0 sits there.
  const CTRL = MAP.road;
  const roadCurve = new THREE.CatmullRomCurve3(CTRL.map(([x, y, z]) => V3(x, y, z)), true, 'centripetal');
  const ROAD_LEN = roadCurve.getLength(), NR = 3000;
  const ctrlAt = i => CTRL[Math.min(CTRL.length - 1, Math.floor(roadCurve.getUtoTmapping(i / NR) * CTRL.length))];
  let RP = roadCurve.getSpacedPoints(NR).slice(0, NR);
  let SEG = RP.map((_, i) => ctrlAt(i)[3]), rawHW = RP.map((_, i) => ctrlAt(i)[4]);
  {
    let i0 = 0, best = 1e9;
    RP.forEach((p, i) => { const d = (p.x - MAP.startAt[0]) ** 2 + (p.z - MAP.startAt[1]) ** 2; if (d < best) { best = d; i0 = i; } });
    const rot = a => a.slice(i0).concat(a.slice(0, i0));
    RP = rot(RP); SEG = rot(SEG); rawHW = rot(rawHW);
  }
  const rawY = RP.map(p => p.y);
  fairRoute(RP, 24);
  const STEP = RP.reduce((a, p, i) => a + p.distanceTo(RP[(i + 1) % NR]), 0) / NR;
  const RR = raster(RP, 100);
  const hwL = new Float32Array(NR), hwR = new Float32Array(NR), roadY = new Float32Array(NR), bank = new Float32Array(NR);
  {
    // The display lanes were 9–13 m wide; racing needs at least 16 m.
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += rawHW[(i + j + NR) % NR]; hwL[i] = hwR[i] = Math.max(8, a / 33 + 2); }
    let src = Float32Array.from(rawY); const tmp = new Float32Array(NR);
    for (const k of [18, 12]) { for (let i = 0; i < NR; i++) { let a = 0; for (let j = -k; j <= k; j++) a += src[(i + j + NR) % NR]; tmp[i] = a / (2 * k + 1); } src = Float32Array.from(tmp); }
    roadY.set(src);
  }
  const roadFrame = i => { const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize(); return { p, t, n: V3(-t.z, 0, t.x) }; };
  {
    const BANK = { e: 1, h: 1, f: 1, l: 1 }, raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) { if (!BANK[SEG[i]]) continue; const a = roadFrame(i - 12).t, b = roadFrame(i + 12).t, f = roadFrame(i), dd = b.clone().sub(a); raw[i] = clamp(-dd.dot(f.n) * 0.08, -0.07, 0.07); }
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += raw[(i + j + NR) % NR]; bank[i] = a / 33; }
  }
  fairHeights(RP, roadY);
  const roadAt = (i, lat, dy = 0) => { const k = (i % NR + NR) % NR, f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const lateralHW = (i, side) => (side > 0 ? hwR[i] : hwL[i]);
  const idxNear = (x, z) => { let b = 0, bd = 1e9; for (let i = 0; i < NR; i++) { const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };

  /* ---------------- the land: a smooth mountainside through the road heights, rising away from it, the valley below the ridge ---------------- */
  const VA = MAP.valley, HL = MAP.hills;
  const valleyDrop = (x, z) => -VA.depth * Math.pow(sstep(VA.from, VA.to, z), 0.7) * (0.85 + 0.15 * noise(x * 0.7, z)) + VA.farRise[2] * sstep(VA.farRise[0], VA.farRise[1], z);
  const farH = (x, z) => HL.base + HL.amp * noise(x * 0.6, z * 0.6) + 60 * Math.max(0, noise(x * 0.25 + 40, z * 0.25)) + 0.12 * Math.max(0, Math.hypot(x - 40, z + 40) - 420) + valleyDrop(x, z);
  const CG = 9, NG = Math.round(SIZE / CG) + 1, HG = new Float32Array(NG * NG);
  {
    const S = []; for (let i = 0; i < NR; i += 6) S.push([RP[i].x, RP[i].z, roadY[i]]);
    for (let gz = 0; gz < NG; gz++) for (let gx = 0; gx < NG; gx++) {
      const x = X0 + gx * CG, z = Z0 + gz * CG; let w = 0, a = 0;
      for (const [sx, sz, sy] of S) { const q = (x - sx) ** 2 + (z - sz) ** 2 + 40; const ww = 1 / (q * q); w += ww; a += ww * sy; }
      const r = sampleR(RR, x, z), dist = r.i >= 0 ? r.dist : 100;
      const k = lerp(HL.slope[0], HL.slope[1], 0.5 + 0.5 * noise(x * 1.3, z * 1.3));
      let h = a / w + Math.max(0, dist - 12) * k * (1 - sstep(VA.from - 40, VA.from, z)) + 3 * noise(x * 3, z * 3) * sstep(10, 30, dist) + valleyDrop(x, z);
      const edge = Math.min(x - X0, X0 + SIZE - x, z - Z0, Z0 + SIZE - z);
      h = lerp(farH(x, z), h, sstep(10, 90, edge));
      HG[gz * NG + gx] = h;
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
    if (r.i >= 0) {
      const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z, hw = lat >= 0 ? hwR[r.i] : hwL[r.i], cl = clamp(lat, -hwL[r.i], hwR[r.i]);
      const w = 1 - sstep(hw + 1, hw + 14, r.dist);
      if (w > 0) h = lerp(h, roadY[r.i] + bank[r.i] * cl - 0.15, w);
    }
    for (const P of PADS) { const dd = Math.hypot(x - P.x, z - P.z) - P.r; if (dd < 10) h = lerp(P.y, h, sstep(0, 10, dd)); }
    // Nothing natural rises through the asphalt.
    if (r.i >= 0 && r.dist < hwR[r.i] + 1.5) h = Math.min(h, roadY[r.i] - 0.2 - Math.abs(bank[r.i]) * hwR[r.i]);
    return h;
  }
  const groundH = (x, z) => (inArea(x, z, 4) ? terrainH(x, z) : farH(x, z));
  { const PZ = MAP.plaza; PADS.push({ x: PZ.x, z: PZ.z, r: PZ.r, y: roadY[idxNear(PZ.x, PZ.z)] - 0.1 }); const MR = MAP.mirador; PADS.push({ x: MR.x, z: MR.z, r: MR.r, y: roadY[idxNear(MR.x, MR.z)] - 0.2 }); }
  const FZ = MAP.zones.forest, inForest = (x, z) => x > FZ[0] && x < FZ[1] && z > FZ[2] && z < FZ[3];
  const TZ = MAP.town.zone, inTown = (x, z) => x > TZ[0] && x < TZ[1] && z > TZ[2] && z < TZ[3];

  return { SIZE, CELL, GR, X0, Z0, CTRL, ROAD_LEN, NR, STEP, RP, SEG, RR, hwL, hwR, roadY, bank, roadFrame, roadAt, lateralHW, idxNear,
    raster, sampleR, inArea, VA, farH, gridH, PADS, terrainH, groundH, inForest, inTown, TZ, wet: () => false };
}
