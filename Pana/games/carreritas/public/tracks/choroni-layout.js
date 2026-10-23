import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';
import * as THREE from 'three';

export function createLayout() {
  const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
  const rand = rng(4321);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = arr => pickRandom(arr, rand);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const col = hex => new THREE.Color(hex);
  const d = new THREE.Object3D();
  const uTime = { value: 0 };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  let bay = 0;
  const plain = z => z < 120 ? 2.6 + (120 - z) * 0.12 : z < 148 ? lerp(2.6, 1.9, (z - 120) / 28) : z < 168 ? lerp(1.9, -0.4, (z - 148) / 20) : Math.max(-9, -0.4 - (z - 168) * 0.09);
  const zFoot = x => lerp(10, 110, sstep(-30, 120, x));
  const kM = x => lerp(0.25, 0.22, sstep(-30, 120, x));
  const CRISTO = V3(92, 0, -150);
  function base(x, z) {
    let h = plain(z) + Math.max(0, zFoot(x) - z) * kM(x);
    if (z < -200) h += (-200 - z) * 0.45;
    const m = sstep(-20, 60, zFoot(x) - z);
    h += m * (4 * Math.sin(x * 0.031 + z * 0.02) + 3 * Math.sin(x * 0.07 - z * 0.05) + 2 * Math.cos(x * 0.013 - z * 0.021));
    if (x < -215) h += (-215 - x) * 0.5 * sstep(185, 120, z);
    const cove = sstep(268, 300, x) * sstep(10, 70, z);
    h = lerp(h, Math.min(h, -7), cove);
    h += 15 * Math.exp(-((x - CRISTO.x) ** 2 + (z - CRISTO.z) ** 2) / 520);
    // the Chuao headland across the water
    const cr = Math.hypot((x - 600) / 250, (z - 110) / 310);
    if (cr < 1) h = Math.max(h, 115 * Math.pow(1 - cr, 1.35) - 3.5 + 3 * Math.sin(x * 0.05) * (1 - cr));
    return h;
  }

  // the route: [x, y, z, segment type]  b playa, c subida, n un solo canal, m mirador, d bajada, p pueblo, h puerto, l La Batea, v vuelta
  const CTRL = [
    [20, 2.2, 140, 'b'], [95, 2.2, 143, 'b'], [175, 2.6, 136, 'b'],
    [228, 5, 112, 'c'], [252, 10, 72, 'c'], [238, 17, 48, 'c'], [190, 24, 40, 'c'], [160, 29, 22, 'c'],
    [178, 35, -4, 'n'], [228, 42, -10, 'n'], [255, 48, -32, 'c'],
    [238, 54, -60, 'c'], [185, 62, -62, 'c'], [158, 68, -84, 'c'],
    [178, 74, -110, 'c'], [228, 82, -116, 'c'], [252, 88, -140, 'c'],
    [232, 93, -168, 'm'], [170, 97, -180, 'm'], [100, 99, -184, 'm'], [40, 98, -182, 'd'],
    [-30, 94, -192, 'd'], [-100, 86, -184, 'd'], [-160, 76, -168, 'd'], [-196, 68, -142, 'd'],
    [-180, 60, -116, 'd'], [-148, 53, -100, 'd'], [-130, 47, -80, 'd'], [-120, 38, -52, 'd'],
    [-118, 28, -20, 'd'], [-122, 18, 14, 'p'],
    [-124, 11, 46, 'p'], [-116, 8, 74, 'p'], [-100, 6, 96, 'p'], [-82, 4, 112, 'h'],
    [-62, 3, 108, 'h'], [-60, 3, 76, 'h'], [-62, 3.4, 40, 'h'], [-66, 4.6, 6, 'l'],
    [-70, 6.4, -22, 'l'], [-58, 7.2, -44, 'l'], [-36, 7.2, -50, 'l'], [-18, 7, -36, 'v'],
    [-16, 5.6, -6, 'v'], [-16, 4, 34, 'v'], [-14, 3, 72, 'v'], [-12, 2.5, 104, 'v'], [-4, 2.3, 128, 'v'],
  ];
  const roadCurve = new THREE.CatmullRomCurve3(CTRL.map(([x, y, z]) => V3(x, y, z)), true, 'centripetal');
  const riverCurve = new THREE.CatmullRomCurve3([[-52, -112], [-46, -92], [-41, -74], [-40, -62], [-41, -48], [-40, -24], [-42, 10], [-40, 50], [-39, 90], [-40, 130], [-40, 166]].map(([x, z]) => V3(x, 0, z)), false, 'centripetal');
  const streamCurve = new THREE.CatmullRomCurve3([[-262, -58], [-210, -68], [-170, -79], [-133, -84], [-112, -88], [-86, -92], [-64, -94], [-47, -93]].map(([x, z]) => V3(x, 0, z)), false, 'centripetal');
  const ROAD_LEN = roadCurve.getLength(), NR = 2200;
  const RP = roadCurve.getSpacedPoints(NR).slice(0, NR);
  fairRoute(RP, 20);
  const SEG = RP.map((_, i) => CTRL[Math.min(CTRL.length - 1, Math.floor(roadCurve.getUtoTmapping(i / NR) * CTRL.length))][3]);
  const NV = 700, VP = riverCurve.getSpacedPoints(NV);
  const NS = 360, SP = streamCurve.getSpacedPoints(NS);
  const MOUNT = { c: 1, n: 1, m: 1, d: 1 };

  // distance rasters (2 m cells) with nearest-sample index
  const SIZE = 700, CELL = 2, GR = SIZE / CELL, HALF = SIZE / 2;
  function raster(pts, far) {
    const dist = new Float32Array(GR * GR).fill(far), idx = new Int32Array(GR * GR).fill(-1), rc = Math.ceil(far / CELL);
    pts.forEach((p, i) => {
      const cx = Math.floor((p.x + HALF) / CELL), cz = Math.floor((p.z + HALF) / CELL);
      for (let z = Math.max(0, cz - rc); z <= Math.min(GR - 1, cz + rc); z++) for (let x = Math.max(0, cx - rc); x <= Math.min(GR - 1, cx + rc); x++) {
        const wx = -HALF + (x + 0.5) * CELL, wz = -HALF + (z + 0.5) * CELL, dd = Math.hypot(wx - p.x, wz - p.z), k = z * GR + x;
        if (dd < dist[k]) { dist[k] = dd; idx[k] = i; }
      }
    });
    return { dist, idx, far };
  }
  const RR = raster(RP, 44), VR = raster(VP, 120), SR = raster(SP, 70);
  function sampleR(R, x, z) {
    const fx = (x + HALF) / CELL - 0.5, fz = (z + HALF) / CELL - 0.5;
    if (fx < 0 || fz < 0 || fx > GR - 1 || fz > GR - 1) return { dist: R.far, i: -1 };
    const x0 = clamp(Math.floor(fx), 0, GR - 2), z0 = clamp(Math.floor(fz), 0, GR - 2), tx = clamp(fx - x0, 0, 1), tz = clamp(fz - z0, 0, 1);
    const k = z0 * GR + x0;
    const dist = lerp(lerp(R.dist[k], R.dist[k + 1], tx), lerp(R.dist[k + GR], R.dist[k + GR + 1], tx), tz);
    const ni = R.idx[clamp(Math.round(fz), 0, GR - 1) * GR + clamp(Math.round(fx), 0, GR - 1)];
    return { dist, i: ni };
  }

  // river: tidal at the harbour, the La Batea pool, rapids upstream
  const RYT = [[-112, 16], [-92, 11.5], [-74, 7.6], [-66, 7.0], [-50, 7.0], [-47, 6.6], [-24, 4.4], [10, 1.8], [50, 0.45], [80, 0.3], [200, 0.22]];
  const ryAt = z => { for (let k = 1; k < RYT.length; k++) if (z <= RYT[k][0]) return lerp(RYT[k - 1][1], RYT[k][1], (z - RYT[k - 1][0]) / (RYT[k][0] - RYT[k - 1][0])); return 0.22; };
  const riverY = VP.map(p => ryAt(p.z));
  const riverHW = VP.map(p => 9 + 8.5 * Math.exp(-(((p.z + 60) / 9) ** 2)) + (p.z > 70 ? Math.min(6, (p.z - 70) * 0.06) : 0));
  const BATEA = V3(-40, ryAt(-60), -60);
  // the stream: follows its bed down to the ford, a little waterfall right below it, then rapids to the river
  const FORD_S = new THREE.Vector2(-133, -84), FORD_R = new THREE.Vector2(-46, -47);
  const streamY = new Float32Array(NS + 1), streamHW = 3.6;
  let iFordS = 0; SP.forEach((p, i) => { if (Math.hypot(p.x - FORD_S.x, p.z - FORD_S.y) < Math.hypot(SP[iFordS].x - FORD_S.x, SP[iFordS].z - FORD_S.y)) iFordS = i; });
  const sStep = streamCurve.getLength() / NS, iFall0 = iFordS + Math.round(7 / sStep), iFall1 = iFordS + Math.round(11 / sStep);
  {
    let m = 1e9;
    for (let i = 0; i <= iFordS; i++) { m = Math.min(m, base(SP[i].x, SP[i].z) - 1.4); streamY[i] = m; }
    const fy = streamY[iFordS], dropTo = fy - 5.5, joinY = riverY[Math.round(NV * 0.07)] + 0.3;
    for (let i = iFordS + 1; i <= NS; i++) streamY[i] = i <= iFall0 ? fy : i <= iFall1 ? lerp(fy, dropTo, (i - iFall0) / (iFall1 - iFall0)) : lerp(dropTo, joinY, (i - iFall1) / (NS - iFall1));
  }

  function natural(x, z) {
    let h = base(x, z);
    const s = sampleR(SR, x, z);
    if (s.i >= 0) {
      const L = streamY[s.i];
      h = Math.min(h, L + 0.6 + Math.max(0, s.dist - streamHW) * 0.9);
      h = lerp(L - 1.3, h, sstep(streamHW - 1.5, streamHW + 1, s.dist));
    }
    const v = sampleR(VR, x, z);
    if (v.i >= 0) {
      const L = riverY[v.i], hw = riverHW[v.i], sl = lerp(1.1, 0.42, sstep(0, 0.3, v.i / NV));
      h = Math.min(h, L + 0.9 + Math.max(0, v.dist - hw) * sl);
      h = lerp(Math.max(L - (v.i < NV * 0.5 ? 1.6 : 2.6), VP[v.i].z < 150 ? 0.12 : -9), h, sstep(hw - 3.5, hw + 1, v.dist));
    }
    return h;
  }

  // road widths: 13 m, a little narrower in town, one single-lane stretch with a passing bay
  const hwL = new Float32Array(NR), hwR = new Float32Array(NR), roadY = new Float32Array(NR), bank = new Float32Array(NR), fordW = new Float32Array(NR);
  {
    const rawL = new Float32Array(NR), rawR = new Float32Array(NR);
    const nIdx = []; for (let i = 0; i < NR; i++) if (SEG[i] === 'n') nIdx.push(i);
    const nMid = nIdx[Math.floor(nIdx.length * 0.5)];
    for (let i = 0; i < NR; i++) {
      const s = SEG[i]; let w = s === 'p' ? 5.5 : s === 'n' ? 5.5 : 6.5;
      rawL[i] = w; rawR[i] = w + (s === 'n' && Math.abs(i - nMid) < 16 ? 4.2 : 0);
    }
    const sm = (src, dst, k) => { for (let i = 0; i < NR; i++) { let a = 0; for (let j = -k; j <= k; j++) a += src[(i + j + NR) % NR]; dst[i] = a / (2 * k + 1); } };
    sm(rawL, hwL, 14); sm(rawR, hwR, 14);
    for(let i=0;i<NR;i++){hwL[i]=Math.max(8,hwL[i]);hwR[i]=Math.max(8,hwR[i]);}
    bay = nMid;
  }
  const roadFrame = i => {
    const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize();
    return { p, t, n: V3(-t.z, 0, t.x) };
  };
  for (let i = 0; i < NR; i++) roadY[i] = RP[i].y;
  // fords: the stream crossing on the descent and the river crossing at La Batea
  for (let i = 0; i < NR; i++) {
    const p = RP[i];
    if (Math.hypot(p.x - FORD_S.x, p.z - FORD_S.y) < 34) {
      const s = sampleR(SR, p.x, p.z); if (s.i >= 0) { const w = 1 - sstep(streamHW + 2, streamHW + 16, s.dist); fordW[i] = w; roadY[i] = lerp(roadY[i], streamY[iFordS] - 0.18, w); }
    } else if (Math.hypot(p.x - FORD_R.x, p.z - FORD_R.y) < 44) {
      const v = sampleR(VR, p.x, p.z); if (v.i >= 0) { const w = 1 - sstep(riverHW[v.i] + 2, riverHW[v.i] + 15, v.dist); fordW[i] = w; roadY[i] = lerp(roadY[i], riverY[v.i] - 0.32, w); }
    } else {
      const v = sampleR(VR, p.x, p.z); if (v.i >= 0 && v.dist < riverHW[v.i] + 16) roadY[i] = Math.max(roadY[i], riverY[v.i] + 1.6);
    }
  }
  // banked hairpins on the mountain: the inside of the turn sits lower
  {
    const raw = new Float32Array(NR);
    for (let i = 0; i < NR; i++) {
      if (!MOUNT[SEG[i]]) continue;
      const a = roadFrame(i - 14).t, b = roadFrame(i + 14).t, f = roadFrame(i), dd = b.clone().sub(a);
      raw[i] = clamp(-dd.dot(f.n) * 0.07, -0.075, 0.075);
    }
    for (let i = 0; i < NR; i++) { let a = 0; for (let j = -20; j <= 20; j++) a += raw[(i + j + NR) % NR]; bank[i] = a / 41; }
  }
  fairHeights(RP, roadY);
  const roadAt = (i, lat, dy = 0) => { const k = (i % NR + NR) % NR, f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };

  function terrainH(x, z, opts = {}) {
    let h = natural(x, z);
    if (!opts.noRoad) {
      const r = sampleR(RR, x, z);
      if (r.i >= 0) {
        const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z;
        const hw = lat >= 0 ? hwR[r.i] : hwL[r.i], cl = clamp(lat, -hwL[r.i], hwR[r.i]);
        const w = 1 - sstep(hw + 0.5, hw + 11, r.dist);
        if (w > 0) h = lerp(h, roadY[r.i] + bank[r.i] * cl - 0.15, w);
      }
    }
    return h;
  }

  return { bay, plain, zFoot, kM, CRISTO, CTRL, roadCurve, riverCurve, streamCurve, ROAD_LEN, NR, RP, SEG, NV, VP, NS, SP, MOUNT, SIZE, CELL, GR, HALF, RR, VR, SR, RYT, ryAt, riverY, riverHW, BATEA, FORD_S, FORD_R, streamY, streamHW, iFordS, sStep, iFall0, iFall1, hwL, hwR, roadY, bank, fordW, roadFrame, roadAt, base, raster, sampleR, natural, terrainH };
}
