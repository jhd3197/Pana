// The Pana cars: one builder per car, shared by Carreritas's garage and Bululú's
// ¡Choque de carritos!. Shared parts live in car-kit.js; the
// driver is the player's pana (see /engine/models/characters/pana/avatar-model.js).
// Every car faces +Z, its left is +X, wheels touch y = 0.
// The eight classics below keep their chunky low-poly look; the eight
// Taller bodies (taller-cars.js) use the filleted kit.

import * as THREE from 'three';
import {
  M, DECAL, CHROME, DARK, mesh, box, profile, tube, roundel, plate, bothSides, spot,
  makeWheel, fender, rig, detachable, cabin, lightBar, spareWheel, roundLamp, venezuelaFlag, flower,
  bevelBox, squareLamp, towLoop, bodyShell, profileFit,
} from './car-kit.js';
import { dress, stock, RIMS } from './car-parts.js';
import { TALLER_BUILDERS, TALLER_NUMBERS } from './taller-cars.js';

// build(avatar, wheel?, cfg?) → { root, driver, … }. Names and stats live with
// the game (Carreritas's car-definitions.js), keyed by the same ids. cfg is the
// garage's render config (car-parts.js); without it every car keeps its own
// stock parts. A slot that asks for another part replaces the stock one.
const CLASSICS = { chamo: buildChamo, lancha: buildLancha, machito: buildMachito, bala: buildBala, toro: buildToro, familiar: buildFamiliar, rumbera: buildRumbera, montanero: buildMontanero };
const NUMBERS = { chamo: 1, lancha: 2, machito: 3, bala: 4, toro: 5, familiar: 6, rumbera: 7, montanero: 8, ...TALLER_NUMBERS };
export const CAR_BUILDERS = Object.fromEntries(Object.entries({ ...CLASSICS, ...TALLER_BUILDERS }).map(([id, build]) =>
  [id, (avatar, wheel, cfg) => dress(build(avatar, wheel, cfg ?? {}), cfg ?? {}, { num: NUMBERS[id] })]));
// A garage wheel replaces the car's own (lifting the body if bigger); rin recolours rims.
const wheelSpec = (wheel, own, cfg) => ({ wheel: wheel ?? own, base: own, rim: RIMS[cfg.rin] });

// ---------- El Chamo ----------
// Every builder takes an optional wheel override (garage cauchos); without
// one it keeps its own spec, so parked cars and Studio previews are unchanged.
function buildChamo(avatar, wheel, cfg = {}) {
  const W = 2.3, red = '#e0262f';
  const car = rig({
    ...wheelSpec(wheel, { r: 0.69, w: 0.68, style: 'spokes', rim: '#6b707e', cap: '#e0262f' }, cfg),
    wheelPos: [[W / 2 + 0.02, 1.32, true], [-W / 2 - 0.02, 1.32, true], [W / 2 + 0.02, -1.32, false], [-W / 2 - 0.02, -1.32, false]],
  });
  const c = car.chassis;
  const paint = M(red);
  const deep = M('#a8141c');
  // lower body; with its bevel the top sits at y 1.56 and the nose at z 2.22
  c.add(profile([[-1.95, 0.55], [1.95, 0.55], [2.08, 0.8], [2.02, 1.2], [1.1, 1.42], [-1.95, 1.42], [-2.06, 1.15]], W, paint, 0.14));
  profileFit(car, [[-1.95, 0.55], [1.95, 0.55], [2.08, 0.8], [2.02, 1.2], [1.1, 1.42], [-1.95, 1.42], [-2.06, 1.15]], W, 0.14, { paint, axles: [1.32, -1.32], arch: 0.86 });
  for (const [x, z] of [[W / 2 + 0.02, 1.32], [-W / 2 - 0.02, 1.32], [W / 2 + 0.02, -1.32], [-W / 2 - 0.02, -1.32]]) {
    const f = fender(0.86, 0.76, '#262732');
    f.position.set(x, 0.69, z);
    c.add(f);
  }

  cabin(car, {
    glass: [[-1.86, 1.52], [0.95, 1.52], [0.3, 2.66], [-1.62, 2.68]],
    roof: [[-1.72, 2.66], [0.38, 2.66], [0.28, 2.84], [-1.56, 2.88], [-1.82, 2.76]],
    width: 2.04, bPillar: -0.62, pillar: paint, roofMat: paint,
    interior: '#2b2b33', seat: '#18181d',
    avatar, head: 0.5, seatY: 0.85, driverZ: -0.1, sill: 1.56,
    hanging(p) {   // little pine air freshener
      const tree = mesh(new THREE.ConeGeometry(0.09, 0.2, 4), M('#2fbf71'), 0, -0.32, 0);
      p.add(tree);
    },
  });

  // face
  for (const s of [1, -1]) {
    const lamp = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 12), M('#ffd23f', { emissive: '#6b5200' }), s * 0.66, 1.0, 2.2);
    lamp.rotation.x = Math.PI / 2;
    c.add(lamp);
    c.add(mesh(new THREE.TorusGeometry(0.27, 0.05, 6, 14), CHROME(), s * 0.66, 1.0, 2.26));
    c.add(mesh(new THREE.SphereGeometry(0.08, 6, 4), M('#f77f00', { emissive: '#3a1d00' }), s * 0.66, 0.66, 2.22));
    const fog = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), M('#fff3c4', { emissive: '#4a4220' }), s * 0.32, 0.66, 2.24);
    fog.rotation.x = Math.PI / 2;
    c.add(fog);
    const tail = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 10), M('#d00000', { emissive: '#4a0000' }), s * 0.8, 1.08, -2.22);
    tail.rotation.x = Math.PI / 2;
    c.add(tail);
    c.add(mesh(new THREE.TorusGeometry(0.18, 0.035, 5, 12), CHROME(), s * 0.8, 1.08, -2.26));
    // mud flaps behind the rear wheels
    c.add(box(0.46, 0.34, 0.04, DARK(), s * (W / 2 - 0.02), 0.42, -2.02));
  }
  c.add(box(0.86, 0.3, 0.06, DARK(), 0, 0.92, 2.23));
  for (let i = 0; i < 3; i++) c.add(box(0.8, 0.035, 0.05, CHROME(), 0, 0.84 + i * 0.08, 2.27));
  c.add(box(W - 0.2, 0.26, 0.3, DARK(), 0, 0.62, -2.18));
  const pipe = mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.4, 8), CHROME(), -0.6, 0.48, -2.34);
  pipe.rotation.x = Math.PI / 2;
  c.add(pipe);
  const rearPlate = plate('PANA·01');
  rearPlate.position.set(0, 0.95, -2.215);
  rearPlate.rotation.y = Math.PI;
  c.add(rearPlate);

  // hood: two white stripes and two vents, following the slope
  const slope = Math.atan2(1.42 - 1.2, 2.02 - 1.1);
  for (const s of [1, -1]) {
    const stripe = box(0.16, 0.012, 1.0, M('#fbf8f0', DECAL), s * 0.2, 1.47, 1.58);
    stripe.rotation.x = slope;
    if (stock(cfg, 'franjas')) c.add(stripe);
    const vent = box(0.34, 0.05, 0.18, DARK(), s * 0.62, 1.5, 1.45);
    vent.rotation.x = slope;
    c.add(vent);
  }
  // doors: seams, handles, side skirts, number
  for (const s of [1, -1]) {
    const x = s * (W / 2 + 0.006);
    c.add(box(0.012, 0.66, 0.025, DARK(), x, 1.2, 0.92));
    c.add(box(0.012, 0.86, 0.025, DARK(), x, 1.1, -0.6));
    c.add(box(0.03, 0.06, 0.2, CHROME(), s * (W / 2 + 0.02), 1.32, -0.38));
    c.add(box(0.03, 0.12, 1.1, DARK(), s * (W / 2 + 0.015), 0.6, 0.15));
  }
  if (stock(cfg, 'calcomania')) {
    bothSides(c, () => roundel(1, 0.36), W / 2 + 0.012, 1.02, 0.15);
    const top = roundel(1, 0.46);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, 2.955, -0.62);
    c.add(top);
  }

  // detachable bits
  const bar = new THREE.Group();
  const steel = M('#202026', { roughness: 0.45, metalness: 0.3 });
  for (const s of [1, -1]) bar.add(tube([s * 0.55, 0.42, 2.48], [s * 0.55, 1.36, 2.48], 0.08, steel));
  bar.add(tube([0.55, 1.36, 2.48], [-0.55, 1.36, 2.48], 0.08, steel));
  bar.add(box(1.72, 0.3, 0.26, steel, 0, 0.6, 2.5));
  for (const s of [1, -1]) bar.add(tube([s * 0.55, 0.92, 2.48], [s * 0.55, 0.92, 2.15], 0.06, steel));
  const frontPlate = plate('PANA·01');
  frontPlate.position.set(0, 0.6, 2.64);
  bar.add(frontPlate);
  if (stock(cfg, 'frente')) detachable(car, bar);
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 1.08, 1.56, 0.82], [s * 1.32, 1.74, 0.82], 0.03, DARK()));
    m.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), M('#1d1d23', { roughness: 0.35 }), s * 1.36, 1.78, 0.82));
    detachable(car, m);
  }
  const antenna = new THREE.Group();
  antenna.add(mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.15, 6), DARK(), 0.72, 3.52, -1.2));
  antenna.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), DARK(), 0.72, 4.12, -1.2));
  const flagShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.62, -0.17), new THREE.Vector2(0, -0.36)]);
  const flag = mesh(new THREE.ShapeGeometry(flagShape), M('#ffd23f', { side: THREE.DoubleSide }), 0.72, 4.02, -1.2);
  flag.rotation.y = -Math.PI / 2;
  antenna.add(flag);
  detachable(car, antenna);
  car.flag = flag;
  // the spoiler lip over the hatch
  if (stock(cfg, 'aleron')) c.add(bevelBox(2.0, 0.1, 0.36, deep, 0, 2.83, -1.82));
  for (const side of [-1, 1]) {
    c.add(bevelBox(0.17, 0.12, 1.22, deep, side * 1.2, 0.58, 0));
    c.add(box(0.06, 0.05, 1.05, CHROME(), side * 1.23, 1.43, 0.13));
  }
  return car;
}

