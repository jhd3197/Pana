// Shared foliage, originally built for Bululu, plus bake(): merges scenery into one mesh
// per material, so hundreds of trees cost a handful of draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, mesh, makeMango, rng } from '/engine/props.js';

// A small shared palette and smooth, gently lobed forms keep the island toy-like
// without turning every crown into the same faceted disk. Colors survive bake().
const leafMat = M(0xffffff, { vertexColors: true, flatShading: false, roughness: 1 });
const bark = M(0x88603d, { flatShading: false, roughness: 1 });
const paleBark = M(0x9b8057, { flatShading: false, roughness: 1 });
const crownGeo = new THREE.IcosahedronGeometry(1, 3);
const cp = crownGeo.attributes.position;
for (let i = 0; i < cp.count; i++) {
  const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
  const f = 1 + 0.035 * Math.sin(x * 7 + z * 3) * Math.cos(y * 6 - z * 4);
  cp.setXYZ(i, x * f, y * f, z * f);
}
// IcosahedronGeometry is non-indexed; radial normals avoid seams between faces.
const cn = crownGeo.attributes.normal;
for (let i = 0; i < cp.count; i++) {
  const n = new THREE.Vector3(cp.getX(i), cp.getY(i), cp.getZ(i)).normalize();
  cn.setXYZ(i, n.x, n.y, n.z);
}

export function foliage(radius, seed = 1, tint = 0x57a344) {
  const geo = crownGeo.clone();
  const p = geo.attributes.position, colors = [];
  const shade = new THREE.Color(0x245b38), sun = new THREE.Color(tint);
  for (let i = 0; i < p.count; i++) {
    const dapple = Math.sin(p.getX(i) * 8 + seed) * Math.cos(p.getZ(i) * 7 - seed) * 0.055;
    const c = shade.clone().lerp(sun, THREE.MathUtils.clamp(0.57 + p.getY(i) * 0.36 + dapple, 0, 1));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.scale(radius, radius, radius);
  return mesh(geo, leafMat);
}

function branch(from, to, bottom, top, mat = bark) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const m = mesh(new THREE.CylinderGeometry(top, bottom, a.distanceTo(b), 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return m;
}

function crown(group, x, y, z, size, seed, tint, sy = 0.85) {
  const m = foliage(size, seed, tint);
  m.position.set(x, y, z);
  m.scale.set(1, sy, 0.9 + (seed % 5) * 0.04);
  m.rotation.y = seed * 2.4;
  group.add(m);
}

// Round mango tree: chunky trunk, a cloud of leaves, a few ripe mangos.
export function mangoTree({ seed = 1, h = 3.2, fruit = true } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(branch([0, 0, 0], [0.2, h, 0], 0.38, 0.19));
  const tint = [0x64a847, 0x76ac49, 0x4f9b48][seed % 3];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    const rr = 1.05 + r() * 0.55;
    const x = Math.cos(a) * 1.05, z = Math.sin(a) * 1.05, y = h + 0.45 + r() * 0.65;
    g.add(branch([0.1, h * 0.6, 0], [x, y, z], 0.16, 0.06));
    crown(g, x, y, z, rr, seed + i, tint, 0.9);
  }
  crown(g, 0.1, h + 1.35, -0.15, 1.5, seed, tint, 1.05);
  if (fruit) {
    for (let i = 0; i < 4; i++) {
      const m = makeMango();
      m.scale.setScalar(0.4);
      const a = r() * Math.PI * 2;
      m.position.set(Math.cos(a) * 1.9, h + 0.1, Math.sin(a) * 1.9);
      g.add(m);
    }
  }
  return g;
}

// Ceiba: tapered buttress roots, visible forks and an irregular domed crown.
export function ceiba({ seed = 1 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const h = 5.7 + r() * 2.2;
  const lean = (r() - 0.5) * 0.7;
  g.add(branch([0, 0, 0], [lean, h, 0.15], 0.64, 0.28, paleBark));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + r() * 0.3;
    g.add(branch([Math.cos(a) * 1.05, 0.08, Math.sin(a) * 1.05], [lean * 0.2, 1.65, 0], 0.14, 0.34, paleBark));
  }
  const tint = [0x75a84d, 0x5f9d46, 0x8ab65b][seed % 3];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4;
    const reach = 1.8 + r() * 0.7;
    const x = Math.cos(a) * reach, z = Math.sin(a) * reach;
    const y = h + 0.25 + r() * 1.2, size = 1.3 + r() * 0.55;
    g.add(branch([lean, h * 0.65, 0], [x, y, z], 0.25, 0.09, paleBark));
    crown(g, x, y, z, size, seed + i, tint, 0.82 + r() * 0.2);
  }
  crown(g, lean, h + 1.25, 0, 2, seed + 31, tint, 0.95);
  return g;
}

