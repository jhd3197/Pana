import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '/engine/models/core/primitives.js';

// Many copies of one library bird (scarletMacaw, scarletIbis, …) flying in
// V-shaped flocks around orbit centres. Each direct child of the bird (its
// body and the two wings) becomes one instanced, vertex-coloured mesh, so a
// whole species costs three draws. The bird's own userData.tick still poses
// the wings; every instance replays it at its own phase.
//
//   birdFlock(scarletMacaw({detail:'low'}), { routes: [{cx, cz, cy, r, speed}], size: 5 })
export function birdFlock(prototype, { routes = [], size = 5, seed = 7, scale = 1 } = {}) {
  const random = rng(seed), group = new THREE.Group(), count = routes.length * size;
  group.name = `${prototype.name || 'bird'} · bandada`;
  prototype.updateMatrixWorld(true);
  const parts = prototype.children.map(child => {
    const inverse = child.matrixWorld.clone().invert(), geos = [];
    child.traverse(o => {
      if (!o.isMesh) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
      g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      const c = (Array.isArray(o.material) ? o.material[0] : o.material).color || new THREE.Color(1, 1, 1);
      g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count * 3 }, (_, i) => c.toArray()[i % 3]), 3));
      geos.push(g);
    });
    const geometry = mergeGeometries(geos, false); geos.forEach(g => g.dispose());
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }), Math.max(1, count));
    // Decorative: never block camera, item or clearance rays.
    mesh.count = count; mesh.frustumCulled = false; mesh.castShadow = false; mesh.raycast = () => {}; mesh.name = `${group.name} · ${child.name || 'parte'}`; group.add(mesh);
    return { child, mesh };
  });
  const birds = Array.from({ length: count }, (_, i) => {
    const k = i % size;
    return { route: routes[Math.floor(i / size)], lag: k * .06, lateral: (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1.8, offset: random() * 10, bob: random() * 6.28 };
  });
  const pose = prototype.userData.tick, body = new THREE.Object3D(), m = new THREE.Matrix4();
  function tick(t) {
    birds.forEach((b, i) => {
      const R = b.route, dir = Math.sign(R.speed || 1), a = t * R.speed + (R.phase || 0) - b.lag * dir, r = R.r + b.lateral;
      body.position.set(R.cx + Math.cos(a) * r, R.cy + Math.sin(t * .8 + b.bob) * 1.2 + Math.abs(b.lateral) * .25, R.cz + Math.sin(a) * r);
      body.rotation.set(0, -a + (dir < 0 ? Math.PI : 0), -.12 * dir); body.scale.setScalar(scale); body.updateMatrix();
      pose?.(t + b.offset);
      for (const { child, mesh } of parts) { child.updateMatrix(); mesh.setMatrixAt(i, m.multiplyMatrices(body.matrix, child.matrix)); }
    });
    for (const { mesh } of parts) mesh.instanceMatrix.needsUpdate = true;
  }
  tick(0);
  group.userData.tick = tick;
  group.userData.dispose = () => parts.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.dispose(); });
  prototype.traverse(o => o.geometry?.dispose());
  return group;
}
