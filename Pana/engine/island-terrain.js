// The island's landform, as one smooth heightfield: an organic coastline,
// rolling meadows, a plateau and Pico Pana (the mountain) at the back, the
// hill with the big mango tree in the middle, and a river that falls off the
// mountain, crosses the path and spills into the sea. Shallow sand shows
// through the water, so the shore fades out naturally.

import * as THREE from 'three';
import { terrainMaterial } from './terrain-material.js';
import { fbm2 } from './random.js';

export const SEA = -1.3;
export const PEAK = { x: 4, z: -76 };
export const HILL = { x: 0, z: -2 };
export const MAP_BOUNDS = { x0: -180, x1: 180, z0: -156, z1: 156 };

const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

// ---------- noise ----------
// smooth 0..1 noise with detail (engine/random.js)
export const fbm = (x, z) => fbm2(x, z);

// ---------- shape ----------
// 1 inland, 0 out at sea; the coast wobbles
export function landMask(x, z) {
  const bay = 8 * Math.exp(-(((x - 125) / 24) ** 2) - ((z - 24) / 36) ** 2);
  const q = Math.hypot(x / 1.3, (z - 6) / 1.08) + bay + (fbm(x * 0.017 + 3.1, z * 0.017 - 1.7) - 0.5) * 25;
  return smooth((114 - q) / 18);
}

export function beachMask(x, z) {
  return smooth((z - 51 - Math.sin(x * 0.025) * 5) / 24) * smooth((138 - Math.abs(x)) / 25);
}

// The land before the path and river cut into it.
export function baseHeight(x, z) {
  const land = landMask(x, z);
  let h = -6 + land * 7.8;                                       // sea floor → meadows
  h += land * (fbm(x * 0.03 + 7, z * 0.03) - 0.5) * 2.2;          // rolling meadows
  const lip = -z - 26 - Math.sin(x * 0.08) * 4;                   // back plateau
  h += 3.4 * smooth(lip / 7) * land;
  h += 4.4 * smooth((15 - Math.hypot(x - HILL.x, z - HILL.z)) / 12);   // the hill
  // A broad green summit and a steep, broken sandstone escarpment.
  const dm = (Math.abs((x - PEAK.x) * 0.9) ** 4 + Math.abs((z - PEAK.z) * 1.25) ** 4) ** 0.25
    + (fbm(x * 0.055 + 6, z * 0.055) - 0.5) * 13;
  const shoulder = smooth((63 - dm) / 44);
  const summit = smooth((35 - dm) / 7);
  h += 13 * shoulder + 36 * summit + summit * (fbm(x * 0.1, z * 0.1) - 0.5) * 3;
  for (const [hx, hz, hh, hr] of [[66, -34, 9, 20], [-66, -40, 7, 18], [-58, 46, 4, 16]]) {
    h += hh * Math.pow(smooth((hr - Math.hypot(x - hx, z - hz)) / hr), 1.4) * land;   // side hills
  }
  const dune = -6 + land * (7.5 + (fbm(x * 0.05, z * 0.06) - 0.5) * 0.8);
  return THREE.MathUtils.lerp(h, dune, beachMask(x, z) * 0.95);
}

// river from a spring on the mountain down to the left shore
export const RIVER = [
  [-4, -51], [-8, -43], [-11, -37], [-17, -27], [-25, -15], [-34, -5],
  [-46, 5], [-60, 13], [-76, 19], [-100, 26], [-123, 29], [-150, 37],
];

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp01(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1));
  return { d: Math.hypot(px - ax - dx * t, pz - az - dz * t), t };
}

export function riverDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    best = Math.min(best, segDist(x, z, ax, az, bx, bz).d);
  }
  return best;
}

