import { clamp, lerp } from '/engine/random.js';
import { fairHeights } from '/engine/worlds/coastal/coastal-road.js';
import * as THREE from 'three';
// Pana Sarisariñama. Metres, x east, z south, y up. Angles in radians.
export const MAP = {
  seed: 20261021,
  // The detailed terrain square (2 m cells) and the far backdrop around it.
  world: { center: [-75, 45], size: 620, cell: 2, far: { size: 5600, segs: 210 } },
  sun: { dir: [-0.25, 0.92, 0.3] },
  // Fog zones: on top in the mist, at the bottom of a sima, inside the caves.
  fog: {
    pit: { color: '#a4c39a', near: 60, far: 700 },
    cave: { color: '#0e2024', near: 22, far: 260 },
  },
  // The flat top of the tepuy: slightly tilted toward the small sima, sheer edges down to the lowland.
  plateau: {
    top: 90, noise: 1.2,
    tilt: { from: [0, 0], near: 130, far: 300, drop: 6 },
    edge: { center: [-60, 40], rx: 820, rz: 700, wobble: 0.07, cliff: 0.045, lowland: -430 },
  },
  // Other tepuyes on the horizon, with long falls down their walls.
  landscape: {
    mesas: [
      { at: [1900, -1500], rx: 700, rz: 420, top: 60, rot: 0.4, fall: true },
      { at: [-2300, -900], rx: 520, rz: 380, top: 20, rot: -0.3, fall: false },
      { at: [600, -2700], rx: 900, rz: 360, top: 110, rot: 0.1, fall: true },
      { at: [-1300, 2400], rx: 600, rz: 500, top: -40, rot: 0.8, fall: false },
      { at: [2600, 900], rx: 420, rz: 300, top: -10, rot: 0, fall: true },
    ],
  },
  simas: {
    // The big one. The road is cut into its wall as one descending spiral:
    // phi runs along the spiral; angle = start + dir * phi; radius and height follow phi.
    humboldt: {
      center: [0, 0], radius: 100, floor: 30,
      spiral: { start: 1.3, dir: 1, end: 8.2, r0: 91, r1: 60, ease: 0.5, rimRadius: 108, tuck: 0.6, shelf: 1.0, talus: 6 },
    },
    // The second sima: a round pit plus a collapse ravine (the ramp) that the climb zigzags up.
    // Ravine-local coords: s along ramp.dir from the centre, l across it (positive to the right of dir).
    martel: {
      center: [-260, 120], radius: 55, floor: 25,
      // Switchback terraces: one leg per entry in `legs` (its s), each running legHalf either side,
      // joined by hairpins of radius (legs[1]-legs[0])/2 that rise hairRise. The legs share the climb evenly.
      ramp: { dir: [0.2, -0.98], halfWidth: 82, flare: 6, legs: [42, 82, 122, 162, 202], legHalf: 44, hairRise: 2.5, end: 22, terrace: 10 },
      pool: { local: [-36, 12], radius: 10, depth: 3 },
    },
  },
  road: {
    // Sixteen metres: eight racers fit down the spiral and through the galleries.
    width: 16,
    // Terrain blend beside the road, per segment. 0 = underground, no carving.
    shoulder: { b: 8, s: 2.2, f: 4, t: 0, g: 0, u: 7 },
    tint: { b: '#56595d', s: '#5f5d58', f: '#55584b', t: '#b6aa93', g: '#cdbd98', u: '#5d5b57' },
    start: [-13.9, -107.1],
    // Segment types: b el borde, s la espiral, f el fondo, t el túnel del lago, g los gours, u la subida.
    // Entries: { p:[x,z], y?, seg } world point (y omitted = on the ground)
    //          { spiral:'humboldt', from, to, step, seg } points along the sima spiral
    //          { local:'martel', at:[s,l], seg } a point in the ravine frame
    //          { switchbacks:'martel', seg } the hairpins and legs up the ravine, built from ramp.legs
    points: [
      { spiral: 'humboldt', from: -3.3, to: 0, step: 0.3, seg: 'b' },
      { spiral: 'humboldt', from: 0, to: 8.2, step: 0.32, seg: 's' },
      { p: [-54, -26], seg: 'f' }, { p: [-36, -44], seg: 'f' }, { p: [-10, -46], seg: 'f' }, { p: [8, -30], seg: 'f' },
      { p: [6, -6], seg: 'f' }, { p: [-6, 20], seg: 'f' }, { p: [-3, 36], seg: 'f' }, { p: [8, 46], seg: 'f' }, { p: [22, 48], seg: 'f' }, { p: [36, 40], seg: 'f' },
      { p: [46, 18], seg: 'f' }, { p: [40, -5], seg: 'f' }, { p: [42.9, -22.6], seg: 'f' },
      { p: [57.1, -30.0], y: 30.6, seg: 't' }, { p: [76.6, -40.2], y: 30.6, seg: 't' }, { p: [110, -42], y: 30.6, seg: 't' },
      { p: [140, -20], y: 30.6, seg: 't' }, { p: [155, 18], y: 30.6, seg: 't' }, { p: [152, 58], y: 30.6, seg: 't' },
      { p: [135, 100], y: 30.6, seg: 't' }, { p: [100, 135], y: 30.6, seg: 't' },
      { p: [55, 160], y: 30.6, seg: 'g' }, { p: [0, 180], y: 29.6, seg: 'g' }, { p: [-55, 195], y: 28.6, seg: 'g' },
      { p: [-110, 198], y: 27.7, seg: 'g' }, { p: [-160, 188], y: 26.8, seg: 'g' }, { p: [-205.9, 165.1], y: 25.9, seg: 'g' },
      { p: [-219.7, 153.6], y: 25.6, seg: 'u' },
      { local: 'martel', at: [-10, 26], seg: 'u' }, { local: 'martel', at: [-1, 4], seg: 'u' },
      { switchbacks: 'martel', seg: 'u' },
      { p: [-95, -62], seg: 'u' },
    ],
  },
  // The underground half: from/to/halls are derived in u along the lap.
  cave: {
    width: 15, height: 18,
    halls: [
      { at: [150, 50], wide: 30, tall: 16 },
      { at: [-60, 195], wide: 14, tall: 10 },
    ],
    lake: { from: [100, -42], to: [82, 147], level: 29.9, bed: 27 },
    gours: { steps: 9, wallStair: { at: [-60, 195], side: 1, pools: 10 } },
    bats: { roost: [150, 50], count: 280, every: 90 },
    lights: [
      { at: [138, -24], lat: -11, color: '#3ab8ff', power: 1.1 },
      { at: [152, 58], lat: 16, color: '#2aa8ff', power: 1.5 },
      { at: [122, 116], lat: -10, color: '#45d0ff', power: 1.0 },
      { at: [-60, 195], lat: 12, color: '#ffc27a', power: 1.7 },
    ],
    curtain: { width: 0.92 },
  },
  // Waterfalls: on the big sima at spiral angles (phi within the first turn), on the small one by a ravine-local direction.
  waterfalls: { humboldt: [0.75, 2.6, 5.75], martel: [{ dir: [-0.75, -0.66] }] },
  vegetation: {
    top: { trees: 2600, rocks: 340, bromeliads: 460, pitchers: 280, ferns: 700, grass: 9000 },
    floor: { emergents: 22, trees: 320, treeFerns: 180, ferns: 640, bushes: 260, grass: 2600 },
    vines: { humboldt: 320, lips: 160, martel: 130 },
    beam: { at: [6, -6], clear: 14 },
  },
  life: { swifts: 22, macaws: 4 },
  // The lap's start line sits this far along the lap (coastalTrack's lineU).
  lineU: 0.015,
};

