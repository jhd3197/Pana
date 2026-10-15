// Shared island casita. Front door faces +Z and the foundation rests on y = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, mesh, box, rng } from '/engine/models/core/primitives.js';
import { leafBlade } from '/engine/models/core/botanical-shapes.js';
import { bake } from '/engine/models/core/static-batch.js';

function roofTile(x, z, side, material) {
  const positions = [], indices = [];
  for (let row = 0; row <= 1; row++) for (let i = 0; i <= 8; i++) {
    const a = i / 8 * Math.PI, u = x + row * 0.37;
    positions.push(side * u, 3.56 - u * 0.57 + Math.sin(a) * 0.095, z + Math.cos(a) * 0.18);
    if (!row && i < 8) { const k = i; indices.push(k, k + 1, k + 9, k + 1, k + 10, k + 9); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return mesh(geo, material);
}

export function casita({ seed = 1 } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const wall = M(['#e89a79', '#e7c76f', '#82bac4', '#aabd83', '#d89b9b', '#eee0bd'][Math.floor(r() * 6)], { flatShading: false, roughness: 0.95 });
  const cream = M(0xf4e6c6, { roughness: 0.9 }), stone = M(0xb8ab8b, { roughness: 1 });
  const wood = M(0x76523a, { roughness: 0.9 }), dark = M(0x493c2c, { roughness: 1 });
  const shutter = M([0x387c78, 0x537c91, 0x688958][Math.floor(r() * 3)], { roughness: 0.8 });
  const glass = M(0x365a60, { roughness: 0.32, metalness: 0.15 });
  const tiles = [0xb95d40, 0xc97550, 0xa94d36].map(color => M(color, { flatShading: false, side: THREE.DoubleSide, roughness: 0.9 }));
  g.add(mesh(new RoundedBoxGeometry(3.55, 0.18, 3.7, 2, 0.05), stone, 0, 0.09, 0.3));
  g.add(mesh(new RoundedBoxGeometry(3.2, 2.3, 2.8, 2, 0.065), wall, 0, 1.33, 0));
  g.add(box(3.28, 0.2, 2.88, cream, 0, 0.3, 0));
  const gable = new THREE.Shape(); gable.moveTo(-1.6, 2.43); gable.lineTo(1.6, 2.43); gable.lineTo(0, 3.4); gable.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: 2.8, bevelEnabled: false }); gableGeo.translate(0, 0, -1.4);
  g.add(mesh(gableGeo, wall));

  // Cream corner boards and the exposed timber below the eaves.
  for (const x of [-1.59, 1.59]) for (const z of [-1.39, 1.39]) g.add(box(0.12, 2.22, 0.12, cream, x, 1.38, z));
  for (const side of [-1, 1]) {
    const panel = box(2.2, 0.1, 3.55, wood, side * 0.96, 3.0, 0); panel.rotation.z = -side * Math.atan(0.57); g.add(panel);
    for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++) {
      g.add(roofTile(0.07 + row * 0.36, -1.6 + col * 0.355, side, tiles[Math.floor(r() * tiles.length)]));
    }
    for (const z of [-1.78, 1.78]) {
      const fascia = box(2.23, 0.14, 0.1, cream, side * 0.96, 3.01, z); fascia.rotation.z = -side * Math.atan(0.57); g.add(fascia);
    }
  }
  for (let i = 0; i < 10; i++) {
    const cap = mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.38, 8, 1, true, 0, Math.PI), tiles[1], 0, 3.55, -1.6 + i * 0.355);
    cap.rotation.set(Math.PI / 2, 0, Math.PI / 2); g.add(cap);
  }

  function windowAt(x, y, z, turn = 0) {
    const win = new THREE.Group(); win.position.set(x, y, z); win.rotation.y = turn;
    win.add(box(0.78, 0.85, 0.06, dark, 0, 0, 0));
    win.add(box(0.65, 0.72, 0.07, glass, 0, 0, 0.035));
    for (const sx of [-1, 1]) {
      win.add(box(0.07, 0.89, 0.12, cream, sx * 0.39, 0, 0.08));
      const door = new THREE.Group(); door.position.set(sx * 0.57, 0, 0.05); door.rotation.y = sx * 0.18;
      door.add(box(0.28, 0.81, 0.065, shutter, 0, 0, 0));
      for (let i = 0; i < 5; i++) door.add(box(0.23, 0.035, 0.035, shutter, 0, -0.3 + i * 0.15, 0.045));
      win.add(door);
    }
    for (const sy of [-1, 1]) win.add(box(0.85, 0.07, 0.12, cream, 0, sy * 0.43, 0.08));
    win.add(box(0.04, 0.76, 0.12, cream, 0, 0, 0.08), box(0.73, 0.035, 0.12, cream, 0, 0, 0.08));
    win.add(box(1.46, 0.09, 0.22, cream, 0, -0.49, 0.08));
    g.add(win);
  }
  windowAt(-0.72, 1.45, 1.42); windowAt(-1.62, 1.45, -0.15, -Math.PI / 2);
  windowAt(1.62, 1.45, -0.15, Math.PI / 2); windowAt(0, 1.45, -1.42, Math.PI);

  // Recessed plank door, frame, threshold and a small brass handle.
  g.add(box(0.86, 1.7, 0.065, dark, 0.68, 1.02, 1.43));
  g.add(mesh(new RoundedBoxGeometry(0.73, 1.57, 0.09, 2, 0.025), wood, 0.68, 0.98, 1.48));
  for (let i = 1; i < 5; i++) g.add(box(0.012, 1.5, 0.012, dark, 0.315 + i * 0.146, 0.98, 1.531));
  for (const x of [0.24, 1.12]) g.add(box(0.095, 1.76, 0.13, cream, x, 1.02, 1.49));
  g.add(box(0.98, 0.1, 0.13, cream, 0.68, 1.88, 1.49));
  g.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), M(0xc9a451, { metalness: 0.6, roughness: 0.35, flatShading: false }), 0.94, 0.98, 1.57));
  g.add(box(1.22, 0.1, 0.46, stone, 0.68, 0.05, 2.05));

  // Shaded veranda stays inside the original house's roof footprint.
  const awning = box(3.4, 0.12, 0.96, tiles[0], 0, 2.49, 1.8); awning.rotation.x = 0.26; g.add(awning);
  for (let i = 0; i < 11; i++) {
    const rib = box(0.045, 0.04, 0.96, tiles[1], -1.55 + i * 0.31, 2.57, 1.8); rib.rotation.x = 0.26; g.add(rib);
  }
  for (const x of [-1.45, 1.45]) {
    g.add(box(0.1, 2.18, 0.1, cream, x, 1.27, 2.07));
    g.add(box(0.18, 0.2, 0.18, stone, x, 0.28, 2.07));
    const brace = box(0.09, 0.46, 0.09, cream, x - Math.sign(x) * 0.13, 2.17, 2.07); brace.rotation.z = Math.sign(x) * -0.65; g.add(brace);
  }
  g.add(box(3.32, 0.14, 0.13, cream, 0, 2.35, 2.18));
  // A small vent in the gable and a doorstep plant make the scale readable.
  g.add(box(0.32, 0.35, 0.08, shutter, 0, 2.81, 1.44));
  for (let i = 0; i < 3; i++) g.add(box(0.25, 0.035, 0.05, cream, 0, 2.71 + i * 0.1, 1.49));
  g.add(mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.25, 10), tiles[0], -1.08, 0.305, 1.84));
  const green = M(0xffffff, { vertexColors: true, side: THREE.DoubleSide, flatShading: false, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const leaf = mesh(leafBlade(0.33, 0.09, 0.08, 0x659849, 6), green, -1.08, 0.43, 1.84);
    leaf.rotation.set(0, i * Math.PI / 3, 0.55); g.add(leaf);
  }
  // Windows and roof tiles are static; retain their detail without hundreds of draws.
  const batched = bake(g);
  g.traverse(node => node.geometry?.dispose());
  return batched;
}
