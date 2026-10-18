// Venezuelan stake-bed fruit delivery truck (camión de estacas) loaded with mangoes,
// watermelons, plantains and crates. Ground origin y=0, cab faces +Z.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/models/core/primitives.js';
import { paintFinish, rounded, sign, curve, palette as P } from '/engine/models/core/architecture-kit.js';
import { wheel, cylinder, ring, plank } from '/engine/models/core/rural-kit.js';
import { makeMango } from './mango.js';
import { crate } from './plaza.js';

export function fruitDeliveryTruck() {
  const g = new THREE.Group(), random = rng(142);
  const teal = M(0x338684, { roughness: 0.72 }), yellow = M(0xe8b543, { roughness: 0.78 });
  const red = M(0xc65640, { roughness: 0.8 }), cream = M(0xf5e6c5, { roughness: 0.85 });
  const chrome = M(0xc8d2cf, { metalness: 0.65, roughness: 0.3 }), glass = M(0x283e42, { roughness: 0.35 });
  const lamp = M(0xffe7a8, { emissive: 0xffba49, emissiveIntensity: 0.4 });
  const melon = M(0x427d48, { roughness: 0.65 }), melonLight = M(0x7ab464, { roughness: 0.7 });

  // Four wheels resting at y=0 (radius 0.52m), heavy steel chassis and axles.
  const r = 0.52;
  for (const [z, dual] of [[1.78, false], [-1.32, true]]) {
    for (const side of [-1, 1]) {
      const w = wheel(r, dual ? 0.34 : 0.24, { hub: 0xe8b543, tread: true });
      w.position.set(side * (dual ? 1.04 : 1.02), r, z);
      g.add(w);
    }
    g.add(tube([-1.06, r, z], [1.06, r, z], 0.06, P.iron));
  }
  for (const side of [-1, 1]) g.add(box(0.14, 0.18, 5.65, P.iron, side * 0.62, 0.68, 0.15));
  // Fuel tank and step boards along the cab flanks.
  for (const side of [-1, 1]) {
    g.add(box(0.26, 0.08, 0.95, chrome, side * 1.08, 0.58, 0.92));
  }
  const tank = cylinder(0.22, 0.22, 0.85, P.iron, -0.92, 0.68, -0.15, 14);
  tank.rotation.x = Math.PI / 2;
  g.add(tank);

  // Vintage rounded truck cab (+Z) with hood, chrome grille, bumper, headlights and mirrors.
  g.add(rounded(2.08, 1.38, 1.48, teal, 0, 1.46, 1.12, 0.12));
  g.add(rounded(2.02, 0.18, 1.44, cream, 0, 2.22, 1.1, 0.08));
  g.add(box(2.1, 0.14, 1.5, yellow, 0, 1.18, 1.12));
  // Hood and front fenders.
  g.add(rounded(1.66, 0.88, 1.16, teal, 0, 1.18, 2.22, 0.14));
  for (const side of [-1, 1]) {
    const fender = mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.36, 18, 1, true, Math.PI * 0.1, Math.PI * 0.8), red, side * 0.98, 0.56, 1.78);
    fender.rotation.z = Math.PI / 2;
    g.add(fender);
  }
  // Windshield, side windows, radiator grille, headlights and front bumper.
  const windshield = rounded(1.76, 0.54, 0.08, glass, 0, 1.84, 1.84, 0.03);
  windshield.rotation.x = -0.14;
  g.add(windshield);
  g.add(box(0.06, 0.56, 0.09, cream, 0, 1.84, 1.86));
  for (const side of [-1, 1]) {
    g.add(rounded(0.08, 0.52, 0.92, glass, side * 1.02, 1.82, 1.14, 0.03));
    // Side wing mirrors.
    g.add(tube([side * 1.04, 1.95, 1.58], [side * 1.28, 1.95, 1.62], 0.018, chrome));
    g.add(rounded(0.06, 0.28, 0.16, chrome, side * 1.3, 1.88, 1.62, 0.02));
  }
  g.add(rounded(1.18, 0.62, 0.08, chrome, 0, 1.14, 2.8, 0.04));
  for (let x = -0.48; x <= 0.48; x += 0.12) g.add(box(0.04, 0.52, 0.05, P.iron, x, 1.14, 2.83));
  for (const side of [-1, 1]) {
    const light = cylinder(0.15, 0.15, 0.12, chrome, side * 0.78, 1.16, 2.75, 14);
    light.rotation.x = Math.PI / 2;
    g.add(light);
    const lens = cylinder(0.12, 0.12, 0.04, lamp, side * 0.78, 1.16, 2.81, 14);
    lens.rotation.x = Math.PI / 2;
    g.add(lens);
  }
  g.add(rounded(2.32, 0.2, 0.22, chrome, 0, 0.68, 2.92, 0.04));

  // Timber stake-bed cargo box (cava de estacas) with painted slats, rolled tarp and roof sign.
  g.add(box(2.38, 0.16, 3.45, P.timber, 0, 0.86, -1.35));
  for (let i = 0; i < 6; i++) {
    const z = -2.92 + i * 0.62;
    for (const side of [-1, 1]) g.add(box(0.09, 1.58, 0.09, P.timber, side * 1.14, 1.68, z));
  }
  const slatColors = [red, yellow, cream, teal];
  for (let row = 0; row < 4; row++) {
    const y = 1.12 + row * 0.34, mat = slatColors[row % 4];
    for (const side of [-1, 1]) g.add(box(0.06, 0.22, 3.38, mat, side * 1.18, y, -1.35));
    g.add(box(2.36, 0.22, 0.06, mat, 0, y, 0.32));
  }
  // Overhead tarp bows, rolled canvas cover and headboard sign above the cab.
  for (const z of [-2.85, -1.35, 0.25]) {
    g.add(curve([[-1.14, 2.45, z], [-0.8, 2.78, z], [0.8, 2.78, z], [1.14, 2.45, z]], 0.03, P.iron, 14));
  }
  const tarp = cylinder(0.16, 0.16, 3.3, cream, 0, 2.82, -1.3, 12);
  tarp.rotation.x = Math.PI / 2;
  g.add(tarp);

  g.add(rounded(2.26, 0.62, 0.14, red, 0, 2.68, 0.42, 0.03));
  const banner = sign(['FRUTAS EL PANA', 'mangos · patillas · cambur'], 2.12, 0.5, { background: '#265c5a', color: '#fff2cf' });
  banner.position.set(0, 2.68, 0.5);
  g.add(banner);

  // Fruit harvest bins inside the truck bed: mangoes, striped watermelons, oranges and plantains.
  for (const [bx, bz] of [[-0.56, -0.55], [0.56, -0.55], [-0.56, -1.95], [0.56, -1.95]]) {
    g.add(box(1.02, 0.48, 1.25, P.wood, bx, 1.18, bz));
  }
  // Bin 1: Canonical mangoes crowning a heaped mango harvest bed.
  const mangoGold = M(0xf4b63a, { roughness: 0.55 }), mangoBlush = M(0xe26438, { roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const m = mesh(new THREE.SphereGeometry(0.15, 9, 7), i % 2 ? mangoGold : mangoBlush,
      -0.8 + (i % 3) * 0.24, 1.46, -0.78 + Math.floor(i / 3) * 0.32);
    m.scale.set(1.15, 0.85, 0.95);
    g.add(m);
  }
  for (let i = 0; i < 3; i++) {
    const m = makeMango({ gold: i === 1 });
    m.scale.setScalar(0.26);
    m.position.set(-0.78 + i * 0.22, 1.58, -0.62 + (i % 2) * 0.16);
    m.rotation.set(random(), random() * 3, 0.9);
    g.add(m);
  }
  // Bin 2: Striped Venezuelan patillas (watermelons).
  for (let i = 0; i < 6; i++) {
    const wx = 0.34 + (i % 2) * 0.42, wz = -0.88 + Math.floor(i / 2) * 0.34;
    const wm = mesh(new THREE.SphereGeometry(0.19, 10, 8), i % 2 ? melon : melonLight, wx, 1.54 + (i === 2 ? 0.16 : 0), wz);
    wm.scale.set(1.0, 0.85, 1.35);
    wm.rotation.y = (i % 3) * 0.4;
    g.add(wm);
  }
  // Bin 3: Bright oranges and papayas.
  const orangeMat = M(0xef9b28, { roughness: 0.65 });
  for (let i = 0; i < 12; i++) {
    g.add(mesh(new THREE.SphereGeometry(0.11 + (i % 2) * 0.03, 8, 6), orangeMat,
      -0.86 + (i % 4) * 0.2, 1.48 + Math.floor(i / 8) * 0.14, -2.25 + Math.floor((i % 8) / 4) * 0.32));
  }
  // Bin 4: Golden plantain/banana bunches and a shared crate at the open tailgate.
  const bananaYellow = M(0xf0c238, { roughness: 0.7 });
  for (let i = 0; i < 8; i++) {
    const bx = 0.28 + (i % 3) * 0.26, bz = -2.22 + Math.floor(i / 3) * 0.34;
    g.add(curve([[bx - 0.1, 1.52, bz], [bx, 1.46, bz + 0.08], [bx + 0.14, 1.56, bz + 0.14]], 0.048, bananaYellow, 6));
  }

  // Lowered tailgate ramp and display crate resting at the rear (-Z) for roadside selling.
  const ramp = box(1.38, 0.09, 1.18, P.wood, 0, 0.48, -3.45);
  ramp.rotation.x = -0.68;
  g.add(ramp);
  const rearCrate = crate();
  rearCrate.scale.setScalar(0.55);
  rearCrate.position.set(1.08, 0, -3.35);
  g.add(rearCrate);
  const heroMango = makeMango();
  heroMango.scale.setScalar(0.24);
  heroMango.position.set(1.08, 0.82, -3.35);
  heroMango.rotation.z = 0.8;
  g.add(heroMango);

  const out = paintFinish(g, 'fruit-delivery-truck');
  out.userData.assetId = 'fruit-delivery-truck';
  return out;
}
