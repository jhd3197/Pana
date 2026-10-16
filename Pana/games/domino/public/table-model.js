import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PIPS } from './tiles.js';
import { disposeModel } from '/engine/models/props/game-table.js';
export { createGameTable as createDominoTable, createGameChair as createDominoChair, disposeModel } from '/engine/models/props/game-table.js';

function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .7, ...extra });
function rounded(parent, material, w, h, d, radius, x, y, z) {
  return part(parent, new RoundedBoxGeometry(w, h, d, 3, radius), material, x, y, z);
}
// Top face points +Y; long axis Z. a is the -Z half. Each piece owns its meshes.
export function createDominoTile({ a = 6, b = 6 } = {}) {
  const group = new THREE.Group(); group.name = `Ficha ${a}–${b}`;
  const ivory = mat('#fff3d5', { roughness: .32 }), back = mat('#213c35', { roughness: .42 }), black = mat('#243a31'), gold = mat('#b29a60', { metalness: .5 });
  const base = rounded(group, back, .28, .115, .56, .025, 0, .0575, 0);
  rounded(group, ivory, .276, .066, .556, .02, 0, .102, 0);
  const face = new THREE.Group(); group.add(face);
  rounded(face, gold, .225, .002, .005, .001, 0, .136, 0);
  part(face, new THREE.SphereGeometry(.009, 8, 6), gold, 0, .139, 0);
  const values = [a, b], total = PIPS[a].length + PIPS[b].length;
  if (total) {
    const dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(.019, .016, .003, 12), black, total), matrix = new THREE.Matrix4(); let index = 0;
    values.forEach((value, half) => { for (const pip of PIPS[value]) { matrix.makeTranslation((pip % 3 - 1) * .066, .137, (half ? .14 : -.14) + (Math.floor(pip / 3) - 1) * .066); dots.setMatrixAt(index++, matrix); } });
    dots.instanceMatrix.needsUpdate = true; face.add(dots);
  }
  const cover = rounded(group, back, .279, .009, .559, .02, 0, .14, 0);
  const motif = part(cover, new THREE.TorusGeometry(.04, .004, 5, 16), gold, 0, .008, 0); motif.rotation.x = Math.PI / 2;
  cover.visible = false;
  group.userData.faceUp = show => { face.visible = show; cover.visible = !show; };
  group.userData.highlight = on => { ivory.emissive.set(on ? '#61451a' : '#000000'); ivory.emissiveIntensity = on ? .2 : 0; base.material.color.set(on ? '#ddb45e' : '#213c35'); };
  group.userData.dispose = () => disposeModel(group); return group;
}
