// Heavy wooden and iron cargo handcart loaded with harvest sacks, crate and barrel.
// Ground origin y=0, front shafts toward +Z. Reuses crate and barrel from plaza.js.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, curve, palette as P } from '/engine/models/core/architecture-kit.js';
import { wheel, plank, ring } from '/engine/models/core/rural-kit.js';
import { crate, barrel } from './plaza.js';

export function cargoHandcart() {
  const g = new THREE.Group();
  const burlap = M(0xcab27e, { roughness: 0.95 }), burlapDark = M(0xb39864, { roughness: 0.95 });
  const rope = M(0xd6c396, { roughness: 1 }), stripe = M(0xb8583e, { roughness: 0.9 });
  const teal = M(0x3a8480, { roughness: 0.85 });

  // Pair of iron-rimmed spoked wheels resting on y=0, axle and wheel chocks.
  const r = 0.48;
  for (const side of [-1, 1]) {
    const w = wheel(r, 0.14, { hub: 0x573e30, tread: false });
    w.position.set(side * 0.86, r, -0.12);
    g.add(w);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.add(tube([side * 0.86, r, -0.12], [side * 0.86, r + Math.cos(a) * 0.36, -0.12 + Math.sin(a) * 0.36], 0.02, P.wood));
    }
    // Wooden wheel chock on the ground under the right wheel.
    if (side === 1) g.add(box(0.16, 0.11, 0.22, P.timber, side * 0.86, 0.055, 0.22));
  }
  g.add(tube([-0.92, r, -0.12], [0.92, r, -0.12], 0.042, P.iron));

  // Front iron landing legs resting at y=0 so the loaded bed sits level.
  for (const side of [-1, 1]) {
    g.add(curve([[side * 0.58, 0.52, 0.82], [side * 0.58, 0.14, 0.88], [side * 0.58, 0.03, 0.76]], 0.028, P.iron, 10));
    g.add(rounded(0.14, 0.05, 0.18, P.iron, side * 0.58, 0.025, 0.82));
  }

  // Hardwood bed frame, longitudinal beams, cross planks and flared side stake racks.
  for (const side of [-1, 1]) {
    g.add(box(0.11, 0.12, 2.35, P.timber, side * 0.64, 0.54, 0));
    // Forward pull shafts with iron handle crossbar at +Z.
    g.add(curve([[side * 0.64, 0.54, 1.12], [side * 0.56, 0.62, 1.65], [side * 0.46, 0.74, 2.15]], 0.042, P.wood, 12));
  }
  g.add(tube([-0.54, 0.74, 2.15], [0.54, 0.74, 2.15], 0.032, P.iron));

  for (let i = 0; i < 9; i++) {
    const z = -1.04 + i * 0.26;
    plank(g, 1.48, 0.07, 0.22, 0, 0.62, z, { mat: i % 2 ? P.wood : M(0xa4754b) });
  }
  // Headboard and flared side stake rails.
  for (const z of [-0.95, -0.32, 0.32, 0.95]) {
    for (const side of [-1, 1]) {
      const stake = box(0.07, 0.68, 0.07, P.timber, side * 0.76, 0.94, z);
      stake.rotation.z = -side * 0.12;
      g.add(stake);
    }
  }
  for (const side of [-1, 1]) {
    for (const y of [0.88, 1.16]) {
      const rail = box(0.05, 0.09, 2.18, teal, side * (0.78 + (y - 0.6) * 0.06), y, 0);
      rail.rotation.z = -side * 0.12;
      g.add(rail);
    }
  }
  for (const y of [0.82, 1.08]) g.add(box(1.52, 0.11, 0.06, P.wood, 0, y, -1.08));

  // Shared cargo: canonical wooden crate and barrel on the rear half of the cart.
  const cargoCrate = crate();
  cargoCrate.scale.setScalar(0.52);
  cargoCrate.position.set(-0.3, 0.65, -0.48);
  cargoCrate.rotation.y = 0.08;
  g.add(cargoCrate);

  const cargoBarrel = barrel();
  cargoBarrel.scale.setScalar(0.46);
  cargoBarrel.position.set(0.34, 0.65, -0.45);
  g.add(cargoBarrel);

  // Stacked burlap harvest sacks on the front half, tied and banded.
  const sacks = [
    [-0.28, 0.84, 0.38, 0.12], [0.28, 0.84, 0.36, -0.1],
    [-0.24, 0.84, 0.82, -0.08], [0.24, 0.84, 0.80, 0.15],
    [0, 1.15, 0.56, 0.25],
  ];
  for (const [i, [sx, sy, sz, rot]] of sacks.entries()) {
    const sack = mesh(new THREE.SphereGeometry(1, 12, 8), i % 2 ? burlap : burlapDark, sx, sy, sz);
    sack.scale.set(0.31, 0.2, 0.42);
    sack.rotation.y = rot;
    g.add(sack);
    const band = box(0.58, 0.04, 0.14, stripe, sx, sy + 0.17, sz);
    band.rotation.y = rot;
    g.add(band);
    // Tied sack ears at the front end.
    g.add(ring(0.055, 0.016, rope, sx, sy + 0.04, sz + 0.36));
  }

  // Lashing ropes securing the load across the side rails.
  g.add(curve([[-0.8, 0.85, -0.82], [-0.3, 1.44, -0.48], [0.34, 1.5, -0.44], [0.8, 0.85, -0.78]], 0.018, rope, 14));
  g.add(curve([[-0.8, 0.85, 0.25], [0, 1.38, 0.56], [0.8, 0.85, 0.72]], 0.018, rope, 12));

  const out = paintFinish(g, 'cargo-handcart');
  out.userData.assetId = 'cargo-handcart';
  return out;
}
