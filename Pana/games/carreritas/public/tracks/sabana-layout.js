// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { clamp, lerp } from '/engine/random.js';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
import * as THREE from 'three';
// Pana Gran Sabana. Metres, +x east, +z south, y up. The tepuyes stand to the
// north (-z), dead ahead on the long straight.
export const MAP = {
  seed: 1931,
  area: { x0: -460, z0: -500, size: 960 },
  // Road control points: [x, y, z, segment, half-width]. Heights follow the land, smoothed along the lap.
  // r recta de la sabana, m morichal, j quebrada de jaspe, s salto kama, k kumarakapay, l la loma
  road: [
    [-80, 0, 230, 'r', 6.5], [-60, 0, 120, 'r', 6.5], [-74, 0, 0, 'r', 6.5], [-56, 0, -120, 'r', 6.5], [-26, 0, -240, 'r', 6.5], [10, 0, -330, 'r', 6.5],
    [60, 0, -385, 'm', 6.0], [112, 0, -400, 'm', 4.2], [150, 0, -400, 'm', 4.2], [188, 0, -394, 'm', 4.2], [232, 0, -372, 'm', 6.0],
    [270, 0, -332, 'j', 6.0], [292, 0, -286, 'j', 6.0], [300, 0, -240, 'j', 6.0], [310, 0, -196, 'j', 6.0], [326, 0, -150, 'j', 6.0],
    [336, 0, -90, 's', 6.0], [338, 0, -20, 's', 6.0], [340, 0, 50, 's', 6.0], [338, 0, 110, 's', 5.5], [322, 0, 150, 's', 5.5], [292, 0, 160, 's', 5.5], [272, 0, 132, 's', 5.5],
    [250, 0, 110, 'k', 6.0], [200, 0, 104, 'k', 6.0], [164, 0, 104, 'k', 6.0], [154, 0, 114, 'k', 6.0], [152, 0, 150, 'k', 6.0], [144, 0, 162, 'k', 6.0], [100, 0, 166, 'k', 6.0],
    [60, 0, 190, 'l', 6.5], [30, 0, 240, 'l', 6.5], [0, 0, 282, 'l', 6.5], [-30, 0, 320, 'l', 6.5], [-70, 0, 330, 'l', 6.5], [-96, 0, 298, 'l', 6.5],
  ],
  startAt: [-62, 160],
  // the plateau rolls gently; these hills make the blind crests of La loma
  plateau: { amp: 3.5 },
  hills: [{ x: 28, z: 236, r: 85, h: 13 }, { x: -36, z: 322, r: 85, h: 16 }, { x: -260, z: 380, r: 120, h: 30 }, { x: 380, z: 400, r: 140, h: 26 }, { x: -380, z: -380, r: 150, h: 22 }],
  // streams: water level below the plateau; 'kind' picks the look
  rivers: [
    { name: 'Morichal', kind: 'tea', pts: [[150, -520], [150, -400], [130, -330], [102, -250], [90, -150], [84, -40], [80, 30]], half: 3, depth: 2.4, palms: true, laguna: [80, 46, 22] },
    { name: 'Quebrada de Jaspe', kind: 'jaspe', pts: [[470, -300], [380, -262], [300, -240], [230, -236], [168, -250], [120, -276]], half: 6, depth: 0.7 },
    { name: 'Río Kama', kind: 'tea', pts: [[620, -60], [520, -42], [450, -28], [404, -24]], half: 9, depth: 1.2 },
    { name: 'Garganta del Kama', kind: 'tea', pts: [[400, -6], [402, 80], [414, 180], [430, 300], [440, 470]], half: 12, depth: 30, gorge: 26 },
    { name: 'Morichal del oeste', kind: 'tea', pts: [[-330, -520], [-270, -260], [-300, 20], [-262, 260], [-320, 470]], half: 2.6, depth: 2, palms: true },
  ],
  fall: { lip: [404, -24], width: 16, base: [401, -4] },
  lookout: { at: [358, -24], view: [374, 7, 42] },
  village: { square: [205, 140, 30], houses: 12, church: [238, 150], kids: 26 },
  // The tepuyes on the horizon: the reference's walls brought 0.55x nearer and
  // smaller, so they keep their size on screen inside the race's fog distance.
  tepuyScale: 0.55,
  tepuyes: [
    { name: 'Kukenán', c: [-2300, -7600], rx: 760, rz: 420, rot: 0.25, h: 640, talus: 560, seed: 3 },
    { name: 'Roraima', c: [1500, -8200], rx: 1350, rz: 560, rot: -0.12, h: 680, talus: 600, seed: 7 },
    { name: 'Ilú', c: [-6400, -2200], rx: 700, rz: 300, rot: 0.6, h: 420, talus: 260, seed: 11 },
    { name: 'Uei', c: [6400, -1200], rx: 900, rz: 360, rot: -0.4, h: 360, talus: 240, seed: 13 },
    { name: 'Chimantá', c: [-4200, 6000], rx: 1600, rz: 500, rot: 0.2, h: 380, talus: 260, seed: 17 },
  ],
  zones: { grass: 14000, loneTrees: 70, gallery: 380, termites: 160, rocks: 120, farTrees: 900 },
  // the afternoon storm on the race clock: dark clouds from the east, a curtain of rain sweeps west, the road stays wet a while
  storm: { period: 170, offset: 0, darkFrom: 40, sweep: [58, 128], from: 1800, to: -1900, trail: 1100, dryBy: 168 },
  signs: [[40, -360, 1, 'Morichal'], [276, -318, -1, 'Quebrada de Jaspe'], [250, 112, 1, 'Kumarakapay']],
};

