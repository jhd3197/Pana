import * as THREE from 'three';

// Aiming guides drawn on the ground (Billar's cloth, the criollas court).
// WebGL lines are one pixel wide, far too faint seen from behind the ball,
// so guides are flat strips. Points are world {x, z}; height is world Y.
export function guideRibbon(color, width, { opacity = .92, segments = 8 } = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 4 * 3), 3));
  const index = []; for (let i = 0; i < segments; i++) { const o = i * 4; index.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'Aim guide';
  mesh.userData.set = (points, height) => {
    const p = geometry.attributes.position; let n = 0;
    for (let i = 0; i + 1 < points.length && n < segments; i++) {
      const a = points[i], b = points[i + 1], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
      if (l < 1e-4) continue;
      const sx = -dz / l * width / 2, sz = dx / l * width / 2, o = n * 4;
      p.setXYZ(o, a.x + sx, height, a.z + sz); p.setXYZ(o + 1, a.x - sx, height, a.z - sz);
      p.setXYZ(o + 2, b.x + sx, height, b.z + sz); p.setXYZ(o + 3, b.x - sx, height, b.z - sz); n++;
    }
    geometry.setDrawRange(0, n * 6); p.needsUpdate = true; mesh.visible = n > 0;
  };
  mesh.userData.dispose = () => { geometry.dispose(); mesh.material.dispose(); };
  return mesh;
}

export const pathLength = points => points.reduce((sum, p, i) => i ? sum + Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z) : 0, 0);

// The first `length` metres of a {x, z} polyline.
export function trimPath(points, length) {
  if (!points.length) return [];
  const out = [points[0]];
  for (let i = 1; i < points.length && length > 0; i++) {
    const a = out.at(-1), b = points[i], l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l <= length) { out.push(b); length -= l; } else { out.push({ x: a.x + (b.x - a.x) * length / l, z: a.z + (b.z - a.z) * length / l }); length = 0; }
  }
  return out;
}
