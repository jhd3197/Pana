import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
import * as THREE from 'three';
export const MAP = {
  seed: 7311,
  size: 700,
  // Road control points: [x, y hint, z, segment, half-width].
  // b bajada, t torres, p playa, c cocotal, s banco de arena, i isla, v promontorio, o carretera de Ocumare
  // Heights come from the terrain (smoothed along the lap); the y hint is a floor for flat sections.
  road: [
    [150, 2.2, 146, 'p', 6.5], [100, 2.2, 128, 'p', 6.5], [40, 2.2, 117, 'p', 6.5], [-20, 2.2, 114, 'p', 6.5], [-62, 2.2, 117, 'p', 6.5],
    [-88, 2.4, 106, 'c', 5.8], [-94, 2.6, 82, 'c', 5.8], [-112, 3, 66, 'c', 5.8], [-136, 3, 80, 'c', 5.8], [-152, 3, 64, 'c', 5.8],
    [-176, 2.6, 78, 'c', 5.8], [-172, 2.2, 108, 'c', 5.8], [-170, 1.2, 134, 's', 6.2],
    [-163, 0.6, 162, 's', 6.2], [-150, 0.6, 196, 's', 6.2], [-138, 1.2, 222, 'i', 6.0],
    [-114, 1.6, 232, 'i', 6.0], [-104, 1.6, 254, 'i', 6.0], [-118, 1.6, 274, 'i', 6.0], [-142, 1.6, 276, 'i', 6.0], [-158, 1.4, 256, 'i', 6.0],
    [-164, 0.6, 230, 's', 6.2], [-176, 0.6, 196, 's', 6.2], [-188, 0.8, 166, 's', 6.2],
    [-208, 2, 152, 'v', 6.5], [-228, 6, 166, 'v', 6.5], [-250, 8, 184, 'v', 6.5], [-272, 8, 168, 'v', 6.5], [-268, 6, 136, 'v', 6.5],
    [-252, 6, 104, 'o', 6.5], [-246, 6, 60, 'o', 6.5], [-256, 6, 14, 'o', 6.5], [-232, 6, -28, 'o', 6.5], [-188, 6, -56, 'o', 6.5],
    [-120, 6, -72, 'b', 6.5], [-40, 6, -74, 'b', 6.5], [40, 6, -68, 'b', 6.5], [104, 6, -58, 'b', 6.5], [130, 6, -36, 'b', 6.5],
    [96, 6, -16, 'b', 6.5], [24, 6, -10, 'b', 6.5], [-38, 6, -4, 'b', 6.5], [-64, 6, 16, 'b', 6.5],
    [-34, 6, 36, 'b', 6.5], [40, 6, 40, 'b', 6.5], [110, 6, 32, 'b', 6.5], [176, 6, 26, 't', 6.5],
    [236, 6, 48, 't', 6.5], [252, 3, 98, 't', 6.5], [238, 2.4, 138, 't', 6.5], [204, 2.2, 158, 't', 6.5],
  ],
  startAt: [60, 120],
  mural: [20, 116],
  // Shoreline from west to east; land lies to the north of it.
  shore: [
    [-350, 104], [-332, 120], [-314, 140], [-296, 152], [-280, 150], [-268, 140], [-258, 150], [-250, 176], [-248, 214], [-240, 250], [-226, 266], [-210, 252],
    [-200, 214], [-190, 180], [-170, 160], [-140, 150], [-100, 143], [-40, 138], [20, 138], [80, 144], [130, 156], [168, 172], [196, 196],
    [212, 230], [226, 264], [244, 284], [262, 268], [272, 226], [292, 198], [320, 182], [350, 178],
  ],
  beach: { width: 26, rise: 0.08 },
  mountains: { start: 55, slope: 0.62, slope2: 0.34, knee: 95, noise: 5 },
  features: [
    { type: 'hill', x: -238, z: 210, r: 40, h: 34 },          // the west headland, the promontorio road climbs its shoulder
    { type: 'hill', x: 240, z: 246, r: 40, h: 40 },           // the east headland behind the towers
    { type: 'hill', x: -306, z: 120, r: 42, h: 26 },          // the ridge between Catica and the headland
    { type: 'flat', x: 196, z: 110, r: 68, h: 2.6 },          // the level ground at the foot of the towers
    { type: 'island', x: -128, z: 252, r: 32, peak: 15 },     // Isla de Cata
    { type: 'bar', a: [-178, 150], b: [-146, 222], half: 21, crest: 0.42 },  // the low-tide sandbar
  ],
  rivers: [
    { name: 'quebrada', pts: [[-110, -46], [-108, 0], [-114, 40], [-110, 76], [-106, 112], [-104, 146]], half: 4.2 },
  ],
  towers: [
    { x: 140, z: 94, rot: -0.45, w: 46, d: 17, h: 74 },
    { x: 192, z: 119, rot: -0.45, w: 46, d: 17, h: 74 },
  ],
  kiosks: { along: 'p', every: 24, side: -1, offset: 7.5 },
  caneyes: [[-30, 128], [8, 126], [70, 132], [118, 142], [-58, 132], [-136, 126], [-300, 156], [-286, 160]],
  lookout: { x: -126, z: 252 },
  signs: [
    { at: [-80, 112], side: 1, lines: ['Isla de Cata'], arrow: 'left' },
    { at: [-205, 152], side: -1, lines: ['Catica'], arrow: 'left' },
    { at: [-240, 60], side: 1, lines: ['Ocumare'], arrow: 'up' },
    { at: [150, 34], side: -1, lines: ['Playa', 'de Cata'], arrow: 'right' },
  ],
  peneros: { beach: [[-80, 145, 9], [30, 141, 7], [110, 152, 5]], catica: [[-300, 160, 4]], island: [[-150, 230, 3]], bay: 6 },
  umbrellas: { along: 'p', every: 10, rows: 2 },
  zones: {
    grove: { dMin: 16, dMax: 74, xMin: -205, xMax: 168, density: 900 },
    forest: { dMin: 60, density: 3000 },
    islandPalms: 26,
    caticaPalms: 30,
  },
  views: {
    aerial: { pos: [300, 440, 620], target: [-90, 0, 150] },
    torres: { pos: [96, 18, 204], target: [172, 44, 108] },
    cocotal: { pos: [-82, 16, 118], target: [-140, 3, 72] },
    isla: { pos: [-60, 26, 300], target: [-138, 4, 236] },
    atardecer: { pos: [-262, 30, 160], target: [-120, 6, 200] },
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

  /* ---------------- the land, from the shoreline and the features ---------------- */
  const shoreCurve = new THREE.CatmullRomCurve3(MAP.shore.map(([x, z]) => V3(x, 0, z)), false, 'centripetal');
  const NSH = 900, SHP = shoreCurve.getSpacedPoints(NSH);
  const SHR = raster(SHP, 170);
  const farShoreZ = x => (x < 0 ? MAP.shore[0][1] : MAP.shore[MAP.shore.length - 1][1]) + 10 * Math.sin(x * 0.012);
  // signed distance to the shore: positive on land
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
  const B = MAP.beach, MT = MAP.mountains;
  function landFromD(dd, x, z) {
    if (dd < 0) return -0.3 - Math.min(14, -dd * 0.17);
    let h = 0.15 + Math.min(dd, B.width) * B.rise + Math.max(0, Math.min(dd, MT.start) - B.width) * 0.03;
    const m = Math.max(0, dd - MT.start);
    h += Math.min(m, MT.knee) * MT.slope + Math.max(0, m - MT.knee) * MT.slope2;
    h += sstep(0, 40, m) * (MT.noise * Math.sin(x * 0.031 + z * 0.02) + 3 * Math.sin(x * 0.07 - z * 0.05) + 2 * Math.cos(x * 0.013 - z * 0.021));
    return h;
  }
  function base(x, z) {
    const dd = shoreD(x, z);
    let h = landFromD(dd, x, z);
    for (const f of MAP.features) {
      if (f.type === 'hill') { const r = Math.hypot(x - f.x, z - f.z) / f.r; if (r < 1.6) h = Math.max(h, h + f.h * Math.exp(-r * r * 1.6) * sstep(-30, 4, dd)); }
      else if (f.type === 'flat') { const r = Math.hypot(x - f.x, z - f.z); h = lerp(h, Math.min(h, f.h + Math.max(0, r - f.r * 0.6) * 0.15), sstep(f.r, f.r * 0.55, r) * (dd > 4 ? 1 : 0)); }
      else if (f.type === 'island') {
        const r = Math.hypot(x - f.x, z - f.z);
        if (r < f.r + 14) {
          const n = 1 + 0.08 * Math.sin(Math.atan2(z - f.z, x - f.x) * 3 + 1);
          const hi = lerp(-3.5, 1.1, sstep(f.r + 8, f.r - 3, r * n)) + f.peak * Math.pow(Math.max(0, 1 - r / (f.r * 0.72)), 1.5) * n;
          h = Math.max(h, hi);
        }
      } else if (f.type === 'bar') {
        const ax = f.a[0], az = f.a[1], bx = f.b[0] - ax, bz = f.b[1] - az, L2 = bx * bx + bz * bz;
        const t = clamp(((x - ax) * bx + (z - az) * bz) / L2, -0.1, 1.1), px = ax + bx * t, pz = az + bz * t, lat = Math.hypot(x - px, z - pz);
        const along = sstep(-0.1, 0.05, t) * sstep(1.1, 0.95, t);
        h = Math.max(h, lerp(-3, f.crest - 0.05 * Math.sin(t * 9), sstep(f.half + 9, f.half - 2, lat)) * along + (along < 1 ? -3 * (1 - along) : 0));
      }
    }
    return h;
  }

  /* ---------------- road, river ---------------- */
  const CTRL = MAP.road;
  const roadCurve = new THREE.CatmullRomCurve3(CTRL.map(([x, y, z]) => V3(x, y, z)), true, 'centripetal');
  const ROAD_LEN = roadCurve.getLength(), NR = 2400;
  const RP = roadCurve.getSpacedPoints(NR).slice(0, NR);
  fairRoute(RP, 20);
  const ctrlAt = i => CTRL[Math.min(CTRL.length - 1, Math.floor(roadCurve.getUtoTmapping(i / NR) * CTRL.length))];
  const SEG = RP.map((_, i) => ctrlAt(i)[3]);
  const RV = MAP.rivers[0], riverCurve = new THREE.CatmullRomCurve3(RV.pts.map(([x, z]) => V3(x, 0, z)), false, 'centripetal');
  const NV = 360, VP = riverCurve.getSpacedPoints(NV);
  const RR = raster(RP, 44), VR = raster(VP, 60);
  const MOUNT = { b: 1, o: 1, v: 1, t: 1 };
  const riverY = new Float32Array(NV + 1);
  { let m = 1e9; for (let i = 0; i <= NV; i++) { m = Math.min(m, base(VP[i].x, VP[i].z) - 1.2); riverY[i] = Math.max(m, VP[i].z > 120 ? 0.05 : -9); } }
  function natural(x, z) {
    let h = base(x, z);
    const v = sampleR(VR, x, z);
    if (v.i >= 0) {
      const L = riverY[v.i], hw = RV.half;
      h = Math.min(h, L + 0.6 + Math.max(0, v.dist - hw) * 0.7);
      h = lerp(Math.max(L - 1.2, 0.0), h, sstep(hw - 1.5, hw + 1, v.dist));
    }
    return h;
  }

  // road widths and heights: heights follow the land, smoothed along the lap; the beach, bar and island have floors
  const hwL = new Float32Array(NR), hwR = new Float32Array(NR), roadY = new Float32Array(NR), bank = new Float32Array(NR), elev = new Uint8Array(NR), splash = new Float32Array(NR);
  {
    const raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) raw[i] = ctrlAt(i)[4];
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -16; j <= 16; j++) a += raw[(i + j + NR) % NR]; hwL[i] = hwR[i] = Math.max(8, a / 33); }
    const nat = new Float32Array(NR);
    for (let i = 0; i < NR; i++) {
      const p = RP[i], s = SEG[i]; let h = base(p.x, p.z);
      if (s === 's') h = Math.max(h, 0.62); if (s === 'p' || s === 't') h = Math.max(h, 2.2); if (s === 'i') h = Math.max(h, 1.3);
      nat[i] = h;
    }
    const tmp = new Float32Array(NR);
    let src = nat;
    for (const k of [26, 26, 14]) { for (let i = 0; i < NR; i++) { let a = 0; for (let j = -k; j <= k; j++) a += src[(i + j + NR) % NR]; tmp[i] = a / (2 * k + 1); } src = Float32Array.from(tmp); }
    for (let i = 0; i < NR; i++) {
      const s = SEG[i];
      roadY[i] = src[i];
      if (s === 's') roadY[i] = Math.max(0.6, Math.min(roadY[i], 1.0));
      if (s === 'p') roadY[i] = Math.max(roadY[i], 2.25);
      const p = RP[i], v = sampleR(VR, p.x, p.z);
      if (v.i >= 0 && v.dist < RV.half + 12) { roadY[i] = Math.max(roadY[i], riverY[v.i] + 2.4); if (v.dist < RV.half + 3) elev[i] = 1; }
      if (s === 's') splash[i] = 1;
    }
    // ramp smoothly onto the plank bridge
    const fixed = Float32Array.from(roadY);
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -10; j <= 10; j++) a += fixed[(i + j + NR) % NR]; roadY[i] = Math.max(fixed[i], a / 21); }
  }
  const roadFrame = i => {
    const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize();
    return { p, t, n: V3(-t.z, 0, t.x) };
  };
  {
    const raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) {
      if (!MOUNT[SEG[i]] && SEG[i] !== 'c' && SEG[i] !== 'i') continue;
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
      if (r.i >= 0 && !elev[r.i]) {
        const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z;
        const hw = lat >= 0 ? hwR[r.i] : hwL[r.i], cl = clamp(lat, -hwL[r.i], hwR[r.i]);
        const w = (1 - sstep(hw + 0.5, hw + (splash[r.i] ? 4 : 11), r.dist));
        if (w > 0) h = lerp(h, roadY[r.i] + bank[r.i] * cl - 0.15, w);
      }
    }
    return h;
  }
  const farH = (x, z) => { let h = base(x, z); if (z < -340) h += (-340 - z) * 0.25 + 30 * sstep(-340, -600, z) * (0.6 + 0.4 * Math.sin(x * 0.006)); return h; };
  const groundH = (x, z) => (Math.abs(x) < 345 && Math.abs(z) < 345 ? terrainH(x, z) : farH(x, z));

  return { SIZE, CELL, GR, HALF, shoreCurve, NSH, SHP, SHR, farShoreZ, B, MT, CTRL, roadCurve, ROAD_LEN, NR, RP, ctrlAt, SEG, RV, riverCurve, NV, VP, RR, VR, MOUNT, riverY, hwL, hwR, roadY, bank, elev, splash, roadFrame, roadAt, lateralHW, farH, groundH, raster, sampleR, shoreD, landFromD, base, natural, terrainH };
}
