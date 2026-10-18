import * as THREE from 'three';
import { M, box, mesh, tube } from '../core/primitives.js';
import { paintFinish, archPanel, archFrame } from '../core/architecture-kit.js';

// Fictional La Guaira-inspired battery: low ramparts, round bastion, sentry domes.
export function coastalFortress() {
  const g = new THREE.Group(), stone = M(0x9b947d), cream = M(0xeee3c6), floor = M(0xbab49a), dark = M(0x354b4a);
  g.add(box(38, 6, 25, stone, 0, 3, 0), box(38.3, .3, 25.3, floor, 0, 6.15, 0));
  for (const z of [-12, 12]) {
    g.add(box(38, 1.5, 1, cream, 0, 7, z));
    for (let x = -18; x <= 18; x += 3) g.add(box(1.5, .8, 1.2, cream, x, 8, z));
  }
  for (const x of [-18.5, 18.5]) g.add(box(1, 1.6, 24, cream, x, 7, 0));
  // Random-looking masonry bands are deterministic geometry, without textures.
  for (let y = .7; y < 6; y += .75) for (let x = -18; x < 19; x += 2.2) {
    for (const z of [-12.53, 12.53]) g.add(box(1.85, .52, .1, M((Math.round(x * 10 + y * 8) % 3) ? 0xaaa38b : 0x827f6c), x, y, z));
  }
  g.add(mesh(new THREE.CylinderGeometry(10, 11, 4.2, 48), stone, 0, 8.4, -2));
  g.add(mesh(new THREE.CylinderGeometry(10.2, 10.2, .25, 48), floor, 0, 10.62, -2));
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, x = Math.cos(a) * 9.9, z = -2 + Math.sin(a) * 9.9;
    g.add(tube([x, 10.7, z], [x, 11.7, z], .045, dark));
    const b = (i + 1) / 64 * Math.PI * 2; g.add(tube([x, 11.7, z], [Math.cos(b) * 9.9, 11.7, -2 + Math.sin(b) * 9.9], .06, dark));
  }
  for (const x of [-18, 18]) for (const z of [-11.5, 11.5]) {
    g.add(mesh(new THREE.CylinderGeometry(1.25, 1.65, 3.6, 16), cream, x, 8.1, z));
    g.add(mesh(new THREE.SphereGeometry(1.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cream, x, 9.9, z));
    g.add(archPanel(.45, 1.2, .05, dark, x, 8, z + 1.27));
  }
  g.add(archPanel(3.5, 4.6, .08, M(0x544c3c), 0, .15, 12.6), archFrame(3.5, 4.6, .35, cream, 0, .15, 12.7));
  for (let i = 0; i < 12; i++) g.add(box(4, (i + 1) * .37, .75, floor, 12, 6.3 + (i + 1) * .185, 9 - i * .7));
  // Museum cannons are scenery, positioned behind the outer parapet.
  for (const x of [-11, 11]) {
    g.add(box(1.2, .65, 2.5, M(0x705540), x, 6.65, 8));
    g.add(tube([x, 7.4, 6.8], [x, 7.9, 10.3], .24, dark));
    for (const dx of [-.8, .8]) { const wheel = mesh(new THREE.CylinderGeometry(.65, .65, .18, 12), dark, x + dx, 6.9, 8); wheel.rotation.z = Math.PI / 2; g.add(wheel); }
  }
  g.add(tube([0, 10.7, -2], [0, 23, -2], .12, cream));
  for (const [i, color] of [0xf0c638, 0x285b91, 0xc94940].entries()) g.add(box(5, .95, .06, M(color), 2.5, 22 - i * .95, -2));
  for (let i = 0; i < 8; i++) g.add(mesh(new THREE.SphereGeometry(.07, 5, 3), cream, .8 + i * .48, 21.05 + .27 * Math.sin(i / 7 * Math.PI), -1.94));
  return paintFinish(g, 'coastal-fortress');
}
