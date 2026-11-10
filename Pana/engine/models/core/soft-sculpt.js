// One watertight low-poly sculpt from a handful of soft ellipsoids: the way the chigüire, the pig and the duck
// are made. Each part: { at, size, p (2 round … 5 boxy), k (how far it melts into its neighbours), tilt (about X) }.
// The result is a plain BufferGeometry with vertex colours from paint(x, y, z, normal) and no index.
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

const scratch = new THREE.MeshBasicMaterial();
function distance(part, x, y, z) {
  let qx = x - part.at[0], qy = y - part.at[1], qz = z - part.at[2];
  if (part.tilt) { const c = Math.cos(part.tilt), s = Math.sin(part.tilt), ny = qy * c + qz * s; qz = qz * c - qy * s; qy = ny; }
  const [sx, sy, sz] = part.size, p = part.p ?? 2;
  if (p === 2) {
    const a = Math.hypot(qx / sx, qy / sy, qz / sz), b = Math.hypot(qx / (sx * sx), qy / (sy * sy), qz / (sz * sz));
    return a * (a - 1) / Math.max(b, 1e-5);
  }
  const n = (Math.abs(qx / sx) ** p + Math.abs(qy / sy) ** p + Math.abs(qz / sz) ** p) ** (1 / p);
  return (n - 1) * Math.min(sx, sy, sz);
}
export function softSculpt(parts, { resolution = 44, blend = .07, paint = null, floor = true } = {}) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) for (let i = 0; i < 3; i++) {
    const reach = Math.max(...part.size) * (part.tilt ? 1 : 0) + part.size[i] * (part.tilt ? 0 : 1);
    min[i] = Math.min(min[i], part.at[i] - reach); max[i] = Math.max(max[i], part.at[i] + reach);
  }
  const centre = min.map((v, i) => (v + max[i]) / 2), extent = min.map((v, i) => (max[i] - v) / 2 * 1.16 + .04);
  const mc = new MarchingCubes(resolution, scratch, false, false, 60000);
  mc.isolation = 0;
  for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const px = (x / resolution * 2 - 1) * extent[0] + centre[0], py = (y / resolution * 2 - 1) * extent[1] + centre[1], pz = (z / resolution * 2 - 1) * extent[2] + centre[2];
    let d = 10;
    for (const part of parts) {
      const next = distance(part, px, py, pz), k = part.k ?? blend, h = Math.max(k - Math.abs(d - next), 0) / k;
      d = Math.min(d, next) - h * h * k * .25;
    }
    mc.field[z * resolution * resolution + y * resolution + x] = -d;
  }
  mc.update();
  const count = mc.geometry.drawRange.count, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(mc.geometry.attributes.position.array.slice(0, count * 3), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(mc.geometry.attributes.normal.array.slice(0, count * 3), 3));
  mc.geometry.dispose();
  geo.scale(...extent); geo.translate(...centre);
  const p = geo.attributes.position, n = geo.attributes.normal;
  // The grid's gradient is in grid space: put the normals back in the model's.
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i) / extent[0], y = n.getY(i) / extent[1], z = n.getZ(i) / extent[2], l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
  if (floor) for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, 0);
  if (paint) {
    const colors = new Float32Array(p.count * 3), normal = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { normal.fromBufferAttribute(n, i); paint(p.getX(i), p.getY(i), p.getZ(i), normal).toArray(colors, i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}
// Small helpers the sculpted animals share.
export const mixer = () => { const out = new THREE.Color(); return (a, b, t) => out.copy(a).lerp(b, Math.min(1, Math.max(0, t))); };
export const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export function oval(parent, material, at, size, segments = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(6, segments - 2)), material);
  m.position.set(...at); m.scale.set(...size); m.castShadow = true; parent.add(m); return m;
}
