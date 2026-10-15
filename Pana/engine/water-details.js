// Shared fountain/waterfall motion. Absolute time keeps Studio thumbnails and
// paused previews deterministic; instances keep spray and ripples to two draws.
import * as THREE from 'three';

export function addWaterMotion(root, impacts, curves = []) {
  const group = new THREE.Group(); group.name = 'Water ripples and droplets'; root.add(group);
  const material = new THREE.MeshStandardMaterial({ color: 0xc8f1e9, roughness: 0.25, transparent: true, opacity: 0.62, depthWrite: false });
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.016, 4, 28), material, impacts.length * 2);
  rings.frustumCulled = false; group.add(rings);
  const drops = curves.length ? new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), material, curves.length * 5) : null;
  if (drops) { drops.frustumCulled = false; group.add(drops); }
  const pose = new THREE.Object3D(), point = new THREE.Vector3();
  const update = t => {
    impacts.forEach(([x, y, z, radius = 0.45], i) => {
      for (let j = 0; j < 2; j++) {
        const phase = ((t * 0.6 + i * 0.17 + j * 0.5) % 1 + 1) % 1;
        pose.position.set(x, y, z); pose.rotation.set(-Math.PI / 2, 0, 0);
        pose.scale.set(radius * (0.15 + phase), radius * (0.15 + phase), 1 - phase * 0.9);
        pose.updateMatrix(); rings.setMatrixAt(i * 2 + j, pose.matrix);
      }
    });
    rings.instanceMatrix.needsUpdate = true;
    if (drops) {
      curves.forEach((curve, i) => {
        for (let j = 0; j < 5; j++) {
          const phase = ((t * 0.75 + j / 5 + i * 0.13) % 1 + 1) % 1;
          curve.getPoint(phase, point); pose.position.copy(point); pose.rotation.set(0, 0, 0);
          pose.scale.set(0.7, 1.3, 0.7); pose.updateMatrix(); drops.setMatrixAt(i * 5 + j, pose.matrix);
        }
      });
      drops.instanceMatrix.needsUpdate = true;
    }
  };
  update(0); return update;
}
