// Small procedural surfaces shared by fruit and foliage. Each call owns its geometry.
import * as THREE from 'three';

export function leafBlade(length, width, bend = 0.08, tint = 0x599b37, segments = 8) {
  const positions = [], colors = [], indices = [];
  const base = new THREE.Color(tint), dark = base.clone().multiplyScalar(0.64);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, w = Math.pow(Math.sin(Math.PI * t), 0.85) * width;
    for (let j = -1; j <= 1; j++) {
      positions.push(t * length, Math.sin(Math.PI * t) * bend - t * t * bend * 0.65 - Math.abs(j) * w * 0.22, j * w);
      const color = dark.clone().lerp(base, 0.58 + (1 - Math.abs(j)) * 0.32 + t * 0.1);
      colors.push(color.r, color.g, color.b);
    }
    if (i < segments) for (let j = 0; j < 2; j++) {
      const a = i * 3 + j;
      indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

export function taperedStem(points, radius, tip, segments = 8, sides = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segments, 1, sides, false), pos = geo.attributes.position;
  for (let i = 0; i <= segments; i++) {
    const center = curve.getPointAt(i / segments), r = THREE.MathUtils.lerp(radius, tip, i / segments);
    for (let j = 0; j <= sides; j++) {
      const k = i * (sides + 1) + j;
      pos.setXYZ(k, center.x + (pos.getX(k) - center.x) * r,
        center.y + (pos.getY(k) - center.y) * r, center.z + (pos.getZ(k) - center.z) * r);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
