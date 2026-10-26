// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { clamp, lerp } from '/engine/random.js';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
import * as THREE from 'three';
// Metres, +x east, +z south (out over the lake), y up. Land lies north of the shore.
export const MAP = {
  seed: 1529,
  area: { x0: -640, z0: -560, size: 1280 },
  land: 2.2,
  // One closed lap: city loop, ramp, bridge, eastern landing, palafitos, casco, plaza.
  // Every section has four 4 m lanes plus shoulders. The lap starts on the city loop.
  road: [
    [140, 2.6, -174, 'v', 9], [108, 2.6, -194, 'v', 9], [100, 2.6, -242, 'v', 9],
    [104, 2.6, -300, 'v', 9], [86, 2.6, -350, 'v', 9], [44, 2.6, -372, 'v', 9],
    [-12, 2.6, -370, 'v', 9], [-62, 2.6, -342, 'v', 9], [-82, 2.6, -296, 'v', 9],
    [-82, 2.6, -236, 'v', 9], [-64, 2.6, -182, 'v', 9], [-36, 2.6, -146, 'v', 9],
    [-36, 4, -110, 's', 9], [-64, 9, -74, 's', 9], [-78, 16, -30, 's', 9],
    ['bridge'],
    [282, 18, 264, 'b', 9], [316, 13, 224, 'b', 9], [318, 9, 180, 'b', 9], [294, 6, 140, 'b', 9], [264, 3.5, 106, 'b', 9], [256, 2.6, 66, 'b', 9], [276, 2.6, 26, 'b', 9],
    [318, 2.6, 6, 'f', 9], [350, 2.6, 22, 'f', 9], [385, 2.6, 34, 'f', 9], [420, 2.6, 32, 'f', 9], [450, 2.6, 18, 'f', 9], [472, 2.6, -8, 'f', 9],
    [480, 2.6, -42, 'k', 9], [480, 2.6, -88, 'k', 9], [470, 2.6, -106, 'k', 9], [446, 2.6, -110, 'k', 9], [420, 2.6, -110, 'k', 9], [402, 2.6, -124, 'k', 9],
    [400, 2.6, -148, 'k', 9], [388, 2.6, -166, 'k', 9], [354, 2.6, -172, 'k', 9],
    [310, 2.6, -172, 'q', 9], [288, 2.6, -190, 'q', 9], [282, 2.6, -226, 'q', 9], [270, 2.6, -254, 'q', 9], [250, 2.6, -266, 'q', 9], [224, 2.6, -269, 'q', 9], [200, 2.6, -263, 'q', 9],
    [180, 2.6, -244, 'q', 9], [176, 2.6, -218, 'q', 9], [172, 2.6, -192, 'q', 9],
  ],
  // Shoreline from west to east; land lies to the north of it.
  shore: [[-1400, 40], [-700, 30], [-520, 20], [-440, 12], [-398, 6], [-370, -16], [-300, -26], [-220, -24], [-172, -6], [-140, 10], [-60, 14], [100, 14], [280, 14], [306, 6],
    [336, -14], [400, -24], [460, -22], [492, -8], [512, 10], [600, 18], [1400, 30]],
  farShore: { z: 1500, lights: 260 },
  // One continuous four-lane bridge.
  bridge: { axis: [[-82, 16], [-100, 390], [230, 290]], half: 9, samples: 25, h: [23, 36, 23], rise: [0, 0.3], fall: [0.6, 1],
    towers: { t: [0.36, 0.44, 0.52, 0.60, 0.68, 0.76], colors: ['#2a5cff', '#b03cff', '#c8f03a', '#ff3030', '#20e0d0', '#3a7aff'], height: 48, base: 20, top: 12 },
    pierEvery: 24, lampEvery: 24 },
  plaza: { x: 227, z: -223, w: 86, d: 72 },
  basilica: { x: 228, z: -296, rot: 0 },
  stage: { x: 227, z: -197, w: 18, d: 8 },
  crowd: 520,
  casco: { x0: 290, x1: 520, z0: -205, z1: -30, colors: ['#f2c230', '#e8462e', '#2a9b5a', '#3d7bf2', '#f08ab0', '#f08a1f', '#8a3ac8', '#22b2b8', '#f5e04a'] },
  palafitos: { houses: 26, colors: ['#7aa89a', '#e8e2d2', '#b8583a', '#5f8fb0', '#d8c060', '#8ab070'] },
  pumps: [[-350, -4], [-300, 8], [-252, -6], [-206, 6], [-322, 40], [-232, 34], [-150, 60], [-90, 96]],
  platforms: 34, flares: [[-1100, 1250], [700, 1380]],
  lanchas: [{ c: [60, 180], r: [180, 70], period: 120 }, { c: [-120, 600], r: [260, 120], period: 160 }, { c: [300, 320], r: [120, 160], period: 140 }, { c: [-600, 300], r: [150, 200], period: 130 }],
  // Catatumbo: flashes on the race clock, far over the lake to the south-west.
  lightning: { interval: [6, 12], bolts: [3, 7], dur: [0.2, 0.4], x: [-2200, 600], z: [2300, 3300], count: 600 },
  fireworks: { at: [227, -223], every: [4, 9], height: [60, 90], n: 140, life: 2.8, count: 400 },
  moon: { dir: [0.92, 0.16, 0.36], size: 260 },
  signs: [{ at: [48, -366], side: 1, lines: ['Puente', '2 carriles por sentido'] }, { at: [470, -60], side: -1, lines: ['Casco histórico'] }, { at: [300, -176], side: 1, lines: ['La Basílica'] }, { at: [330, 12], side: -1, lines: ['Palafitos'] }],
};

