import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bake } from '/engine/models/core/static-batch.js';
import { disposeModel } from './game-table.js';

// Held origin at the grip; barrel points +Z. A sporting paint marker, not a firearm.
export function createPaintMarker({ color = '#f28b42' } = {}) {
  const root = new THREE.Group(), paint = new THREE.MeshStandardMaterial({ color, roughness: .4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#344847', roughness: .55 }), steel = new THREE.MeshStandardMaterial({ color: '#a9bfc0', metalness: .6, roughness: .3 });
  function add(geometry, material, x, y, z, turn = false) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); if (turn) mesh.rotation.x = Math.PI / 2; mesh.castShadow = true; root.add(mesh); return mesh; }
  add(new RoundedBoxGeometry(.19, .21, .52, 2, .04), paint, 0, .15, .16);
  add(new RoundedBoxGeometry(.15, .3, .17, 2, .035), dark, 0, -.08, .02).rotation.x = -.2;
  add(new THREE.CylinderGeometry(.055, .07, .65, 16), steel, 0, .17, .67, true);
  add(new THREE.CylinderGeometry(.078, .078, .07, 16), paint, 0, .17, 1.02, true);
  add(new THREE.CylinderGeometry(.045, .045, .075, 16), dark, 0, .17, 1.025, true);
  add(new THREE.CylinderGeometry(.07, .07, .17, 12), steel, 0, .32, .13);
  add(new THREE.SphereGeometry(.21, 16, 12), paint, 0, .5, .12).scale.set(1, .8, 1.45);
  add(new THREE.CylinderGeometry(.13, .13, .43, 16), dark, 0, -.12, -.25, true);
  const result = bake(root); const geometry = new Set(); root.traverse(o => { if (o.geometry) geometry.add(o.geometry); }); geometry.forEach(g => g.dispose());
  result.name = 'Marcadora de pintura'; let disposed = false;
  result.userData.dispose = () => { if (!disposed) { disposed = true; disposeModel(result); } }; return result;
}
