// Overgrown Maya-style temple pieces for jungle tracks: a corbel-arch portal
// draped in lianas and roots with a small carved jaguar relief on the
// lintel (never a giant head), and a stepped pyramid. Metres, +Y up, ground
// origin, +Z front.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/models/core/primitives.js';
import { jaguarRelief } from '/engine/models/props/jaguar-stone.js';
import { waterPool } from '/engine/models/effects/water-surface.js';

const STONE = [0xc9b388, 0xb9a27a, 0xd8c497, 0xa8956f].map(c => M(c, { roughness: 1 }));
const MOSS = M(0x63b347, { roughness: 1 }), LEAF = M(0x4f9e3c, { roughness: .9 }), ROOT = M(0x7a5a3a, { roughness: 1 });
const GOLD = M(0xf2c14e, { roughness: .35, metalness: .4, emissive: 0x6a4a10, emissiveIntensity: .35 });

// A hanging liana: a sagging tube between two points with leaf blobs.
function liana(group, a, b, sag, seed) {
  const r = rng(seed), mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(.5); mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  group.add(mesh(new THREE.TubeGeometry(curve, 16, .12, 5, false), LEAF));
  for (let i = 1; i < 12; i++) {
    const p = curve.getPoint(i / 12), leaf = mesh(new THREE.SphereGeometry(1, 6, 4), i % 3 ? LEAF : MOSS, p.x + (r() - .5) * .5, p.y - .2, p.z + (r() - .5) * .4);
    leaf.scale.set(.55, .22, .4); leaf.rotation.set(r(), r() * 3, r()); group.add(leaf);
  }
  // A few strands drop from the swag.
  for (let i = 0; i < 3; i++) {
    const p = curve.getPoint(.2 + i * .3), len = 2 + r() * 3.5;
    group.add(tube([p.x, p.y, p.z], [p.x + (r() - .5) * .4, p.y - len, p.z + (r() - .5) * .4], .06, LEAF));
    const tip = mesh(new THREE.SphereGeometry(.35, 6, 4), MOSS, p.x, p.y - len, p.z); tip.scale.y = .6; group.add(tip);
  }
}

// Overgrown corbel-arch portal, local x across the road, +z toward the
// approaching car. Opening 2·span wide and 11 m to the corbel.
export function mayaPortal({ span = 12, seed = 61 } = {}) {
  const g = new THREE.Group(), r = rng(seed), stone = () => STONE[Math.floor(r() * 4)];
  // Jambs of coursed blocks, then corbel courses stepping inward.
  for (let row = 0; row < 7; row++) for (const side of [-1, 1]) {
    g.add(box(3.2 + r() * .2, 1.55, 4.6, stone(), side * (span + 1.6), row * 1.6 + .8, 0));
    g.add(box(6, 1.55, 4.2, stone(), side * (span + 6.2), row * 1.6 + .8, -.3));
  }
  for (let k = 0; k < 4; k++) for (const side of [-1, 1]) {
    const inner = span - k * 1.8, outer = span + 9;
    g.add(box(outer - inner, 1.4, 4.4 - k * .2, stone(), side * (inner + outer) / 2, 11.9 + k * 1.45, 0));
  }
  // Lintel with a step-fret frieze and a small jaguar relief in its centre.
  const top = 11.2 + 4 * 1.45;
  g.add(box(span * 2 + 19, 2.6, 5, STONE[1], 0, top + 1.3, 0));
  for (let i = -6; i <= 6; i++) if (Math.abs(i) > 1) {
    g.add(box(1.6, .5, .3, STONE[2], i * 2.4, top + .7, 2.6), box(.5, 1.1, .3, STONE[2], i * 2.4 + .55, top + 1.25, 2.6));
  }
  const relief = jaguarRelief({ width: 5.4, height: 2.3, depth: .5, seed: seed + 3 }); relief.position.set(0, top + .15, 2.3); g.add(relief);
  // Roof comb: receding tiers with jade studs.
  for (let k = 0; k < 3; k++) g.add(box(span * 2 + 12 - k * 7, 1.5, 4 - k * .6, stone(), 0, top + 3.35 + k * 1.5, -.3));
  for (const x of [-6, 0, 6]) g.add(box(1, 1, .4, M(0x3fbf9a, { roughness: .5, emissive: 0x145a44, emissiveIntensity: .4 }), x, top + 4.9, 1.85));
  // Moss on every top, roots down the jambs, lianas across the front.
  for (let i = 0; i < 26; i++) {
    const x = (r() - .5) * (span * 2 + 18), y = r() < .5 ? top + 2.65 : 11.2 + Math.floor(r() * 4) * 1.45;
    if (Math.abs(x) < span - 1 && y < top) continue;
    const pad = mesh(new THREE.SphereGeometry(1, 7, 5), MOSS, x, y, (r() - .3) * 3); pad.scale.set(1.2 + r() * 1.6, .35, 1 + r()); g.add(pad);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = side * (span + .2 + r() * 2.6), y0 = 11 + r() * 5, z = 2.2 + r() * .6;
    const pts = [[x, y0, z], [x + side * r(), y0 * .6, z + .3], [x + side * (.5 + r() * 1.5), y0 * .25, z + .4], [x + side * (1.5 + r() * 2), 0, z + .8 + r()]];
    for (let k = 1; k < pts.length; k++) g.add(tube(pts[k - 1], pts[k], .28 - k * .05, ROOT));
  }
  for (let i = 0; i < 4; i++) {
    const x0 = -span - 6 + i * (span * 2 + 12) / 4, x1 = x0 + (span * 2 + 12) / 4;
    liana(g, new THREE.Vector3(x0, top - .2, 2.7), new THREE.Vector3(x1, top - .2, 2.7), 2 + r() * 2.5, seed + i);
  }
  g.name = 'maya-portal'; g.userData.previewBounds = [[-span - 10, 0, -3], [span + 10, 24, 4]];
  return g;
}