export function createLayout() {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------------- distance rasters (2 m cells) ---------------- */
  const AR = MAP.area, SIZE = AR.size, CELL = 2, GR = SIZE / CELL, X0 = AR.x0, Z0 = AR.z0;
  function raster(pts, far) {
    const dist = new Float32Array(GR * GR).fill(far), idx = new Int32Array(GR * GR).fill(-1), rc = Math.ceil(far / CELL);
    pts.forEach((p, i) => {
      const cx = Math.floor((p.x - X0) / CELL), cz = Math.floor((p.z - Z0) / CELL);
      for (let z = Math.max(0, cz - rc); z <= Math.min(GR - 1, cz + rc); z++) for (let x = Math.max(0, cx - rc); x <= Math.min(GR - 1, cx + rc); x++) {
        const wx = X0 + (x + 0.5) * CELL, wz = Z0 + (z + 0.5) * CELL, dx = wx - p.x, dz = wz - p.z;
        if (dx * dx + dz * dz > far * far) continue;
        const dd = Math.sqrt(dx * dx + dz * dz), k = z * GR + x;
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

  /* ---------------- the land: a flat city behind a sea wall, the lake south of it ---------------- */
  const shoreCurve = new THREE.CatmullRomCurve3(MAP.shore.map(([x, z]) => V3(x, 0, z)), false, 'centripetal');
  const NSH = 1600, SHP = shoreCurve.getSpacedPoints(NSH), SHR = raster(SHP, 60);
  const shoreZ = x => { let b = SHP[0]; for (const p of SHP) if (Math.abs(p.x - x) < Math.abs(b.x - x)) b = p; return b.z; };
  function shoreD(x, z) {
    const s = sampleR(SHR, x, z);
    if (s.i < 0) return z < shoreZ(x) ? 60 : -60;
    const p = SHP[s.i], q = SHP[Math.min(NSH, s.i + 1)], pp = SHP[Math.max(0, s.i - 1)];
    const tx = q.x - pp.x, tz = q.z - pp.z, cross = tx * (z - p.z) - tz * (x - p.x);
    return cross < 0 ? s.dist : -s.dist;
  }
  const LAND = MAP.land;
  const softShore = x => x > 300 && x < 520;      // mud and mangrove under the palafitos, a sea wall elsewhere
  function base(x, z) {
    const dd = shoreD(x, z);
    if (softShore(x)) return lerp(-2.5, LAND, sstep(-6, 14, dd));
    return lerp(-3, LAND, sstep(-0.5, 1.2, dd));
  }

  /* ---------------- the road: control points with the bridge expanded ---------------- */
  const BR = MAP.bridge;
  const bz = (t, k) => { const [a, b, c] = BR.axis; return (1 - t) * (1 - t) * a[k] + 2 * (1 - t) * t * b[k] + t * t * c[k]; };
  const axisAt = t => V3(bz(t, 0), 0, bz(t, 1));
  const bridgeH = t => BR.h[0] + (BR.h[1] - BR.h[0]) * sstep(BR.rise[0], BR.rise[1], t) - (BR.h[1] - BR.h[2]) * sstep(BR.fall[0], BR.fall[1], t);
  const CTRL = [];
  for (const p of MAP.road) {
    if (p[0] !== 'bridge') { CTRL.push(p); continue; }
    for (let k = 0; k < BR.samples; k++) { const t = k / (BR.samples - 1), a = axisAt(t); CTRL.push([a.x, bridgeH(t), a.z, 'u', BR.half]); }
  }
  const roadCurve = new THREE.CatmullRomCurve3(CTRL.map(([x, y, z]) => V3(x, y, z)), true, 'centripetal');
  const ROAD_LEN = roadCurve.getLength(), NR = 3600, STEP = ROAD_LEN / NR;
  const RP = roadCurve.getSpacedPoints(NR).slice(0, NR);
  // The reference's square city corners are display-only; fair them to a
  // driveable radius before anything is placed beside the road.
  fairRoute(RP, Math.round(24 / STEP));
  const ctrlAt = i => CTRL[Math.min(CTRL.length - 1, Math.floor(roadCurve.getUtoTmapping(i / NR) * CTRL.length))];
  const SEG = RP.map((_, i) => ctrlAt(i)[3]);
  const RR = raster(RP, 46);
  const BRIDGE = { u: 1 };
  const hwL = new Float32Array(NR), hwR = new Float32Array(NR), roadY = new Float32Array(NR), bank = new Float32Array(NR), elev = new Uint8Array(NR);
  {
    const raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) raw[i] = ctrlAt(i)[4];
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += raw[(i + j + NR) % NR]; hwL[i] = hwR[i] = Math.max(8, a / 33); }
    let src = Float32Array.from(RP.map(p => p.y)); const tmp = new Float32Array(NR);
    for (const k of [14, 10]) { for (let i = 0; i < NR; i++) { let a = 0; for (let j = -k; j <= k; j++) a += src[(i + j + NR) % NR]; tmp[i] = a / (2 * k + 1); } src = Float32Array.from(tmp); }
    for (let i = 0; i < NR; i++) roadY[i] = Math.max(src[i], 2.6);
  }
  const roadFrame = i => { const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize(); return { p, t, n: V3(-t.z, 0, t.x) }; };
  {
    const BANK = { s: 1, b: 1, u: 1, v: 1 }, raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) { if (!BANK[SEG[i]]) continue; const a = roadFrame(i - 14).t, b = roadFrame(i + 14).t, f = roadFrame(i), dd = b.clone().sub(a); raw[i] = clamp(-dd.dot(f.n) * 0.07, -0.07, 0.07); }
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -20; j <= 20; j++) a += raw[(i + j + NR) % NR]; bank[i] = a / 41; }
  }
  fairHeights(RP, roadY);
  for (let i = 0; i < NR; i++) { const p = RP[i]; if (roadY[i] - base(p.x, p.z) > 1.4) elev[i] = 1; }
  { const e = Uint8Array.from(elev); for (let i = 0; i < NR; i++) if (e[(i + 3) % NR] || e[(i - 3 + NR) % NR]) elev[i] = elev[i] || (SEG[i] === 'f' ? 1 : 0); }
  const roadAt = (i, lat, dy = 0) => { const k = (i % NR + NR) % NR, f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const lateralHW = (i, side) => (side > 0 ? hwR[i] : hwL[i]);
  const idxNear = (x, z, keep = () => true) => { let b = 0, bd = 1e9; for (let i = 0; i < NR; i++) { if (!keep(i)) continue; const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };
  // Bridge furniture follows the faired deck, not the reference's axis.
  const bridgeIndex = t => { const a = axisAt(t); return idxNear(a.x, a.z, i => BRIDGE[SEG[i]]); };
  const PL = MAP.plaza;
  const inPlaza = (x, z, m = 0) => Math.abs(x - PL.x) < PL.w / 2 + m && Math.abs(z - PL.z) < PL.d / 2 + m;
  function terrainH(x, z) {
    let h = base(x, z);
    const r = sampleR(RR, x, z);
    if (r.i >= 0 && !elev[r.i]) {
      const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z, hw = lat >= 0 ? hwR[r.i] : hwL[r.i], cl = clamp(lat, -hwL[r.i], hwR[r.i]);
      const w = 1 - sstep(hw + 0.5, hw + 8, r.dist);
      if (w > 0 && h > -0.5) h = lerp(h, roadY[r.i] + bank[r.i] * cl - 0.15, w);
    }
    if (inPlaza(x, z, 6) && h > 0) h = 2.5;
    return h;
  }
  const groundH = (x, z) => (inArea(x, z, 4) ? terrainH(x, z) : base(x, z));

  return { SIZE, CELL, GR, X0, Z0, LAND, inArea, raster, sampleR, shoreCurve, NSH, SHP, SHR, shoreZ, shoreD, softShore, base,
    BR, axisAt, bridgeH, bridgeIndex, CTRL, roadCurve, ROAD_LEN, NR, STEP, RP, ctrlAt, SEG, RR, BRIDGE, hwL, hwR, roadY, bank, elev,
    roadFrame, roadAt, lateralHW, idxNear, PL, inPlaza, terrainH, groundH };
}
