import { clamp, lerp } from '/engine/random.js';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
import * as THREE from 'three';
// Pana Margarita. Metres, +x east, +z south, y up. The island is the land
// inside MAP.shore; the Caribbean is all around it.
export const MAP = {
  seed: 1525,
  area: { x0: -700, z0: -540, size: 1340 },
  // Road control points: [x, y, z, segment, half-width].
  // p Pampatar, c subida al castillo (and down the far side), a Playa El Agua, r La Restinga, j Juan Griego
  road: [
    [190, 2.6, 152, 'p', 6.5], [110, 2.6, 153, 'p', 6.5], [30, 2.6, 150, 'p', 6.5], [-50, 2.6, 150, 'p', 6.5],
    [-110, 3, 140, 'c', 6.0], [-156, 5, 137, 'c', 6.0], [-184, 7, 114, 'c', 6.0], [-156, 9, 92, 'c', 6.0], [-115, 12, 88, 'c', 6.0],
    [-85, 14, 78, 'c', 6.0], [-62, 16, 56, 'c', 6.0], [-84, 18, 36, 'c', 6.0], [-125, 21, 24, 'c', 6.0], [-165, 24, 20, 'c', 6.0], [-188, 26, 4, 'c', 6.0], [-180, 28, -16, 'c', 6.0],
    [-175, 31, -30, 'c', 6.0], [-138, 35, -60, 'c', 6.0], [-130, 39, -95, 'c', 6.0], [-92, 38, -140, 'c', 6.0], [-55, 35, -150, 'c', 6.0], [-34, 33, -170, 'c', 6.0], [-52, 30, -192, 'c', 6.0], [-82, 28, -190, 'c', 6.0], [-110, 27, -213, 'c', 6.0], [-82, 25, -238, 'c', 6.0],
    [-30, 20, -238, 'c', 6.0], [30, 12, -255, 'c', 6.0], [80, 5, -285, 'c', 6.0],
    [140, 2.6, -298, 'a', 6.5], [220, 2.6, -302, 'a', 6.5], [300, 2.6, -296, 'a', 6.5],
    [355, 2.2, -268, 'r', 5.5], [392, 1.6, -215, 'r', 5.5], [408, 1.6, -140, 'r', 5.5], [400, 1.6, -60, 'r', 5.5], [412, 1.6, 15, 'r', 5.5],
    [428, 2.4, 80, 'j', 6.0], [412, 2.6, 140, 'j', 6.0], [362, 2.6, 172, 'j', 6.0], [302, 2.6, 178, 'j', 6.0], [250, 2.6, 165, 'j', 6.0],
  ],
  startAt: [110, 153],
  // the coastline of the island, west to east along the south and back along the north (land inside)
  shore: [[-560, 70], [-470, 130], [-400, 170], [-300, 182], [-180, 198], [-100, 192], [60, 194], [200, 196], [250, 212], [300, 204], [350, 200], [400, 204], [440, 216],
    [470, 236], [505, 214], [535, 160], [560, 60], [548, -60], [575, -170], [530, -270], [470, -330], [350, -338], [200, -342], [60, -336], [-60, -326], [-140, -350], [-220, -310], [-330, -262], [-430, -200], [-520, -110], [-575, -10]],
  land: 2.4,
  hills: [{ x: 60, z: -60, r: 140, h: 125 }, { x: 220, z: -140, r: 95, h: 70 }, { x: -340, z: -60, r: 140, h: 70 }, { x: 480, z: 150, r: 42, h: 26 }],
  // La Laguna de La Restinga: mangrove lagoon with channels where the peñeros race
  lagoon: { c: [430, -110], rx: 80, rz: 140, depth: 1.3, islets: 0.22,
    channels: [[[440, -225], [478, -170], [490, -90], [474, -5], [446, 12], [452, -80], [446, -160]], [[368, -200], [384, -130], [382, -40], [366, -20], [360, -120]]], racers: [3, 2] },
  forts: {
    sanCarlos: { at: [20, 186], rot: 0, height: 7, color: '#c8b48a', outline: [[9, -16], [24, -24], [16, -9], [16, 9], [24, 24], [9, 16], [-9, 16], [-24, 24], [-16, 9], [-16, -9], [-24, -24], [-9, -16]], garitas: [1, 4, 7, 10], cannons: 8 },
    santaRosa: { at: [-200, -82], rot: 0.3, y: 47, height: 8, color: '#c8743a', outline: [[0, -26], [20, -22], [30, -6], [24, 14], [10, 24], [-12, 26], [-26, 12], [-28, -8], [-16, -22]], garitas: [1, 3, 5, 7], cannons: 10 },
    laGalera: { at: [480, 150], rot: 0, height: 3, color: '#c88a4a', outline: [[0, -10], [9, -5], [9, 5], [0, 10], [-9, 5], [-9, -5]], garitas: [1], cannons: 2 },
  },
  ferry: { dock: [-330, 182], berth: [-312, 262], far: [-312, 980], period: 180, offset: 31, approach: 40, stay: 80, leave: 30 },
  towns: {
    pampatar: { zone: [-40, 210, 90, 138], houses: 46, boats: 7, beached: 10, bay: [-60, 210, 215, 270] },
    juanGriego: { zone: [262, 400, 108, 150], houses: 40, boats: 16, beached: 14, bay: [270, 450, 225, 300], church: [330, 128] },
  },
  hotels: [[262, 92, 38], [300, 70, 46], [228, 58, 30], [330, 46, 34], [-10, 70, 26]],
  playa: { seg: 'a', umbrellas: 70, huts: 5, vendors: 24, islets: [[150, -430], [260, -460], [40, -480], [330, -410]] },
  zones: { palms: 220, scrub: 900, cacti: 260, grass: 7000, mangroves: 700 },
  signs: [{ at: [-96, 142], side: 1, lines: ['Castillo de Santa Rosa'] }, { at: [110, -296], side: -1, lines: ['Playa El Agua'] }, { at: [352, -264], side: 1, lines: ['La Restinga'] }, { at: [430, 70], side: 1, lines: ['Juan Griego'] }, { at: [230, 160], side: 1, lines: ['Pampatar'] }],
};

