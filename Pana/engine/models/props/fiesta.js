// Fiesta dressing for race days and town parties: balloon bunches, feather
// flags, bunting, a checkered banner and a hot-air balloon. Each model is one
// or two vertex-coloured meshes (cloth and gloss), so a map can instance
// dozens of them for a few draws. Cloth sways with the shared plant wind.
// Ground origin, +Y up, +Z along the street/road. Metres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '/engine/models/core/primitives.js';
import { applyWindSway } from '/engine/models/vegetation/plant-kit.js';

export const FIESTA_COLORS = [0xff4f6d, 0xffc93c, 0x3ec1ff, 0x52d273, 0xb36bff, 0xff8a3d, 0xff6fb5];

const cloth = applyWindSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, side: THREE.DoubleSide }), .03);
const gloss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3 });
const balloonSkin = applyWindSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .28 }), .035);

const unit = {
  ball: () => new THREE.IcosahedronGeometry(1, 2),
  egg: () => new THREE.IcosahedronGeometry(1, 1),
  pole: () => new THREE.CylinderGeometry(1, 1, 1, 7),
  string: () => new THREE.CylinderGeometry(1, 1, 1, 3, 1, true),
  pennant: () => new THREE.ConeGeometry(1, 1, 3),
  box: () => new THREE.BoxGeometry(1, 1, 1),
  cone: () => new THREE.ConeGeometry(1, 1, 16, 1, true),
};
const tmp = new THREE.Object3D();
function part(parts, shape, color, [x, y, z], [sx, sy, sz] = [1, 1, 1], [rx, ry, rz] = [0, 0, 0], quaternion) {
  tmp.position.set(x, y, z); tmp.scale.set(sx, sy, sz);
  if (quaternion) tmp.quaternion.copy(quaternion); else tmp.rotation.set(rx, ry, rz);
  tmp.updateMatrix();
  // Colour functions see the unit shape's own coordinates (stripes, bands).
  // Icosahedra (ball, egg) come non-indexed already; converting them again only warns.
  const u = unit[shape](), g = u.index ? u.toNonIndexed() : u, c = new THREE.Color(), colors = [], p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { c.setHex(typeof color === 'function' ? color(p.getX(i), p.getY(i), p.getZ(i)) : color); colors.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.applyMatrix4(tmp.matrix);
  parts.push(g);
}
function link(parts, color, a, b, radius) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  part(parts, 'string', color, va.clone().add(vb).multiplyScalar(.5).toArray(), [radius, va.distanceTo(vb), radius], undefined, q);
}
function build(name, layers) {
  const group = new THREE.Group(); group.name = name;
  for (const [parts, material] of layers) {
    if (!parts.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(parts, false), material); parts.forEach(g => g.dispose());
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  return group;
}

// Six balloons tied to a little weight; the bunch bobs in the wind.
export function balloonBunch({ seed = 1, colors = FIESTA_COLORS } = {}) {
  const r = rng(seed), skin = [];
  part(skin, 'egg', 0xf3f0e6, [0, .3, 0], [.22, .3, .22]);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + r(), d = i ? .55 + r() * .3 : 0, x = Math.cos(a) * d, z = Math.sin(a) * d, y = 3.2 + (i ? r() * .7 : 1);
    link(skin, 0xffffff, [0, .6, 0], [x, y, z], .012);
    part(skin, 'ball', colors[(i + Math.floor(r() * 9)) % colors.length], [x, y + .3, z], [.42, .52, .42]);
    part(skin, 'pennant', colors[i % colors.length], [x, y - .24, z], [.06, .1, .06], [Math.PI, 0, 0]);
  }
  return build('balloon-bunch', [[skin, balloonSkin]]);
}

