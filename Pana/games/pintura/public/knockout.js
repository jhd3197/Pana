import * as THREE from 'three';
import { KnockoutPhysics } from './knockout-physics.js';

// Drive the existing pana pivots, including the skinned legs. No replacement
// humanoid, detached bones or additional draw calls; restore before respawn.
export function createKnockout(character, impulse, cover) {
  const { body, neck, arms, legs } = character;
  character.group.updateMatrixWorld(true);
  const nodes = [body, neck, ...arms, ...legs];
  const saved = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  const worldRotations = new Map(nodes.map(node => [node, node.getWorldQuaternion(new THREE.Quaternion())]));
  const world = (node, y = 0) => node.localToWorld(new THREE.Vector3(0, y, 0));
  const points = [world(body, .8), world(neck), world(neck, .55),
    ...arms.flatMap(a => [world(a), world(a, -.85)]), ...legs.flatMap(a => [world(a), world(a, -.48)])];
  const pairs = [[0,1],[1,2],[0,3],[0,5],[1,3],[1,5],[3,5],[3,4],[5,6],
    [0,7],[0,9],[7,9],[7,8],[9,10],[3,7],[5,9],[3,9],[5,7],[2,3],[2,5]];
  const physics = new KnockoutPhysics(points.map((p,i) => ({ x:p.x, y:p.y, z:p.z, radius:i===2?.38:i<2?.25:.12 })), pairs, impulse, impulse?.zone === 'head' ? 2 : 1, cover);
  const up = new THREE.Vector3(0,1,0), down = new THREE.Vector3(0,-1,0), direction = new THREE.Vector3(), reference = new THREE.Vector3();
  const rotation = new THREE.Quaternion(), parent = new THREE.Quaternion(), origin = new THREE.Vector3();
  function aim(node, a, b, axis) {
    const rest = worldRotations.get(node);
    direction.subVectors(b,a).normalize(); reference.copy(axis).applyQuaternion(rest);
    rotation.setFromUnitVectors(reference,direction).multiply(rest);
    node.parent.getWorldQuaternion(parent); node.quaternion.copy(parent.invert().multiply(rotation));
    node.updateMatrixWorld(true);
  }
  return {
    physics,
    update(dt) {
      physics.update(dt); const p = physics.points.map(p => new THREE.Vector3(p.x,p.y,p.z));
      aim(body,p[0],p[1],up);
      // The torso particle is .8 sculpt units above the body's origin.
      origin.copy(p[0]); direction.set(0,.8,0).multiply(body.scale).applyQuaternion(body.quaternion);
      body.parent.worldToLocal(origin); body.position.copy(origin.sub(direction)); body.updateMatrixWorld(true);
      aim(neck,p[1],p[2],up);
      arms.forEach((a,i) => aim(a,p[3+i*2],p[4+i*2],down));
      legs.forEach((a,i) => aim(a,p[7+i*2],p[8+i*2],down));
    },
    reset() { for(const {node,p,q,s} of saved) {node.position.copy(p);node.quaternion.copy(q);node.scale.copy(s);} character.group.updateMatrixWorld(true); },
  };
}
