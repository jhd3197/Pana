// Shared foliage, originally built for Bululu, plus bake(): merges scenery into one mesh
// per material, so hundreds of trees cost a handful of draw calls.

import * as THREE from 'three';
import { M, mesh, makeMango, rng } from '/engine/props.js';
import { leafBlade, taperedStem } from './botanical-shapes.js';
import { bake } from './static-batch.js';
export { casita } from './island-house.js';
export { bake } from './static-batch.js';
export { araguaney, bamboo, fern, monstera, heliconia, cactus, mangrove, papaya, agave, waterLily, hibiscus, reeds, jungleGiant, tropicalBush } from './flora-species.js';

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

// Round mango tree: chunky trunk, a cloud of leaves, a few ripe mangos.
export function mangoTree({ seed = 1, h = 3.2, fruit = true } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(branch([0, 0, 0], [0.2, h, 0], 0.38, 0.19));
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.4 + seed;
    g.add(mesh(taperedStem([[Math.cos(a) * 0.65, 0.035, Math.sin(a) * 0.65], [Math.cos(a) * 0.3, 0.18, Math.sin(a) * 0.3], [0.02, 0.65, 0]], 0.045, 0.12, 5, 6), bark));
  }
  const tint = [0x64a847, 0x76ac49, 0x4f9b48][seed % 3];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    const rr = 0.95 + r() * 0.35;
    const x = Math.cos(a) * 1.05, z = Math.sin(a) * 1.05, y = h + 0.45 + r() * 0.65;
    g.add(branch([0.1, h * 0.6, 0], [x, y, z], 0.16, 0.06));
    const pad = leafyCushion(rr, seed + i, tint); pad.position.set(x, y, z); pad.scale.y = 0.82; g.add(pad);
    for (let j = 0; j < 3; j++) {
      const turn = a + j * Math.PI * 2 / 3, px = x + Math.cos(turn) * rr * 0.65, pz = z + Math.sin(turn) * rr * 0.65;
      const tuft = leafyCushion(0.58 + j * 0.06, seed + i + j, j % 3 ? tint : 0x79a448, true);
      tuft.position.set(px, y + rr * 0.1, pz); tuft.scale.y = 0.85; g.add(tuft);
      leafSprig(g, px, y + rr * 0.54, pz, -turn, 0.4, seed + i * 6 + j, tint);
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + seed, top = leafyCushion(0.95, seed + 20 + i, tint);
    top.position.set(Math.cos(a) * 0.6, h + 1.2 + i * 0.15, Math.sin(a) * 0.6); top.scale.set(1, 0.85, 0.95); g.add(top);
  }
  if (fruit) {
    for (let i = 0; i < 5; i++) {
      const m = makeMango();
      m.scale.setScalar(0.4);
      const a = i * 2.4 + seed, y = h + (i % 3) * 0.22;
      m.position.set(Math.cos(a) * 1.72, y, Math.sin(a) * 1.72); m.rotation.z = Math.sin(a) * 0.3;
      g.add(branch([m.position.x, y + 0.22, m.position.z], [m.position.x * 0.85, y + 0.65, m.position.z * 0.85], 0.012, 0.018));
      g.add(m);
    }
  }
  const result = bake(g); result.name = 'mangoTree'; g.traverse(o => o.geometry?.dispose()); return result;
}

// Smaller scallops and leaf tips give these crowns a readable plant silhouette.
const bladeMat = M(0xffffff, { vertexColors: true, side: THREE.DoubleSide, flatShading: false, roughness: 1 });
function leafyCushion(size, seed, tint, small = false) {
  const geo = new THREE.SphereGeometry(1, small ? 12 : 20, small ? 8 : 14), p = geo.attributes.position, colors = [];
  const dark = new THREE.Color(0x24543a), light = new THREE.Color(tint);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const scallop = 1 + 0.07 * Math.sin(x * 5 + seed) * Math.sin(z * 5 - seed) + 0.035 * Math.cos(y * 7 + x * 3);
    p.setXYZ(i, x * size * scallop, y * size * scallop, z * size * scallop);
    const shade = THREE.MathUtils.clamp(0.56 + y * 0.36 + Math.sin(x * 12 + z * 9 + seed) * 0.04, 0, 1);
    const c = dark.clone().lerp(light, shade); colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  return mesh(geo, leafMat);
}
function leafSprig(group, x, y, z, angle, size, seed, tint) {
  for (let j = -1; j <= 1; j++) {
    const leaf = mesh(leafBlade(size * (j ? 0.8 : 1), size * 0.27, size * 0.2, tint, 6), bladeMat, x, y + Math.abs(j) * 0.025, z);
    leaf.rotation.set(0.5 + 0.15 * Math.sin(seed + j), angle + j * 0.65, 0.22 + Math.sin(seed) * 0.18); group.add(leaf);
  }
}