// A five-tier temple pyramid, 26 m square, stairs on +Z and a shrine with a
// gilded roof on top.
export function steppedPyramid({ seed = 61 } = {}) {
  const g = new THREE.Group(), r = rng(seed);
  for (let tier = 0; tier < 5; tier++) {
    const size = 26 - tier * 4.4;
    g.add(box(size, 2.3, size, STONE[tier % 2 ? 1 : 0], 0, tier * 2.4 + 1.15, 0));
    g.add(box(size + .5, .3, size + .5, STONE[2], 0, tier * 2.4 + 2.35, 0));
    for (let i = 0; i < 6; i++) { const pad = mesh(new THREE.SphereGeometry(1, 6, 4), MOSS, (r() - .5) * size, tier * 2.4 + 2.45, (r() - .5) * size); pad.scale.set(1 + r(), .25, 1 + r()); g.add(pad); }
  }
  for (let i = 0; i < 22; i++) g.add(box(5, .55, .9, STONE[2], 0, .28 + i * .55, 13.4 - i * .55));
  g.add(box(7, 4, 6, STONE[1], 0, 14, 0), box(9, .8, 8, GOLD, 0, 16.4, 0), box(2.6, 3, .2, M(0x2e3d33), 0, 13.5, 3.05));
  g.name = 'stepped-pyramid'; g.userData.previewBounds = [[-14, 0, -14], [14, 18, 15]];
  return g;
}

// A round sinkhole pool ringed with dressed stones and moss. The water is the
// shared animated pool surface; userData.tick drives it.
export function cenote({ radius = 9, seed = 63, color = 0x2fc6c0 } = {}) {
  const g = new THREE.Group(), r = rng(seed), water = waterPool(radius, radius, { color, depth: 4 });
  water.position.y = .12; g.add(water);
  const stones = Math.round(radius * 1.8);
  for (let i = 0; i < stones; i++) {
    const a = i / stones * Math.PI * 2, s = box(2.2, .9, 1.4, STONE[i % 4], Math.cos(a) * (radius + 1), .3, Math.sin(a) * (radius + 1));
    s.rotation.y = -a; g.add(s);
    if (r() < .4) { const pad = mesh(new THREE.SphereGeometry(1, 6, 4), MOSS, Math.cos(a) * (radius + 1), .8, Math.sin(a) * (radius + 1)); pad.scale.set(.9, .25, .7); g.add(pad); }
  }
  g.name = 'cenote'; g.userData.tick = t => water.userData.tick(t);
  g.userData.previewBounds = [[-radius - 2.5, 0, -radius - 2.5], [radius + 2.5, 2, radius + 2.5]];
  return g;
}