export const noise = (x, z) => 0.5 * Math.sin(x * 0.013 + Math.sin(z * 0.011) * 2) * Math.cos(z * 0.012 - x * 0.004) + 0.3 * Math.sin(x * 0.041 + z * 0.037) + 0.2 * Math.cos(x * 0.09 - z * 0.07);

export function createLayout() {
  const TAU = Math.PI * 2;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------------- rasters and the island masks ---------------- */
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
  // fill a closed outline into a cell mask with scanlines
  function polyMask(P) {
    const m = new Uint8Array(GR * GR), n = P.length;
    for (let gz = 0; gz < GR; gz++) {
      const z = Z0 + (gz + 0.5) * CELL, xs = [];
      for (let k = 0; k < n; k++) { const a = P[k], b = P[(k + 1) % n]; if ((a.z <= z && b.z > z) || (b.z <= z && a.z > z)) xs.push(a.x + (z - a.z) / (b.z - a.z) * (b.x - a.x)); }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) { const g0 = Math.max(0, Math.ceil((xs[k] - X0) / CELL - 0.5)), g1 = Math.min(GR - 1, Math.floor((xs[k + 1] - X0) / CELL - 0.5)); for (let gx = g0; gx <= g1; gx++) m[gz * GR + gx] = 1; }
    }
    return m;
  }
  const cellOf = (x, z) => clamp(Math.round((z - Z0) / CELL - 0.5), 0, GR - 1) * GR + clamp(Math.round((x - X0) / CELL - 0.5), 0, GR - 1);
  const SHP = new THREE.CatmullRomCurve3(MAP.shore.map(([x, z]) => V3(x, 0, z)), true, 'centripetal').getSpacedPoints(1400);
  const LANDM = polyMask(SHP), SHR = raster(SHP, 160);
  const shoreD = (x, z) => { if (!inArea(x, z, 2)) return -200; const s = sampleR(SHR, x, z); return LANDM[cellOf(x, z)] ? s.dist : -s.dist; };
  const LG = MAP.lagoon, LGP = [];
  for (let k = 0; k < 160; k++) { const a = k / 160 * TAU, r = 1 + 0.08 * Math.sin(a * 5 + 1) + 0.05 * Math.sin(a * 11); LGP.push(V3(LG.c[0] + Math.cos(a) * LG.rx * r, 0, LG.c[1] + Math.sin(a) * LG.rz * r)); }
  const LAGM = polyMask(LGP), LGR = raster(LGP, 40);
  const lagoonD = (x, z) => { if (!inArea(x, z, 2)) return -40; const s = sampleR(LGR, x, z); return LAGM[cellOf(x, z)] ? s.dist : -s.dist; };
  const channels = LG.channels.map(pts => { const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V3(x, 0, z)), true, 'centripetal'); return { curve: c, len: c.getLength(), pts: c.getSpacedPoints(300) }; });
  const CHR = raster(channels.flatMap(c => c.pts), 30);

  /* ---------------- the land: beaches, the central mountains, the lagoon ---------------- */
  function base(x, z) {
    const s = shoreD(x, z);
    if (s < 0) return -0.3 - Math.min(14, -s * 0.11);
    let hills = 0;
    for (const H of MAP.hills) { const r = Math.hypot(x - H.x, z - H.z) / H.r; if (r < 2) hills += H.h * Math.exp(-r * r * 1.6) * (1 + 0.12 * noise(x * 2, z * 2)); }
    const inland = MAP.land + 0.8 * noise(x, z) + hills;
    let h = lerp(0.12 + s * 0.055, inland, sstep(10, 70, s));
    const L = lagoonD(x, z);
    if (L > -14) h = lerp(h, -LG.depth, sstep(-10, 5, L));
    return h;
  }

  /* ---------------- the road ---------------- */
  // The lap starts on the Pampatar seafront: rotate the samples so index 0 sits there.
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
  // The castle hairpins have rounded tips; fairing smooths what remains of the display kinks.
  fairRoute(RP, 30);
  const STEP = RP.reduce((a, p, i) => a + p.distanceTo(RP[(i + 1) % NR]), 0) / NR;
  const RR = raster(RP, 60);
  const hwL = new Float32Array(NR), hwR = new Float32Array(NR), roadY = new Float32Array(NR), bank = new Float32Array(NR);
  {
    // The display lanes were 11–13 m wide; racing needs at least 16 m.
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += rawHW[(i + j + NR) % NR]; hwL[i] = hwR[i] = Math.max(8, a / 33 + 2); }
    let src = Float32Array.from(rawY); const tmp = new Float32Array(NR);
    for (const k of [24, 18, 12]) { for (let i = 0; i < NR; i++) { let a = 0; for (let j = -k; j <= k; j++) a += src[(i + j + NR) % NR]; tmp[i] = a / (2 * k + 1); } src = Float32Array.from(tmp); }
    roadY.set(src);
  }
  const roadFrame = i => { const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize(); return { p, t, n: V3(-t.z, 0, t.x) }; };
  {
    const BANK = { c: 1, a: 1, r: 1, j: 1 }, raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) { if (!BANK[SEG[i]]) continue; const a = roadFrame(i - 12).t, b = roadFrame(i + 12).t, f = roadFrame(i), dd = b.clone().sub(a); raw[i] = clamp(-dd.dot(f.n) * 0.08, -0.07, 0.07); }
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += raw[(i + j + NR) % NR]; bank[i] = a / 33; }
  }
  fairHeights(RP, roadY);
  const roadAt = (i, lat, dy = 0) => { const k = (i % NR + NR) % NR, f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const lateralHW = (i, side) => (side > 0 ? hwR[i] : hwL[i]);
  const idxNear = (x, z) => { let b = 0, bd = 1e9; for (let i = 0; i < NR; i++) { const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };

  /* ---------------- the castle hill: shaped from the hairpins themselves, flat on top for the fort ---------------- */
  const SR = MAP.forts.santaRosa;
  const CG = 8, NG = Math.round(SIZE / CG) + 1, HF = new Float32Array(NG * NG).fill(-99), HI = new Float32Array(NG * NG);
  {
    const S = [];
    for (let i = 0; i < NR; i += 6) if (SEG[i] === 'c') S.push([RP[i].x, RP[i].z, roadY[i] - 0.2, 1]);
    for (let r = 0; r <= 34; r += 6) for (let k = 0; k < 10; k++) S.push([SR.at[0] + Math.cos(k / 10 * TAU) * r, SR.at[1] + Math.sin(k / 10 * TAU) * r, SR.y, 3]);
    for (let gz = 0; gz < NG; gz++) for (let gx = 0; gx < NG; gx++) {
      const x = X0 + gx * CG, z = Z0 + gz * CG; let w = 0, a = 0, dmin = 1e9;
      for (const [sx, sz, sy, sw] of S) { const q = (x - sx) ** 2 + (z - sz) ** 2; dmin = Math.min(dmin, Math.sqrt(q)); const ww = sw / ((q + 30) * (q + 30)); w += ww; a += ww * sy; }
      HF[gz * NG + gx] = a / w; HI[gz * NG + gx] = 1 - sstep(30, 120, dmin);
    }
  }
  const gridS = (A, x, z) => { const fx = clamp((x - X0) / CG, 0, NG - 1.001), fz = clamp((z - Z0) / CG, 0, NG - 1.001), x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0, k = z0 * NG + x0; return lerp(lerp(A[k], A[k + 1], tx), lerp(A[k + NG], A[k + NG + 1], tx), tz); };
  function natural(x, z) {
    let h = base(x, z);
    if (inArea(x, z)) { const k = gridS(HI, x, z); if (k > 0 && h > -0.5) h = Math.max(h, lerp(h, gridS(HF, x, z) - 0.4 + 2 * noise(x * 3, z * 3) * (1 - k), k)); }
    // mangrove islets in the lagoon, clear of the road and the boat channels
    if (lagoonD(x, z) > 3 && noise(x * 2.6 + 7, z * 2.6 - 3) > LG.islets && sampleR(CHR, x, z).dist > 12 && sampleR(RR, x, z).dist > 16) h = 0.15;
    return h;
  }
  const PADS = [];
  function terrainH(x, z) {
    let h = natural(x, z);
    const r = sampleR(RR, x, z);
    if (r.i >= 0) {
      const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z, hw = lat >= 0 ? hwR[r.i] : hwL[r.i], cl = clamp(lat, -hwL[r.i], hwR[r.i]);
      const w = 1 - sstep(hw + 0.5, hw + (SEG[r.i] === 'r' ? 7 : 12), r.dist);
      if (w > 0) h = lerp(h, roadY[r.i] + bank[r.i] * cl - 0.15, w);
    }
    for (const P of PADS) { const dd = Math.max(Math.abs(x - P.x) - P.r, Math.abs(z - P.z) - P.r); if (dd < 6) h = lerp(P.y, h, sstep(0, 6, dd)); }
    // Nothing natural rises through the asphalt.
    if (r.i >= 0 && r.dist < hwR[r.i] + 1.5) h = Math.min(h, roadY[r.i] - 0.2 - Math.abs(bank[r.i]) * hwR[r.i]);
    return h;
  }
  // Beyond the island grid the sea floor continues; the far land is the sea bed.
  const farH = (x, z) => base(x, z);
  const groundH = (x, z) => (inArea(x, z, 4) ? terrainH(x, z) : farH(x, z));
  { const F = MAP.forts.sanCarlos; PADS.push({ x: F.at[0], z: F.at[1], r: 26, y: 2.2 }); }

  return { SIZE, CELL, GR, X0, Z0, CTRL, ROAD_LEN, NR, STEP, RP, SEG, RR, hwL, hwR, roadY, bank, roadFrame, roadAt, lateralHW, idxNear,
    raster, sampleR, inArea, shoreD, lagoonD, channels, CHR, LG, base, natural, PADS, terrainH, farH, groundH, wet: () => false };
}
