import * as THREE from 'three';
import { M, mesh } from '/engine/models/core/primitives.js';
import { leafBlade } from '/engine/models/core/botanical-shapes.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';

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
  return mesh(natureSurface(geo, 'foliage'), leafMat);
}

function branch(from, to, bottom, top, mat = bark) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const m = mesh(natureSurface(new THREE.CylinderGeometry(top, bottom, a.distanceTo(b), 8), 'bark'), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return m;
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
  return mesh(natureSurface(geo, 'foliage'), leafMat);
}
function leafSprig(group, x, y, z, angle, size, seed, tint) {
  for (let j = -1; j <= 1; j++) {
    const leaf = mesh(natureSurface(leafBlade(size * (j ? 0.8 : 1), size * 0.27, size * 0.2, tint, 6), 'foliage'), bladeMat, x, y + Math.abs(j) * 0.025, z);
    leaf.rotation.set(0.5 + 0.15 * Math.sin(seed + j), angle + j * 0.65, 0.22 + Math.sin(seed) * 0.18); group.add(leaf);
  }
}

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
  return natureSurface(geo, 'foliage');
}

const frondMats = [0x45934a, 0x65a64a, 0x86b657].map(color => M(color, { side: THREE.DoubleSide, flatShading: false, roughness: 1 }));
export { bark, paleBark, bladeMat, branch, leafyCushion, leafSprig, ribbon, frondMats };
