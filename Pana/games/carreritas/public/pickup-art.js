import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const wood = ['#a76b37', '#bf8348', '#d59a58'].map(color =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }));
const iron = new THREE.MeshStandardMaterial({ color: '#403b36', roughness: 0.6, metalness: 0.3 });
const gold = new THREE.MeshStandardMaterial({ color: '#ffc83e', roughness: 0.35, metalness: 0.5, emissive: '#5b3000', flatShading: true });
const face = new THREE.MeshStandardMaterial({ color: '#ffe999', roughness: 0.45, metalness: 0.25, emissive: '#4a2800', flatShading: true });

// Keep unmerged boards as a fracture template; render just four material batches.
export function crateArt() {
  const pieces = new THREE.Group();
  function board(w, h, d, x, y, z, material, rz = 0) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    part.position.set(x, y, z); part.rotation.z = rz;
    part.castShadow = part.receiveShadow = true;
    pieces.add(part);
    return part;
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      board(1.62, 0.34, 0.11, 0, -0.57 + i * 0.38, side * 0.75, wood[i % 3]);
      board(0.11, 0.34, 1.4, side * 0.75, -0.57 + i * 0.38, 0, wood[(i + 1) % 3]);
    }
    board(1.88, 0.16, 0.1, 0, 0, side * 0.83, wood[0], side * 0.72);
    for (const x of [-0.59, 0.59]) board(0.12, 1.64, 0.08, x, 0, side * 0.82, iron);
  }
  for (let i = 0; i < 4; i++) board(0.35, 0.1, 1.6, -0.57 + i * 0.38, 0.78, 0, wood[i % 3]);
  pieces.updateMatrixWorld(true);
  const visual = new THREE.Group();
  for (const material of [...wood, iron]) {
    const geos = pieces.children.filter(p => p.material === material).map(p => p.geometry.clone().applyMatrix4(p.matrix));
    const m = new THREE.Mesh(mergeGeometries(geos, false), material);
    geos.forEach(g => g.dispose());
    m.castShadow = m.receiveShadow = true;
    visual.add(m);
  }
  // Painted mango stamps read as supplies without a floating mystery symbol.
  const stampGeo = new THREE.CircleGeometry(0.22, 7);
  for (const side of [-1, 1]) {
    const stamp = new THREE.Mesh(stampGeo, gold);
    stamp.position.set(0, 0.3, side * 0.815);
    stamp.rotation.y = side < 0 ? Math.PI : 0;
    stamp.scale.set(0.7, 1, 1);
    visual.add(stamp);
  }
  visual.name = 'wooden-item-crate';
  return { visual, pieces };
}

export function coinArt() {
  const g = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.16, 12), gold);
  edge.rotation.x = Math.PI / 2;
  g.add(edge);
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 4, 12), face);
    ring.position.z = side * 0.09;
    g.add(ring);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.025), face);
    mark.position.z = side * 0.09;
    g.add(mark);
  }
  g.name = 'collectible-coin';
  return g;
}