export const noise = (x, z) => 0.5 * Math.sin(x * 0.013 + Math.sin(z * 0.011) * 2) * Math.cos(z * 0.012 - x * 0.004) + 0.3 * Math.sin(x * 0.041 + z * 0.037) + 0.2 * Math.cos(x * 0.09 - z * 0.07);

export function createLayout() {
  const PI = Math.PI, TAU = PI * 2;
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

  /* ---------------- the plateau, the hills, the tepuy talus ---------------- */
  const K = MAP.tepuyScale;
  const TEP = MAP.tepuyes.map(T0 => {
    const T = { ...T0, c: [T0.c[0] * K, T0.c[1] * K], rx: T0.rx * K, rz: T0.rz * K, h: T0.h * K, talus: T0.talus * K };
    // an irregular rounded footprint with notches, in world space
    const N = 96, pts = [], R = (() => { let s = T.seed * 97; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const bumps = Array.from({ length: 7 }, () => [R() * TAU, 0.05 + R() * 0.14, 2 + Math.floor(R() * 5)]);
    for (let k = 0; k < N; k++) {
      const a = k / N * TAU; let r = 1;
      for (const [ph, amp, f] of bumps) r += amp * Math.sin(a * f + ph);
      const sq = Math.pow(Math.abs(Math.cos(a)), 0.55) * Math.sign(Math.cos(a)), sz = Math.pow(Math.abs(Math.sin(a)), 0.55) * Math.sign(Math.sin(a));
      const lx = sq * T.rx * r, lz = sz * T.rz * r, c = Math.cos(T.rot), s = Math.sin(T.rot);
      pts.push(new THREE.Vector2(T.c[0] + lx * c - lz * s, T.c[1] + lx * s + lz * c));
    }
    return { ...T, pts };
  });
  const distToTepuy = (T, x, z) => { const c = Math.cos(-T.rot), s = Math.sin(-T.rot), dx = x - T.c[0], dz = z - T.c[1], lx = (dx * c - dz * s) / T.rx, lz = (dx * s + dz * c) / T.rz; return (Math.hypot(lx, lz) - 1) * Math.min(T.rx, T.rz); };
  const TALUS = 2600 * K;
  function plain(x, z) {
    let h = MAP.plateau.amp * noise(x * 0.5, z * 0.5) + 1.2 * noise(x * 2.2, z * 2.2);
    for (const H of MAP.hills) { const r = Math.hypot(x - H.x, z - H.z) / H.r; if (r < 1.8) h += H.h * Math.exp(-r * r * 1.5); }
    // the plateau swells into far ridges and then the talus slopes of the tepuyes
    const far = Math.hypot(x, z); h += sstep(1400 * K, 5000 * K, far) * (20 + 50 * noise(x * 0.08, z * 0.08)) * (z < -1500 * K ? 0.35 : 1);
    for (const T of TEP) { const dd = distToTepuy(T, x, z); if (dd < TALUS) h = Math.max(h, T.talus * Math.pow(1 - sstep(-40, TALUS, dd), 1.3) + 20 * noise(x * 0.3, z * 0.3) * (1 - sstep(0, 2000 * K, dd))); }
    return h;
  }

  /* ---------------- rivers carved into the plateau ---------------- */
  const rivers = MAP.rivers.map(R => {
    const curve = new THREE.CatmullRomCurve3(R.pts.map(([x, z]) => V3(x, 0, z)), false, 'centripetal');
    const N = Math.max(40, Math.round(curve.getLength() / 2)), P = curve.getSpacedPoints(N);
    const Y = new Float32Array(N + 1); let m = 1e9;
    for (let i = 0; i <= N; i++) { m = Math.min(m, plain(P[i].x, P[i].z) - R.depth); Y[i] = m; }
    return { R, N, P, Y, ras: raster(P, 70) };
  });
  const LAG = MAP.rivers[0].laguna;
  function natural(x, z) {
    let h = plain(x, z);
    for (const rv of rivers) {
      const v = sampleR(rv.ras, x, z); if (v.i < 0) continue;
      const L = rv.Y[v.i], hw = rv.R.half;
      if (rv.R.gorge) { const g = rv.R.gorge; h = lerp(L - 1, h, sstep(g - 6, g + 2, v.dist) * (0.15 + 0.85 * sstep(g - 1, g + 1, v.dist))); }
      else { h = Math.min(h, L + 0.4 + Math.max(0, v.dist - hw) * 0.35); h = lerp(L - 0.6, h, sstep(hw - 1, hw + 1.5, v.dist)); }
    }
    if (LAG) { const r = Math.hypot(x - LAG[0], z - LAG[1]) / LAG[2]; if (r < 1.5) h = lerp(rivers[0].Y[rivers[0].N] - 0.8, h, sstep(0.85, 1.4, r)); }
    return h;
  }

  /* ---------------- the road ---------------- */
  // The lap starts on the long straight: rotate the samples so index 0 sits there.
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
  // The reference's hairpins at Kumarakapay and the Kama lookout are faired
  // into curves a pack of racers can take.
  fairRoute(RP, 24);
  const STEP = RP.reduce((a, p, i) => a + p.distanceTo(RP[(i + 1) % NR]), 0) / NR;
  const RR = raster(RP, 60);
  const hwL = new Float32Array(NR), hwR = new Float32Array(NR), roadY = new Float32Array(NR), bank = new Float32Array(NR), elev = new Uint8Array(NR), ford = new Float32Array(NR);
  {
    // The display track was 8–13 m wide; racing needs at least 16 m.
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += rawHW[(i + j + NR) % NR]; hwL[i] = hwR[i] = Math.max(8, a / 33 + 2); }
    const nat = new Float32Array(NR);
    for (let i = 0; i < NR; i++) nat[i] = plain(RP[i].x, RP[i].z);
    let src = nat; const tmp = new Float32Array(NR);
    for (const k of [20, 14]) { for (let i = 0; i < NR; i++) { let a = 0; for (let j = -k; j <= k; j++) a += src[(i + j + NR) % NR]; tmp[i] = a / (2 * k + 1); } src = Float32Array.from(tmp); }
    roadY.set(src);
    // plank bridge over the morichal; a low ford through the jaspe
    for (let i = 0; i < NR; i++) {
      const p = RP[i];
      for (const rv of rivers) {
        const v = sampleR(rv.ras, p.x, p.z); if (v.i < 0) continue;
        if (rv.R.kind === 'jaspe') { const w = 1 - sstep(rv.R.half, rv.R.half + 24, v.dist); if (w > 0) { roadY[i] = lerp(roadY[i], rv.Y[v.i] + 0.25, w); ford[i] = 1 - sstep(rv.R.half - 1, rv.R.half + 2, v.dist); } }
        else if (!rv.R.gorge && v.dist < rv.R.half + 6) { roadY[i] = Math.max(roadY[i], plain(p.x, p.z) + 0.6); elev[i] = 1; }
      }
    }
    const fixed = Float32Array.from(roadY);
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -10; j <= 10; j++) a += fixed[(i + j + NR) % NR]; roadY[i] = ford[i] > 0 ? fixed[i] : a / 21; }
    // The deck runs a little past the banks so its ends sit on the ground.
    const deck = Uint8Array.from(elev);
    for (let i = 0; i < NR; i++) if (deck[i]) for (let j = -6; j <= 6; j++) elev[(i + j + NR) % NR] = 1;
  }
  const roadFrame = i => { const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize(); return { p, t, n: V3(-t.z, 0, t.x) }; };
  {
    const BANK = { r: 1, l: 1, s: 1, m: 1 }, raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) { if (!BANK[SEG[i]] || elev[i]) continue; const a = roadFrame(i - 14).t, b = roadFrame(i + 14).t, f = roadFrame(i), dd = b.clone().sub(a); raw[i] = clamp(-dd.dot(f.n) * 0.08, -0.08, 0.08); }
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += raw[(i + j + NR) % NR]; bank[i] = elev[i] ? 0 : a / 33; }
  }
  fairHeights(RP, roadY);
  const roadAt = (i, lat, dy = 0) => { const k = (i % NR + NR) % NR, f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const lateralHW = (i, side) => (side > 0 ? hwR[i] : hwL[i]);
  const idxNear = (x, z) => { let b = 0, bd = 1e9; for (let i = 0; i < NR; i++) { const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };
  const PADS = [];
  function terrainH(x, z) {
    let h = natural(x, z);
    const r = sampleR(RR, x, z);
    if (r.i >= 0 && !elev[r.i]) {
      const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z, hw = lat >= 0 ? hwR[r.i] : hwL[r.i], cl = clamp(lat, -hwL[r.i], hwR[r.i]);
      const w = 1 - sstep(hw + 0.5, hw + 10, r.dist);
      if (w > 0) h = lerp(h, roadY[r.i] + bank[r.i] * cl - 0.12, w);
    }
    for (const P of PADS) { const dd = Math.hypot(x - P.x, z - P.z) - P.r; if (dd < 8) h = lerp(P.y, h, sstep(0, 8, dd)); }
    // Nothing natural rises through the road or the bridge deck.
    if (r.i >= 0 && r.dist < hwR[r.i] + 1.5) h = Math.min(h, roadY[r.i] - (elev[r.i] ? 0.6 : 0.2) - Math.abs(bank[r.i]) * hwR[r.i]);
    return h;
  }
  const groundH = (x, z) => (inArea(x, z, 1) ? terrainH(x, z) : plain(x, z));
  { const [vx, vz, vr] = MAP.village.square; PADS.push({ x: vx, z: vz, r: vr, y: roadY[idxNear(vx - vr, vz - vr)] - 0.12 }); }
  const nearRiver = (x, z, m) => rivers.some(rv => { const v = sampleR(rv.ras, x, z); return v.i >= 0 && v.dist < (rv.R.gorge || rv.R.half) + m; });

  return { SIZE, CELL, GR, X0, Z0, CTRL, ROAD_LEN, NR, STEP, RP, SEG, RR, hwL, hwR, roadY, bank, elev, ford, roadFrame, roadAt, lateralHW, idxNear,
    raster, sampleR, inArea, TEP, plain, rivers, LAG, natural, PADS, terrainH, groundH, nearRiver, wet: i => ford[(i % NR + NR) % NR] > 0.5 };
}