// Mountain pine: gently scalloped, curved tiers instead of straight cones.
export function pine({ seed = 1, h = 6 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.28, h * 0.35, 6), M(0x6b4a2a, { roughness: 1 }), 0, h * 0.17, 0));
  const leaf = M(r() < 0.5 ? 0x367854 : 0x488b59, { roughness: 1, flatShading: false });
  for (let i = 0; i < 4; i++) {
    const s = 1 - i * 0.22, ht = h * 0.42;
    const points = [[0, 0], [1.6 * s, 0.07], [1.2 * s, ht * 0.28], [0.65 * s, ht * 0.64], [0, ht]].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(points, 12);
    const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const a = Math.atan2(p.getZ(j), p.getX(j));
      const f = 1 + Math.sin(a * 5 + seed + i) * 0.09;
      p.setXYZ(j, p.getX(j) * f, p.getY(j) + Math.sin(a * 6 + i) * 0.1 * s, p.getZ(j) * f);
    }
    geo.computeVertexNormals();
    g.add(mesh(geo, leaf, Math.sin(i + seed) * 0.12, h * (0.2 + i * 0.19), 0));
  }
  return g;
}

// Curved leaf ribbon, folded along its midrib. Used for banana leaves and
// the many tapered leaflets of a palm frond; never a rigid triangle fan.
function ribbon(length, width, rise, droop, seed = 0, n = 10) {
  const pos = [], indices = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = Math.pow(Math.sin(Math.PI * t), 0.8) * width;
    const y = Math.sin(t * Math.PI * 0.85) * rise - t * t * droop;
    for (let j = -1; j <= 1; j++) pos.push(t * length, y - Math.abs(j) * w * 0.16, j * w * (1 + Math.sin(t * 18 + seed) * 0.06));
    if (i < n) for (let j = 0; j < 2; j++) {
      const k = i * 3 + j;
      indices.push(k, k + 3, k + 1, k + 1, k + 3, k + 4);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const frondMats = [0x45934a, 0x65a64a, 0x86b657].map(color => M(color, { side: THREE.DoubleSide, flatShading: false, roughness: 1 }));

export function palm({ h = 8, seed = 1 } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const bend = 0.6 + r() * 1.1, turn = r() * Math.PI * 2;
  const dx = Math.cos(turn) * bend, dz = Math.sin(turn) * bend;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.36, h, 9, 10);
  const p = trunkGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h;
    p.setXYZ(i, p.getX(i) + dx * t * t, p.getY(i) + h / 2, p.getZ(i) + dz * t * t);
  }
  trunkGeo.computeVertexNormals();
  g.add(mesh(trunkGeo, bark));
  const collar = M(0xb69a6a, { roughness: 1, flatShading: false });
  for (let i = 1; i < 9; i++) {
    const t = i / 10;
    const ring = mesh(new THREE.TorusGeometry(0.36 - t * 0.18, 0.017, 3, 9), collar, dx * t * t, h * t, dz * t * t);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const n = 8 + seed % 3;
  for (let i = 0; i < n; i++) {
    const frond = new THREE.Group();
    frond.position.set(dx, h - 0.1, dz);
    frond.rotation.y = i / n * Math.PI * 2 + r() * 0.25;
    const length = 3.2 + r() * 1.2, rise = 0.8 + r() * 0.7, droop = 0.85 + r() * 0.75;
    frond.add(mesh(ribbon(length, 0.065, rise, droop), frondMats[2]));
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      const leafletLength = (0.35 + Math.sin(t * Math.PI) * 0.85) * (length / 3.7);
      for (const side of [-1, 1]) {
        const leaf = mesh(ribbon(leafletLength, 0.13, 0.04, 0.24 + t * 0.2, k, 3), frondMats[(i + k) % 3], t * length, Math.sin(t * Math.PI * 0.85) * rise - t * t * droop, 0);
        leaf.rotation.y = side * (0.9 + t * 0.35);
        frond.add(leaf);
      }
    }
    g.add(frond);
  }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    g.add(mesh(new THREE.SphereGeometry(0.24, 8, 6), M(0x73502c, { flatShading: false }), dx + Math.cos(a) * 0.28, h - 0.25, dz + Math.sin(a) * 0.28));
  }
  return g;
}

