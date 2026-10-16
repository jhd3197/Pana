// Iguanas sunning around a map: lite models (two draw calls each, no
// shadow) on spots { x, y, z, rot } or, for a wall or trunk, { up, fwd } as
// vectors. Returns their group; call userData.tick(t) once a frame.
import * as THREE from 'three';
import { iguana } from '/engine/models/fauna/iguana.js';

const GREENS = [0x5fae3c, 0x6cb543, 0x58a046, 0x7a9f3e, 0x8a8f3a];

export function placeIguanas(parent, spots, { seed = 1, scale = 1, name = 'Iguanas' } = {}) {
  const group = new THREE.Group(); group.name = name;
  const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3(), m = new THREE.Matrix4();
  spots.forEach((s, i) => {
    const g = iguana({ seed: seed + i * 13, pose: s.pose || 'sun', color: GREENS[(seed + i) % GREENS.length], lite: true });
    g.position.set(s.x, s.y, s.z);
    if (s.up) {
      z.set(...s.fwd).normalize(); y.set(...s.up); y.addScaledVector(z, -y.dot(z)).normalize(); x.crossVectors(y, z);
      g.quaternion.setFromRotationMatrix(m.makeBasis(x, y, z));
    } else g.rotation.y = s.rot || 0;
    g.scale.setScalar(s.scale || scale);
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    g.userData.assetId = 'iguana';
    g.userData.footprintRadius = 0.7;
    group.add(g);
  });
  group.userData.tick = (t) => group.children.forEach((g, i) => g.userData.tick(t + i * 1.7));
  parent.add(group);
  return group;
}