// ---------- La Lancha ----------
function buildLancha(avatar, wheel, cfg = {}) {
  const W = 2.24, teal = '#1f9e8e', cream = '#f3e2bf';
  const car = rig({
    ...wheelSpec(wheel, { r: 0.64, w: 0.62, style: 'hubcap' }, cfg),
    wheelPos: [[W / 2, 1.38, true], [-W / 2, 1.38, true], [W / 2, -1.38, false], [-W / 2, -1.38, false]],
  });
  const c = car.chassis;
  const paint = M(teal);
  const roof = M(cream);
  // lower body; with its bevel the top sits at y 1.38 and the nose at z 2.22
  c.add(profile([[-2.05, 0.52], [2.05, 0.52], [2.1, 1.12], [1.05, 1.24], [-1.95, 1.26], [-2.1, 1.08]], W, paint, 0.12));
  profileFit(car, [[-2.05, 0.52], [2.05, 0.52], [2.1, 1.12], [1.05, 1.24], [-1.95, 1.26], [-2.1, 1.08]], W, 0.12, { paint, axles: [1.38, -1.38], arch: 0.81 });
  for (const [x, z] of [[W / 2, 1.38], [-W / 2, 1.38], [W / 2, -1.38], [-W / 2, -1.38]]) {
    const f = fender(0.81, 0.68, '#23433f');
    f.position.set(x, 0.64, z);
    c.add(f);
  }

  cabin(car, {
    glass: [[-1.42, 1.36], [0.72, 1.36], [0.12, 2.74], [-0.98, 2.76]],
    roof: [[-1.08, 2.72], [0.2, 2.72], [0.1, 2.92], [-0.98, 2.94], [-1.18, 2.82]],
    width: 2.0, bPillar: -0.36, pillar: roof, roofMat: roof,
    interior: '#3b2a22', seat: '#7a4a2b',
    avatar, head: 0.48, seatY: 0.58, driverZ: 0.02, sill: 1.38,
    hanging(p) {   // fuzzy dice
      for (const s of [1, -1]) {
        const die = box(0.13, 0.13, 0.13, M('#fbf8f0'), s * 0.07, -0.3 - (s > 0 ? 0 : 0.05), 0);
        die.rotation.set(0.4 * s, 0.5, 0.2);
        die.add(box(0.03, 0.03, 0.14, M('#16161a'), 0, 0, 0));
        p.add(die);
      }
    },
  });

  // Face: chrome grille, framed square lamps, hood ornament and latches.
  c.add(box(1.2, 0.36, 0.08, CHROME(), 0, 0.86, 2.23));
  for (let i = 0; i < 4; i++) c.add(box(1.08, 0.04, 0.1, DARK(), 0, 0.74 + i * 0.08, 2.25));
  for (const s of [1, -1]) {
    c.add(box(0.16, 0.1, 0.06, M('#f77f00', { emissive: '#3a1d00' }), s * 1.0, 0.66, 2.22));
    c.add(box(0.36, 0.14, 0.06, M('#d00000', { emissive: '#4a0000' }), s * 0.78, 0.98, -2.24));
    c.add(box(0.1, 0.06, 0.16, CHROME(), s * 0.45, 1.4, 1.6));       // hood latches
  }
  c.add(mesh(new THREE.ConeGeometry(0.05, 0.16, 5), CHROME(), 0, 1.44, 2.05));
  c.add(box(0.12, 0.08, 0.04, CHROME(), 0, 1.0, -2.23));                // trunk lock
  const rearPlate = plate('LAN·CHA');
  rearPlate.position.set(0, 0.78, -2.235);
  rearPlate.rotation.y = Math.PI;
  c.add(rearPlate);
  const frontPlate = plate('LAN·CHA');
  frontPlate.position.set(0, 0.56, 2.43);

  // sides: chrome trim, seams, handles, number, tape, a bit of rust
  for (const s of [1, -1]) {
    const x = s * (W / 2 + 0.006);
    c.add(box(0.02, 0.04, 4.0, CHROME(), s * (W / 2 + 0.012), 1.3, 0));
    for (const z of [0.72, -0.36, -1.42]) c.add(box(0.012, 0.74, 0.025, DARK(), x, 1.0, z));
    for (const z of [0.5, -0.62]) c.add(box(0.03, 0.05, 0.18, CHROME(), s * (W / 2 + 0.02), 1.18, z));
    c.add(box(0.02, 0.03, 1.6, CHROME(), s * 1.03, 2.76, -0.42));     // roof drip rail
  }
  if (stock(cfg, 'calcomania')) bothSides(c, () => roundel(2, 0.34), W / 2 + 0.012, 0.92, 0.18);
  bothSides(c, () => new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.1), M('#c9ccd4', DECAL)), W / 2 + 0.014, 1.2, -0.85);
  const rust = '#b4562a';
  for (const [y, z, size] of [[0.66, -0.7, 0.19], [0.77, -1.0, 0.15], [0.62, 0.55, 0.12], [1.15, 1.73, 0.15], [1.23, 0.5, 0.12], [1.2, -0.7, 0.13]]) {
    bothSides(c, () => spot(size, rust), W / 2 + 0.013, y, z);
  }
  for (const [x, z, size] of [[0.55, 1.75, 0.12], [-0.3, 1.45, 0.08], [-0.45, -1.7, 0.11], [0.6, -1.55, 0.07]]) {
    const r = spot(size, rust);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 1.39, z);
    c.add(r);
  }
  for (const side of [-1, 1]) {
    c.add(squareLamp(0.29, 0.32, side * 0.86, 0.93, 2.25));
    c.add(bevelBox(0.1, 0.12, 1.28, M('#22584f'), side * 1.16, 0.53, 0));
    c.add(box(0.025, 0.045, 1.36, CHROME(), side * 1.04, 2.76, -0.46));
  }

  // detachable bumpers and mirrors
  const rubber = M('#26262c', { roughness: 0.9 });
  for (const z of [2.36, -2.36]) {
    const b = new THREE.Group();
    b.add(box(W + 0.16, 0.3, 0.3, rubber, 0, 0.55, z));
    for (const s of [1, -1]) b.add(box(0.16, 0.5, 0.36, CHROME(), s * 0.55, 0.58, z));
    if (z > 0) {
      frontPlate.position.z = z + 0.16;
      b.add(frontPlate);
    }
    detachable(car, b);
  }
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 1.02, 1.42, 0.62], [s * 1.24, 1.56, 0.62], 0.03, CHROME()));
    m.add(box(0.1, 0.2, 0.28, CHROME(), s * 1.28, 1.62, 0.62));
    detachable(car, m);
  }
  return car;
}

