// The island's landform, as one smooth heightfield: an organic coastline,
// rolling meadows, a plateau and Pico Pana (the mountain) at the back, the
// hill with the big mango tree in the middle, and a river that falls off the
// mountain, crosses the path and spills into the sea. Shallow sand shows
// through the water, so the shore fades out naturally.

import * as THREE from 'three';

export const SEA = -1.3;
export const PEAK = { x: 4, z: -62 };
export const HILL = { x: 0, z: -2 };

const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

// ---------- noise ----------
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// smooth 0..1 noise with detail
export function fbm(x, z) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) {
    s += amp * vnoise(x * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return s / 0.9375;
}

// ---------- shape ----------
// 1 inland, 0 out at sea; the coast wobbles
export function landMask(x, z) {
  const q = Math.hypot(x / 1.2, z) + (fbm(x * 0.017 + 3.1, z * 0.017 - 1.7) - 0.5) * 30;
  return smooth((88 - q) / 15);
}

// The land before the path and river cut into it.
export function baseHeight(x, z) {
  const land = landMask(x, z);
  let h = -6 + land * 7.8;                                       // sea floor → meadows
  h += land * (fbm(x * 0.03 + 7, z * 0.03) - 0.5) * 2.2;          // rolling meadows
  const lip = -z - 26 - Math.sin(x * 0.08) * 4;                   // back plateau
  h += 3.4 * smooth(lip / 7) * land;
  h += 4.4 * smooth((15 - Math.hypot(x - HILL.x, z - HILL.z)) / 12);   // the hill
  const dm = Math.hypot((x - PEAK.x) * 0.85, z - PEAK.z);          // Pico Pana
  const m = smooth((44 - dm) / 44);
  h += 34 * Math.pow(m, 1.7) + m * (fbm(x * 0.08, z * 0.08) - 0.5) * 7;
  for (const [hx, hz, hh, hr] of [[66, -34, 9, 20], [-66, -40, 7, 18], [-58, 46, 4, 16]]) {
    h += hh * Math.pow(smooth((hr - Math.hypot(x - hx, z - hz)) / hr), 1.4) * land;   // side hills
  }
  return h;
}

// river from a spring on the mountain down to the left shore
export const RIVER = [
  [-4, -46], [-11, -37], [-17, -27], [-25, -15], [-34, -5],
  [-46, 5], [-60, 13], [-76, 19], [-100, 26],
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
export function buildIsland(tiles, edges) {
  const group = new THREE.Group();

  function pathInfo(x, z) {
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
    const w = smooth((5 - p.d) / 2.6) * (1 - smooth((4 - rd) / 1.4));
    g += (p.h - g) * w;                                            // path embankment
    return { g, path: p.d, river: rd, base };
  }
  const groundAt = (x, z) => shape(x, z).g;

  // ---- ground: one smooth-shaded grid ----
  const W = 270, D = 240, SX = 216, SZ = 192;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -14);
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
    forest: new THREE.Color(0x3f8a44), rock: new THREE.Color(0x9a8d80), rockHi: new THREE.Color(0xc2b8ae),
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
      c.lerp(C.sand, Math.max(smooth((0.93 - landMask(x, z)) / 0.12), smooth((0.6 - y) / 0.6)));
      c.lerp(C.bank, smooth((2.8 - s.river) / 1.2) * 0.8);
      c.lerp(C.dirt, smooth((2.4 - s.path) / 1.2) * 0.55);         // worn ground along the path
    }
    // rock on steep faces, bare rock up high
    c.lerp(C.rock, smooth((0.74 - ny) / 0.16));
    c.lerp(C.rockHi, smooth((y - 22) / 8));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
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
  const wy = samples.map(([x, z]) => Math.max(baseHeight(x, z) - 0.6, SEA + 0.04));
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

  return {
    group, groundAt,
    pathDist: (x, z) => pathInfo(x, z).d,
    update(t) {
      foamMat.opacity = 0.5 + Math.sin(t * 6) * 0.12;
      rings.forEach((m, i) => m.scale.setScalar(0.7 + ((t * 0.8 + i * 0.37) % 1) * 0.8));
    },
  };
}
