// Open waterfront fish-auction pavilion with tiled counters, woven baskets, hanging scale and crates.
// Ground origin y=0, front +Z. Reuses canonical fishCrates from coastal.js.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, sign, curve, palette as P } from '/engine/models/core/architecture-kit.js';
import { cylinder, ring } from '/engine/models/core/rural-kit.js';
import { fishCrates } from './coastal.js';

export function fishAuctionCanopy() {
  const g = new THREE.Group();
  const teal = M(0x36888c, { roughness: 0.8 }), coral = M(0xd6664e, { roughness: 0.85 });
  const cream = M(0xf0e1be, { roughness: 0.9 }), tile = M(0xd8ecea, { roughness: 0.55 });
  const basketMat = M(0xb89156, { roughness: 0.95 }), ice = M(0xe3f6f7, { roughness: 0.35 });
  const silver = M(0x8fa7ab, { metalness: 0.45, roughness: 0.4 }), goldFish = M(0xdf8258, { roughness: 0.55 });

  // Concrete dock apron with curb, drainage grate and corner mooring bollards.
  g.add(rounded(8.4, 0.22, 6.2, P.stone, 0, 0.11, 0, 0.05));
  g.add(box(8.1, 0.06, 5.9, cream, 0, 0.23, 0));
  for (let i = -3; i <= 3; i++) g.add(box(0.75, 0.02, 0.28, P.iron, i * 1.05, 0.265, 0.15));
  for (const x of [-3.85, 3.85]) {
    g.add(cylinder(0.14, 0.17, 0.52, P.iron, x, 0.48, 2.75, 12));
    g.add(cylinder(0.18, 0.18, 0.08, P.iron, x, 0.74, 2.75, 12));
  }

  // Six timber-and-teal columns with knee braces and a stepped coastal canopy roof.
  for (const x of [-3.6, 0, 3.6]) for (const z of [-2.4, 2.4]) {
    g.add(box(0.38, 0.34, 0.38, teal, x, 0.4, z));
    g.add(box(0.24, 3.65, 0.24, P.wood, x, 2.22, z));
    if (x !== 0) g.add(tube([x, 3.1, z], [x - Math.sign(x) * 0.75, 3.85, z], 0.055, P.wood));
    g.add(tube([x, 3.1, z], [x, 3.85, z - Math.sign(z) * 0.7], 0.055, P.wood));
  }
  for (const z of [-2.4, 2.4]) g.add(box(7.8, 0.22, 0.22, P.wood, 0, 3.95, z));
  for (const x of [-3.6, 0, 3.6]) g.add(box(0.2, 0.22, 5.2, P.wood, x, 3.95, 0));

  for (const side of [-1, 1]) {
    const mainRoof = box(8.8, 0.11, 3.25, side < 0 ? teal : coral, 0, 4.46, side * 1.42);
    mainRoof.rotation.x = side * 0.24;
    g.add(mainRoof);
    for (let x = -4.2; x <= 4.2; x += 0.56) {
      const rib = box(0.05, 0.06, 3.22, cream, x, 4.52, side * 1.42);
      rib.rotation.x = side * 0.24;
      g.add(rib);
    }
    // Raised clerestory monitor along the ridge for harbor air circulation.
    const upperRoof = box(6.4, 0.09, 1.35, teal, 0, 5.08, side * 0.56);
    upperRoof.rotation.x = side * 0.2;
    g.add(upperRoof);
  }
  g.add(box(8.85, 0.14, 0.24, cream, 0, 5.22, 0));

  // Overhead sign board and price chalkboard at the entrance.
  const banner = sign(['LONJA DE PESCADO · PUERTO PANA', 'pargo rojo · carite · mero · catalana'], 4.9, 0.68, { background: '#265c60', color: '#f9e7bd' });
  banner.position.set(0, 4.02, 2.55);
  g.add(banner);
  const board = sign(['SUBASTA DEL DÍA', 'Pargo 12 · Carite 10 · Robalo 9'], 1.65, 0.92, { background: '#243a3a', color: '#f5e6c4' });
  board.position.set(3.45, 2.35, -2.26);
  g.add(board);

  // Two tiled fish-display counters with crushed ice beds and sorted catch.
  for (const [idx, cx] of [-2.05, 1.95].entries()) {
    const z = -0.55;
    g.add(rounded(2.7, 0.92, 1.45, teal, cx, 0.72, z, 0.04));
    g.add(rounded(2.86, 0.14, 1.6, tile, cx, 1.24, z, 0.03));
    // Raised rim and crushed ice bed.
    for (const sz of [-0.72, 0.72]) g.add(box(2.82, 0.1, 0.08, tile, cx, 1.34, z + sz));
    for (const sx of [-1.37, 1.37]) g.add(box(0.08, 0.1, 1.52, tile, cx + sx, 1.34, z));
    g.add(box(2.64, 0.07, 1.34, ice, cx, 1.32, z));

    // Stylized whole fish laid out on the ice bed.
    for (let i = 0; i < 6; i++) {
      const fx = cx - 0.95 + i * 0.38, fz = z + (i % 2 ? -0.18 : 0.16);
      const mat = (i + idx) % 3 === 0 ? goldFish : silver;
      const body = mesh(new THREE.SphereGeometry(1, 8, 6), mat, fx, 1.39, fz);
      body.scale.set(0.11, 0.075, 0.34);
      body.rotation.y = (i % 2 ? 0.18 : -0.15);
      g.add(body);
      const tail = mesh(new THREE.ConeGeometry(0.13, 0.18, 3), mat, fx, 1.39, fz - 0.36);
      tail.rotation.x = -Math.PI / 2;
      tail.scale.z = 0.35;
      g.add(tail);
    }
  }

  // Woven round catch baskets along the front aisle, brimming with silver fish.
  const basketSpots = [
    [-2.85, 1.45, 0.44], [-1.95, 1.55, 0.4], [-1.1, 1.35, 0.42],
    [1.15, 1.45, 0.42], [2.05, 1.58, 0.45],
  ];
  for (const [i, [bx, bz, r]] of basketSpots.entries()) {
    g.add(cylinder(r, r * 0.76, 0.46, basketMat, bx, 0.49, bz, 12));
    for (const h of [0.36, 0.66]) {
      const hoop = mesh(new THREE.TorusGeometry(r * (0.82 + (h - 0.3) * 0.42), 0.022, 4, 12), P.wood, bx, h, bz);
      hoop.rotation.x = Math.PI / 2;
      g.add(hoop);
    }
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.TorusGeometry(0.08, 0.018, 4, 10), P.wood, bx + s * (r + 0.02), 0.73, bz);
      ear.rotation.y = Math.PI / 2;
      g.add(ear);
    }
    g.add(cylinder(r * 0.9, r * 0.85, 0.06, ice, bx, 0.68, bz, 10));
    for (let k = 0; k < 3; k++) {
      const a = (k + i) * 1.8, fx = bx + Math.cos(a) * r * 0.36, fz = bz + Math.sin(a) * r * 0.36;
      const f = mesh(new THREE.SphereGeometry(1, 7, 5), k === 0 ? goldFish : silver, fx, 0.74 + (k % 2) * 0.03, fz);
      f.scale.set(0.085, 0.06, 0.24);
      f.rotation.y = a;
      g.add(f);
    }
  }

  // Central hanging dial scale suspended from the crossbeam with a prize fish in the pan.
  const sx = 0, sz = 0.85;
  g.add(tube([sx, 3.95, sz], [sx, 3.15, sz], 0.025, P.iron));
  g.add(cylinder(0.32, 0.32, 0.09, P.brass, sx, 2.85, sz, 24));
  g.children.at(-1).rotation.x = Math.PI / 2;
  g.add(cylinder(0.27, 0.27, 0.1, cream, sx, 2.85, sz, 24));
  g.children.at(-1).rotation.x = Math.PI / 2;
  g.add(box(0.025, 0.21, 0.02, coral, sx + 0.05, 2.9, sz + 0.06));
  g.children.at(-1).rotation.z = -0.65;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(tube([sx, 2.52, sz], [sx + Math.cos(a) * 0.42, 1.78, sz + Math.sin(a) * 0.42], 0.012, P.iron));
  }
  g.add(cylinder(0.46, 0.38, 0.08, silver, sx, 1.75, sz, 20));
  const prize = mesh(new THREE.SphereGeometry(1, 14, 10), goldFish, sx, 1.84, sz);
  prize.scale.set(0.14, 0.095, 0.42);
  g.add(prize);
  const prizeTail = mesh(new THREE.ConeGeometry(0.15, 0.2, 3), goldFish, sx, 1.84, sz - 0.44);
  prizeTail.rotation.x = -Math.PI / 2;
  prizeTail.scale.z = 0.35;
  g.add(prizeTail);

  // Reuse canonical fishCrates at the side of the auction floor.
  const crates = fishCrates();
  crates.position.set(3.05, 0.26, 1.35);
  crates.rotation.y = -0.35;
  g.add(crates);

  // Hanging harbor lamps under the ridge.
  for (const x of [-2.1, 2.1]) {
    g.add(tube([x, 4.6, 0.2], [x, 3.75, 0.2], 0.018, P.iron));
    g.add(cylinder(0.08, 0.24, 0.12, teal, x, 3.7, 0.2, 12));
    g.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), M(0xffe4a0, { emissive: 0xffb84d, emissiveIntensity: 0.4 }), x, 3.6, 0.2));
  }

  const out = paintFinish(g, 'fish-auction-canopy');
  out.userData.assetId = 'fish-auction-canopy';
  return out;
}