// ---------- El Machito (short-wheelbase hardtop utility 4x4) ----------
function buildMachito(avatar, wheel, cfg = {}) {
  const W = 2.18;
  const car = rig({
    ...wheelSpec(wheel, { r: 0.72, w: 0.66, style: 'steel', rim: '#c1c2cd' }, cfg),
    wheelPos: [[1.12,1.25,true],[-1.12,1.25,true],[1.12,-1.25,false],[-1.12,-1.25,false]],
  });
  const c = car.chassis, paint = M('#ffc629'), trim = M('#ede4cf'), rubber = DARK();
  // Upright rear body, long flat bonnet and compact wheelbase.
  c.add(profile([[-2.03,0.57],[2.12,0.57],[2.12,1.32],[1.88,1.53],
    [0.7,1.57],[-2.03,1.57]],W,paint,0.06));
  profileFit(car, [[-2.03,0.57],[2.12,0.57],[2.12,1.32],[1.88,1.53],[0.7,1.57],[-2.03,1.57]], W, 0.06, { paint, axles: [1.25, -1.25], arch: 0.89 });
  for(const x of [-1.12,1.12]) for(const z of [-1.25,1.25]) {
    const arch=fender(0.89,0.74,'#292b34'); arch.position.set(x,0.72,z); c.add(arch);
  }
  cabin(car,{
    glass:[[-1.9,1.64],[0.65,1.64],[0.45,2.73],[-1.88,2.73]],
    roof:[[-2,2.75],[0.5,2.75],[0.5,2.86],[-2,2.86]],
    width:2.05,bPillar:-0.62,pillar:paint,roofMat:trim,
    interior:'#3b3c39',seat:'#494b44',avatar,head:0.47,seatY:0.94,driverZ:-0.2,sill:1.64,
  });
  // Continuous rain gutter and stamped door seams distinguish the hardtop.
  for(const side of [-1,1]) {
    c.add(box(0.055,0.07,2.64,trim,side*1.1,2.75,-0.75));
    c.add(box(0.035,0.62,0.035,rubber,side*1.13,1.22,-0.63));
    c.add(box(0.06,0.07,0.27,rubber,side*1.14,1.45,-0.43));
    c.add(box(0.3,0.12,1.55,rubber,side*1.18,0.49,-0.08));
    c.add(box(0.04,0.12,1.92,trim,side*1.14,0.91,-0.94));
    c.add(box(0.22,0.3,0.08,M('#d64130'),side*0.84,1.02,-2.11));
    const mirror=new THREE.Group();
    mirror.add(tube([side*1.03,1.92,0.52],[side*1.3,2.01,0.54],0.035,rubber));
    mirror.add(box(0.1,0.28,0.3,rubber,side*1.35,2.04,0.54));
    detachable(car,mirror);
  }
  // Broad horizontal grille and square headlamp surrounds, no vertical slots.
  c.add(box(1.35,0.48,0.1,rubber,0,1.17,2.2));
  for(const y of [1.02,1.14,1.26,1.38]) c.add(box(1.32,0.035,0.035,CHROME(),0,y,2.27));
  c.add(box(0.26,0.12,0.04,trim,0,1.19,2.3));
  for(const side of [-1,1]) {
    c.add(box(0.47,0.46,0.12,trim,side*0.85,1.19,2.19));
    c.add(box(0.34,0.29,0.05,M('#ffe5a0',{emissive:'#ffbb46',emissiveIntensity:0.65}),side*0.85,1.24,2.27));
    c.add(box(0.33,0.09,0.05,M('#ef9c2a'),side*0.85,1.02,2.27));
  }
  const bumper=new THREE.Group();
  bumper.add(box(2.4,0.28,0.3,rubber,0,0.66,2.26));
  bumper.add(box(0.65,0.22,0.28,M('#697273'),0,0.87,2.35));
  for (const side of [-1, 1]) bumper.add(towLoop(side * 0.82, 0.65, 2.45));
  if (stock(cfg, 'frente')) detachable(car,bumper);
  c.add(box(2.28,0.22,0.25,rubber,0,0.61,-2.14));
  const spare=spareWheel(0.59,0.38); spare.position.set(0.35,1.37,-2.27); detachable(car,spare);
  const snorkel=new THREE.Group();
  snorkel.add(tube([-1.13,1.4,0.98],[-1.13,2.45,0.53],0.085,rubber));
  snorkel.add(box(0.25,0.22,0.3,rubber,-1.13,2.52,0.52));
  detachable(car,snorkel);
  const roofRack = new THREE.Group();
  for (const side of [-1, 1]) roofRack.add(bevelBox(0.09, 0.12, 2.1, rubber, side * 0.78, 3.0, -0.7));
  for (const z of [-1.55, 0.13]) roofRack.add(box(1.65, 0.08, 0.1, rubber, 0, 3.02, z));
  roofRack.add(lightBar(4, 0.46, 3.08, 0.17, 0.22));
  if (stock(cfg, 'techo')) detachable(car, roofRack);
  c.add(bevelBox(0.65, 0.1, 0.27, rubber, 0, 1.67, 1.48));
  return car;
}

