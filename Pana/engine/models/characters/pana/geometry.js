import * as THREE from 'three';
import { gameDetail, segments } from '/engine/models/characters/pana/detail.js';

export const signedPower = (v, power) => Math.sign(v) * Math.abs(v) ** power;

// Smooth, indexed surfaces with consistent winding, including their UV seam.
export function surface(fn, columns = 64, rows = 40) {
  const positions = [], uvs = [], indices = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    positions.push(...fn(i / columns, j / rows));
    uvs.push(i / columns, j / rows);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * (columns + 1) + i, b = a + columns + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Weld normals (not UVs) at the wrapped seam.
  const normals = g.attributes.normal;
  for (let j = 0; j <= rows; j++) {
    const a = j * (columns + 1), b = a + columns;
    const n = new THREE.Vector3().fromBufferAttribute(normals, a)
      .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
  }
  return g;
}

export function ellipsoidGeometry(x, y, z, power = 1, detail = 32) {
  detail = segments(detail);
  const g = new THREE.SphereGeometry(1, detail, Math.round(detail * 0.75));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i,
    signedPower(p.getX(i), power) * x,
    signedPower(p.getY(i), power) * y,
    signedPower(p.getZ(i), power) * z);
  g.computeVertexNormals(); return g;
}

export function mesh(parent, name, geometry, material, position = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material);
  item.name = name; item.position.set(...position);
  item.castShadow = true; item.receiveShadow = true;
  parent.add(item); return item;
}

export function ellipsoid(parent, name, material, position, scale, power = 1, detail = 32) {
  return mesh(parent, name, ellipsoidGeometry(...scale, power, detail), material, position);
}

export function curve(parent, name, points, radius, material, closed = false, segments = 48) {
  if (gameDetail()) segments = Math.max(8, Math.round(segments * 0.55));
  return mesh(parent, name, new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed),
    segments, radius, 8, closed), material);
}

export function ovalRing(parent, name, material, width, depth, y, radius, centerZ = 0) {
  return curve(parent, name, Array.from({ length: 64 }, (_, i) => {
    const t = i / 64 * Math.PI * 2;
    return [Math.sin(t) * width, y, Math.cos(t) * depth + centerZ];
  }), radius, material, true, 80);
}

// Shape surfaces conform to a sculpt instead of floating in front of it.
export function patch(parent, name, shape, material, depthAt, detail = 40) {
  const flat = new THREE.ShapeGeometry(shape, detail), p = flat.attributes.position;
  const positions = [], index = flat.index, divisions = gameDetail() ? 4 : 8;
  // ShapeGeometry triangulates only the outline. Subdivision lets the interior
  // follow the recess too, without long triangles cutting through the sculpt.
  for (let face = 0; face < index.count; face += 3) {
    const a = new THREE.Vector2(p.getX(index.getX(face)), p.getY(index.getX(face)));
    const b = new THREE.Vector2(p.getX(index.getX(face + 1)), p.getY(index.getX(face + 1)));
    const c = new THREE.Vector2(p.getX(index.getX(face + 2)), p.getY(index.getX(face + 2)));
    const point = (u, v) => {
      const x = a.x + (b.x - a.x) * u / divisions + (c.x - a.x) * v / divisions;
      const y = a.y + (b.y - a.y) * u / divisions + (c.y - a.y) * v / divisions;
      positions.push(x, y, depthAt(x, y));
    };
    for (let u = 0; u < divisions; u++) for (let v = 0; v < divisions - u; v++) {
      point(u, v); point(u + 1, v); point(u, v + 1);
      if (u + v < divisions - 1) { point(u + 1, v); point(u + 1, v + 1); point(u, v + 1); }
    }
  }
  flat.dispose();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const normals = [], epsilon = 0.0005;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1];
    const dx = (depthAt(x + epsilon, y) - depthAt(x - epsilon, y)) / (2 * epsilon);
    const dy = (depthAt(x, y + epsilon) - depthAt(x, y - epsilon)) / (2 * epsilon);
    normals.push(...new THREE.Vector3(-dx, -dy, 1).normalize().toArray());
  }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return mesh(parent, name, g, material);
}