// Banana plant: a soft stem with broad, drooping leaves.
export function banana({ seed = 1 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6), M(0x6f9a3a, { roughness: 1 }), 0, 1.1, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.5;
    const arm = new THREE.Group();
    arm.position.y = 2.1;
    arm.rotation.set(0, -a, 0);
    const l = mesh(ribbon(2.3 + r() * 0.7, 0.48, 0.9, 0.8, seed + i), frondMats[i % 3]);
    arm.add(l);
    g.add(arm);
  }
  return g;
}

// A round bush, sometimes with flowers.
export function bush({ seed = 1, flowers = false } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    crown(g, (r() - 0.5) * 1.1, 0.45, (r() - 0.5) * 1.1, 0.6 + r() * 0.35, seed + i, 0x80b955);
  }
  if (flowers) {
    const petal = M(['#ff6fa5', '#ffd23f', '#ff8a1f', '#f3e9d7'][Math.floor(r() * 4)], { roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      g.add(mesh(new THREE.SphereGeometry(0.13, 5, 4), petal, (r() - 0.5) * 1.4, 0.8 + r() * 0.3, (r() - 0.5) * 1.4));
    }
  }
  return g;
}

// A little tropical house: colored walls, tin roof, lit window.
export function casita({ seed = 1 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const walls = ['#ff8a65', '#ffd54f', '#4fc3f7', '#aed581', '#f48fb1', '#fff3e0'][Math.floor(r() * 6)];
  g.add(mesh(new THREE.BoxGeometry(3.2, 2.4, 2.8), M(walls, { roughness: 0.9 }), 0, 1.2, 0));
  const roof = mesh(new THREE.ConeGeometry(2.7, 1.4, 4), M(r() < 0.5 ? 0xb5462f : 0x8a7a6a, { roughness: 0.8 }), 0, 3.1, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.2, 1, 1.05);
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(0.8, 1.5, 0.08), M(0x6b4226), 0.6, 0.75, 1.42));
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.6, 0.08), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb340, emissiveIntensity: 1.2 }), -0.8, 1.4, 1.42));
  return g;
}

// Merge every static mesh under `root` into one mesh per material.
// Meshes with texture maps keep their own (signs are few); everything else is
// vertex colors are retained for the foliage's top-to-bottom color variation.
export function bake(root, { cellSize = Infinity } = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (m.material.map || Array.isArray(m.material) || m.material.transparent) { keep.push(m); return; }
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.applyMatrix4(m.matrixWorld);
    // same look = same bucket, even when two builders made separate materials
    const mt = m.material;
    // Optional spatial buckets let large race environments cull distant
    // vegetation instead of submitting every tree in the world each frame.
    const cellX = Math.floor(m.matrixWorld.elements[12] / cellSize);
    const cellZ = Math.floor(m.matrixWorld.elements[14] / cellSize);
    const key = [cellX, cellZ, mt.type, mt.color?.getHex(), mt.emissive?.getHex(), mt.emissiveIntensity, mt.roughness, mt.metalness, mt.side, mt.flatShading, mt.vertexColors, !!geo.attributes.color, m.castShadow, m.receiveShadow].join('|');
    if (!buckets.has(key)) buckets.set(key, { mat: mt, geos: [], castShadow: m.castShadow, receiveShadow: m.receiveShadow });
    buckets.get(key).geos.push(geo);
  });
  const out = new THREE.Group();
  for (const { mat, geos, castShadow, receiveShadow } of buckets.values()) {
    const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
    merged.castShadow = castShadow;
    merged.receiveShadow = receiveShadow;
    out.add(merged);
    for (const g of geos) g.dispose();
  }
  for (const m of keep) {
    m.updateMatrixWorld(true);
    const clone = m.clone();
    m.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    out.add(clone);
  }
  return out;
}