// ---------- La Bala (blue rally hatch) ----------
function buildBala(avatar, wheel, cfg = {}) {
  const W = 2.24, blue = '#3d7bf2';
  const car = rig({
    ...wheelSpec(wheel, { r: 0.65, w: 0.66, style: 'spokes', rim: '#d8ddea', cap: '#ff4b4b' }, cfg),
    wheelPos: [[W / 2 + 0.02, 1.3, true], [-W / 2 - 0.02, 1.3, true], [W / 2 + 0.02, -1.3, false], [-W / 2 - 0.02, -1.3, false]],
  });
  const c = car.chassis;
  const paint = M(blue);
  const white = M('#f3e9d7', { ...DECAL });
  // low hatch; with its bevel the top sits at y 1.4 and the nose at z 2.22
  c.add(profile([[-1.95, 0.5], [1.95, 0.5], [2.1, 0.85], [1.95, 1.12], [0.95, 1.28], [-1.9, 1.28], [-2.05, 1.02]], W, paint, 0.12));
  profileFit(car, [[-1.95, 0.5], [1.95, 0.5], [2.1, 0.85], [1.95, 1.12], [0.95, 1.28], [-1.9, 1.28], [-2.05, 1.02]], W, 0.12, { paint, axles: [1.3, -1.3], arch: 0.83 });
  for (const [x, z] of [[W / 2 + 0.02, 1.3], [-W / 2 - 0.02, 1.3], [W / 2 + 0.02, -1.3], [-W / 2 - 0.02, -1.3]]) {
    const f = fender(0.83, 0.72, '#224682');
    f.position.set(x, 0.65, z);
    c.add(f);
  }
  cabin(car, {
    glass: [[-1.8, 1.4], [0.9, 1.4], [0.3, 2.45], [-1.55, 2.48]],
    roof: [[-1.65, 2.44], [0.38, 2.44], [0.28, 2.62], [-1.5, 2.66], [-1.75, 2.56]],
    width: 2.0, bPillar: -0.55, pillar: paint, roofMat: paint,
    interior: '#22222a', seat: '#18181d',
    avatar, head: 0.5, seatY: 0.85, driverZ: -0.05, sill: 1.4,
  });
  // the white center stripe, over the hood and the roof
  if (stock(cfg, 'franjas')) {
    const hood = box(0.52, 0.012, 1.05, white, 0, 1.33, 1.45);
    hood.rotation.x = Math.atan2(1.28 - 1.12, 1.95 - 0.95);
    c.add(hood);
    c.add(box(0.52, 0.012, 1.65, white, 0, 2.735, -0.62));
    c.add(box(0.52, 0.3, 0.012, white, 0, 0.95, 2.215));
  }
  for (const s of [1, -1]) c.add(squareLamp(0.28, 0.26, s * 0.8, 1.03, 2.22));
  c.add(bevelBox(1.1, 0.24, 0.13, DARK(), 0, 0.93, 2.25));
  c.add(bevelBox(2.23, 0.17, 0.42, M('#1d2c49'), 0, 0.53, 2.25));
  for (const side of [-1, 1]) {
    c.add(bevelBox(0.16, 0.17, 1.35, M('#1c3770'), side * 1.19, 0.5, 0));
    c.add(box(0.03, 0.06, 0.24, DARK(), side * 1.15, 1.25, -0.32));
    c.add(box(0.025, 0.58, 0.03, M('#1b4594'), side * 1.145, 1.0, 0.73));
    c.add(box(0.22, 0.14, 0.07, M('#e5333f', { emissive: '#61101b' }), side * 0.8, 1.03, -2.16));
    c.add(box(0.46, 0.3, 0.05, M('#172947'), side * 1.14, 0.35, -1.98));
  }
  if (stock(cfg, 'calcomania')) bothSides(c, () => roundel(4, 0.27), W / 2 + 0.02, 0.97, 0.02);
  const rear = plate('BALA·4');
  rear.position.set(0, 0.9, -2.175);
  rear.rotation.y = Math.PI;
  c.add(rear);
  // bolt-ons
  if (stock(cfg, 'frente')) detachable(car, lightBar(3, 0.47, 0.64, 2.4, 0.23));
  const wing = new THREE.Group();
  for (const s of [1, -1]) wing.add(box(0.08, 0.3, 0.12, DARK(), s * 0.6, 2.76, -1.7));
  wing.add(box(2.0, 0.08, 0.46, paint, 0, 2.94, -1.78));
  for (const s of [1, -1]) wing.add(box(0.06, 0.24, 0.5, DARK(), s * 1.0, 2.94, -1.78));
  if (stock(cfg, 'aleron')) detachable(car, wing);
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 1.02, 1.52, 0.78], [s * 1.24, 1.62, 0.78], 0.03, DARK()));
    m.add(box(0.1, 0.16, 0.26, paint, s * 1.28, 1.66, 0.78));
    detachable(car, m);
  }
  return car;
}

