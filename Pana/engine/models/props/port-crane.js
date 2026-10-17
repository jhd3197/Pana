import * as THREE from 'three';
import { M, box, tube, mesh } from '../core/primitives.js';
import { paintFinish } from '../core/architecture-kit.js';

// Ship-to-shore gantry. Boom faces +Z; the 23 m opening remains a real void.
export function portCrane() {
  const g = new THREE.Group(), red = M(0xcc4e3c), blue = M(0x285b83), steel = M(0x657778, { metalness: .45 }), cream = M(0xf4e6c8), dark = M(0x2a434f);
  for (const x of [-13, 13]) for (const z of [-9, 9]) {
    g.add(box(2.2, 1.7, 5, blue, x, 1.2, z));
    for (const dz of [-1.5, 1.5]) { const wheel = mesh(new THREE.CylinderGeometry(.75, .75, .75, 10), dark, x, .75, z + dz); wheel.rotation.z = Math.PI / 2; g.add(wheel); }
    g.add(tube([x, 2, z], [x * .8, 31, z * .75], .8, blue));
    g.add(tube([x, 6, z], [-x * .78, 30, z * .75], .26, blue));
  }
  for (const x of [-10.4, 10.4]) {
    g.add(box(1.4, 2, 28, red, x, 31, 0));
    for (const z of [-7, 7]) g.add(tube([x, 31, z], [0, 48, -8], .42, blue));
  }
  g.add(box(28, 2.4, 2.2, red, 0, 23, -8), box(28, 2.4, 2.2, red, 0, 31, 7));
  for (const x of [-2, 2]) {
    g.add(box(.65, .9, 72, red, x, 34, 15), box(.4, .5, 72, red, x, 37, 15));
    for (let z = -21; z < 51; z += 6) {
      g.add(tube([x, 34, z], [x, 37, z + 6], .13, red), tube([x, 37, z], [x, 34, z + 6], .13, red));
    }
    g.add(tube([0, 48, -8], [x, 34, 47], .1, steel), tube([0, 48, -8], [x, 34, -19], .1, steel));
  }
  g.add(box(9, 5, 8, cream, 0, 34, -13), box(5.5, 3, 3.5, cream, 0, 31.8, 24), box(5.2, 1.8, .1, dark, 0, 32, 25.8));
  for (const x of [-1.8, 1.8]) for (const z of [29, 35]) g.add(tube([x, 34, z], [x, 12, z], .055, steel));
  g.add(box(4.4, .65, 7, M(0xe8b74c), 0, 11.8, 32));
  // A ladder and maintenance gallery give the tall silhouette a readable scale.
  for (let y = 3; y < 30; y += .6) g.add(box(.95, .08, .2, cream, -13.2 + y * .085, y, -8));
  for (const x of [-3, 3]) { g.add(tube([x, 35, -21], [x, 35, 51], .065, cream)); for (let z = -21; z <= 51; z += 3) g.add(tube([x, 34, z], [x, 35, z], .055, cream)); }
  return paintFinish(g, 'port-crane');
}