// Builds the ground for a finished path: `tiles` (x, z, ground) joined by
// `edges` ([tileA, tileB] pairs).
export function buildIsland(tiles, edges, { road = null } = {}) {
  const group = new THREE.Group();

  function pathInfo(x, z) {
    if (road) return road(x, z);
    let best = Infinity, h = 0;
    for (const [a, b] of edges) {
      const s = segDist(x, z, a.x, a.z, b.x, b.z);
      if (s.d < best) { best = s.d; h = a.ground + (b.ground - a.ground) * s.t; }
    }
    return { d: best, h };
  }

  function shape(x, z) {
    const base = baseHeight(x, z);
    let g = base;
    const rd = riverDist(x, z);
    g -= 1.3 * smooth((3.2 - rd) / 2.2) * smooth(base + 0.5);    // river bed (inland only)
    const p = pathInfo(x, z);
    const corridor = smooth(((p.width ?? 2.4) + (p.shoulder ?? 2.6) - p.d) / (p.shoulder ?? 2.6));
    const w = road ? corridor : corridor * (1 - smooth((4 - rd) / 1.4));
    // A driving bridge keeps the riverbed below its deck, even where the
    // hillside beside the river was higher than the road centerline.
    const riverBed = Math.min(g, p.h - 1.2);
    const target = road ? riverBed + (p.h - riverBed) * smooth((rd - 2) / 2) : p.h;
    g += (target - g) * w;                                          // path embankment
    return { g, path: p.d, river: rd, base };
  }
  const groundAt = (x, z) => shape(x, z).g;

  // ---- ground: one smooth-shaded grid ----
  const W = 360, D = 320, SX = 240, SZ = 214;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const info = [];
  for (let i = 0; i < pos.count; i++) {
    const s = shape(pos.getX(i), pos.getZ(i));
    pos.setY(i, s.g);
    info.push(s);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const C = {
    deep: new THREE.Color(0x2a7fa8), shallow: new THREE.Color(0x7fd3c8), sand: new THREE.Color(0xecd096),
    grassA: new THREE.Color(0x63b453), grassB: new THREE.Color(0x7cc35d), grassC: new THREE.Color(0x4f9d4a),
    forest: new THREE.Color(0x3f8a44), rock: new THREE.Color(0x796552), rockHi: new THREE.Color(0xba9870),
    dirt: new THREE.Color(0xc9a46c), bank: new THREE.Color(0x7d8f5c),
  };
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const s = info[i];
    const ny = nrm.getY(i);
    if (y < SEA + 0.2) {
      c.copy(C.shallow).lerp(C.deep, clamp01((SEA + 0.2 - y) / 3.5));
    } else {
      // soft patches of meadow color, deeper green up the slopes
      const n = fbm(x * 0.05 + 11, z * 0.05);
      c.copy(C.grassA).lerp(C.grassB, smooth((n - 0.45) * 4)).lerp(C.grassC, smooth((0.4 - n) * 4) * 0.7);
      c.lerp(C.forest, smooth((y - 6) / 10) * 0.8);
      // a sandy beach all round the coast, fading into the grass
      c.lerp(C.sand, Math.max(beachMask(x, z), smooth((0.93 - landMask(x, z)) / 0.12), smooth((0.6 - y) / 0.6)));
      c.lerp(C.bank, smooth((2.8 - s.river) / 1.2) * 0.8);
      c.lerp(C.dirt, smooth((2.4 - s.path) / 1.2) * 0.55);         // worn ground along the path
    }
    // rock on steep faces, bare rock up high
    const cliff = smooth((0.76 - ny) / 0.32) * (1 - beachMask(x, z));
    const strata = 0.45 + Math.sin(y * 1.2 + fbm(x * 0.12, z * 0.12) * 3) * 0.17;
    const stone = C.rock.clone().lerp(C.rockHi, strata + fbm(x * 0.22, z * 0.22) * 0.3);
    c.lerp(stone, cliff);
    if (y > 30 && ny > 0.78) c.lerp(C.forest, 0.5);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(geo, terrainMaterial());
  ground.receiveShadow = true;
  group.add(ground);
  // the seafloor carries on past the grid, so the open sea has no edge
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: C.deep, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6.1;
  group.add(floor);

  // ---- river: a water ribbon with foam where it tumbles ----
  const samples = [];
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.7);
    for (let k = 0; k < n; k++) samples.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  samples.push(RIVER[RIVER.length - 1]);
  const wy = samples.map(([x, z]) => {
    let y = Math.max(baseHeight(x, z) - 0.6, SEA + 0.04);
    if (road) {
      const p = road(x, z);
      // Reserve the full river width at a crossing, including its high bank.
      if (p.d < p.width + 3) y = Math.min(y, p.h - 0.45);
    }
    return y;
  });
  for (let i = 1; i < wy.length; i++) wy[i] = Math.min(wy[i], wy[i - 1]);   // always downhill
  const rp = [], foamP = [];
  const RW = 1.7;
  const falls = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const [ax, az] = samples[i], [bx, bz] = samples[i + 1];
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l * RW, nz = dx / l * RW;
    const A1 = [ax + nx, wy[i], az + nz], A2 = [ax - nx, wy[i], az - nz];
    const B1 = [bx + nx, wy[i + 1], bz + nz], B2 = [bx - nx, wy[i + 1], bz - nz];
    rp.push(...A1, ...A2, ...B1, ...B1, ...A2, ...B2);
    const drop = wy[i] - wy[i + 1];
    if (drop > 0.14) {
      const lift = (p) => [p[0], p[1] + 0.03, p[2]];
      foamP.push(...lift(A1), ...lift(A2), ...lift(B1), ...lift(B1), ...lift(A2), ...lift(B2));
      if (wy[i + 2] !== undefined && wy[i + 1] - wy[i + 2] <= 0.14) falls.push(new THREE.Vector3(bx, wy[i + 1] + 0.05, bz));
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  riverGeo.computeVertexNormals();
  const water = new THREE.Mesh(riverGeo, new THREE.MeshStandardMaterial({
    color: 0x45bde0, emissive: 0x0d4a63, roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide,
  }));
  water.name = 'island-river';
  group.add(water);
  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setAttribute('position', new THREE.Float32BufferAttribute(foamP, 3));
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  group.add(new THREE.Mesh(foamGeo, foamMat));
  const rings = falls.map((p) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.18, 5, 16), foamMat);
    m.rotation.x = Math.PI / 2;
    m.position.copy(p);
    group.add(m);
    return m;
  });
  const spring = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16), water.material);
  spring.rotation.x = -Math.PI / 2;
  spring.position.set(RIVER[0][0], wy[0] + 0.02, RIVER[0][1]);
  group.add(spring);

  // Two thin, irregular surf ribbons follow the actual coast instead of an
  // ellipse. They rise and fade independently, leaving the beach unobstructed.
  const surf = [];
  for (let band = 0; band < 2; band++) {
    const positions = [], indices = [];
    for (let i = 0; i <= 220; i++) {
      const a = i / 220 * Math.PI * 2;
      let lo = 40, hi = 210;
      for (let k = 0; k < 14; k++) {
        const r = (lo + hi) / 2;
        if (baseHeight(Math.cos(a) * r, Math.sin(a) * r) > SEA) lo = r;
        else hi = r;
      }
      const r = (lo + hi) / 2 + band * 1.8;
      for (const edge of [0, 0.5 + Math.sin(a * 13) * 0.18]) positions.push(Math.cos(a) * (r + edge), SEA + 0.19, Math.sin(a) * (r + edge));
      if (i < 220) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    const material = new THREE.MeshBasicMaterial({ color: 0xe8fffa, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    const ribbon = new THREE.Mesh(geo, material);
    group.add(ribbon);
    surf.push(ribbon);
  }

  return {
    group, groundAt,
    pathDist: (x, z) => pathInfo(x, z).d,
    update(t) {
      foamMat.opacity = 0.5 + Math.sin(t * 6) * 0.12;
      rings.forEach((m, i) => m.scale.setScalar(0.7 + ((t * 0.8 + i * 0.37) % 1) * 0.8));
      surf.forEach((m, i) => {
        const wave = Math.sin(t * 0.65 + i * Math.PI);
        m.material.opacity = 0.16 + (wave + 1) * 0.12;
        m.scale.set(1 + wave * 0.004, 1, 1 + wave * 0.004);
      });
    },
  };
}
