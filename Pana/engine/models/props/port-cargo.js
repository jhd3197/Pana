// Native port equipment. Metres, +Y up, doors/front +Z, ground origin.
import * as THREE from 'three';
import { M, box, mesh, tube } from '../core/primitives.js';
import { paintFinish } from '../core/architecture-kit.js';

export function shippingContainer({ color = 0xc95339, length = 12.2 } = {}) {
  const g = new THREE.Group(), paint = M(color), frame = M(0x354b52), metal = M(0xb5b9ad, { metalness: .5 });
  g.add(box(2.44, 2.5, length, paint, 0, 1.3, 0));
  for (const x of [-1.24, 1.24]) {
    for (let z = -length / 2 + .22; z < length / 2; z += .28) g.add(box(.07, 2.25, .095, paint, x, 1.3, z));
    for (const y of [.1, 2.55]) g.add(box(.13, .15, length + .08, frame, x, y, 0));
  }
  for (const z of [-length / 2, length / 2]) {
    for (const x of [-1.19, 1.19]) g.add(box(.19, 2.6, .18, frame, x, 1.3, z));
    for (const x of [-.57, .57]) {
      g.add(box(1.07, 2.25, .06, paint, x, 1.3, z + Math.sign(z) * .045));
      for (const dx of [-.32, .32]) g.add(tube([x + dx, .3, z + Math.sign(z) * .1], [x + dx, 2.3, z + Math.sign(z) * .1], .027, metal));
      g.add(box(.25, .07, .07, metal, x, 1.05, z + Math.sign(z) * .15));
    }
    for (const x of [-1.13, 1.13]) for (const y of [.1, 2.5]) g.add(box(.22, .17, .22, metal, x, y, z));
  }
  const out = paintFinish(g, 'shipping-container');
  out.userData.dimensions = [2.52, 2.65, length + .3];
  return out;
}

export function transitWarehouse() {
  const g = new THREE.Group(), wall = M(0xe9dcc0), blue = M(0x548a98), trim = M(0xf7ebd1), roof = M(0xaa6954), dark = M(0x334e56);
  g.add(box(18, .7, 36, M(0x979d94), 0, .35, 0), box(17, 7, 34, wall, 0, 4.2, 0));
  for (const side of [-1, 1]) {
    const slope = box(9.6, .22, 36, roof, side * 4.5, 8.7, 0); slope.rotation.z = -side * .23; g.add(slope);
    for (let z = -16; z <= 16; z += 5.3) {
      g.add(box(.18, 4.9, 3.8, blue, side * 8.6, 3.1, z));
      for (let y = 1; y < 5.5; y += .35) g.add(box(.23, .055, 3.8, trim, side * 8.65, y, z));
      g.add(box(.5, 7.2, .5, trim, side * 8.6, 4.1, z - 2.4));
      g.add(box(.2, .9, 3, dark, side * 8.65, 6.7, z));
    }
  }
  for (const z of [-17.1, 17.1]) { g.add(box(6, 4.6, .18, blue, 0, 3.05, z)); g.add(box(10, .7, .2, trim, 0, 6.6, z)); }
  for (let z = -13; z <= 13; z += 6.5) g.add(box(1.5, .5, 2, trim, 0, 10, z));
  return paintFinish(g, 'transit-warehouse');
}

export function portBollard() {
  const g = new THREE.Group(), steel = M(0x344b50), yellow = M(0xe4b64b);
  g.add(box(1.3, .16, 1.3, steel, 0, .08, 0), mesh(new THREE.CylinderGeometry(.35, .48, .85, 10), yellow, 0, .58, 0), box(1.2, .25, .65, steel, 0, 1.1, 0));
  return paintFinish(g, 'port-bollard');
}