// ---------- El Toro (red and white pickup) ----------
function buildToro(avatar, wheel, cfg = {}) {
  const W = 2.3, red = '#e0262f';
  const car = rig({
    ...wheelSpec(wheel, { r: 0.73, w: 0.72, style: 'steel', rim: '#aeb7c7' }, cfg),
    wheelPos: [[W / 2 + 0.04, 1.45, true], [-W / 2 - 0.04, 1.45, true], [W / 2 + 0.04, -1.4, false], [-W / 2 - 0.04, -1.4, false]],
  });
  const c = car.chassis;
  const paint = M(red);
  // long body; with its bevel the top sits at y 1.48, nose z 2.25, tail z -2.25
  c.add(profile([[-2.15, 0.6], [2.1, 0.6], [2.15, 1.25], [1.05, 1.38], [-2.15, 1.38]], W, paint, 0.1));
  profileFit(car, [[-2.15, 0.6], [2.1, 0.6], [2.15, 1.25], [1.05, 1.38], [-2.15, 1.38]], W, 0.1, { paint, axles: [1.45, -1.4], arch: 0.92 });
  if (stock(cfg, 'franjas')) bothSides(c, () => new THREE.Mesh(new THREE.PlaneGeometry(4.3, 0.28), M('#f3e9d7', DECAL)), W / 2 + 0.008, 0.84, 0);
  for (const [x, z] of [[W / 2 + 0.04, 1.45], [-W / 2 - 0.04, 1.45], [W / 2 + 0.04, -1.4], [-W / 2 - 0.04, -1.4]]) {
    const f = fender(0.92, 0.8, '#2e3039');
    f.position.set(x, 0.73, z);
    c.add(f);
  }
  cabin(car, {
    glass: [[-0.6, 1.48], [0.85, 1.48], [0.4, 2.52], [-0.55, 2.54]],
    roof: [[-0.68, 2.5], [0.48, 2.5], [0.4, 2.7], [-0.62, 2.72]],
    width: 2.04, bPillar: -0.25, pillar: paint, roofMat: paint,
    interior: '#2b2b33', seat: '#7a4a2b',
    avatar, head: 0.5, seatY: 0.9, driverZ: 0.15, sill: 1.48,
  });
  // the bed: side walls and a tailgate
  car.fit.bed = { zF: -0.66, zR: -2.2 };
  car.fit.cargo = { z: -1.42, y: 1.53, half: 0.7, len: 1.3 };
  for (const s of [1, -1]) c.add(box(0.1, 0.34, 1.52, paint, s * (W / 2 - 0.06), 1.64, -1.45));
  c.add(box(W - 0.1, 0.34, 0.1, paint, 0, 1.64, -2.2));
  c.add(box(W - 0.24, 0.06, 1.34, M('#582c28'), 0, 1.5, -1.42));
  for (const x of [-0.7, -0.35, 0, 0.35, 0.7]) c.add(box(0.035, 0.04, 1.3, M('#a7453b'), x, 1.55, -1.42));
  for (const side of [-1, 1]) {
    c.add(box(0.035, 0.64, 0.03, M('#9b222c'), side * 1.16, 1.1, -0.55));
    c.add(bevelBox(0.08, 0.07, 0.25, CHROME(), side * 1.18, 1.37, -0.27));
    c.add(bevelBox(0.3, 0.12, 1.15, DARK(), side * 1.22, 0.48, -0.02));
    c.add(box(0.24, 0.36, 0.08, M('#ed313c', { emissive: '#5b1313' }), side * 0.9, 1.14, -2.27));
  }
  c.add(bevelBox(0.36, 0.07, 0.04, CHROME(), 0, 1.68, -2.26));
  // face: black grille with chrome surround, square lamps
  c.add(box(1.36, 0.46, 0.06, CHROME(), 0, 0.98, 2.25));
  c.add(box(1.24, 0.36, 0.06, DARK(), 0, 0.98, 2.27));
  for (const s of [1, -1]) c.add(squareLamp(0.31, 0.34, s * 0.88, 1.04, 2.26));
  for (const y of [0.87, 0.99, 1.11]) c.add(box(1.2, 0.035, 0.08, CHROME(), 0, y, 2.32));
  // bolt-ons
  if (stock(cfg, 'techo')) detachable(car, lightBar(3, 0.49, 2.82, 0.2, 0.22));
  const rails = new THREE.Group();
  const wood = M('#9a6a3a', { roughness: 0.9 });
  for (const s of [1, -1]) {
    for (const z of [-0.72, -1.45, -2.18]) rails.add(box(0.08, 0.42, 0.08, wood, s * (W / 2 - 0.06), 2.0, z));
    for (const y of [1.98, 2.18]) rails.add(box(0.06, 0.08, 1.56, wood, s * (W / 2 - 0.06), y, -1.45));
  }
  detachable(car, rails);
  const cooler = new THREE.Group();
  cooler.add(bevelBox(0.88, 0.57, 0.65, M('#eb454d'), 0.35, 1.85, -1.3));
  cooler.add(bevelBox(0.93, 0.12, 0.7, M('#f3e9d7'), 0.35, 2.2, -1.3));
  cooler.add(box(0.3, 0.07, 0.08, M('#f3e9d7'), 0.35, 2.3, -1.3));
  cooler.add(box(0.12, 0.18, 0.05, CHROME(), 0.35, 1.98, -0.96));
  for (const side of [-1, 1]) cooler.add(box(0.08, 0.2, 0.25, M('#f3e9d7'), 0.35 + side * 0.48, 1.98, -1.3));
  if (stock(cfg, 'techo')) detachable(car, cooler);
  const bumper = new THREE.Group();
  bumper.add(bevelBox(W + 0.1, 0.25, 0.3, CHROME(), 0, 0.62, 2.32));
  for (const side of [-1, 1]) {
    bumper.add(bevelBox(0.16, 0.76, 0.23, DARK(), side * 0.58, 0.98, 2.51));
    bumper.add(towLoop(side * 0.93, 0.56, 2.45));
  }
  bumper.add(bevelBox(1.27, 0.13, 0.2, DARK(), 0, 1.36, 2.51));
  const front = plate('TORO·5');
  front.position.set(0, 0.62, 2.46);
  bumper.add(front);
  if (stock(cfg, 'frente')) detachable(car, bumper);
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 1.04, 1.62, 0.7], [s * 1.26, 1.74, 0.7], 0.03, CHROME()));
    m.add(box(0.1, 0.24, 0.3, CHROME(), s * 1.3, 1.8, 0.7));
    detachable(car, m);
  }
  return car;
}

