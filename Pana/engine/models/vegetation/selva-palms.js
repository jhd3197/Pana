import * as THREE from 'three';
import { palmTrunk, pinnateFrond, tube, addMesh, barkMat, newParts, finishTree, paint, TAU, treeDetail } from '/engine/models/vegetation/tree-kit.js';
import { rng, lerp } from '/engine/random.js';

// The selva's understorey palms and the tree fern.

// Palma zancona, the walking palm: the stem starts in the air on a cone of
// stilt roots, with a green crownshaft and a few broad fronds.
export function zancona({ seed = 1, detail = 'game', leaves = true, fruit = true, scale = 1 } = {}) {
  const r = rng(seed), s = scale, level = treeDetail(detail), lite = level !== 'full', low = level === 'low' || level === 'far', group = new THREE.Group(), parts = newParts();
  const stilt = (1.6 + r() * 0.6) * s;
  const trunk = palmTrunk(group, r, { at: new THREE.Vector3(0, stilt * 0.55, 0), height: (12 + r() * 3) * s, base: 0.13 * s, top: 0.11 * s, lean: 0.05, bend: 0.03, rings: 2.2 / s, bark: 0x6b6f5c, barkLight: 0x969a84, flare: 0, sides: 10 });
  const rootDark = new THREE.Color(0x3d4231), rootLight = new THREE.Color(0x5a5f45);
  for (let i = 0, n = lite ? 9 : 16; i < n; i++) {
    const a = i / n * TAU + r() * 0.35, y = lerp(0.4, stilt, Math.pow(r(), 0.7)), out = (0.45 + y / s * 0.75 + r() * 0.3) * s;
    const from = new THREE.Vector3(0, y, 0), foot = new THREE.Vector3(Math.cos(a) * out, 0.05 * s, Math.sin(a) * out), pts = [];
    for (let j = 0; j <= 8; j++) { const t = j / 8, p = from.clone().lerp(foot, t); p.y += Math.sin(t * Math.PI) * 0.12 * s; pts.push(p); }
    addMesh(group, tube(pts, pts.map((p, j) => lerp(0.035, 0.05, j / 8) * s), 6, (c, t, ang) => c.copy(rootDark).lerp(rootLight, 0.5 + 0.5 * Math.sin(ang * 3 + t * 30))), barkMat, 'bark');
  }
  const top = trunk.top, shaftBase = top.clone().addScaledVector(trunk.dir, -1.4 * s), shaft = [shaftBase, shaftBase.clone().lerp(top, 0.5), top.clone().addScaledVector(trunk.dir, 0.15 * s)];
  const shaftDark = new THREE.Color(0x6f8f42), shaftLight = new THREE.Color(0x9fb06a);
  addMesh(group, tube(shaft, [0.12 * s, 0.15 * s, 0.1 * s], 10, (c, t) => c.copy(shaftDark).lerp(shaftLight, t * 0.6)), barkMat, 'bark');
  if (leaves) for (let i = 0, n = lite ? 6 : 9; i < n; i++) {
    pinnateFrond(parts, r, shaft[2], i * 2.39996 + r() * 0.3, { length: (3.2 + r() * 0.6) * s, rise: 1 - i / n * 0.6, droop: 0.95 + i / n * 0.4, leaflets: 15, leafLen: 0.85 * s, leafWidth: 0.17, drop: 0.25, color: i % 2 ? 0x4b8a34 : 0x58963b, lite, low });
  }
  if (fruit) {
    const at = shaftBase.clone().addScaledVector(trunk.dir, -0.1 * s);
    for (let i = 0; i < (lite ? 12 : 30); i++) {
      const a = r() * TAU, out = 0.18 * s + r() * 0.3 * s, ball = new THREE.SphereGeometry(0.04 * s, 6, 5);
      paint(ball, c => c.set(i % 3 ? 0xc9a83a : 0xa6862a));
      ball.translate(at.x + Math.cos(a) * out, at.y - r() * 0.6 * s, at.z + Math.sin(a) * out); parts.fruit.push(ball);
    }
  }
  return finishTree(group, parts, 'zancona', { crownRadius: 3.2 * s, petals: null });
}

