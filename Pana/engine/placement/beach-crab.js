import * as THREE from 'three';

// Align planted feet with sloping terrain while preserving yaw.
export function groundBeachCrab(crab,groundAt,yaw=0) {
  const {x,z}=crab.position;
  const normal=new THREE.Vector3(groundAt(x-.5,z)-groundAt(x+.5,z),1,groundAt(x,z-.5)-groundAt(x,z+.5)).normalize();
  crab.position.y=groundAt(x,z)+.005;
  crab.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);crab.rotateY(yaw);
}
