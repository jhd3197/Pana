import * as THREE from 'three';
import { M, box, mesh, tube } from '../core/primitives.js';
import { paintFinish } from '../core/architecture-kit.js';
import { shippingContainer } from './port-cargo.js';

// Keel origin; waterline is y=2.8. Bow points +Z.
export function cargoShip() {
  const g = new THREE.Group(), hull = new THREE.Shape();
  hull.moveTo(-9, -40); hull.lineTo(9, -40); hull.lineTo(10.5, 26); hull.quadraticCurveTo(9, 38, 0, 45); hull.quadraticCurveTo(-9, 38, -10.5, 26); hull.closePath();
  const shape = new THREE.ExtrudeGeometry(hull, { depth: 6, bevelEnabled: true, bevelSize: .6, bevelThickness: .4, bevelSegments: 1, steps: 1 });
  shape.rotateX(Math.PI / 2); shape.translate(0, 6.4, 0);
  g.add(mesh(shape, M(0x274f67)));
  g.add(box(19, .35, 66, M(0xb98b68), 0, 6.7, -4));
  for (const x of [-7.3, -3.65, 0, 3.65, 7.3]) for (const z of [-10, 4, 18]) for (let level = 0; level < (z === 18 ? 1 : 2); level++) {
    const colors = [0xc95740, 0x367f8c, 0xe6bb54, 0xe3d7bb];
    const c = shippingContainer({ markings: false, color: colors[(Math.round(x * 10) + 80 + level + z) % 4] }); c.position.set(x, 6.9 + level * 2.65, z); g.add(c);
  }
  const white = M(0xf1e7ce), glass = M(0x315a6a);
  g.add(box(16, 10, 10, white, 0, 11.8, -29), box(18, 3, 11, white, 0, 18, -29), box(19, .35, 12, white, 0, 19.7, -29));
  for (let x = -7; x <= 7; x += 2) { g.add(box(1.5, 1.5, .12, glass, x, 18.2, -23.45)); for (const y of [9.5, 12, 14.5]) g.add(box(.7, .9, .12, glass, x, y, -23.9)); }
  g.add(box(4, 5, 3.5, M(0xc6573d), 0, 22, -31), box(4.2, .6, 3.7, glass, 0, 24.6, -31));
  g.add(tube([0, 19.7, -27], [0, 29, -27], .12, white), tube([-3, 27, -27], [3, 27, -27], .08, white));
  for (const x of [-9.3, 9.3]) { g.add(tube([x, 7.6, -39], [x, 7.6, 26], .055, white)); for (let z = -39; z < 26; z += 3) g.add(tube([x, 6.6, z], [x, 7.6, z], .05, white)); }
  const out = paintFinish(g, 'cargo-ship'); out.userData.waterline = 2.8; return out;
}