// Palma manaca: a clump of slim stems of every height, leaflets hanging like
// fringes, purple fruit bunches and pups at the base.
export function manaca({ seed = 1, detail = 'game', leaves = true, fruit = true, scale = 1 } = {}) {
  const r = rng(seed), s = scale, level = treeDetail(detail), lite = level !== 'full', low = level === 'low' || level === 'far', group = new THREE.Group(), parts = newParts();
  const shaftDark = new THREE.Color(0x8a6a3a), shaftLight = new THREE.Color(0x6f8a3a);
  for (let i = 0, stems = lite ? 4 : 7; i < stems; i++) {
    const a = i / stems * TAU + r() * 0.5, off = i === 0 ? 0 : (0.35 + r() * 0.5) * s, height = (i === 0 ? 14 : 6 + r() * 8) * s;
    const trunk = palmTrunk(group, r, { at: new THREE.Vector3(Math.cos(a) * off, 0, Math.sin(a) * off), az: a, height, base: 0.09 * s, top: 0.075 * s, lean: i === 0 ? 0.03 : 0.08 + r() * 0.08, bend: 0.06, rings: 3 / s, bark: 0x77705e, barkLight: 0xa09a84, flare: 0.3, sides: 8 });
    const low = trunk.top.clone().addScaledVector(trunk.dir, -1.1 * s), high = trunk.top.clone().addScaledVector(trunk.dir, 0.1 * s);
    addMesh(group, tube([low, low.clone().lerp(high, 0.5), high], [0.085 * s, 0.1 * s, 0.07 * s], 8, (c, t) => c.copy(shaftDark).lerp(shaftLight, t)), barkMat, 'bark');
    if (leaves) for (let k = 0, n = lite ? 5 : 9; k < n; k++) {
      pinnateFrond(parts, r, high, k * 2.39996 + r() * 0.3, { length: (2.4 + r() * 0.5) * s, rise: 0.9 - k / n * 0.5, droop: 1.05 + k / n * 0.4, leaflets: 24, leafLen: 0.8 * s, leafWidth: 0.045, drop: 1.4, color: k % 2 ? 0x4d8a34 : 0x5a963a, lite, low });
    }
    if (fruit && i < 3) {
      const at = low.clone().addScaledVector(trunk.dir, -0.05 * s), turn = a + 1.4;
      for (let k = 0, n = lite ? 4 : 9; k < n; k++) {
        const ang = turn + (k - n / 2) * 0.18, strand = [];
        for (let j = 0; j <= 5; j++) { const t = j / 5; strand.push(new THREE.Vector3(at.x + Math.cos(ang) * (0.12 + t * 0.18) * s, at.y - t * 0.85 * s, at.z + Math.sin(ang) * (0.12 + t * 0.18) * s)); }
        parts.fruit.push(tube(strand, strand.map(() => 0.008 * s), 3, c => c.set(0x8a6a3a)));
        for (let j = 1; j <= 5; j++) for (let m = 0; m < 5; m++) {
          const berry = new THREE.SphereGeometry(0.03 * s, 5, 4), p = strand[j];
          paint(berry, c => c.set(m % 2 ? 0x3a1f3a : 0x4f2a4a));
          berry.translate(p.x + (r() - 0.5) * 0.06, p.y - 0.03, p.z + (r() - 0.5) * 0.06); parts.fruit.push(berry);
        }
      }
    }
  }
  if (leaves) for (let i = 0; i < 3; i++) {   // pups at the foot of the clump
    const a = r() * TAU, at = new THREE.Vector3(Math.cos(a) * 0.9 * s, 0.25 * s, Math.sin(a) * 0.9 * s);
    for (let k = 0; k < 3; k++) pinnateFrond(parts, r, at, a + (k - 1) * 0.9, { length: 1.3 * s, rise: 1.4, droop: 1, leaflets: 12, leafLen: 0.45 * s, leafWidth: 0.06, drop: 0.9, color: 0x63a040, lite, low });
  }
  return finishTree(group, parts, 'manaca', { crownRadius: 3.2 * s, petals: null });
}

// Helecho arborescente: a hairy brown stem, a crown of fine arching fronds,
// dry fronds hanging below and curled fiddleheads on top.
export function treeFern({ seed = 1, detail = 'game', leaves = true, scale = 1 } = {}) {
  const r = rng(seed), s = scale, level = treeDetail(detail), lite = level !== 'full', low = level === 'low' || level === 'far', group = new THREE.Group(), parts = newParts();
  const trunk = palmTrunk(group, r, { height: (5 + r() * 1.8) * s, base: 0.2 * s, top: 0.16 * s, lean: 0.07, bend: 0.06, rings: 7 / s, bark: 0x4a3a2c, barkLight: 0x6e573f, scar: 0.35, flare: 0.5, sides: 10 });
  if (leaves) {
    for (let i = 0, n = lite ? 10 : 17; i < n; i++) {
      const t = i / n, dry = i >= n - 3 ? 0.85 : 0;
      pinnateFrond(parts, r, trunk.top, i * 2.39996 + r() * 0.3, { length: (2.7 + r() * 0.6) * s * (dry ? 0.8 : 1), rise: dry ? -0.6 : 1 - t * 0.75, droop: dry ? 0.6 : 1 + t * 0.5, leaflets: 30, leafLen: 0.8 * s, leafWidth: 0.12, drop: 0.12, color: i % 2 ? 0x5d9b3c : 0x6aa843, dry, lite, low });
    }
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + r(), curl = new THREE.TorusGeometry(0.1 * s, 0.025 * s, 5, 12, Math.PI * 1.6);
      paint(curl, c => c.set(0x7f7a3a)); curl.rotateY(a);
      curl.translate(trunk.top.x + Math.cos(a) * 0.12 * s, trunk.top.y + 0.25 * s, trunk.top.z + Math.sin(a) * 0.12 * s);
      parts.leaves.push(curl);
    }
  }
  return finishTree(group, parts, 'treeFern', { crownRadius: 3 * s, petals: null });
}
