// The camp at night. Placeholder floors until the full map lands.
import * as THREE from 'three';
import { campfire } from '/engine/models/props/llano-life.js';
import { ZONES, FIRE } from './layout.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
export const groundAt = () => 0;

export function createCampWorld() {
  const group = new THREE.Group(); group.name = '¡Embuste! · El campamento';
  for (const z of ZONES) {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(z.w, 0.4, z.d), mat(z.path ? 0x6b5a40 : 0x5d6b4c));
    floor.position.set(z.x, -0.2, z.z); floor.receiveShadow = true; group.add(floor);
  }
  const fire = campfire(); fire.position.set(FIRE.x, 0, FIRE.z); fire.scale.setScalar(1.6); group.add(fire);
  function update(t) { fire.userData.tick?.(t); }
  function dispose() { group.traverse(o => { o.geometry?.dispose(); if (o.material?.dispose) o.material.dispose(); }); }
  return { group, update, dispose, groundAt };
}
