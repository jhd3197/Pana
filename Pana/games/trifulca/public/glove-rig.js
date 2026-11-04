// A boxing glove worn on a pana's arm. The arm is stretched along its length and
// its parent body squashes, so a plain child would inherit a skew: the glove
// sets its own matrix each frame to cancel that, staying a rigid, evenly sized
// glove at the end of the arm whatever the pose.
import * as THREE from 'three';
import { boxingGlove } from './set.js';
import { rigidFrame } from './glove-shape.js';

const WRIST_ON_ARM = new THREE.Vector3(0, -.86, .04);
const world = new THREE.Matrix4(), inverse = new THREE.Matrix4(), at = new THREE.Vector3(), size = new THREE.Vector3();
const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();

export function wearGlove(arm, { side = 1, ...look } = {}) {
  const glove = boxingGlove({ side, ...look });
  glove.matrixAutoUpdate = false; glove.userData.side = side; arm.add(glove);
  return glove;
}

// Call after the arm is posed. `scale` is the glove's size in `root`'s units;
// `roll` turns the hand on the arm's axis (glove-shape.js, handRoll).
export function settleGlove(glove, arm, root, scale, roll = 0) {
  glove.userData.hand.rotation.y = -glove.userData.side * roll;
  arm.updateWorldMatrix(true, false);
  const frame = rigidFrame(arm.matrixWorld.elements);
  x.fromArray(frame.x); y.fromArray(frame.y); z.fromArray(frame.z);
  world.makeBasis(x, y, z).scale(size.setScalar(scale * root.matrixWorld.getMaxScaleOnAxis()));
  world.setPosition(at.copy(WRIST_ON_ARM).applyMatrix4(arm.matrixWorld));
  glove.matrix.copy(inverse.copy(arm.matrixWorld).invert()).multiply(world);
  glove.matrixWorldNeedsUpdate = true;
}