export function createLayout() {
  const PI = Math.PI, TAU = PI * 2;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const W0 = MAP.world, CX = W0.center[0], CZ = W0.center[1], SIZE = W0.size, HALF = SIZE / 2;

  /* ---------------- the land: plateau, the two simas, the backdrop ---------------- */
  const P = MAP.plateau, TOP = P.top, HUM = MAP.simas.humboldt, MAR = MAP.simas.martel, SPI = HUM.spiral;
  const HW0 = MAP.road.width / 2;
  const C1 = { x: HUM.center[0], z: HUM.center[1] }, C2 = { x: MAR.center[0], z: MAR.center[1] };
  const RD = (() => { const [x, z] = MAR.ramp.dir, l = Math.hypot(x, z); return { x: x / l, z: z / l }; })(), RN = { x: -RD.z, z: RD.x };
  const toLocal2 = (x, z) => { const dx = x - C2.x, dz = z - C2.z; return { s: dx * RD.x + dz * RD.z, l: dx * RN.x + dz * RN.z, r: Math.hypot(dx, dz) }; };
  const local2 = (s, l) => [C2.x + RD.x * s + RN.x * l, C2.z + RD.z * s + RN.z * l];

  const noiseTop = (x, z) => Math.sin(x * 0.043 + Math.sin(z * 0.031) * 2) * Math.cos(z * 0.039 - x * 0.012) + 0.5 * Math.sin(x * 0.11 - z * 0.09);
  const plateauH = (x, z) => {
    const dist = Math.hypot(x - P.tilt.from[0], z - P.tilt.from[1]);
    return TOP - P.tilt.drop * sstep(P.tilt.near, P.tilt.far, dist) + P.noise * noiseTop(x, z) * sstep(HUM.radius + 4, HUM.radius + 22, Math.hypot(x - C1.x, z - C1.z));
  };
  // the spiral: radius and road height along phi
  const spR = phi => phi < 0 ? lerp(SPI.r0, SPI.rimRadius, sstep(0, -SPI.tuck, phi)) : lerp(SPI.r0, SPI.r1, phi / SPI.end);
  const spY = phi => phi <= 0 ? TOP : lerp(TOP, HUM.floor + 0.6, lerp(phi / SPI.end, sstep(0, 1, phi / SPI.end), SPI.ease));
  const spAng = phi => SPI.start + SPI.dir * phi;
  const spXZ = phi => { const a = spAng(phi), r = spR(phi); return [C1.x + Math.cos(a) * r, C1.z + Math.sin(a) * r]; };
  const floor1 = (x, z) => HUM.floor - 0.4 + 0.8 * Math.sin(x * 0.13 + Math.cos(z * 0.11) * 2) * Math.cos(z * 0.09) + 0.5 * Math.sin(z * 0.21 - x * 0.07);
  const poolXZ = local2(...MAR.pool.local);
  const floor2 = (x, z) => {
    const h = MAR.floor - 0.4 + 0.7 * Math.sin(x * 0.15 + Math.cos(z * 0.12) * 2) * Math.cos(z * 0.1);
    const dp = Math.hypot(x - poolXZ[0], z - poolXZ[1]);
    return h - MAR.pool.depth * (1 - sstep(MAR.pool.radius * 0.5, MAR.pool.radius + 2.5, dp));
  };
  // Every ring of the spiral that passes this angle, from the top down: a shelf where the road
  // runs, a sheer cliff between one turn and the next, the drop to the floor inside the last one.
  function humboldtH(x, z, top) {
    const dx = x - C1.x, dz = z - C1.z, r = Math.hypot(dx, dz);
    if (r > HUM.radius + 1) return null;
    const tp = (((SPI.dir * (Math.atan2(dz, dx) - SPI.start)) % TAU) + TAU) % TAU, sh = HW0 + SPI.shelf;
    let above = top, aboveInner = HUM.radius, first = true;
    for (let k = -1; k <= 2; k++) {
      const phi = tp + k * TAU; if (phi < -SPI.tuck || phi > SPI.end) continue;
      const r0 = spR(phi), y = spY(phi) - 0.15, inner = r0 - sh, outer = r0 + sh;
      if (r >= inner) {
        if (r <= outer) return y;
        if (first) {
          const R = HUM.radius;
          if (outer > R - SPI.talus - 2) return lerp(y, top, sstep(outer, Math.max(R, outer + 3), r));
          const t = clamp((r - outer) / (R - outer), 0, 1);
          return Math.min(top, y + (top - y) * (0.22 * t + 0.78 * sstep(R - SPI.talus, R, r)));
        }
        return lerp(y, above, sstep(outer, aboveInner, r));
      }
      above = y; aboveInner = inner; first = false;
    }
    if (first) return lerp(floor1(x, z), top, sstep(HUM.radius - 5, HUM.radius, r));
    return lerp(floor1(x, z), above, sstep(aboveInner - 4, aboveInner, r));
  }
  // the ravine: flat terraces where the legs run, steep banks between, each leg climbing evenly
  const RMP = MAR.ramp, LEGS = RMP.legs, LH = RMP.legHalf, NL = LEGS.length, HP = (LEGS[1] - LEGS[0]) / 2, TER = RMP.terrace;
  const legSide = k => (k % 2 === 0 ? -1 : 1);     // side of the ravine each leg starts from
  const legYA = [], legYB = [];
  {
    const [ex, ez] = local2(LEGS[NL - 1], -legSide(NL - 1) * LH), yTop = plateauH(ex, ez), y0 = MAR.floor;
    const dy = (yTop - y0 - (NL - 1) * RMP.hairRise) / NL;
    for (let k = 0; k < NL; k++) { legYA.push(k ? legYB[k - 1] + RMP.hairRise : y0); legYB.push(legYA[k] + dy); }
  }
  const legY = (k, l) => lerp(legYA[k], legYB[k], clamp((l - legSide(k) * LH) / (-2 * legSide(k) * LH), 0, 1));
  function martelH(x, z, top) {
    const q = toLocal2(x, z), R = MAR.radius;
    let h = top;
    if (q.r < R + 1) h = Math.min(h, lerp(floor2(x, z), top, sstep(R - 5, R, q.r)));
    // the ravine wins over the pit where both apply (its first leg starts inside the pit's circle)
    if (q.s > 0 && q.s < LEGS[NL - 1] + RMP.end + 6) {
      const hw = lerp(R * 0.92, RMP.halfWidth, sstep(0, RMP.flare, q.s));
      if (Math.abs(q.l) < hw + 1) {
        let fl;
        if (q.s < LEGS[0]) fl = lerp(floor2(x, z), legY(0, q.l), sstep(LEGS[0] - 22, LEGS[0] - TER, q.s));
        else if (q.s >= LEGS[NL - 1]) fl = lerp(legY(NL - 1, q.l), top, sstep(LEGS[NL - 1] + TER, LEGS[NL - 1] + RMP.end, q.s));
        else { let k = 0; while (k < NL - 2 && q.s >= LEGS[k + 1]) k++; fl = lerp(legY(k, q.l), legY(k + 1, q.l), sstep(LEGS[k] + TER, LEGS[k + 1] - TER, q.s)); }
        const rv = lerp(fl, top, sstep(hw - 5, hw, Math.abs(q.l)));
        h = q.s > 4 ? rv : Math.min(h, rv);
      }
    }
    return h;
  }
  function natural(x, z) {
    const top = plateauH(x, z);
    const h1 = humboldtH(x, z, top); if (h1 !== null) return h1;
    return martelH(x, z, top);
  }
  // the tepuy outline, its cliffs to the lowland and the other tepuyes on the horizon
  const E = P.edge;
  const edgeE = (x, z) => { const dx = (x - E.center[0]) / E.rx, dz = (z - E.center[1]) / E.rz, a = Math.atan2(dz, dx); return Math.hypot(dx, dz) * (1 + E.wobble * (Math.sin(a * 5 + 1.3) * 0.6 + Math.sin(a * 11 - 0.4) * 0.4)); };
  const lowland = (x, z) => E.lowland + 22 * Math.sin(x * 0.004 + Math.sin(z * 0.003) * 2) + 12 * Math.cos(z * 0.007 - x * 0.002) + 5 * Math.sin(x * 0.03) * Math.cos(z * 0.027);
  const mesaE = (m, x, z) => { const c = Math.cos(m.rot), s = Math.sin(m.rot), dx = x - m.at[0], dz = z - m.at[1], u = (dx * c + dz * s) / m.rx, v = (-dx * s + dz * c) / m.rz, a = Math.atan2(v, u); return Math.pow(Math.pow(Math.abs(u), 3) + Math.pow(Math.abs(v), 3), 1 / 3) * (1 + 0.06 * Math.sin(a * 7 + m.rx)); };
  function farH(x, z) {
    const e = edgeE(x, z), low = lowland(x, z);
    let h = e < 1 ? plateauH(x, z) : lerp(plateauH(x, z), low + 110 * sstep(1.3, 1.05, e), sstep(1.0, 1.0 + E.cliff, e));
    for (const m of MAP.landscape.mesas) { const me = mesaE(m, x, z); if (me < 1.4) h = Math.max(h, lerp(low + 140 * sstep(1.35, 1.05, me), m.top + 4 * Math.sin(x * 0.01), sstep(1.05, 1.0, me))); }
    return h;
  }

  /* ---------------- the route ---------------- */
  const CTRL = [];
  for (const e of MAP.road.points) {
    if (e.spiral) {
      const n = Math.max(1, Math.round((e.to - e.from) / e.step)), last = e.to >= SPI.end - 1e-6;
      for (let k = 0; k < n + (last ? 1 : 0); k++) { const phi = e.from + (e.to - e.from) * k / n, [x, z] = spXZ(phi); CTRL.push([x, spY(phi), z, e.seg]); }
    } else if (e.switchbacks) {
      const pts = [], arc = (cs, side) => { for (let k = 1; k < 16; k++) { const a = PI * k / 16; pts.push([cs - HP * Math.cos(a), side * (LH + HP * Math.sin(a))]); } };
      // Control points stay ~4 m apart from the run-in to the run-out: uneven
      // Catmull-Rom spans would hook where a long straight meets an arc.
      for (let l = LH - 24; l <= LH; l += 4) pts.push([LEGS[0] - 2 * HP, legSide(0) * l]);
      arc(LEGS[0] - HP, legSide(0));
      for (let k = 0; k < NL; k++) {
        for (let j = 0; j <= 22; j++) pts.push([LEGS[k], legSide(k) * LH * (1 - j / 11)]);
        if (k < NL - 1) arc(LEGS[k] + HP, -legSide(k));
      }
      for (let l = LH + 4; l <= LH + 36; l += 4) pts.push([LEGS[NL - 1] + (l - LH) * 0.15, -legSide(NL - 1) * l]);
      for (const [ls, ll] of pts) { const [x, z] = local2(ls, ll); CTRL.push([x, natural(x, z) + 0.25, z, e.seg]); }
    } else {
      const [x, z] = e.local ? local2(...e.at) : e.p;
      CTRL.push([x, e.y !== undefined ? e.y : natural(x, z) + 0.25, z, e.seg]);
    }
  }
  const roadCurve = new THREE.CatmullRomCurve3(CTRL.map(([x, y, z]) => V3(x, y, z)), true, 'centripetal');
  let NR = Math.round(roadCurve.getLength());
  let RP = roadCurve.getSpacedPoints(NR).slice(0, NR);
  let SEG = RP.map((_, i) => CTRL[Math.min(CTRL.length - 1, Math.floor(roadCurve.getUtoTmapping(i / NR) * CTRL.length))][3]);
  // Fair the floor chicane and the first gallery, never the spiral (its
  // shelves are cut from spR, except where it meets the floor), the climb
  // (its switchbacks are sampled as true circles) nor the gours stair. The
  // blend fades in over 40 m from any of them.
  {
    const fixed = i => { const k = (i + NR) % NR, g = SEG[k]; return g === 'b' || g === 'g' || g === 'u' || (g === 's' && RP[k].y > HUM.floor + 4); }, reach = new Float32Array(NR).fill(1e9);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 2 * NR; i++) {
      const k = pass ? 2 * NR - 1 - i : i, j = k % NR, prev = (j + (pass ? 1 : -1) + NR) % NR;
      reach[j] = fixed(j) ? 0 : Math.min(reach[j], reach[prev] + 1);
    }
    const W = 14;
    for (let pass = 0; pass < 6; pass++) {
      const src = RP.map(p => p.clone());
      for (let i = 0; i < NR; i++) {
        const k = sstep(0, 40, reach[i]); if (k <= 0) continue;
        let x = 0, z = 0, ws = 0;
        for (let j = -W; j <= W; j++) { const w = W + 1 - Math.abs(j), q = src[(i + j + NR) % NR]; x += q.x * w; z += q.z * w; ws += w; }
        RP[i].x = lerp(RP[i].x, x / ws, k); RP[i].z = lerp(RP[i].z, z / ws, k);
      }
    }
  }
  // Fairing bunches samples on the inside of the hairpins; space them evenly
  // again so each metre of road climbs only its designed share.
  {
    const along = [0];
    for (let i = 1; i <= NR; i++) along.push(along[i - 1] + RP[i % NR].distanceTo(RP[i - 1]));
    const total = along[NR], n = Math.round(total), out = [], seg = [];
    for (let k = 0, j = 0; k < n; k++) {
      const d = k * total / n; while (along[j + 1] < d) j++;
      const t = (d - along[j]) / (along[j + 1] - along[j] || 1);
      out.push(RP[j].clone().lerp(RP[(j + 1) % NR], t)); seg.push(SEG[t < 0.5 ? j : (j + 1) % NR]);
    }
    RP = out; SEG = seg; NR = n;
  }
  const ROAD_LEN = NR;
  const nearestSample = (x, z) => { let b = 0, bd = 1e9; for (let i = 0; i < NR; i++) { const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };
  // Rotate the samples so the game's start line (lineU along the lap) lands on MAP.road.start.
  {
    const shift = (nearestSample(...MAP.road.start) - Math.round(MAP.lineU * NR) + NR) % NR;
    RP = RP.map((_, i) => RP[(i + shift) % NR]); SEG = SEG.map((_, i) => SEG[(i + shift) % NR]);
  }
  const CAVE_SEG = { t: 1, g: 1 };
  const isCave = i => !!CAVE_SEG[SEG[(i % NR + NR) % NR]];
  const hwL = new Float32Array(NR).fill(HW0), hwR = new Float32Array(NR).fill(HW0);
  const SHOULDER = new Float32Array(NR); for (let i = 0; i < NR; i++) SHOULDER[i] = MAP.road.shoulder[SEG[i]] ?? 6;
  // Layered laps keep a flat road: the runtime resolves the cave and the rim
  // above it by height, which a banked crossfall cannot do.
  const roadY = new Float32Array(NR), bank = new Float32Array(NR);
  for (let i = 0; i < NR; i++) roadY[i] = RP[i].y;
  const roadFrame = i => {
    const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize();
    return { p, t, n: V3(-t.z, 0, t.x) };
  };
  // the cave stretch: from the first tunnel sample to the last gour sample
  let c0 = -1, c1 = -1; for (let i = 0; i < NR; i++) if (isCave(i)) { if (c0 < 0) c0 = i; c1 = i; }
  let g0 = -1; for (let i = 0; i < NR; i++) if (SEG[i] === 'g') { g0 = i; break; }
  // the gours: the road hops down a stair of rimstone pools, flat in each pool, a short ramp between
  const GN = MAP.cave.gours.steps, gY0 = roadY[g0], gY1 = roadY[(c1 + 1) % NR], gLen = c1 + 1 - g0;
  const stepY = a => { const k = Math.min(GN - 1, Math.floor(a * GN)), f = a * GN - k; return gY0 - (gY0 - gY1) * (k + sstep(0.62, 1, f)) / GN; };
  for (let i = g0; i <= c1; i++) roadY[i] = stepY((i - g0) / gLen);
  fairHeights(RP, roadY);
  for (let i = 0; i < NR; i++) RP[i].y = roadY[i];
  const roadAt = (i, lat, dy = 0) => { const k = (i % NR + NR) % NR, f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };
  const idxNear = (x, z, from = 0, to = NR) => { let b = from, bd = 1e9; for (let i = from; i < to; i++) { const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };

  // distance rasters (2 m cells) with nearest-sample index: surface road and cave road apart
  const GR = Math.round(SIZE / W0.cell), CELL = SIZE / GR, X0 = CX - HALF, Z0 = CZ - HALF;
  function raster(ids, far) {
    const dist = new Float32Array(GR * GR).fill(far), idx = new Int32Array(GR * GR).fill(-1), rc = Math.ceil(far / CELL);
    ids.forEach(i => {
      const p = RP[i], cx = Math.floor((p.x - X0) / CELL), cz = Math.floor((p.z - Z0) / CELL);
      for (let z = Math.max(0, cz - rc); z <= Math.min(GR - 1, cz + rc); z++) for (let x = Math.max(0, cx - rc); x <= Math.min(GR - 1, cx + rc); x++) {
        const wx = X0 + (x + 0.5) * CELL, wz = Z0 + (z + 0.5) * CELL, dd = Math.hypot(wx - p.x, wz - p.z), k = z * GR + x;
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
  const surfIds = [], caveIds = [];
  for (let i = 0; i < NR; i++) (isCave(i) ? caveIds : surfIds).push(i);
  const RR = raster(surfIds, 44), CR = raster(caveIds, 46);

  // ground = natural land, blended to the road where both sit at the same level
  function terrainH(x, z, nat) {
    let h = nat !== undefined ? nat : natural(x, z);
    const r = sampleR(RR, x, z);
    if (r.i >= 0 && SHOULDER[r.i] > 0) {
      const f = roadFrame(r.i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z;
      const hw = lat >= 0 ? hwR[r.i] : hwL[r.i], cl = clamp(lat, -hwL[r.i], hwR[r.i]);
      const target = roadY[r.i] + bank[r.i] * cl - 0.15;
      const w = (1 - sstep(hw + 0.5, hw + SHOULDER[r.i], r.dist)) * (1 - sstep(4, 14, Math.abs(h - target)));
      if (w > 0) h = lerp(h, target, w);
      // never above the asphalt: the 2 m grid must not poke through the ribbon
      if (r.dist < hw + 1) h = Math.min(h, target - 0.2);
    }
    return h;
  }

  /* ---------------- the underground half: widths along the galleries ---------------- */
  const hallProfile = (base, bumps) => u => base + bumps.reduce((a, b) => { let du = Math.abs(u - b.u); du = Math.min(du, 1 - du); return a + b.add * Math.exp(-((du / b.spread) ** 2)); }, 0);
  const cave = { from: c0 / NR, to: (c1 + 1) / NR, halls: MAP.cave.halls.map(h => ({ u: idxNear(...h.at, c0, c1 + 1) / NR, wide: h.wide, tall: h.tall })) };
  const widthAt = hallProfile(MAP.cave.width, cave.halls.map(h => ({ u: h.u, add: h.wide, spread: .022 })));
  const heightAt = hallProfile(MAP.cave.height, cave.halls.map(h => ({ u: h.u, add: h.tall, spread: .024 })));
  const caveW = i => widthAt(i / NR), caveH = i => heightAt(i / NR);
  const LAKE = MAP.cave.lake, lake0 = idxNear(...LAKE.from, c0, c1), lake1 = idxNear(...LAKE.to, c0, c1);
  const inLake = i => i >= lake0 && i <= lake1;

  const groundH = (x, z) => (Math.abs(x - CX) < HALF - 2 && Math.abs(z - CZ) < HALF - 2 ? terrainH(x, z) : farH(x, z));
  // Ground for cars and tests: the gallery floor under the cave's footprint
  // (a heightfield has no roof), the land everywhere else.
  function physicalGround(x, z) {
    const c = sampleR(CR, x, z);
    const land = groundH(x, z);
    return c.i >= 0 && c.dist < caveW(c.i) ? Math.min(land, roadY[c.i] - 0.6) : land;
  }
  // The road sample under a car: surface or gallery, whichever is level with it.
  function roadSampleAt(x, z, y) {
    const a = sampleR(RR, x, z), b = sampleR(CR, x, z);
    if (b.i < 0 || b.dist > caveW(b.i) + 4) return a.i >= 0 ? { ...a, cave: false } : null;
    if (a.i < 0 || a.dist > 40) return { ...b, cave: true };
    return Math.abs(roadY[b.i] - y) < Math.abs(roadY[a.i] - y) ? { ...b, cave: true } : { ...a, cave: false };
  }

  return { MAP, PI, TAU, sstep, V3, W0, CX, CZ, SIZE, HALF, P, TOP, HUM, MAR, SPI, HW0, C1, C2, RD, RN, toLocal2, local2,
    plateauH, spR, spY, spAng, spXZ, floor1, floor2, poolXZ, natural, E, edgeE, lowland, mesaE, farH,
    RMP, LEGS, LH, NL, HP, CTRL, ROAD_LEN, NR, RP, SEG, CAVE_SEG, isCave, hwL, hwR, SHOULDER, roadY, bank, roadFrame,
    c0, c1, g0, GN, gY0, gY1, gLen, roadAt, idxNear, GR, CELL, X0, Z0, raster, sampleR, RR, CR, terrainH,
    cave, widthAt, heightAt, caveW, caveH, LAKE, lake0, lake1, inLake, groundH, physicalGround, roadSampleAt,
    wet: () => false };
}