// Three tall feather flags in a row along +Z: a curved sail with a white
// swoosh near the pole and a white cap, so they read as flags, not boards.
function featherSail(parts, color, z, height) {
  const rows = 14, cols = 5, base = new THREE.Color(color), white = new THREE.Color(0xfffaf0), dark = base.clone().multiplyScalar(.72);
  const pos = [], colors = [], at = (u, v) => {
    // Width swells from the foot and rounds over the top like a feather.
    const w = 1.05 * Math.sin(Math.min(1, .25 + v * 1.1) * Math.PI * .5) * (v > .82 ? Math.sqrt(Math.max(0, 1 - ((v - .82) / .18) ** 2)) : 1) + .05;
    const x = .06 + u * w, y = height * (.3 + v * .66), curl = Math.sin(u * 2.2) * .12;
    const swoosh = Math.abs(u - (.22 + .12 * Math.sin(v * 5.5))) < .1, cap = v > .86;
    const c = (swoosh || cap ? white : base).clone().lerp(dark, u > .85 && !cap ? .5 : 0);
    return [[x, y, z + curl], c];
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const q = [at(i / cols, j / rows), at((i + 1) / cols, j / rows), at(i / cols, (j + 1) / rows), at((i + 1) / cols, (j + 1) / rows)];
    for (const k of [0, 1, 2, 2, 1, 3]) { pos.push(...q[k][0]); colors.push(q[k][1].r, q[k][1].g, q[k][1].b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2)); g.computeVertexNormals();
  parts.push(g);
}
export function fiestaFlags({ seed = 1, colors = FIESTA_COLORS, height = 5 } = {}) {
  const r = rng(seed), poles = [], sails = [], k = Math.floor(r() * colors.length);
  for (let j = 0; j < 3; j++) {
    const z = j * 2.2;
    part(poles, 'pole', 0xf4efe2, [0, height / 2, z], [.07, height, .07]);
    part(poles, 'egg', 0xffd23f, [0, height + .08, z], [.14, .14, .14]);
    featherSail(sails, colors[(k + j) % colors.length], z, height);
  }
  return build('fiesta-flags', [[poles, gloss], [sails, cloth]]);
}

// Two poles and a sagging line of triangular pennants along +Z.
export function buntingLine({ span = 20, seed = 1, colors = FIESTA_COLORS, height = 4.2 } = {}) {
  const r = rng(seed), poles = [], flags = [], n = Math.round(span / 1.1), shift = Math.floor(r() * colors.length);
  for (const z of [-span / 2, span / 2]) part(poles, 'pole', 0xf4efe2, [0, height / 2, z], [.09, height, .09]);
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, sag = Math.sin(t * Math.PI) * 1.1, z = -span / 2 + t * span, y = height - sag;
    part(flags, 'pennant', colors[(i + shift) % colors.length], [0, y - .38, z], [.36, .62, .06], [0, Math.PI / 2, Math.PI]);
    link(flags, 0xffffff, [0, y - .05, z - span / n / 2], [0, y - .05, z + span / n / 2], .015);
  }
  return build('bunting-line', [[poles, gloss], [flags, cloth]]);
}

// A black-and-white checkered race banner on two posts, facing ±X.
export function checkeredBanner({ width = 7, accent = 0xff4f6d } = {}) {
  const parts = [], h = 1.6, y0 = 2.2, cols = 12, rows = 3;
  for (const z of [-width / 2, width / 2]) part(parts, 'pole', accent, [0, (y0 + h) / 2, z], [.1, y0 + h + .2, .1]);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++)
    part(parts, 'box', (i + j) % 2 ? 0x22262e : 0xfbf7ee, [0, y0 + (j + .5) * h / rows, -width / 2 + (i + .5) * width / cols], [.08, h / rows, width / cols]);
  for (const y of [y0 - .12, y0 + h + .12]) part(parts, 'box', accent, [0, y, 0], [.12, .24, width + .2]);
  return build('checkered-banner', [[parts, gloss]]);
}

// A striped hot-air balloon with basket; origin at the basket floor.
export function hotAirBalloon({ seed = 1, colors = FIESTA_COLORS, size = 6 } = {}) {
  const r = rng(seed), a = colors[Math.floor(r() * colors.length)], b = colors[Math.floor(r() * colors.length)] === a ? 0xfffaf0 : colors[Math.floor(r() * colors.length)];
  const parts = [], s = size, stripe = (x, y, z) => y < -.7 ? 0xfff6e0 : Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 4)) % 2 ? a : b;
  part(parts, 'ball', (x, y, z) => stripe(x, y, z), [0, s * 1.75, 0], [s, s * 1.15, s]);
  part(parts, 'cone', a, [0, s * .55, 0], [s * .45, s * .5, s * .45], [Math.PI, 0, 0]);
  part(parts, 'box', 0x9a6a40, [0, s * .12, 0], [s * .3, s * .25, s * .3]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) link(parts, 0x6b4a30, [x * s * .14, s * .25, z * s * .14], [x * s * .32, s * .8, z * s * .32], .04);
  return build('hot-air-balloon', [[parts, gloss]]);
}
