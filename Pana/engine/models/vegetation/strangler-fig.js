import * as THREE from 'three';
import { M, mesh } from '/engine/models/core/primitives.js';
import { growTree, ellipsoid, figs, tube, addMesh, barkMat, bromeliad, hangingVine, branchPoints, TAU, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import { lerp } from '/engine/random.js';

// Matapalo (higuerón estrangulador): a cage of pale roots hugs the old trunk
// and opens out on the ground, with figs and bromeliads; `leaves: false`
// shows the cage. With `shrine` it swallows a small stone shrine at
// (-5·scale, 0, 7·scale) and roots drape over it.
const MATAPALO = {
  name: 'stranglerFig',
  height: 12,
  skeleton: s => ({
    trunk: 6.5 * s, trunkR: 0.4 * s, trunkTaper: 0.65, clear: 0.72, lean: 0.05, trunkWobble: 0.04, trunkSegments: 18,
    depth: 3, kids: [6, 3, 3], angle: [1.05, 0.7, 0.65], lenRatio: [0.85, 0.55, 0.52], radRatio: [0.5, 0.55, 0.55],
    upturn: [0, 0.025, 0.03, 0.02], wobble: 0.2, taper: 0.38, minY: 0, maxY: 0.6,
    envelope: ellipsoid(0, 9.4 * s, 0, 7 * s, 3.1 * s, 7 * s),
  }),
  bark: { bark: 0x3f372e, barkLight: 0x5a5044, ridges: 5 },
  foliage: { openCrown: true, kind: 'leaf', size: 1.1, tints: [0x2b5e2f, 0x346a33, 0x3f7638], blades: 26, bladeLen: 0.45, bladeWidth: 0.4, flat: 0.55, along: 2, alongFrom: 2 },
  fruit: (parts, r, skeleton, s) => figs(parts, r, skeleton, s),
};

function cageRoots(group, parts, r, skeleton, s, o) {
  const trunk = skeleton.branches[0], n = trunk.pts.length, top = trunk.pts[n - 1].y * 0.9;
  // the host trunk's centre and radius at height y
  const at = y => {
    const k = Math.max(0, Math.min(n - 1.001, (y - trunk.pts[0].y) / (trunk.pts[n - 1].y - trunk.pts[0].y) * (n - 1))), i = Math.floor(k), f = k - i;
    return { c: trunk.pts[i].clone().lerp(trunk.pts[i + 1], f), rad: lerp(trunk.rads[i], trunk.rads[i + 1], f) };
  };
  const light = new THREE.Color(0x968b78), dark = new THREE.Color(0x6c6355);
  const colorAt = (c, t, a) => c.copy(dark).lerp(light, 0.5 + 0.5 * Math.sin(a * 2 + t * 7));
  const roots = o.lite ? 9 : 15, cage = [];
  // fig roots wrap down the host and flare out onto the ground
  for (let i = 0; i < roots; i++) {
    const a0 = i / roots * TAU + r() * 0.3, twist = (r() - 0.5) * 2.4, flare = (1.2 + r() * 1.4) * s, start = top * (0.75 + r() * 0.25), pts = [], rads = [];
    for (let j = 0; j <= 18; j++) {
      const t = j / 18, y = lerp(start, 0.12 * s, t), { c, rad } = at(Math.max(0, y)), a = a0 + twist * t + Math.sin(t * 7 + i) * 0.12;
      const out = rad * 1.04 + (t > 0.8 ? ((t - 0.8) / 0.2) ** 1.6 * flare : 0);
      pts.push(new THREE.Vector3(c.x + Math.cos(a) * out, y, c.z + Math.sin(a) * out)); rads.push(lerp(0.07, 0.15, t) * s * (0.7 + r() * 0.5));
    }
    cage.push({ a0, twist, start });
    addMesh(group, tube(pts, rads, 6, colorAt), barkMat, 'bark');
  }
  // cross ties between the roots
  for (let i = 0; i < (o.lite ? 6 : 14); i++) {
    const root = cage[(r() * cage.length) | 0], y0 = r() * root.start * 0.85 + 0.3, t = 1 - (y0 + 0.02) / (root.start + 0.02);
    const a = root.a0 + root.twist * t, span = 0.5 + r() * 0.6, pts = [];
    for (let j = 0; j <= 6; j++) {
      const aa = a + span * j / 6, y = y0 + Math.sin(j / 6 * Math.PI) * 0.2 - j * 0.04, { c, rad } = at(y);
      pts.push(new THREE.Vector3(c.x + Math.cos(aa) * rad * 1.06, y, c.z + Math.sin(aa) * rad * 1.06));
    }
    addMesh(group, tube(pts, pts.map(() => 0.05 * s), 5, colorAt), barkMat, 'bark');
  }
  // aerial roots hanging from the main limbs
  for (const b of skeleton.branches) if (b.depth === 1) for (let i = 3; i < b.pts.length; i += 3) if (r() < 0.55) {
    const p = b.pts[i], drop = r() < 0.4 ? p.y - 0.04 * s : p.y * (0.25 + r() * 0.4), pts = [];
    for (let j = 0; j <= 8; j++) pts.push(new THREE.Vector3(p.x + Math.sin(j * 1.3) * 0.05, p.y - drop * j / 8, p.z + Math.cos(j) * 0.05));
    addMesh(group, tube(pts, pts.map((q, j) => (0.02 + j / 8 * 0.015) * s), 4, colorAt), barkMat, 'bark');
  }
  if (o.leaves) {
    for (const spot of branchPoints(skeleton, r, o.lite ? 3 : 7)) bromeliad(parts, r, spot.p.clone().add(new THREE.Vector3(0, spot.rad, 0)), 0.45 * s);
    for (const spot of branchPoints(skeleton, r, o.lite ? 3 : 6, 2)) hangingVine(parts, r, spot.p, (1.5 + r() * 3) * s, { s, lite: o.lite });
  }
  if (o.shrine) shrineRuin(group, r, s, colorAt);
}

// A small stepped stone shrine with roots spilling over its top.
function shrineRuin(group, r, s, colorAt) {
  const sx = -5 * s, sz = 7 * s;
  const stone = M(0xa29c84, { roughness: 0.95 }), dark = M(0x8f8c77, { roughness: 0.95 }), moss = M(0x6a8e36, { roughness: 1 });
  const add = (geo, mat, x, y, z) => { const m = mesh(geo, mat, sx + x * s, y * s, sz + z * s); m.scale.setScalar(s); group.add(m); return m; };
  add(new THREE.BoxGeometry(4.4, 0.8, 4.4), dark, 0, 0.4, 0);
  add(new THREE.BoxGeometry(3.2, 3.4, 3.2), stone, 0, 2.5, 0);
  add(new THREE.BoxGeometry(1.2, 2.2, 0.2), M(0x181410), 0, 1.9, 1.62);
  add(new THREE.BoxGeometry(3.6, 0.5, 3.6), dark, 0, 4.4, 0);
  add(new THREE.BoxGeometry(2.6, 1.2, 2.6), stone, 0, 5.2, 0);
  add(new THREE.BoxGeometry(1.8, 0.9, 1.8), dark, 0, 6.2, 0);
  add(new THREE.ConeGeometry(0.7, 1.4, 4), stone, 0, 7.35, 0).rotation.y = Math.PI / 4;
  add(new THREE.BoxGeometry(3.3, 0.18, 2.2), moss, 0.2, 4.72, -0.5);
  for (let i = 0; i < 4; i++) {
    const block = add(new THREE.BoxGeometry(0.9 + r() * 0.6, 0.5 + r() * 0.4, 0.8 + r() * 0.5), stone, 2.4 + r() * 1.5, 0.3, (r() - 0.5) * 4);
    block.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
  }
  // roots from the tree arch over the shrine and down its sides
  for (let i = 0; i < 7; i++) {
    const a = -2.2 + r() * 2.2 + (i % 2 ? Math.PI : 0), c = Math.cos(a), n = Math.sin(a);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, (3 + r() * 2) * s, 0), new THREE.Vector3(sx * 0.6, (8 + r() * 2) * s, sz * 0.6),
      new THREE.Vector3(sx + c * 1.5 * s, 9 * s, sz + n * 1.5 * s), new THREE.Vector3(sx + c * 3.4 * s, 3 * s, sz + n * 3.4 * s),
      new THREE.Vector3(sx + c * (5 + r() * 2) * s, 0.07 * s, sz + n * (5 + r() * 2) * s)]);
    const pts = curve.getPoints(18), rad = (0.12 + r() * 0.1) * s;
    addMesh(group, tube(pts, pts.map((p, j) => lerp(rad, 0.06 * s, j / 18)), 6, colorAt), barkMat, 'bark');
  }
}

export function stranglerFig({ seed = 1, scale = 1, shrine = true, detail = 'game', leaves = true, fruit = true } = {}) {
  const species = { ...MATAPALO, extra: (group, parts, r, skeleton, s, o) => cageRoots(group, parts, r, skeleton, s, { ...o, shrine }) };
  return growTree(species, { seed, detail: treeDetail(detail), leaves, fruit, scale });
}
