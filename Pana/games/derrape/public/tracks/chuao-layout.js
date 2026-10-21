import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import { fairRoute, fairHeights } from './coastal-road.js';
import * as THREE from 'three';
export const MAP = {
  seed: 5150,
  size: 700,
  // Road control points: [x, y hint, z, segment, half-width]. Heights follow the land, smoothed along the lap.
  // b desembarco, r boca, c cacaotal, p pueblo, q patio, u subida, l cornisa, f entrada al agua, s quebrada, e salida del agua, d regreso
  road: [
    [-60, 2, 140, 'b', 6.5], [0, 2, 142, 'b', 6.5], [60, 2, 140, 'b', 6.5],
    [100, 2, 130, 'r', 6.0], [116, 3, 104, 'r', 6.0], [112, 4, 76, 'r', 6.0],
    [88, 5, 58, 'c', 5.5], [50, 5, 56, 'c', 5.5], [10, 6, 77, 'c', 5.5], [-28, 6, 78, 'c', 5.5], [-59, 6, 59, 'c', 5.5], [-72, 7, 24, 'c', 5.5],
    [-60, 8, -2, 'p', 5.5], [-30, 9, -12, 'p', 5.5], [0, 10, -14, 'p', 5.5],
    [36, 10, -18, 'q', 6.0], [56, 10, -46, 'q', 6.0], [48, 11, -82, 'q', 6.0], [18, 12, -110, 'q', 6.0],
    [40, 14, -130, 'u', 6.0], [10, 18, -155, 'u', 6.0], [50, 22, -180, 'u', 6.0], [15, 27, -208, 'u', 6.0], [45, 32, -232, 'u', 5.5],
    [36, 36, -256, 'l', 5.0], [12, 37, -270, 'l', 5.0],
    [-10, 37, -272, 'f', 5.5], [-30, 36, -272, 's', 5.5],
    [-70, 35, -274, 's', 5.5], [-115, 33, -252, 's', 5.5], [-146, 30, -205, 's', 5.5],
    [-164, 25, -150, 's', 5.5], [-173, 19, -90, 's', 5.5], [-178, 12, -20, 's', 5.5],
    [-178, 7, 50, 's', 5.5], [-177, 5, 84, 'e', 5.5], [-164, 3, 114, 'd', 6.0],
    [-138, 2, 132, 'd', 6.0], [-112, 2, 139, 'b', 6.5], [-86, 2, 141, 'b', 6.5],
  ],
  startAt: [-24, 141],
  // Shoreline from west to east; land lies to the north of it.
  shore: [
    [-350, 70], [-300, 96], [-262, 140], [-244, 196], [-230, 248], [-210, 266], [-196, 238], [-186, 186], [-170, 162], [-130, 151],
    [-60, 149], [0, 151], [60, 149], [120, 151], [168, 158], [196, 184], [212, 232], [232, 262], [254, 246], [268, 196], [300, 164], [350, 154],
  ],
  beach: { rise: 0.09 },
  // The valley: rows [z, centre x, half-width of the flat floor, floor height]; walls climb outside it.
  valley: [
    [170, 0, 420, 1], [100, 0, 340, 3], [40, -20, 270, 6], [-20, -30, 230, 10], [-80, -40, 200, 15], [-140, -60, 150, 24],
    [-200, -60, 128, 33], [-250, -35, 100, 40], [-282, -20, 66, 43], [-293, -20, 54, 92], [-350, -20, 44, 112],
  ],
  walls: { slope: 0.95, noise: 6, dry: 0.45 },
  features: [
    { type: 'hill', x: -222, z: 214, r: 52, h: 78 },    // the tall west headland
    { type: 'hill', x: 236, z: 222, r: 46, h: 52 },     // the east headland
    { type: 'hill', x: 30, z: -266, r: 22, h: 6 },      // the shoulder that carries the ledge beside the falls
    { type: 'lagoon', x: 152, z: 116, rx: 26, rz: 18, depth: 0.7 },   // la boca: the lagoon behind the sand
    { type: 'lagoon', x: -176, z: 140, rx: 16, rz: 12, depth: 0.7 },  // the mouth of the río Chuao
  ],
  rivers: [
    { name: 'Río Chuao', pts: [[-30, -272], [-70, -274], [-115, -252], [-146, -205], [-164, -150], [-173, -90], [-178, -20], [-178, 50], [-177, 84], [-176, 112], [-176, 136]], half: 8.5, pool: 18 },
    { name: 'Quebrada de la boca', pts: [[168, -70], [146, -30], [164, 10], [142, 52], [156, 86], [152, 106]], half: 2.4 },
  ],
  fall: { x: -30, z: -292, width: 8 },
  plaza: { x: 17, z: -50, w: 56, d: 40, circles: 16 },
  church: { x: 15, z: -78, rot: 0 },
  shop: { x: -26, z: -40, rot: Math.PI / 2 },
  welcome: [-58, 0],
  jetty: { x: 24, z: 150, len: 36 },
  zones: {
    cacao: { xMin: -95, xMax: 100, zMin: 18, zMax: 112, cacao: 1300, bucare: 120 },
    town: { xMin: -70, xMax: 75, zMin: -110, zMax: 10, houses: 90 },
    forest: 5200,
    beachPalms: 140, seaGrape: 160,
  },
  peneros: { beach: [[-40, 152, 6], [50, 152, 5]], ferry: 3 },
  signs: [
    { at: [112, 90], side: -1, lines: ['Cacaotal'], arrow: 'left' },
    { at: [40, -118], side: 1, lines: ['Chorrerón'], arrow: 'up' },
    { at: [-164, 114], side: 1, lines: ['Playa'], arrow: 'up' },
    { at: [12, -270], side: 1, lines: ['Quebrada'], arrow: 'up' },
  ],
  views: {
    aerial: { pos: [120, 470, 460], target: [-20, 0, -40] },
    playa: { pos: [70, 12, 196], target: [-20, 4, 138] },
    cacaotal: { pos: [72, 17, 70], target: [14, 3, 54] },
    patio: { pos: [16, 30, 12], target: [15, 9, -64] },
    quebrada: { pos: [-118, 58, -42], target: [-168, 17, -112] },
    chorreron: { pos: [14, 54, -214], target: [-30, 64, -290] },
  },
};
export function createLayout() {
  const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
  const rand = rng(MAP.seed);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = arr => pickRandom(arr, rand);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const col = hex => new THREE.Color(hex);
  const d = new THREE.Object3D();
  const uTime = { value: 0 };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  const SIZE = MAP.size, CELL = 2, GR = SIZE / CELL, HALF = SIZE / 2;
  function raster(pts, far) {
    const dist = new Float32Array(GR * GR).fill(far), idx = new Int32Array(GR * GR).fill(-1), rc = Math.ceil(far / CELL);
    pts.forEach((p, i) => {
      const cx = Math.floor((p.x + HALF) / CELL), cz = Math.floor((p.z + HALF) / CELL);
      for (let z = Math.max(0, cz - rc); z <= Math.min(GR - 1, cz + rc); z++) for (let x = Math.max(0, cx - rc); x <= Math.min(GR - 1, cx + rc); x++) {
        const wx = -HALF + (x + 0.5) * CELL, wz = -HALF + (z + 0.5) * CELL, dx = wx - p.x, dz = wz - p.z;
        if (dx * dx + dz * dz > far * far) continue;
        const dd = Math.sqrt(dx * dx + dz * dz), k = z * GR + x;
        if (dd < dist[k]) { dist[k] = dd; idx[k] = i; }
      }
    });
    return { dist, idx, far };
  }
  function sampleR(R, x, z) {
    const fx = (x + HALF) / CELL - 0.5, fz = (z + HALF) / CELL - 0.5;
    if (fx < 0 || fz < 0 || fx > GR - 1 || fz > GR - 1) return { dist: R.far, i: -1 };
    const x0 = clamp(Math.floor(fx), 0, GR - 2), z0 = clamp(Math.floor(fz), 0, GR - 2), tx = clamp(fx - x0, 0, 1), tz = clamp(fz - z0, 0, 1);
    const k = z0 * GR + x0;
    const dist = lerp(lerp(R.dist[k], R.dist[k + 1], tx), lerp(R.dist[k + GR], R.dist[k + GR + 1], tx), tz);
    const ni = R.idx[clamp(Math.round(fz), 0, GR - 1) * GR + clamp(Math.round(fx), 0, GR - 1)];
    return { dist, i: ni };
  }

  /* ---------------- the land: shoreline, the valley and its walls, headlands, lagoons ---------------- */
  const shoreCurve = new THREE.CatmullRomCurve3(MAP.shore.map(([x, z]) => V3(x, 0, z)), false, 'centripetal');
  const NSH = 900, SHP = shoreCurve.getSpacedPoints(NSH);
  const SHR = raster(SHP, 170);
  const farShoreZ = x => (x < 0 ? MAP.shore[0][1] : MAP.shore[MAP.shore.length - 1][1]) + 10 * Math.sin(x * 0.012);
  function shoreD(x, z) {
    const s = sampleR(SHR, x, z);
    if (s.i < 0) {
      const far = farShoreZ(x) - z;
      // The display demo capped inland distance at 170 m until the grid
      // boundary, then jumped to the full distance: a square cliff.
      return Math.abs(x) < HALF && Math.abs(z) < HALF
        ? lerp(z < 150 ? SHR.far : -SHR.far, far, sstep(270,349,Math.max(Math.abs(x),Math.abs(z)))) : far;
    }
    const p = SHP[s.i], q = SHP[Math.min(NSH, s.i + 1)], pp = SHP[Math.max(0, s.i - 1)];
    const tx = q.x - pp.x, tz = q.z - pp.z, cross = tx * (z - p.z) - tz * (x - p.x);
    return lerp(cross < 0 ? s.dist : -s.dist, farShoreZ(x)-z, sstep(320,349,Math.max(Math.abs(x),Math.abs(z))));
  }
  const VAL = MAP.valley, WALL = MAP.walls;
  function valleyAt(z) {
    if (z >= VAL[0][0]) return { cx: VAL[0][1], hw: VAL[0][2], floor: VAL[0][3] };
    for (let k = 1; k < VAL.length; k++) if (z >= VAL[k][0]) { const a = VAL[k - 1], b = VAL[k], t = (z - a[0]) / (b[0] - a[0]); return { cx: lerp(a[1], b[1], t), hw: lerp(a[2], b[2], t), floor: lerp(a[3], b[3], t) }; }
    const L = VAL[VAL.length - 1]; return { cx: L[1], hw: L[2], floor: L[3] + (L[0] - z) * 0.3 };
  }
  function base(x, z) {
    const dd = shoreD(x, z);
    let hills = 0;
    for (const f of MAP.features) if (f.type === 'hill') { const r = Math.hypot(x - f.x, z - f.z) / f.r; if (r < 1.8) hills += f.h * Math.exp(-r * r * 1.6) * (1 + 0.08 * Math.sin(x * 0.11 + z * 0.07)); }
    let h;
    if (dd < 0) h = Math.max(-0.3 - Math.min(14, -dd * 0.17), hills - 4);
    else {
      const v = valleyAt(z), dx = Math.abs(x - v.cx), out = Math.max(0, dx - v.hw);
      h = v.floor + out * WALL.slope + sstep(0, 30, out) * (WALL.noise * Math.sin(x * 0.031 + z * 0.02) + 3 * Math.sin(x * 0.07 - z * 0.05) + 2 * Math.cos(x * 0.013 - z * 0.021));
      h += 1.2 * Math.sin(x * 0.05 + 1) * Math.cos(z * 0.045) * sstep(-150, 80, z);
      h = Math.min(h, 0.15 + dd * MAP.beach.rise * (1 + Math.max(0, dd - 30) * 0.08)) + hills;
    }
    for (const f of MAP.features) if (f.type === 'lagoon') {
      const r = Math.hypot((x - f.x) / f.rx, (z - f.z) / f.rz);
      if (r < 1.6) h = lerp(-f.depth, h, sstep(0.85, 1.35, r));
    }
    return h;
  }

  /* ---------------- road and rivers ---------------- */
  const CTRL = MAP.road;
  const roadCurve = new THREE.CatmullRomCurve3(CTRL.map(([x, y, z]) => V3(x, y, z)), true, 'centripetal');
  const ROAD_LEN = roadCurve.getLength(), NR = 2400;
  const RP = roadCurve.getSpacedPoints(NR).slice(0, NR);
  fairRoute(RP);
  const ctrlAt = i => CTRL[Math.min(CTRL.length - 1, Math.floor(roadCurve.getUtoTmapping(i / NR) * CTRL.length))];
  const SEG = RP.map((_, i) => ctrlAt(i)[3]);
  const RR = raster(RP, 44);
  const rivers = MAP.rivers.map(R => {
    const curve = new THREE.CatmullRomCurve3(R.pts.map(([x, z]) => V3(x, 0, z)), false, 'centripetal');
    const N = Math.max(60, Math.round(curve.getLength() / 1.5)), P = curve.getSpacedPoints(N), step = curve.getLength() / N;
    const Y = new Float32Array(N + 1), HW = new Float32Array(N + 1);
    let m = 1e9;
    for (let i = 0; i <= N; i++) { m = Math.min(m, base(P[i].x, P[i].z) - 1.2); Y[i] = Math.max(m, 0.05); HW[i] = R.half + (R.pool ? Math.max(0, R.pool - i * step) * 0.75 : 0); }
    return { R, N, P, Y, HW, ras: raster(P, 60) };
  });
  const MAIN = rivers[0];
  const POOL = MAIN.P[0].clone().setY(MAIN.Y[0]);
  function natural(x, z) {
    let h = base(x, z);
    for (const rv of rivers) {
      const v = sampleR(rv.ras, x, z);
      if (v.i < 0) continue;
      const L = rv.Y[v.i], hw = rv.HW[v.i];
      const bankK = rv.R.pool && z < rv.P[0].z - 4 ? 8 : 0.7;
      h = Math.min(h, L + 0.6 + Math.max(0, v.dist - hw) * bankK);
      h = lerp(Math.max(L - (rv === MAIN ? 0.55 : 1.4), -0.4), h, sstep(hw - 1.5, hw + 1, v.dist));
    }
    return h;
  }
  // The lap follows the river surface here; there is no road underneath it.
  const wet = i => ['f', 's', 'e'].includes(SEG[(i + NR) % NR]);
  const waterY = i => {
    const p = RP[(i + NR) % NR];
    const v = sampleR(MAIN.ras, p.x, p.z);
    return MAIN.Y[Math.max(0, v.i)] + 0.1;
  };
  const wetBlend = i => {
    const seg = SEG[i], t = (roadCurve.getUtoTmapping(i / NR) * CTRL.length) % 1;
    return seg === 's' ? 1 : seg === 'f' ? sstep(0, 1, t) : seg === 'e' ? 1 - sstep(0, 1, t) : 0;
  };
  const MOUNT = { u: 1, l: 1 };
  const hwL = new Float32Array(NR), hwR = new Float32Array(NR), roadY = new Float32Array(NR), bank = new Float32Array(NR), elev = new Uint8Array(NR);
  {
    const raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) raw[i] = ctrlAt(i)[4];
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += raw[(i + j + NR) % NR]; hwL[i] = hwR[i] = Math.max(8, a / 33); }
    const nat = new Float32Array(NR);
    for (let i = 0; i < NR; i++) {
      const p = RP[i], s = SEG[i]; let h = base(p.x, p.z);
      if (s === 'b') h = Math.max(h, 1.9);
      if (s === 'w') h = Math.max(h, POOL.y + 3.6);
      if (s === 'l') h = Math.max(h, POOL.y + 2.0);
      if (wet(i)) h = lerp(h, waterY(i), wetBlend(i));
      nat[i] = h;
    }
    let src = nat; const tmp = new Float32Array(NR);
    for (const k of [24, 24, 14]) { for (let i = 0; i < NR; i++) { let a = 0; for (let j = -k; j <= k; j++) a += src[(i + j + NR) % NR]; tmp[i] = a / (2 * k + 1); } src = Float32Array.from(tmp); }
    for (let i = 0; i < NR; i++) {
      roadY[i] = src[i];
      if (SEG[i] === 'b') roadY[i] = Math.max(roadY[i], 1.9);
      const p = RP[i];
      for (const rv of rivers) { const v = sampleR(rv.ras, p.x, p.z); if (!wet(i) && !(rv === MAIN && ['l', 'd', 'b'].includes(SEG[i])) && v.i >= 0 && v.dist < rv.HW[v.i] + 10) { roadY[i] = Math.max(roadY[i], rv.Y[v.i] + 3.0); if (v.dist < rv.HW[v.i] + 2.5) elev[i] = 1; } }
    }
    const fixed = Float32Array.from(roadY);
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -12; j <= 12; j++) a += fixed[(i + j + NR) % NR]; roadY[i] = Math.max(fixed[i], a / 25); }
    for (let i = 0; i < NR; i++) if (wet(i)) { roadY[i] = lerp(roadY[i], waterY(i), wetBlend(i)); elev[i] = 0; }
  }
  const roadFrame = i => {
    const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize();
    return { p, t, n: V3(-t.z, 0, t.x) };
  };
  {
    const raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) {
      if (!MOUNT[SEG[i]] && SEG[i] !== 'c') continue;
      const a = roadFrame(i - 14).t, b = roadFrame(i + 14).t, f = roadFrame(i), dd = b.clone().sub(a);
      raw[i] = clamp(-dd.dot(f.n) * 0.07, -0.075, 0.075);
    }
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -20; j <= 20; j++) a += raw[(i + j + NR) % NR]; bank[i] = a / 41; }
  }
  fairHeights(RP, roadY);
  const roadAt = (i, lat, dy = 0) => { const k = (i % NR + NR) % NR, f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const lateralHW = (i, side) => (side > 0 ? hwR[i] : hwL[i]);
  function terrainH(x, z, opts = {}) {
    let h = natural(x, z);
    if (!opts.noRoad) {
      const r = sampleR(RR, x, z);
      if (r.i >= 0 && !elev[r.i] && SEG[r.i] !== 's') {
        const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z;
        const hw = lat >= 0 ? hwR[r.i] : hwL[r.i], cl = clamp(lat, -hwL[r.i], hwR[r.i]);
        const w = 1 - sstep(hw + 0.5, hw + 11, r.dist);
        if (w > 0) h = lerp(h, roadY[r.i] + bank[r.i] * cl - 0.15, w);
      }
    }
    // the cement plaza is dead flat at road level
    const PL = MAP.plaza, px = Math.abs(x - PL.x) - PL.w / 2, pz = Math.abs(z - PL.z) - PL.d / 2;
    if (px < 4 && pz < 4) h = lerp(h, plazaY, 1 - sstep(0, 4, Math.max(px, pz)));
    const near = sampleR(RR,x,z);
    if(near.i >= 0 && near.dist < 10) h = Math.min(h, roadY[near.i] - .2);
    return h;
  }
  let plazaY = 10;
  { const iP = RP.reduce((b, p, i) => (SEG[i] === 'q' && Math.hypot(p.x - MAP.plaza.x, p.z - MAP.plaza.z) < Math.hypot(RP[b].x - MAP.plaza.x, RP[b].z - MAP.plaza.z) ? i : b), RP.findIndex((_, i) => SEG[i] === 'q')); plazaY = roadY[iP] - 0.1; }
  const farH = (x, z) => { let h = base(x, z); if (z < -340) h += (-340 - z) * 0.25 + 30 * sstep(-340, -600, z) * (0.6 + 0.4 * Math.sin(x * 0.006)); return h; };
  const groundH = (x, z) => (Math.abs(x) < 345 && Math.abs(z) < 345 ? terrainH(x, z) : farH(x, z));
  const CZ = MAP.zones.cacao, inCacao = (x, z) => x > CZ.xMin && x < CZ.xMax && z > CZ.zMin && z < CZ.zMax;

  return { SIZE, CELL, GR, HALF, shoreCurve, NSH, SHP, SHR, farShoreZ, VAL, WALL, CTRL, roadCurve, ROAD_LEN, NR, RP, ctrlAt, SEG, RR, rivers, MAIN, POOL, wet, waterY, wetBlend, MOUNT, hwL, hwR, roadY, bank, elev, roadFrame, roadAt, lateralHW, plazaY, farH, groundH, CZ, inCacao, raster, sampleR, shoreD, valleyAt, base, natural, terrainH };
}
