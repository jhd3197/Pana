import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { leafBlade } from '/engine/models/core/botanical-shapes.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

function ellipsoid(mat, [x, y, z], [sx, sy, sz], rx = 0, w = 18, h = 12) {
  const m = mesh(new THREE.SphereGeometry(1, w, h), mat, x, y, z);
  m.scale.set(sx, sy, sz); m.rotation.x = rx;
  return m;
}

// ---------- the four-legged capybara silhouette ----------
// Feet at y = 0, snout toward +Z, about 2.8 long and 1.6 tall at scale 1.
// Statues, topiary and souvenirs share these proportions.
const CAPY_PARTS = [
  { at: [0, 0.82, -0.12], size: [0.62, 0.58, 1.08] },        // barrel body
  { at: [0, 0.9, 0.45], size: [0.52, 0.52, 0.6] },            // shoulders
  { at: [0, 1.12, 0.91], size: [0.4, 0.39, 0.58] },          // broad, low head
  { at: [0, 1.0, 1.32], size: [0.36, 0.29, 0.34] },          // blunt snout
  ...[[0.38, 0.58], [0.4, -0.65]].flatMap(([x, z]) => [-1, 1].map(s => ({ at: [s * x, 0.33, z], size: [0.19, 0.33, 0.23] }))),
];

// One watertight sculpt, rather than intersecting balls. Cache only templates;
// every caller receives independent buffers, including the tiny souvenir toys.
const capyTemplates = new Map();
function capySculpt(detail) {
  const resolution = detail < 0.75 ? 24 : 40;
  if (!capyTemplates.has(resolution)) {
    const mc = new MarchingCubes(resolution, hedgeMat, false, false, 25000);
    mc.isolation = 0;
    const extent = [0.86, 1.0, 1.66], center = [0, 0.77, 0.22];
    for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
      const point = [x, y, z].map((v, i) => (v / resolution * 2 - 1) * extent[i] + center[i]);
      let distance = 10;
      for (const part of CAPY_PARTS) {
        const q = point.map((v, i) => v - part.at[i]);
        const a = Math.hypot(...q.map((v, i) => v / part.size[i]));
        const b = Math.hypot(...q.map((v, i) => v / part.size[i] ** 2));
        const d = a * (a - 1) / Math.max(b, 0.00001), blend = Math.max(0.13 - Math.abs(distance - d), 0) / 0.13;
        distance = Math.min(distance, d) - blend * blend * 0.0325;
      }
      mc.field[z * resolution * resolution + y * resolution + x] = -distance;
    }
    mc.update();
    const count = mc.geometry.drawRange.count, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(mc.geometry.attributes.position.array.slice(0, count * 3), 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(mc.geometry.attributes.normal.array.slice(0, count * 3), 3));
    geo.scale(...extent); geo.translate(...center); geo.computeBoundingBox(); geo.translate(0, -geo.boundingBox.min.y, 0);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, Math.max(0, positions.getY(i) - 0.025));
    mc.geometry.dispose(); capyTemplates.set(resolution, geo);
  }
  return capyTemplates.get(resolution).clone();
}

// Clipped-hedge ellipsoid: small leafy bumps and sun-to-shade vertex color.
const hedgeMat = M(0xffffff, { vertexColors: true, flatShading: false, roughness: 1 });
export function hedgeBlob([x, y, z], [sx, sy, sz], seed, tint, rx = 0) {
  const geo = new THREE.SphereGeometry(1, 30, 20), p = geo.attributes.position, colors = [];
  const shade = new THREE.Color(0x2a5f30), sun = new THREE.Color(tint), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const bump = Math.sin(v.x * 23 + seed) * Math.sin(v.y * 19 - seed) * Math.sin(v.z * 21 + seed * 0.5);
    v.multiplyScalar(1 + bump * 0.035); p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
    const c = shade.clone().lerp(sun, THREE.MathUtils.clamp(0.55 + v.y * 0.35 + bump * 0.18, 0, 1)); colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  const m = mesh(geo, hedgeMat, x, y, z); m.rotation.x = rx;
  return m;
}

export function capybaraForm(material, { eyes = null, leafy = false, seed = 1, tint = 0x5f9f47, detail = 1 } = {}) {
  const g = new THREE.Group(), geo = capySculpt(detail);
  if (leafy) {
    const p = geo.attributes.position, colors = [], dark = new THREE.Color(0x214c2f), light = new THREE.Color(tint);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), noise = Math.sin(x * 73 + seed) * Math.sin(z * 61 + y * 47);
      const c = dark.clone().lerp(light, THREE.MathUtils.clamp(0.25 + y * 0.43 + noise * 0.11, 0, 1)); colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const random = rng(seed), leaves = M(0xffffff, { vertexColors: true, side: THREE.DoubleSide, flatShading: false, roughness: 1 });
    const normal = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), normals = geo.attributes.normal;
    for (let i = 0; i < 480; i++) {
      const vertex = Math.floor(random() * p.count);
      normal.fromBufferAttribute(normals, vertex);
      if (normal.y < 0.15 || p.getY(vertex) < 0.6) continue;
      const leaf = mesh(leafBlade(0.09, 0.035, 0.015, i % 3 ? 0x4d853e : tint, 3), leaves, p.getX(vertex), p.getY(vertex), p.getZ(vertex));
      leaf.quaternion.setFromUnitVectors(up, normal); leaf.rotateY(random() * Math.PI * 2); g.add(leaf);
    }
  }
  g.add(mesh(geo, leafy ? hedgeMat : material));
  for (const s of [-1, 1]) {
    const at = [s * 0.3, 1.48, 0.75], size = [0.115, 0.135, 0.075];
    g.add(leafy ? hedgeBlob(at, size, seed + s, tint) : ellipsoid(material, at, size, -0.2, 12, 8));
    if (eyes) {
      g.add(ellipsoid(eyes, [s * 0.365, 1.26, 1.13], [0.04, 0.045, 0.04], 0, 8, 6));
      g.add(ellipsoid(eyes, [s * 0.15, 1.10, 1.625], [0.025, 0.018, 0.015], 0, 8, 6));
    }
  }
  return g;
}
