// The island's landform: a raised plateau at the back, a hill in the middle,
// a river that falls off the plateau, runs under the path and spills into
// the sea. The path sits on a flattened embankment that follows the terrain.

import * as THREE from 'three';
import { M } from '/engine/props.js';

export const R = 37;           // island radius
const SEA = -1.3;

const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

// river from a spring at the back of the plateau out to the left shore
export const RIVER = [
  [-4, -28], [-7, -20], [-10.5, -12], [-12.5, -6.5], [-15.5, -1.5],
  [-21, 3.5], [-27, 8], [-33, 11], [-41, 14],
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

// The land before the path and river cut into it.
export function baseHeight(x, z) {
  const lip = -z - 7 - Math.sin(x * 0.13) * 2.2;          // > 0 up on the plateau
  const plateau = 2.8 * smooth(lip / 4.5);
  const hill = 3.6 * smooth((12 - Math.hypot(x, z + 3)) / 9);
  const bumps = Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.12;
  return plateau + hill + bumps;
}

// edge of the island, a little wobbly
const edgeR = (a) => R * (1 + Math.sin(a * 7) * 0.018 + Math.sin(a * 3 + 1) * 0.014);

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

  function groundAt(x, z) {
    const base = baseHeight(x, z);
    let g = base;
    const rd = riverDist(x, z);
    g -= 1.1 * smooth((2.9 - rd) / 1.9);                       // river bed
    const p = pathInfo(x, z);
    const w = smooth((4.8 - p.d) / 2.6) * (1 - smooth((3.8 - rd) / 1.4));
    g += (p.h - g) * w;                                          // path embankment
    const r = Math.hypot(x, z);
    const beach = smooth((r - (R - 4)) / 3.5) * (1 - smooth((base - 0.5) / 0.8));
    g += (-0.2 - g) * beach;                                     // low shores slope to sand
    return g;
  }

  // ---- ground: a radial grid so the rim matches the cliff ----
  const RINGS = 48, SEGS = 144;
  const ring = (k, j) => {
    const a = (j / SEGS) * Math.PI * 2;
    const r = edgeR(a) * (k / RINGS);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    return [x, groundAt(x, z), z];
  };
  const grid = [];
  for (let k = 0; k <= RINGS; k++) {
    grid.push([]);
    for (let j = 0; j < SEGS; j++) grid[k].push(ring(k, j));
  }
  const pos = [];
  const col = [];
  const cGrass = [new THREE.Color(0x5aa64e), new THREE.Color(0x55a04a), new THREE.Color(0x5eaa51)];
  const cHigh = new THREE.Color(0x6db85a);
  const cRock = new THREE.Color(0x8d8396);
  const cSand = new THREE.Color(0xe6c88c);
  const cBank = new THREE.Color(0x7a8a5a);
  const tri = (a, b, c) => {
    pos.push(...a, ...b, ...c);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const steep = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
    const r = Math.hypot(cx, cz);
    const h = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1;
    let c0;
    if (steep < 0.72) c0 = cRock.clone().offsetHSL(0, 0, (h - 0.5) * 0.06);
    else if (riverDist(cx, cz) < 2.4) c0 = cBank;
    else if (cy < 0.25 && r > R - 6) c0 = cSand.clone().offsetHSL(0, 0, (h - 0.5) * 0.05);
    else c0 = cGrass[Math.floor(h * 3)].clone().lerp(cHigh, clamp01(cy / 5) * 0.5);
    for (let i = 0; i < 3; i++) col.push(c0.r, c0.g, c0.b);
  };
  for (let j = 0; j < SEGS; j++) {
    const j2 = (j + 1) % SEGS;
    tri([0, groundAt(0, 0), 0], grid[1][j2], grid[1][j]);
    for (let k = 1; k < RINGS; k++) {
      tri(grid[k][j], grid[k][j2], grid[k + 1][j]);
      tri(grid[k][j2], grid[k + 1][j2], grid[k + 1][j]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  ground.receiveShadow = true;
  group.add(ground);

  // ---- cliffs: a skirt from the rim down under the sea, tapering in ----
  const cp = [], cc = [];
  const rockA = new THREE.Color(0x7d7488), rockB = new THREE.Color(0x5a5266);
  for (let j = 0; j < SEGS; j++) {
    const j2 = (j + 1) % SEGS;
    const a = grid[RINGS][j], b = grid[RINGS][j2];
    const down = (p, k) => [p[0] * k, -6, p[2] * k];
    const a2 = down(a, 0.86), b2 = down(b, 0.86);
    cp.push(...a, ...a2, ...b, ...b, ...a2, ...b2);
    const shade = j % 3 === 0 ? rockB : rockA;
    for (let i = 0; i < 6; i++) cc.push(shade.r, shade.g, shade.b);
  }
  const cliffGeo = new THREE.BufferGeometry();
  cliffGeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cliffGeo.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  cliffGeo.computeVertexNormals();
  const cliff = new THREE.Mesh(cliffGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide }));
  cliff.receiveShadow = true;
  group.add(cliff);

  // ---- river: a water ribbon with foam where it tumbles ----
  const samples = [];
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.6);
    for (let k = 0; k < n; k++) samples.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  samples.push(RIVER[RIVER.length - 1]);
  const wy = samples.map(([x, z]) => {
    const r = Math.hypot(x, z);
    const y = baseHeight(x, z) - 0.55;
    if (r < R - 1) return Math.max(y, -0.55);
    return SEA + 0.05 + (Math.max(y, -0.55) - SEA) * clamp01((R + 1.5 - r) / 2.5);   // over the edge
  });
  // keep the water always running downhill
  for (let i = 1; i < wy.length; i++) wy[i] = Math.min(wy[i], wy[i - 1]);
  const rp = [], foamP = [];
  const W = 1.55;
  const falls = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const [ax, az] = samples[i], [bx, bz] = samples[i + 1];
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l * W, nz = dx / l * W;
    const A1 = [ax + nx, wy[i], az + nz], A2 = [ax - nx, wy[i], az - nz];
    const B1 = [bx + nx, wy[i + 1], bz + nz], B2 = [bx - nx, wy[i + 1], bz - nz];
    rp.push(...A1, ...A2, ...B1, ...B1, ...A2, ...B2);
    const drop = wy[i] - wy[i + 1];
    if (drop > 0.12) {
      const lift = (p) => [p[0], p[1] + 0.03, p[2]];
      foamP.push(...lift(A1), ...lift(A2), ...lift(B1), ...lift(B1), ...lift(A2), ...lift(B2));
      if (wy[i + 2] !== undefined && wy[i + 1] - wy[i + 2] <= 0.12) falls.push(new THREE.Vector3(bx, wy[i + 1] + 0.05, bz));
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  riverGeo.computeVertexNormals();
  const water = new THREE.Mesh(riverGeo, new THREE.MeshStandardMaterial({
    color: 0x3fb6d9, emissive: 0x0d4a63, roughness: 0.25, metalness: 0.1, flatShading: true, side: THREE.DoubleSide,
  }));
  group.add(water);
  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setAttribute('position', new THREE.Float32BufferAttribute(foamP, 3));
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  group.add(new THREE.Mesh(foamGeo, foamMat));
  // splash rings at the bottom of each fall, plus the one into the sea
  const end = RIVER[RIVER.length - 1];
  falls.push(new THREE.Vector3(end[0] * 0.98, SEA + 0.1, end[1] * 0.98));
  const rings = falls.map((p) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 5, 16), foamMat);
    m.rotation.x = Math.PI / 2;
    m.position.copy(p);
    group.add(m);
    return m;
  });
  // turquoise shallows hugging the shore, fading out to the deep sea
  const shallows = new THREE.Mesh(new THREE.RingGeometry(R * 0.9, R + 9, 64, 1), new THREE.MeshBasicMaterial({
    color: 0x3fc1c9, transparent: true, opacity: 0.35, depthWrite: false,
  }));
  shallows.rotation.x = -Math.PI / 2;
  shallows.position.y = SEA + 0.32;
  group.add(shallows);
  const surf = new THREE.Mesh(new THREE.RingGeometry(R - 0.2, R + 1.2, 72, 1), new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  surf.rotation.x = -Math.PI / 2;
  surf.position.y = SEA + 0.36;
  group.add(surf);

  // a little spring where the river starts
  const spring = new THREE.Mesh(new THREE.CircleGeometry(2.3, 14), water.material);
  spring.rotation.x = -Math.PI / 2;
  spring.position.set(RIVER[0][0], wy[0] + 0.01, RIVER[0][1]);
  group.add(spring);

  return {
    group, groundAt,
    update(t) {
      foamMat.opacity = 0.5 + Math.sin(t * 6) * 0.12;
      surf.material.opacity = 0.35 + Math.sin(t * 1.4) * 0.15;
      surf.scale.setScalar(1 + Math.sin(t * 1.4) * 0.012);
      rings.forEach((m, i) => {
        const k = (t * 0.8 + i * 0.37) % 1;
        m.scale.setScalar(0.7 + k * 0.8);
      });
    },
  };
}
