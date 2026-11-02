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
  // `count` uses only the first points of a reused array.
  mesh.userData.set = (points, height, count = points.length) => {
    const p = geometry.attributes.position; let n = 0;
    for (let i = 0; i + 1 < count && n < segments; i++) {
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

// A thrown arc in the air (Pepazo's grenade): beads every `spacing` metres along
// a 3D polyline of {x, y, z}. A flat strip seen from behind the throw is edge-on;
// round beads read from any camera. One instanced mesh, nothing allocated per call.
export function guideBeads(color, { count = 40, size = .045, spacing = .8, opacity = .9 } = {}) {
  const geometry = new THREE.IcosahedronGeometry(size, 1);
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }), count);
  mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'Aim arc'; mesh.count = 0;
  const matrix = new THREE.Matrix4();
  mesh.userData.set = (points, n = points.length) => {
    let placed = 0, next = 0;
    for (let i = 0; i + 1 < n && placed < count; i++) {
      const a = points[i], b = points[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      for (; next < l && placed < count; next += spacing) {
        const k = next / l; matrix.makeTranslation(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k); mesh.setMatrixAt(placed++, matrix);
      }
      next -= l;
    }
    mesh.count = placed; mesh.instanceMatrix.needsUpdate = true; mesh.visible = placed > 0;
  };
  mesh.userData.dispose = () => { geometry.dispose(); mesh.material.dispose(); mesh.dispose(); };
  return mesh;
}

// A flat ring on the ground: where a throw ends and how far its blast reaches.
export function guideRing(color, { inner = .9, opacity = .85 } = {}) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 2; mesh.name = 'Aim ring'; mesh.visible = false;
  mesh.userData.set = (x, y, z, radius) => { mesh.position.set(x, y, z); mesh.scale.setScalar(radius); mesh.visible = true; };
  mesh.userData.dispose = () => { mesh.geometry.dispose(); mesh.material.dispose(); };
  return mesh;
}