// ---------- La Familiar (green sedan with a loaded roof rack) ----------
function buildFamiliar(avatar, wheel, cfg = {}) {
  const W = 2.24, green = '#3f9d4a';
  const car = rig({
    ...wheelSpec(wheel, { r: 0.63, w: 0.59, style: 'hubcap' }, cfg),
    wheelPos: [[W / 2, 1.38, true], [-W / 2, 1.38, true], [W / 2, -1.38, false], [-W / 2, -1.38, false]],
  });
  const c = car.chassis;
  const paint = M(green);
  // with its bevel the top sits at y 1.36 and the nose at z 2.24
  c.add(profile([[-2.1, 0.52], [2.1, 0.52], [2.12, 1.1], [1.1, 1.22], [-2.0, 1.24], [-2.12, 1.06]], W, paint, 0.12));
  profileFit(car, [[-2.1, 0.52], [2.1, 0.52], [2.12, 1.1], [1.1, 1.22], [-2.0, 1.24], [-2.12, 1.06]], W, 0.12, { paint, axles: [1.38, -1.38], arch: 0.8 });
  for (const [x, z] of [[W / 2, 1.38], [-W / 2, 1.38], [W / 2, -1.38], [-W / 2, -1.38]]) {
    const f = fender(0.8, 0.65, '#285a41');
    f.position.set(x, 0.63, z);
    c.add(f);
  }
  cabin(car, {
    glass: [[-1.5, 1.34], [0.78, 1.34], [0.2, 2.6], [-1.15, 2.62]],
    roof: [[-1.22, 2.58], [0.3, 2.58], [0.2, 2.76], [-1.12, 2.78], [-1.32, 2.68]],
    width: 2.0, bPillar: -0.4, pillar: paint, roofMat: paint,
    interior: '#3b2a22', seat: '#c9b38a',
    avatar, head: 0.48, seatY: 0.62, driverZ: 0.05, sill: 1.36,
    hanging(p) {   // a rosary swinging from the mirror
      const bead = M('#7a4a2b');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        p.add(mesh(new THREE.SphereGeometry(0.025, 5, 4), bead, Math.sin(a) * 0.07, -0.3 + Math.cos(a) * 0.07, 0));
      }
      p.add(box(0.025, 0.12, 0.02, M('#d9a441'), 0, -0.44, 0));
      p.add(box(0.07, 0.025, 0.02, M('#d9a441'), 0, -0.42, 0));
    },
  });
  // face: chrome grille, square lamps; chrome side trim, seams and handles
  c.add(box(1.24, 0.34, 0.08, CHROME(), 0, 0.86, 2.24));
  for (let i = 0; i < 3; i++) c.add(box(1.1, 0.04, 0.1, DARK(), 0, 0.76 + i * 0.09, 2.26));
  for (const s of [1, -1]) {
    c.add(squareLamp(0.3, 0.31, s * 0.86, 0.94, 2.25));
    const x = s * (W / 2 + 0.006);
    c.add(box(0.02, 0.04, 4.0, CHROME(), s * (W / 2 + 0.012), 1.24, 0));
    for (const z of [0.78, -0.4, -1.5]) c.add(box(0.012, 0.7, 0.025, DARK(), x, 0.98, z));
    for (const z of [0.55, -0.66]) c.add(box(0.03, 0.05, 0.18, CHROME(), s * (W / 2 + 0.02), 1.12, z));
    c.add(box(0.04, 0.1, 1.28, M('#e3dfc2'), s * 1.14, 0.56, 0));
    c.add(box(0.28, 0.19, 0.07, M('#c73b32', { emissive: '#4a100c' }), s * 0.86, 1.0, -2.24));
  }
  const rear = plate('FAM·6');
  rear.position.set(0, 0.8, -2.245);
  rear.rotation.y = Math.PI;
  c.add(rear);
  // roof rack (fixed) and the luggage on it (flies off)
  const rack = DARK();
  for (const s of [1, -1]) c.add(box(0.06, 0.06, 1.5, rack, s * 0.75, 2.86, -0.46));
  for (const z of [0.2, -0.46, -1.12]) c.add(box(1.56, 0.05, 0.06, rack, 0, 2.86, z));
  for (const side of [-1, 1]) {
    c.add(tube([side * 0.81, 2.86, 0.26], [side * 0.81, 3.1, 0.26], 0.035, CHROME()));
    c.add(tube([side * 0.81, 2.86, -1.18], [side * 0.81, 3.1, -1.18], 0.035, CHROME()));
    c.add(tube([side * 0.81, 3.1, 0.26], [side * 0.81, 3.1, -1.18], 0.035, CHROME()));
  }
  const suitcase = (w, h, d, color, x, y, z) => {
    const g = new THREE.Group();
    g.add(bevelBox(w, h, d, M(color), x, y, z));
    for (const side of [-1, 1]) {
      g.add(box(0.06, h + 0.02, d + 0.02, M('#2b1d14'), x + side * w * 0.3, y, z));
      g.add(box(0.085, 0.07, 0.025, CHROME(), x + side * w * 0.3, y + 0.03, z + d / 2 + 0.02));
    }
    g.add(box(0.2, 0.05, 0.08, M('#2b1d14'), x, y + h / 2 + 0.02, z));
    return g;
  };
  if (stock(cfg, 'techo')) {
    detachable(car, suitcase(0.92, 0.38, 0.67, '#8b5a2b', -0.28, 3.09, -0.25));
    detachable(car, suitcase(0.72, 0.32, 0.55, '#d9772b', -0.28, 3.46, -0.3));
  }
  const pot = new THREE.Group();
  const steel = M('#c9ccd4', { metalness: 0.6, roughness: 0.3 });
  pot.add(mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.3, 12), steel, 0.48, 3.05, -0.8));
  pot.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 12), steel, 0.48, 3.22, -0.8));
  pot.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), DARK(), 0.48, 3.27, -0.8));
  for (const s of [1, -1]) pot.add(box(0.1, 0.04, 0.05, DARK(), 0.48 + s * 0.28, 3.12, -0.8));
  if (stock(cfg, 'techo')) detachable(car, pot);
  for (const z of [2.36, -2.36]) {
    const b = new THREE.Group();
    b.add(box(W + 0.16, 0.24, 0.26, CHROME(), 0, 0.55, z));
    detachable(car, b);
  }
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 1.02, 1.42, 0.66], [s * 1.24, 1.54, 0.66], 0.03, CHROME()));
    m.add(box(0.1, 0.2, 0.28, CHROME(), s * 1.28, 1.6, 0.66));
    detachable(car, m);
  }
  return car;
}