// Ceiba: flared roots flow into the trunk; curved forks support a spreading crown.
export function ceiba({ seed = 1 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const h = 5.7 + r() * 2.2;
  const lean = (r() - 0.5) * 0.7;
  const trunk = new THREE.CylinderGeometry(1, 1, 1, 20, 12), p = trunk.attributes.position, colors = [];
  const low = new THREE.Color(0x756746), high = new THREE.Color(0xb8a37a);
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5, x = p.getX(i), z = p.getZ(i), angle = Math.atan2(z, x);
    const flute = Math.pow(Math.max(0, Math.cos(angle * 5 + seed)), 4);
    const radius = 0.64 - t * 0.37 + Math.pow(1 - t, 6) * (0.16 + flute * 1.05) + Math.sin(t * Math.PI) * 0.1;
    p.setXYZ(i, x * radius + lean * t * t, t * h, z * radius + Math.sin(t * Math.PI * 0.6) * 0.18);
    const color = low.clone().lerp(high, 0.38 + t * 0.4 + Math.cos(angle * 5 + seed) * 0.08);
    colors.push(color.r, color.g, color.b);
  }
  trunk.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); trunk.computeVertexNormals();
  g.add(mesh(trunk, M(0xffffff, { vertexColors: true, flatShading: false, roughness: 1 })));
  const tint = [0x78a84a, 0x629e48, 0x8ab252][Math.abs(seed) % 3];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.35;
    const reach = 1.95 + r() * 0.5;
    const x = Math.cos(a) * reach, z = Math.sin(a) * reach;
    const y = h + r() * 0.65, size = 1.35 + r() * 0.4;
    g.add(mesh(taperedStem([[lean * 0.5, h * 0.61, 0.13], [x * 0.5, h * 0.92, z * 0.5], [x, y, z]], 0.3, 0.07, 7, 8), paleBark));
    const canopy = leafyCushion(size, seed + i, tint); canopy.position.set(x, y + 0.45, z); canopy.scale.set(1.12, 0.72, 1); g.add(canopy);
    const edge = leafyCushion(size * 0.55, seed + i + 12, tint, true); edge.position.set(x * 1.35, y + 0.08, z * 1.35); edge.scale.y = 0.75; g.add(edge);
    leafSprig(g, x * 1.35, y + size * 0.55, z * 1.35, -a, 0.72, seed + i, 0x629238);
  }
  const top = leafyCushion(1.95, seed + 31, tint); top.position.set(lean, h + 1.15, 0); top.scale.set(1.1, 0.76, 1); g.add(top);
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
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.36, h, 12, 18);
  const p = trunkGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h;
    p.setXYZ(i, p.getX(i) + dx * t * t, p.getY(i) + h / 2, p.getZ(i) + dz * t * t);
  }
  trunkGeo.computeVertexNormals();
  g.add(mesh(trunkGeo, bark));
  const collar = M(0xb69a6a, { roughness: 1, flatShading: false });
  for (let i = 1; i < 20; i++) {
    const t = i / 21;
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
        const leaf = mesh(ribbon(leafletLength * (1 + side * 0.06), 0.16, 0.04, 0.24 + t * 0.2, k, 5), frondMats[(i + k) % 3], t * length, Math.sin(t * Math.PI * 0.85) * rise - t * t * droop, 0);
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
  // Upright new growth breaks the flat umbrella silhouette.
  for (let i = 0; i < 3; i++) {
    const spear = mesh(leafBlade(1.45, 0.16, 0.2, 0x92b854, 7), bladeMat, dx, h - 0.1, dz);
    spear.rotation.set(0, i * 2.1, 1.0); g.add(spear);
  }
  const result = bake(g); result.name = 'palm'; g.traverse(o => o.geometry?.dispose()); return result;
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

// Low branching shrub with overlapping leaf pads and folded new growth.
export function bush({ seed = 1, flowers = false } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const pads = [[-0.55, 0.49, 0.06, 0.68], [0.5, 0.5, 0.12, 0.72], [0, 0.79, -0.16, 0.67], [-0.05, 0.39, 0.56, 0.51], [0.22, 0.46, -0.63, 0.55]];
  pads.forEach(([x, y, z, size], i) => {
    const pad = leafyCushion(size, seed + i, [0x689e42, 0x80ae4b, 0x92ba55][i % 3]);
    pad.position.set(x, y, z); pad.scale.set(1, 0.68, 0.95); g.add(pad);
    if (i < 3) g.add(mesh(taperedStem([[0, 0, 0], [x * 0.4, 0.28, z * 0.4], [x, y, z]], 0.045, 0.014, 4, 5), bark));
    leafSprig(g, x * 1.1, y + size * 0.66, z * 1.1, r() * Math.PI * 2, 0.36 + r() * 0.12, seed + i, 0x8dbd52);
    for (let j = 0; j < 3; j++) {
      const a = j * Math.PI * 2 / 3 + i;
      const leaf = mesh(leafBlade(0.4, 0.14, 0.07, 0x528a38, 6), bladeMat,
        x + Math.cos(a) * size * 0.75, y + size * 0.47, z + Math.sin(a) * size * 0.75);
      leaf.rotation.set(0, -a, -0.4); g.add(leaf);
    }
  });
  if (flowers) {
    const tint = [0xf29eae, 0xffd364, 0xf28a50, 0xfff0d4][Math.floor(r() * 4)];
    const centerMat = M(0xe5a632, { flatShading: false, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const [x, y, z, size] = pads[i], flower = new THREE.Group();
      flower.position.set(x + (r() - 0.5) * 0.2, y + size * 0.68 + 0.02, z);
      flower.rotation.set((r() - 0.5) * 0.6, r() * Math.PI * 2, (r() - 0.5) * 0.5);
      for (let j = 0; j < 5; j++) {
        const petal = mesh(leafBlade(0.23, 0.12, 0.055, tint, 6), bladeMat);
        petal.rotation.y = j / 5 * Math.PI * 2; flower.add(petal);
      }
      const center = mesh(new THREE.SphereGeometry(0.07, 8, 5), centerMat, 0, 0.035, 0); center.scale.y = 0.55;
      flower.add(center); g.add(flower);
    }
  }
  return g;
}