// ---------- La Rumbera (pink beetle with a sound system) ----------
function buildRumbera(avatar, wheel, cfg = {}) {
  const W = 2.2, pink = '#ff4fa3';
  const car = rig({
    ...wheelSpec(wheel, { r: 0.64, w: 0.62, style: 'steel', rim: '#ef68ab' }, cfg),
    wheelPos: [[W / 2, 1.3, true], [-W / 2, 1.3, true], [W / 2, -1.3, false], [-W / 2, -1.3, false]],
  });
  const c = car.chassis;
  const paint = M(pink);
  // A crowned bonnet tapers between the two round eyes; the rear narrows too.
  c.add(bodyShell([[-2.1, 0.82, 0.55, 0.86, 1.03], [-1.5, 1.07, 0.55, 1.12, 1.3],
    [-0.8, 1.1, 0.55, 1.3, 1.44], [0.65, 1.1, 0.55, 1.26, 1.42],
    [1.22, 1.03, 0.55, 1.13, 1.34], [1.8, 0.84, 0.55, 0.9, 1.14],
    [2.17, 0.62, 0.6, 0.76, 0.87]], paint));
  // the crowned shell's centre line, for parts
  profileFit(car, [[2.17, 0.6], [2.17, 0.87], [1.8, 1.14], [1.22, 1.34], [0.65, 1.42], [-0.8, 1.44], [-1.5, 1.3], [-2.1, 1.03], [-2.1, 0.55], [1.8, 0.55]], W, 0, { paint, axles: [1.3, -1.3], arch: 0.84 });
  for (const [x, z] of [[W / 2, 1.3], [-W / 2, 1.3], [W / 2, -1.3], [-W / 2, -1.3]]) {
    const f = fender(0.84, 0.74, pink);
    f.position.set(x, 0.64, z);
    c.add(f);
  }
  cabin(car, {
    glass: [[-1.2, 1.44], [0.7, 1.44], [0.12, 2.42], [-0.9, 2.44]],
    roof: [[-0.98, 2.38], [0.22, 2.38], [0.1, 2.56], [-0.4, 2.62], [-0.88, 2.56], [-1.06, 2.46]],
    width: 1.9, bPillar: -0.3, pillar: paint, roofMat: paint,
    interior: '#2b2b33', seat: '#f3e9d7',
    avatar, head: 0.48, seatY: 0.75, driverZ: 0.0, sill: 1.46,
  });
  // bug eyes on the front fenders, a chrome nose line, flowers on the doors
  for (const s of [1, -1]) c.add(roundLamp(s * 0.78, 1.12, 2.1, 0.29, '#ffe59c'));
  c.add(box(0.05, 0.5, 0.04, CHROME(), 0, 1.15, 1.98));
  if (stock(cfg, 'calcomania')) bothSides(c, () => flower(0.39), W / 2 + 0.025, 1.0, -0.08);
  for (const side of [-1, 1]) {
    c.add(bevelBox(0.22, 0.1, 1.3, M('#923560'), side * 1.14, 0.54, 0));
    c.add(box(0.04, 0.05, 0.22, CHROME(), side * 1.13, 1.3, -0.35));
    c.add(roundLamp(side * 0.78, 0.98, -2.11, 0.14, '#c62a35'));
  }
  for (const z of [2.28, -2.26]) {
    const bumper = new THREE.Group();
    bumper.add(bevelBox(2.1, 0.19, 0.23, CHROME(), 0, 0.59, z));
    for (const side of [-1, 1]) bumper.add(bevelBox(0.18, 0.38, 0.26, DARK(), side * 0.67, 0.67, z));
    detachable(car, bumper);
  }
  const rear = plate('RUM·BA');
  rear.position.set(0, 0.8, -2.19);
  rear.rotation.y = Math.PI;
  c.add(rear);
  // the sound system strapped to the roof (flies off)
  const speakers = new THREE.Group();
  speakers.add(bevelBox(1.75, 0.68, 0.68, M('#1d1d23'), 0, 3.03, -0.42));
  speakers.add(bevelBox(0.76, 0.44, 0.58, M('#26262d'), 0, 3.57, -0.46));
  for (const [x, y, r] of [[-0.53, 3.03, 0.22], [0.53, 3.03, 0.22], [0, 3.57, 0.17]]) {
    const cone = mesh(new THREE.CylinderGeometry(r, r * 0.7, 0.06, 12), M('#4a4a52'), x, y, -0.04);
    cone.rotation.x = Math.PI / 2;
    speakers.add(cone);
    speakers.add(mesh(new THREE.TorusGeometry(r + 0.025, 0.025, 5, 12), M('#cf732c'), x, y, -0.005));
    const dustCap = mesh(new THREE.SphereGeometry(r * 0.4, 8, 5), DARK(), x, y, 0);
    dustCap.scale.z = 0.4; speakers.add(dustCap);
  }
  for (const s of [1, -1]) speakers.add(box(0.06, 0.75, 0.74, M('#ff8a1f'), s * 0.77, 3.03, -0.42));
  if (stock(cfg, 'techo')) detachable(car, speakers);
  const flagGroup = new THREE.Group();
  flagGroup.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.4, 6), DARK(), 0.82, 3.25, -0.95));
  const flag = mesh(new THREE.PlaneGeometry(0.78, 0.52), venezuelaFlag(), 0.82, 3.66, -1.36);
  flag.material.side = THREE.DoubleSide;
  flag.rotation.y = Math.PI / 2;
  flagGroup.add(flag);
  detachable(car, flagGroup);
  car.flag = flag;
  return car;
}

// ---------- El Montañero (camo buggy) ----------
function buildMontanero(avatar, wheel, cfg = {}) {
  const W = 2.3, olive = '#6b7a3a';
  const car = rig({
    ...wheelSpec(wheel, { r: 0.81, w: 0.78, style: 'steel', rim: '#aeb3bc' }, cfg),
    wheelPos: [[W / 2 + 0.08, 1.32, true], [-W / 2 - 0.08, 1.32, true], [W / 2 + 0.08, -1.32, false], [-W / 2 - 0.08, -1.32, false]],
  });
  const c = car.chassis;
  const paint = M(olive);
  // low tub; with its bevel the top sits at y 1.38
  c.add(profile([[-1.85, 0.66], [1.9, 0.66], [2.05, 1.15], [1.15, 1.28], [-1.85, 1.28]], W, paint, 0.1));
  profileFit(car, [[-1.85, 0.66], [1.9, 0.66], [2.05, 1.15], [1.15, 1.28], [-1.85, 1.28]], W, 0.1, { paint, axles: [1.32, -1.32], arch: 1.0 });
  for (const [x, z] of [[W / 2 + 0.08, 1.32], [-W / 2 - 0.08, 1.32], [W / 2 + 0.08, -1.32], [-W / 2 - 0.08, -1.32]]) {
    const f = fender(1.0, 0.84, '#3b442b');
    f.position.set(x, 0.81, z);
    c.add(f);
  }
  // camo: brown and dark green blobs on the sides and the hood
  const camo = ['#a76e37', '#34401c', '#825c30'];
  if (stock(cfg, 'acabado')) [[0.95, 0.6, 0.2], [0.85, -0.3, 0.16], [1.05, -1.1, 0.18], [0.8, 1.2, 0.12], [1.1, -0.7, 0.1]].forEach(([y, z, s], i) => {
    bothSides(c, () => spot(s * 1.55, camo[i % 3]), W / 2 + 0.012, y, z);
  });
  if (stock(cfg, 'acabado')) [[0.45, 1.6, 0.2], [-0.4, 1.75, 0.16], [0.1, 1.35, 0.12]].forEach(([x, z, s], i) => {
    const sp = spot(s, camo[i % 3]);
    sp.rotation.x = -Math.PI / 2;
    sp.position.set(x, 1.385, z);
    c.add(sp);
  });
  cabin(car, {
    open: true,
    glass: [[-1.2, 1.38], [0.95, 1.38], [0.8, 2.15], [-1.2, 2.15]],
    width: 2.0, pillar: M('#1d1d23', { roughness: 0.5 }),
    interior: '#2b2b33', seat: '#3a3a30',
    avatar, head: 0.5, seatY: 0.82, driverZ: -0.2, sill: 1.38,
  });
  // the roll cage; roof cargo rides on its top, spare stuff on the deck
  const cage = M('#1d1d23', { roughness: 0.5 });
  car.fit.roof = { zF: 0.3, zR: -1.25, top: 2.69, half: 0.9, y: () => 2.69 };
  car.fit.cargo = { z: -1.45, y: 1.4, half: 0.7, len: 0.7 };
  for (const s of [1, -1]) {
    c.add(tube([s * 0.92, 2.15, 0.8], [s * 0.9, 2.62, 0.3], 0.07, cage));
    c.add(tube([s * 0.9, 2.62, 0.3], [s * 0.92, 2.6, -1.25], 0.07, cage));
    c.add(tube([s * 0.92, 2.6, -1.25], [s * 0.98, 1.36, -1.7], 0.07, cage));
    c.add(tube([s * 0.92, 2.6, -1.25], [s * 0.98, 1.36, -0.9], 0.05, cage));
  }
  for (const z of [0.3, -1.25]) c.add(tube([0.9, 2.62, z], [-0.9, 2.62, z], 0.07, cage));
  c.add(tube([0.9, 2.6, -1.25], [-0.9, 1.4, -1.7], 0.065, cage));
  for (const side of [-1, 1]) {
    c.add(tube([side * 1.16, 0.56, -0.7], [side * 1.16, 0.56, 0.75], 0.085, cage));
    c.add(squareLamp(0.27, 0.25, side * 0.82, 1.05, 2.13));
    c.add(bevelBox(0.06, 0.12, 0.25, DARK(), side * 0.73, 1.42, 1.45));
  }
  // bolt-ons
  if (stock(cfg, 'techo')) detachable(car, lightBar(2, 0.58, 2.66, 0.34, 0.25));
  const winch = new THREE.Group();
  for (const s of [1, -1]) winch.add(tube([s * 0.6, 0.55, 2.3], [s * 0.6, 1.2, 2.3], 0.06, cage));
  winch.add(tube([0.6, 1.2, 2.3], [-0.6, 1.2, 2.3], 0.06, cage));
  winch.add(box(1.0, 0.24, 0.3, DARK(), 0, 0.68, 2.3));
  const drum = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 10), M('#c9ccd4', { metalness: 0.5, roughness: 0.4 }), 0, 0.68, 2.48);
  drum.rotation.z = Math.PI / 2;
  winch.add(drum);
  for (let i = -3; i <= 3; i++) {
    const coil = mesh(new THREE.TorusGeometry(0.125, 0.022, 4, 10), M('#ce692c'), i * 0.065, 0.68, 2.48);
    coil.rotation.y = Math.PI / 2;
    winch.add(coil);
  }
  for (const side of [-1, 1]) winch.add(towLoop(side * 0.84, 0.61, 2.35));
  winch.add(mesh(new THREE.TorusGeometry(0.07, 0.025, 5, 10, Math.PI * 1.4), M('#ff4b4b'), 0, 0.52, 2.58));
  if (stock(cfg, 'frente')) detachable(car, winch);
  const can = new THREE.Group();
  can.add(box(0.2, 0.46, 0.36, M('#e0262f'), -1.08, 1.6, -1.45));
  can.add(box(0.06, 0.08, 0.12, DARK(), -1.08, 1.86, -1.36));
  detachable(car, can);
  const spare = spareWheel(0.6, 0.52);
  spare.position.set(0, 1.4, -2.0);
  detachable(car, spare);
  const shovel = new THREE.Group();
  shovel.add(tube([1.07, 1.42, -1.65], [0.95, 2.55, -1.16], 0.05, M('#95612f')));
  const blade = bevelBox(0.29, 0.39, 0.065, M('#777b7d'), 1.07, 1.42, -1.65);
  blade.rotation.x = 0.4; shovel.add(blade);
  detachable(car, shovel);
  return car;
}
