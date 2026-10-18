// The Pana cars: one builder per car, shared by Derrape's garage and Bululú's
// ¡Choque de carritos!. Shared parts live in car-kit.js; the
// driver is the player's pana (see /engine/models/characters/pana/avatar-model.js).
// Every car faces +Z, its left is +X, wheels touch y = 0.

import * as THREE from 'three';
import {
  M, DECAL, CHROME, DARK, mesh, box, profile, tube, roundel, plate, bothSides, spot,
  makeWheel, fender, rig, detachable, cabin, lightBar, spareWheel, roundLamp, venezuelaFlag, flower,
  bevelBox, squareLamp, towLoop, bodyShell,
  S, PAINT, LENS, AMBER, TAIL, rbox, shellBody, archFlare, domeLamp, rectLamp, extrudeX, roundedPath,
} from './car-kit.js';
import { dress, stock, spoiler, roofCargo, decal, stripes, finish, RIMS } from './car-parts.js';

// build(avatar, wheel?, cfg?) → { root, driver, … }. Names and stats live with
// the game (Derrape's car-definitions.js), keyed by the same ids. cfg is the
// garage's render config (car-parts.js): spoiler, roof cargo, decal, stripes,
// finish, rim colour; without it every car keeps its own stock parts.
const BUILDERS = { chamo: buildChamo, lancha: buildLancha, machito: buildMachito, bala: buildBala, toro: buildToro, familiar: buildFamiliar, rumbera: buildRumbera, montanero: buildMontanero };
const NUMBERS = { chamo: 1, lancha: 2, machito: 3, bala: 4, toro: 5, familiar: 6, rumbera: 7, montanero: 8 };
export const CAR_BUILDERS = Object.fromEntries(Object.entries(BUILDERS).map(([id, build]) =>
  [id, (avatar, wheel, cfg = {}) => dress(build(avatar, wheel, cfg ?? {}), cfg ?? {}, { num: NUMBERS[id] })]));

// Four wheels: [x, z, front].
const corners = (x, zF, zR = -zF) => [[x, zF, true], [-x, zF, true], [x, zR, false], [-x, zR, false]];
const rimOf = cfg => RIMS[cfg.rin];

// ---------- El Chamo (red beetle rally car) ----------
// Every builder takes an optional wheel override (garage cauchos); without
// one it keeps its own spec, so parked cars and Studio previews are unchanged.
function buildChamo(avatar, wheel, cfg = {}) {
  const red = '#e0262f';
  const own = { r: 0.69, w: 0.68, style: 'cinco', rim: '#6b707e', cap: '#e0262f' };
  const car = rig({ wheel: wheel ?? own, base: own, rim: rimOf(cfg), wheelPos: corners(1.17, 1.3) });
  const c = car.chassis;
  const paint = PAINT(red);
  // a round-backed bug: big fillets everywhere, pinched nose and tail
  const fit = shellBody(car, {
    side: [[2.0, 0.52, 0.12], [2.16, 0.86, 0.34], [1.9, 1.3, 0.5], [1.05, 1.5, 0.3], [0.86, 1.52, 0.04],
      [-1.15, 1.52, 0.04], [-1.6, 1.42, 0.5], [-2.16, 0.98, 0.45], [-2.08, 0.52, 0.12]],
    width: 2.18, axles: [1.3, -1.3], hub: 0.69, archR: 0.8, sill: 0.52, slab: 0.34,
    taper: { f: 0.2, zf: 0.8, r: 0.16, zr: -0.9 }, paint,
  });
  // the beetle's separate round fenders, with the eyes set into the front pair
  for (const [x, , z] of corners(1.17, 1.3).map(([x, z]) => [x, 0, z])) {
    const f = archFlare(0.78, 0.74, paint, 0.15, 0.1);
    f.position.set(x, 0.69, z);
    c.add(f);
  }
  for (const s of [1, -1]) {
    const eye = domeLamp(0.22, LENS(), CHROME(), 0.16);
    eye.position.set(s * 1.0, 1.42, 1.94);
    eye.rotation.x = -0.35;
    c.add(eye);
    const tail = domeLamp(0.13, TAIL(), CHROME(), 0.1);
    tail.position.set(s * 1.02, 1.36, -1.96);
    tail.rotation.y = Math.PI;
    tail.rotation.x = 0.3;
    c.add(tail);
    c.add(rbox(0.06, 0.06, 0.24, CHROME(), s * 0.72, 0.62, fit.noseZ(0.62) + 0.02, 0.02));
    // running boards between the fenders
    c.add(rbox(0.3, 0.09, 0.98, DARK(), s * (fit.halfW(0) + 0.08), 0.56, 0, 0.03));
    // mud flaps behind the rear wheels
    c.add(rbox(0.44, 0.34, 0.05, DARK(), s * 1.1, 0.42, -2.02, 0.02));
  }

  cabin(car, {
    glass: [[-1.2, 1.52], [0.86, 1.52], [0.22, 2.5], [-0.82, 2.52]],
    roof: [[0.32, 2.46, 0.04], [0.16, 2.62, 0.14], [-0.45, 2.74, 0.4], [-0.96, 2.6, 0.2], [-1.06, 2.46, 0.04]],
    width: 1.96, bPillar: -0.42, pillar: paint, roofMat: paint,
    interior: '#2b2b33', seat: '#18181d',
    avatar, head: 0.5, seatY: 0.85, driverZ: -0.1, sill: 1.56,
    hanging(p) {   // little pine air freshener
      const tree = mesh(new THREE.ConeGeometry(0.09, 0.2, 4), M('#2fbf71'), 0, -0.32, 0);
      p.add(tree);
    },
  });

  // chrome bumpers with overriders, front and rear
  for (const [z, dir] of [[fit.noseZ(0.66), 1], [fit.tailZ(0.66), -1]]) {
    c.add(rbox(1.9, 0.14, 0.16, CHROME(), 0, 0.66, z + dir * 0.06, 0.06));
    for (const s of [1, -1]) c.add(rbox(0.14, 0.34, 0.2, CHROME(), s * 0.55, 0.7, z + dir * 0.06, 0.06));
  }
  // engine-lid louvres and a twin exhaust out back
  for (let i = 0; i < 4; i++) c.add(rbox(0.6, 0.03, 0.05, DARK(), 0, fit.topOf(-1.72 - i * 0.08) + 0.01, -1.72 - i * 0.08, 0.012));
  for (const x of [-0.45, -0.68]) {
    const pipe = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.36, 10), CHROME(), x, 0.46, -2.14);
    pipe.rotation.x = Math.PI / 2;
    c.add(pipe);
  }
  const rearPlate = plate('PANA·01');
  rearPlate.position.set(0, 0.92, fit.tailZ(0.92) - 0.012);
  rearPlate.rotation.y = Math.PI;
  rearPlate.rotation.x = -0.35;
  c.add(rearPlate);
  // doors: seams and handles
  for (const s of [1, -1]) {
    const x = s * (fit.halfW(0.5) + 0.004);
    c.add(rbox(0.012, 0.74, 0.02, DARK(), x, 1.12, 0.84, 0.005));
    c.add(rbox(0.012, 0.74, 0.02, DARK(), s * (fit.halfW(-0.6) + 0.004), 1.12, -0.6, 0.005));
    c.add(rbox(0.04, 0.05, 0.22, CHROME(), s * (fit.halfW(-0.4) + 0.02), 1.32, -0.4, 0.02));
  }
  if (stock(cfg, 'franjas')) stripes(car, 'carrera', '#fbf8f0');
  if (stock(cfg, 'calcomania')) {
    decal(car, 'numero', 1);
    const top = roundel(1, 0.42);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, car.fit.roof.y(-0.45) + 0.012, -0.45);
    c.add(top);
  }
  if (stock(cfg, 'aleron')) spoiler(car, 'pato', paint);

  // detachable bits: bull bar, mirrors, the antenna flag
  const bar = new THREE.Group();
  const steel = S('#202026', { roughness: 0.45, metalness: 0.3 });
  const bz = fit.noseZ(0.6) + 0.32;
  for (const s of [1, -1]) bar.add(tube([s * 0.55, 0.42, bz], [s * 0.55, 1.3, bz], 0.08, steel));
  bar.add(tube([0.55, 1.3, bz], [-0.55, 1.3, bz], 0.08, steel));
  bar.add(rbox(1.62, 0.28, 0.24, steel, 0, 0.58, bz + 0.02, 0.06));
  for (const s of [1, -1]) bar.add(tube([s * 0.55, 0.92, bz], [s * 0.55, 0.92, bz - 0.3], 0.06, steel));
  const frontPlate = plate('PANA·01');
  frontPlate.position.set(0, 0.58, bz + 0.15);
  bar.add(frontPlate);
  detachable(car, bar);
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 0.98, 1.56, 0.7], [s * 1.24, 1.72, 0.7], 0.03, DARK()));
    m.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), S('#1d1d23', { roughness: 0.35 }), s * 1.28, 1.76, 0.7));
    detachable(car, m);
  }
  const antenna = new THREE.Group();
  antenna.add(mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.15, 6), DARK(), 0.82, 2.0, -1.55));
  antenna.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), DARK(), 0.82, 2.6, -1.55));
  const flagShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.62, -0.17), new THREE.Vector2(0, -0.36)]);
  const flag = mesh(new THREE.ShapeGeometry(flagShape), M('#ffd23f', { side: THREE.DoubleSide }), 0.82, 2.5, -1.55);
  flag.rotation.y = -Math.PI / 2;
  antenna.add(flag);
  detachable(car, antenna);
  car.flag = flag;
  return car;
}

// A chrome or rubber bumper bar across the nose (dir 1) or tail (dir -1),
// following the body's plan-view pinch, with optional overriders.
function bumper(c, fit, y, dir, mat, { h = 0.18, d = 0.22, over = 0, inset = 0.04 } = {}) {
  const z = (dir > 0 ? fit.noseZ(y) : fit.tailZ(y)) + dir * (d / 2 - inset);
  const w = 2 * fit.halfW(z) + 0.08;
  c.add(rbox(w, h, d, mat, 0, y, z, Math.min(0.07, h / 2.2)));
  if (over) for (const s of [1, -1]) c.add(rbox(0.15, over, d + 0.08, mat, s * w * 0.28, y + over * 0.18, z + dir * 0.03, 0.06));
  return z + dir * d / 2;
}

// ---------- La Lancha (long two-tone Malibu) ----------
function buildLancha(avatar, wheel, cfg = {}) {
  const teal = '#1f9e8e', cream = '#f3e2bf';
  const own = { r: 0.64, w: 0.62, style: 'disco', rim: '#d9dde4', cap: '#c9ccd4' };
  const car = rig({ wheel: wheel ?? own, base: own, rim: rimOf(cfg), wheelPos: corners(1.12, 1.42, -1.4) });
  const c = car.chassis;
  const paint = PAINT(teal), roof = PAINT(cream);
  // long hood, long deck, a gentle fillet on every edge
  const fit = shellBody(car, {
    side: [[2.3, 0.48, 0.06], [2.38, 0.9, 0.12], [2.3, 1.36, 0.16], [1.0, 1.44, 0.14], [0.66, 1.46, 0.04],
      [-1.5, 1.47, 0.04], [-1.7, 1.45, 0.1], [-2.28, 1.4, 0.18], [-2.4, 0.92, 0.1], [-2.32, 0.48, 0.06]],
    width: 2.24, axles: [1.42, -1.4], hub: 0.64, archR: 0.74, sill: 0.46, slab: 0.32,
    taper: { f: 0.05, zf: 1.4, r: 0.05, zr: -1.6 }, paint,
  });
  cabin(car, {
    glass: [[-1.5, 1.47], [0.64, 1.47], [0.02, 2.62], [-1.06, 2.64]],
    roof: [[0.12, 2.6, 0.03], [0.0, 2.8, 0.12], [-1.0, 2.84, 0.14], [-1.22, 2.72, 0.08], [-1.24, 2.6, 0.03]],
    width: 2.0, bPillar: -0.42, pillar: roof, roofMat: roof,
    interior: '#3b2a22', seat: '#7a4a2b',
    avatar, head: 0.48, seatY: 0.62, driverZ: 0.0, sill: 1.47,
    hanging(p) {   // fuzzy dice
      for (const s of [1, -1]) {
        const die = box(0.13, 0.13, 0.13, M('#fbf8f0'), s * 0.07, -0.3 - (s > 0 ? 0 : 0.05), 0);
        die.rotation.set(0.4 * s, 0.5, 0.2);
        die.add(box(0.03, 0.03, 0.14, M('#16161a'), 0, 0, 0));
        p.add(die);
      }
    },
  });

  // Face: a wide chrome grille between quad round lamps, hood ornament.
  const nz = fit.noseZ(0.98);
  c.add(rbox(1.1, 0.36, 0.08, CHROME(), 0, 0.98, nz + 0.01, 0.04));
  for (let i = 0; i < 4; i++) c.add(rbox(1.0, 0.035, 0.06, DARK(), 0, 0.86 + i * 0.08, nz + 0.05, 0.012));
  for (const s of [1, -1]) for (const x of [0.66, 0.92]) {
    const lamp = domeLamp(0.13, LENS(), CHROME(), 0.1);
    lamp.position.set(s * x, 1.0, fit.noseZ(1.0) + 0.02);
    c.add(lamp);
  }
  c.add(mesh(new THREE.ConeGeometry(0.05, 0.18, 6), CHROME(), 0, fit.topOf(2.0) + 0.08, 2.0));
  // long rectangular tail lamps and a trunk lock
  const tz = fit.tailZ(1.06);
  for (const s of [1, -1]) {
    const tail = rectLamp(0.46, 0.13, TAIL(), CHROME());
    tail.position.set(s * 0.68, 1.06, tz - 0.02);
    tail.rotation.y = Math.PI;
    c.add(tail);
    c.add(rbox(0.12, 0.08, 0.16, CHROME(), s * 0.42, fit.topOf(1.7) + 0.02, 1.7, 0.03));   // hood latches
  }
  c.add(rbox(0.12, 0.08, 0.04, CHROME(), 0, 1.16, tz - 0.01, 0.02));
  const rearPlate = plate('LAN·CHA');
  rearPlate.position.set(0, 0.86, tz - 0.012);
  rearPlate.rotation.y = Math.PI;
  c.add(rearPlate);

  // sides: a chrome spear, seams, handles, number, a bit of rust
  for (const s of [1, -1]) {
    c.add(rbox(0.03, 0.05, 3.9, CHROME(), s * (fit.halfW(0) + 0.012), 1.2, 0, 0.02));
    for (const z of [0.6, -0.5]) c.add(rbox(0.012, 0.7, 0.02, DARK(), s * (fit.halfW(z) + 0.004), 1.02, z, 0.005));
    c.add(rbox(0.04, 0.05, 0.2, CHROME(), s * (fit.halfW(0.35) + 0.02), 1.32, 0.35, 0.02));
    c.add(rbox(0.03, 0.04, 1.5, CHROME(), s * 1.02, 2.66, -0.5, 0.015));     // roof drip rail
  }
  if (stock(cfg, 'calcomania')) decal(car, 'numero', 2);
  const rust = '#b4562a';
  for (const [y, z, size] of [[0.66, -0.7, 0.17], [0.75, -0.95, 0.12], [1.18, 1.95, 0.12]]) {
    bothSides(c, () => spot(size, rust), fit.halfW(z) + 0.013, y, z);
  }
  for (const [x, z, size] of [[0.55, 1.75, 0.12], [-0.3, 1.45, 0.08], [-0.45, -1.9, 0.11]]) {
    const r = spot(size, rust);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, fit.topOf(z) + 0.01, z);
    c.add(r);
  }

  // detachable chrome bumpers and mirrors
  for (const dir of [1, -1]) {
    const b = new THREE.Group();
    const y = 0.6, z = (dir > 0 ? fit.noseZ(y) : fit.tailZ(y)) + dir * 0.1;
    b.add(rbox(2 * fit.halfW(z) + 0.14, 0.24, 0.24, CHROME(), 0, y, z, 0.09));
    for (const s of [1, -1]) b.add(rbox(0.16, 0.42, 0.3, CHROME(), s * 0.55, y + 0.06, z + dir * 0.04, 0.07));
    if (dir > 0) {
      const frontPlate = plate('LAN·CHA');
      frontPlate.position.set(0, y - 0.02, z + 0.125);
      b.add(frontPlate);
    }
    detachable(car, b);
  }
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 1.0, 1.5, 0.52], [s * 1.22, 1.64, 0.52], 0.03, CHROME()));
    m.add(rbox(0.1, 0.2, 0.28, CHROME(), s * 1.26, 1.7, 0.52, 0.04));
    detachable(car, m);
  }
  return car;
}

// ---------- El Machito (short-wheelbase hardtop utility 4x4) ----------
function buildMachito(avatar, wheel, cfg = {}) {
  const own = { r: 0.72, w: 0.66, style: 'acero', rim: '#c1c2cd', cap: '#c1c2cd', tread: 'barro' };
  const car = rig({ wheel: wheel ?? own, base: own, rim: rimOf(cfg), wheelPos: corners(1.12, 1.25) });
  const c = car.chassis, paint = PAINT('#ffc629'), trim = S('#ede4cf'), rubber = S('#24252b', { roughness: 0.8 });
  // Upright and square, small fillets: a long flat bonnet and a compact wheelbase.
  const fit = shellBody(car, {
    side: [[2.1, 0.56, 0.06], [2.15, 1.36, 0.1], [1.98, 1.6, 0.08], [0.62, 1.62, 0.04], [-2.0, 1.62, 0.06], [-2.06, 1.5, 0.06], [-2.05, 0.56, 0.06]],
    width: 2.16, axles: [1.25, -1.25], hub: 0.72, archR: 0.84, sill: 0.56, slab: 0.32,
    taper: { f: 0.03, zf: 1.5, r: 0.0, zr: -1.6 }, paint, bevel: 0.05,
  });
  for (const [x, z] of corners(1.12, 1.25)) {
    const arch = archFlare(0.84, 0.74, rubber, 0.13, 0.12);
    arch.position.set(x + Math.sign(x) * 0.04, 0.72, z);
    c.add(arch);
  }
  cabin(car, {
    glass: [[-1.9, 1.64], [0.6, 1.64], [0.44, 2.72], [-1.88, 2.72]],
    roof: [[0.54, 2.72, 0.02], [0.5, 2.88, 0.06], [-1.98, 2.88, 0.06], [-2.02, 2.72, 0.02]],
    width: 2.02, bPillar: -0.62, pillar: paint, roofMat: trim,
    interior: '#3b3c39', seat: '#494b44', avatar, head: 0.47, seatY: 0.94, driverZ: -0.2, sill: 1.64,
  });
  // rain gutter, stamped door seams, side steps and the lamps out back
  for (const side of [-1, 1]) {
    c.add(rbox(0.055, 0.07, 2.64, trim, side * 1.08, 2.74, -0.72, 0.02));
    c.add(rbox(0.014, 0.66, 0.02, rubber, side * (fit.halfW(-0.63) + 0.004), 1.18, -0.63, 0.005));
    c.add(rbox(0.05, 0.06, 0.26, rubber, side * (fit.halfW(-0.43) + 0.02), 1.46, -0.43, 0.02));
    c.add(rbox(0.3, 0.1, 1.2, rubber, side * (fit.halfW(0) + 0.1), 0.5, 0, 0.03));
    const tail = rectLamp(0.2, 0.3, TAIL(), rubber);
    tail.position.set(side * 0.84, 1.1, fit.tailZ(1.1) - 0.02);
    tail.rotation.y = Math.PI;
    c.add(tail);
    const mirror = new THREE.Group();
    mirror.add(tube([side * 1.02, 1.92, 0.52], [side * 1.28, 2.01, 0.54], 0.035, rubber));
    mirror.add(rbox(0.1, 0.28, 0.3, rubber, side * 1.33, 2.04, 0.54, 0.04));
    detachable(car, mirror);
  }
  // Broad horizontal grille between square surrounds with round lamps.
  const nz = fit.noseZ(1.2);
  c.add(rbox(1.3, 0.5, 0.1, rubber, 0, 1.2, nz, 0.04));
  for (const y of [1.04, 1.16, 1.28, 1.4]) c.add(rbox(1.24, 0.04, 0.05, CHROME(), 0, y, nz + 0.06, 0.015));
  c.add(rbox(0.26, 0.12, 0.04, trim, 0, 1.22, nz + 0.09, 0.02));
  for (const side of [-1, 1]) {
    c.add(rbox(0.48, 0.48, 0.1, trim, side * 0.84, 1.2, nz + 0.01, 0.05));
    const lamp = domeLamp(0.15, LENS(), CHROME(), 0.1);
    lamp.position.set(side * 0.84, 1.24, nz + 0.07);
    c.add(lamp);
    c.add(rbox(0.3, 0.08, 0.05, AMBER(), side * 0.84, 1.02, nz + 0.07, 0.02));
  }
  c.add(rbox(0.68, 0.1, 0.27, rubber, 0, fit.topOf(1.48) + 0.04, 1.48, 0.03));   // bonnet vent
  const bumperGroup = new THREE.Group();
  const bz = fit.noseZ(0.66) + 0.12;
  bumperGroup.add(rbox(2.36, 0.28, 0.3, rubber, 0, 0.66, bz, 0.06));
  bumperGroup.add(rbox(0.65, 0.22, 0.28, M('#697273'), 0, 0.87, bz + 0.09, 0.05));
  for (const side of [-1, 1]) bumperGroup.add(towLoop(side * 0.82, 0.65, bz + 0.19));
  detachable(car, bumperGroup);
  bumper(c, fit, 0.62, -1, rubber, { h: 0.24, d: 0.26 });
  const spare = spareWheel(0.59, 0.38); spare.position.set(0.35, 1.37, fit.tailZ(1.37) - 0.24); detachable(car, spare);
  const snorkel = new THREE.Group();
  snorkel.add(tube([-1.12, 1.4, 0.98], [-1.12, 2.45, 0.53], 0.085, rubber));
  snorkel.add(rbox(0.25, 0.22, 0.3, rubber, -1.12, 2.52, 0.52, 0.05));
  detachable(car, snorkel);
  if (stock(cfg, 'techo')) {
    const roofRack = new THREE.Group();
    for (const side of [-1, 1]) roofRack.add(rbox(0.09, 0.12, 2.1, rubber, side * 0.78, 3.0, -0.7, 0.03));
    for (const z of [-1.55, 0.13]) roofRack.add(rbox(1.65, 0.08, 0.1, rubber, 0, 3.02, z, 0.025));
    roofRack.add(lightBar(4, 0.46, 3.08, 0.17, 0.22));
    detachable(car, roofRack);
  }
  if (stock(cfg, 'calcomania')) decal(car, 'numero', 3);
  return car;
}

// ---------- La Bala (blue rally hatch) ----------
function buildBala(avatar, wheel, cfg = {}) {
  const blue = '#3d7bf2';
  const own = { r: 0.65, w: 0.66, style: 'cinco', rim: '#d8ddea', cap: '#ff4b4b' };
  const car = rig({ wheel: wheel ?? own, base: own, rim: rimOf(cfg), wheelPos: corners(1.14, 1.3) });
  const c = car.chassis;
  const paint = PAINT(blue), dark = S('#1c3770');
  // a short, wedgy hatch with blistered rally arches
  const fit = shellBody(car, {
    side: [[2.08, 0.5, 0.1], [2.16, 0.9, 0.22], [1.86, 1.3, 0.36], [0.9, 1.42, 0.12], [-1.6, 1.44, 0.12], [-2.02, 1.32, 0.18], [-2.08, 0.5, 0.1]],
    width: 2.16, axles: [1.3, -1.3], hub: 0.65, archR: 0.78, sill: 0.5, slab: 0.32,
    taper: { f: 0.12, zf: 1.1, r: 0.08, zr: -1.3 }, paint,
  });
  for (const [x, z] of corners(1.14, 1.3)) {
    const blister = archFlare(0.77, 0.72, paint, 0.12, 0.08);
    blister.position.set(x, 0.65, z);
    c.add(blister);
  }
  cabin(car, {
    glass: [[-1.8, 1.44], [0.88, 1.44], [0.28, 2.46], [-1.55, 2.48]],
    roof: [[0.38, 2.44, 0.03], [0.26, 2.6, 0.1], [-1.5, 2.64, 0.12], [-1.76, 2.52, 0.06], [-1.78, 2.44, 0.03]],
    width: 2.0, bPillar: -0.55, pillar: paint, roofMat: paint,
    interior: '#22222a', seat: '#18181d',
    avatar, head: 0.5, seatY: 0.85, driverZ: -0.05, sill: 1.44,
  });
  if (stock(cfg, 'franjas')) stripes(car, 'carrera', '#f3e9d7', { lanes: [0], half: 0.26 });
  // face: rectangular lamps, a black mesh grille and a skid plate
  const nz = fit.noseZ(1.0);
  for (const s of [1, -1]) {
    const lamp = rectLamp(0.3, 0.16, LENS());
    lamp.position.set(s * 0.68, 1.0, fit.noseZ(1.0) - 0.02);
    c.add(lamp);
  }
  c.add(rbox(0.8, 0.22, 0.08, DARK(), 0, 0.9, nz - 0.01, 0.03));
  c.add(rbox(2.0, 0.17, 0.42, S('#1d2c49'), 0, 0.5, fit.noseZ(0.5) - 0.1, 0.06));
  for (const side of [-1, 1]) {
    c.add(rbox(0.16, 0.16, 1.2, dark, side * (fit.halfW(0) + 0.06), 0.52, 0, 0.05));
    c.add(rbox(0.04, 0.06, 0.24, DARK(), side * (fit.halfW(-0.32) + 0.015), 1.26, -0.32, 0.02));
    c.add(rbox(0.014, 0.6, 0.02, dark, side * (fit.halfW(0.62) + 0.004), 1.0, 0.62, 0.005));
    const tail = rectLamp(0.22, 0.14, TAIL());
    tail.position.set(side * 0.78, 1.04, fit.tailZ(1.04) - 0.01);
    tail.rotation.y = Math.PI;
    c.add(tail);
    c.add(rbox(0.46, 0.3, 0.05, S('#172947'), side * 1.08, 0.35, -1.98, 0.02));   // mud flaps
  }
  if (stock(cfg, 'calcomania')) decal(car, 'numero', 4);
  const rear = plate('BALA·4');
  rear.position.set(0, 0.86, fit.tailZ(0.86) - 0.012);
  rear.rotation.y = Math.PI;
  c.add(rear);
  bumper(c, fit, 0.6, -1, DARK(), { h: 0.16, d: 0.2 });
  // bolt-ons
  detachable(car, lightBar(3, 0.47, 0.64, fit.noseZ(0.64) + 0.24, 0.23));
  if (stock(cfg, 'aleron')) spoiler(car, 'rally', paint);
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 1.0, 1.52, 0.74], [s * 1.22, 1.62, 0.74], 0.03, DARK()));
    m.add(rbox(0.1, 0.16, 0.26, paint, s * 1.26, 1.66, 0.74, 0.04));
    detachable(car, m);
  }
  return car;
}

// ---------- El Toro (red and white pickup) ----------
function buildToro(avatar, wheel, cfg = {}) {
  const red = '#e0262f';
  const own = { r: 0.73, w: 0.72, style: 'acero', rim: '#aeb7c7', cap: '#aeb7c7' };
  const car = rig({ wheel: wheel ?? own, base: own, rim: rimOf(cfg), wheelPos: corners(1.19, 1.45, -1.4) });
  const c = car.chassis;
  const paint = PAINT(red), dark = S('#2e3039', { roughness: 0.8 });
  // the cab, then a bed whose side rails stand taller than the hood
  const front = [[2.22, 0.6, 0.06], [2.27, 1.3, 0.1], [2.1, 1.52, 0.14], [0.9, 1.56, 0.05]];
  const back = [[-2.24, 1.72, 0.05], [-2.24, 0.6, 0.06]];
  const fit = shellBody(car, {
    side: [...front, [-0.6, 1.56, 0.02], [-0.64, 1.86, 0.03], [-2.18, 1.86, 0.04], ...back],
    tub: [...front, [-0.6, 1.56, 0.02], [-0.64, 1.86, 0.02], [-0.72, 1.86, 0.02], [-0.74, 1.5, 0.02], [-2.08, 1.5, 0.02], [-2.1, 1.86, 0.02], [-2.18, 1.86, 0.04], ...back],
    width: 2.24, axles: [1.45, -1.4], hub: 0.73, archR: 0.84, sill: 0.6, slab: 0.22,
    taper: { f: 0.04, zf: 1.7, r: 0.0, zr: -2.0 }, paint, bevel: 0.05,
  });
  car.fit.bed = { zF: -0.66, zR: -2.12 };
  car.fit.cargo = { z: -1.4, y: 1.52, half: 0.75, len: 1.3 };
  for (const [x, z] of corners(1.19, 1.45, -1.4)) {
    const arch = archFlare(0.85, 0.74, dark, 0.13, 0.1);
    arch.position.set(x + Math.sign(x) * 0.03, 0.73, z);
    c.add(arch);
  }
  if (stock(cfg, 'franjas')) {
    const band = M('#f3e9d7', DECAL);
    bothSides(c, () => new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.2), band), fit.halfW(0) + 0.008, 1.62, -0.1);
  }
  cabin(car, {
    glass: [[-0.58, 1.56], [0.86, 1.56], [0.42, 2.54], [-0.54, 2.56]],
    roof: [[0.5, 2.52, 0.03], [0.4, 2.7, 0.08], [-0.6, 2.72, 0.08], [-0.64, 2.52, 0.03]],
    width: 2.04, bPillar: -0.25, pillar: paint, roofMat: paint,
    interior: '#2b2b33', seat: '#7a4a2b',
    avatar, head: 0.5, seatY: 0.9, driverZ: 0.15, sill: 1.56,
  });
  // wooden bed floor and a tailgate handle
  c.add(rbox(1.7, 0.05, 1.3, M('#582c28'), 0, 1.53, -1.41, 0.02));
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) c.add(rbox(0.04, 0.04, 1.28, M('#a7453b'), x, 1.57, -1.41, 0.015));
  c.add(rbox(0.36, 0.07, 0.04, CHROME(), 0, 1.7, fit.tailZ(1.7) - 0.02, 0.02));
  for (const side of [-1, 1]) {
    c.add(rbox(0.014, 0.66, 0.02, M('#9b222c'), side * (fit.halfW(-0.55) + 0.004), 1.12, -0.55, 0.005));
    c.add(rbox(0.06, 0.07, 0.25, CHROME(), side * (fit.halfW(-0.27) + 0.02), 1.38, -0.27, 0.02));
    c.add(rbox(0.28, 0.12, 1.1, DARK(), side * (fit.halfW(0) + 0.08), 0.5, 0.02, 0.04));
    const tail = rectLamp(0.2, 0.36, TAIL(), CHROME());
    tail.position.set(side * 0.88, 1.2, fit.tailZ(1.2) - 0.02);
    tail.rotation.y = Math.PI;
    c.add(tail);
  }
  bumper(c, fit, 0.62, -1, CHROME(), { h: 0.22, d: 0.24 });
  // face: black grille in a chrome surround, framed lamps, chrome bars
  const nz = fit.noseZ(1.04);
  c.add(rbox(1.36, 0.48, 0.08, CHROME(), 0, 1.04, nz - 0.01, 0.05));
  c.add(rbox(1.24, 0.38, 0.06, DARK(), 0, 1.04, nz + 0.02, 0.03));
  for (const y of [0.93, 1.04, 1.15]) c.add(rbox(1.2, 0.035, 0.06, CHROME(), 0, y, nz + 0.05, 0.012));
  for (const s of [1, -1]) {
    const lamp = rectLamp(0.3, 0.3, LENS(), CHROME());
    lamp.position.set(s * 0.88, 1.1, fit.noseZ(1.1) - 0.02);
    c.add(lamp);
  }
  // bolt-ons
  if (stock(cfg, 'techo')) {
    detachable(car, lightBar(3, 0.49, 2.82, 0.2, 0.22));
    const cooler = new THREE.Group();
    cooler.add(rbox(0.88, 0.57, 0.65, S('#eb454d'), 0.35, 1.85, -1.3, 0.07));
    cooler.add(rbox(0.93, 0.12, 0.7, S('#f3e9d7'), 0.35, 2.2, -1.3, 0.04));
    cooler.add(rbox(0.3, 0.07, 0.08, S('#f3e9d7'), 0.35, 2.3, -1.3, 0.02));
    for (const side of [-1, 1]) cooler.add(rbox(0.08, 0.2, 0.25, S('#f3e9d7'), 0.35 + side * 0.48, 1.98, -1.3, 0.02));
    detachable(car, cooler);
  }
  const rails = new THREE.Group();
  const wood = M('#9a6a3a', { roughness: 0.9 });
  for (const s of [1, -1]) {
    for (const z of [-0.78, -1.45, -2.1]) rails.add(rbox(0.08, 0.42, 0.08, wood, s * 1.0, 2.06, z, 0.02));
    for (const y of [2.04, 2.22]) rails.add(rbox(0.06, 0.08, 1.46, wood, s * 1.0, y, -1.44, 0.02));
  }
  detachable(car, rails);
  const front2 = new THREE.Group();
  const bz = fit.noseZ(0.62) + 0.1;
  front2.add(rbox(2.3, 0.25, 0.3, CHROME(), 0, 0.62, bz, 0.08));
  for (const side of [-1, 1]) {
    front2.add(rbox(0.16, 0.76, 0.23, DARK(), side * 0.58, 0.98, bz + 0.19, 0.05));
    front2.add(towLoop(side * 0.93, 0.56, bz + 0.13));
  }
  front2.add(rbox(1.27, 0.13, 0.2, DARK(), 0, 1.36, bz + 0.19, 0.04));
  const frontPlate = plate('TORO·5');
  frontPlate.position.set(0, 0.62, bz + 0.16);
  front2.add(frontPlate);
  detachable(car, front2);
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 1.04, 1.66, 0.7], [s * 1.26, 1.78, 0.7], 0.03, CHROME()));
    m.add(rbox(0.1, 0.24, 0.3, CHROME(), s * 1.3, 1.84, 0.7, 0.04));
    detachable(car, m);
  }
  if (stock(cfg, 'calcomania')) decal(car, 'numero', 5);
  return car;
}

// ---------- La Familiar (two-tone buseta with a loaded roof rack) ----------
function buildFamiliar(avatar, wheel, cfg = {}) {
  const green = '#3f9d4a', cream = '#f1e6c8';
  const own = { r: 0.63, w: 0.59, style: 'disco', rim: '#e3dfc2', cap: '#c9ccd4' };
  const car = rig({ wheel: wheel ?? own, base: own, rim: rimOf(cfg), wheelPos: corners(1.12, 1.38) });
  const c = car.chassis;
  const paint = PAINT(green), top = PAINT(cream);
  // a bread-loaf van: blunt nose, the glasshouse runs the whole length
  const fit = shellBody(car, {
    side: [[2.12, 0.46, 0.1], [2.24, 1.08, 0.26], [2.12, 1.42, 0.12], [-2.06, 1.44, 0.12], [-2.18, 1.1, 0.18], [-2.12, 0.46, 0.1]],
    width: 2.22, axles: [1.38, -1.38], hub: 0.63, archR: 0.74, sill: 0.46, slab: 0.32,
    taper: { f: 0.06, zf: 1.4, r: 0.04, zr: -1.6 }, paint,
  });
  cabin(car, {
    glass: [[-1.98, 1.44], [2.0, 1.44], [1.66, 2.64], [-1.86, 2.66]],
    roof: [[1.78, 2.62, 0.04], [1.62, 2.82, 0.16], [-1.78, 2.86, 0.16], [-2.0, 2.62, 0.04]],
    width: 2.02, bPillar: 0.42, pillar: top, roofMat: top,
    interior: '#3b2a22', seat: '#c9b38a',
    avatar, head: 0.48, seatY: 0.62, driverZ: 0.78, sill: 1.44,
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
  // extra window posts down the side, like the por puesto
  for (const s of [1, -1]) for (const z of [-0.5, -1.3]) c.add(rbox(0.1, 1.2, 0.12, top, s * 1.0, 2.04, z, 0.03));
  // two-tone: a cream nose panel and a cream belt line
  const nz = fit.noseZ(1.12);
  c.add(rbox(1.2, 0.5, 0.06, top, 0, 1.14, nz, 0.06));
  c.add(mesh(new THREE.CircleGeometry(0.17, 16), CHROME(), 0, 1.16, nz + 0.035));
  for (const s of [1, -1]) {
    c.add(rbox(0.03, 0.12, 3.9, top, s * (fit.halfW(0) + 0.01), 1.3, 0, 0.02));
    const lamp = domeLamp(0.18, LENS(), CHROME(), 0.12);
    lamp.position.set(s * 0.82, 0.96, fit.noseZ(0.96));
    c.add(lamp);
    c.add(rbox(0.16, 0.08, 0.05, AMBER(), s * 0.82, 0.72, fit.noseZ(0.72) + 0.01, 0.02));
    const tail = rectLamp(0.16, 0.3, TAIL(), CHROME());
    tail.position.set(s * 0.86, 1.04, fit.tailZ(1.04) - 0.02);
    tail.rotation.y = Math.PI;
    c.add(tail);
    for (const z of [0.9, -0.4]) c.add(rbox(0.014, 0.7, 0.02, DARK(), s * (fit.halfW(z) + 0.004), 0.98, z, 0.005));
    c.add(rbox(0.04, 0.05, 0.2, CHROME(), s * (fit.halfW(0.7) + 0.02), 1.16, 0.7, 0.02));
  }
  const rear = plate('FAM·6');
  rear.position.set(0, 0.8, fit.tailZ(0.8) - 0.012);
  rear.rotation.y = Math.PI;
  c.add(rear);
  if (stock(cfg, 'calcomania')) decal(car, 'flor', 6);
  if (stock(cfg, 'techo')) roofCargo(car, 'maletas');
  for (const dir of [1, -1]) {
    const b = new THREE.Group(), y = 0.56, z = (dir > 0 ? fit.noseZ(y) : fit.tailZ(y)) + dir * 0.08;
    b.add(rbox(2 * fit.halfW(z) + 0.16, 0.2, 0.22, CHROME(), 0, y, z, 0.08));
    detachable(car, b);
  }
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 1.04, 1.54, 1.7], [s * 1.26, 1.66, 1.7], 0.03, CHROME()));
    m.add(rbox(0.1, 0.22, 0.28, CHROME(), s * 1.3, 1.72, 1.7, 0.04));
    detachable(car, m);
  }
  return car;
}

// ---------- La Rumbera (pink 70s sedan with a sound system) ----------
function buildRumbera(avatar, wheel, cfg = {}) {
  const pink = '#ff4fa3';
  const own = { r: 0.64, w: 0.62, style: 'turbo', rim: '#ef68ab', cap: '#ffd23f' };
  const car = rig({ wheel: wheel ?? own, base: own, rim: rimOf(cfg), wheelPos: corners(1.1, 1.34) });
  const c = car.chassis;
  const paint = PAINT(pink);
  // long and low with a crisp three-box line, softened at every corner
  const fit = shellBody(car, {
    side: [[2.22, 0.5, 0.06], [2.28, 0.92, 0.1], [2.2, 1.36, 0.16], [0.86, 1.44, 0.08], [-1.1, 1.45, 0.08],
      [-2.16, 1.4, 0.16], [-2.26, 0.94, 0.1], [-2.22, 0.5, 0.06]],
    width: 2.2, axles: [1.34, -1.34], hub: 0.64, archR: 0.74, sill: 0.5, slab: 0.32,
    taper: { f: 0.06, zf: 1.5, r: 0.05, zr: -1.6 }, paint,
  });
  cabin(car, {
    glass: [[-1.3, 1.45], [0.86, 1.45], [0.2, 2.5], [-0.86, 2.52]],
    roof: [[0.3, 2.48, 0.03], [0.16, 2.66, 0.1], [-0.86, 2.68, 0.1], [-1.02, 2.5, 0.03]],
    width: 1.96, bPillar: -0.3, pillar: paint, roofMat: paint,
    interior: '#2b2b33', seat: '#f3e9d7',
    avatar, head: 0.48, seatY: 0.75, driverZ: 0.0, sill: 1.45,
  });
  // quad round lamps around a chrome grille, chrome bumpers, a nose line
  const nz = fit.noseZ(1.0);
  c.add(rbox(1.0, 0.3, 0.06, CHROME(), 0, 1.0, nz, 0.04));
  for (let i = 0; i < 3; i++) c.add(rbox(0.92, 0.035, 0.05, DARK(), 0, 0.92 + i * 0.08, nz + 0.035, 0.012));
  for (const s of [1, -1]) for (const x of [0.66, 0.9]) {
    const lamp = domeLamp(x > 0.8 ? 0.13 : 0.12, LENS(), CHROME(), 0.1);
    lamp.position.set(s * x, 1.0, fit.noseZ(1.0) - 0.01);
    c.add(lamp);
  }
  bumper(c, fit, 0.62, 1, CHROME(), { h: 0.16, d: 0.2, over: 0.3 });
  bumper(c, fit, 0.62, -1, CHROME(), { h: 0.16, d: 0.2, over: 0.3 });
  for (const side of [-1, 1]) {
    c.add(rbox(0.03, 0.05, 3.8, CHROME(), side * (fit.halfW(0) + 0.012), 1.1, 0, 0.02));
    c.add(rbox(0.04, 0.05, 0.22, CHROME(), side * (fit.halfW(-0.35) + 0.02), 1.32, -0.35, 0.02));
    c.add(rbox(0.014, 0.66, 0.02, DARK(), side * (fit.halfW(-0.25) + 0.004), 1.04, -0.25, 0.005));
    const tail = rectLamp(0.4, 0.14, TAIL(), CHROME());
    tail.position.set(side * 0.66, 1.08, fit.tailZ(1.08) - 0.02);
    tail.rotation.y = Math.PI;
    c.add(tail);
  }
  const rear = plate('RUM·BA');
  rear.position.set(0, 0.86, fit.tailZ(0.86) - 0.012);
  rear.rotation.y = Math.PI;
  c.add(rear);
  if (stock(cfg, 'calcomania')) decal(car, 'flor', 7);
  if (stock(cfg, 'aleron')) spoiler(car, 'gt', paint);
  if (stock(cfg, 'techo')) roofCargo(car, 'cornetas');
  // the flag rides along whatever is on the roof (flies off)
  const flagGroup = new THREE.Group();
  const ry = car.fit.roof.top;
  flagGroup.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.4, 6), DARK(), 0.86, ry + 0.6, -0.95));
  const flag = mesh(new THREE.PlaneGeometry(0.78, 0.52), venezuelaFlag(), 0.86, ry + 1.0, -1.36);
  flag.material.side = THREE.DoubleSide;
  flag.rotation.y = Math.PI / 2;
  flagGroup.add(flag);
  detachable(car, flagGroup);
  car.flag = flag;
  for (const s of [1, -1]) {
    const m = new THREE.Group();
    m.add(tube([s * 0.98, 1.52, 0.66], [s * 1.2, 1.64, 0.66], 0.03, CHROME()));
    m.add(rbox(0.1, 0.18, 0.26, paint, s * 1.24, 1.7, 0.66, 0.05));
    detachable(car, m);
  }
  return car;
}

// ---------- El Montañero (open camo jeep with a roll cage) ----------
function buildMontanero(avatar, wheel, cfg = {}) {
  const olive = '#6b7a3a';
  const own = { r: 0.81, w: 0.78, style: 'acero', rim: '#aeb3bc', cap: '#d6a640', tread: 'barro' };
  const car = rig({ wheel: wheel ?? own, base: own, rim: rimOf(cfg), wheelPos: corners(1.23, 1.32) });
  const c = car.chassis;
  const paint = PAINT(olive);
  // a short open tub, flat-sided, with wide flat fenders over big tires
  const fit = shellBody(car, {
    side: [[1.96, 0.66, 0.06], [2.04, 1.3, 0.1], [1.92, 1.44, 0.06], [0.7, 1.46, 0.05], [-1.82, 1.46, 0.06], [-1.9, 1.34, 0.06], [-1.88, 0.66, 0.06]],
    width: 2.16, axles: [1.32, -1.32], hub: 0.81, archR: 0.92, sill: 0.66, slab: 0.3,
    taper: { f: 0.03, zf: 1.4, r: 0.0, zr: -1.5 }, paint, bevel: 0.05,
  });
  for (const [x, z] of corners(1.23, 1.32)) {
    const arch = archFlare(0.93, 0.84, paint, 0.12, 0.05);
    arch.position.set(x + Math.sign(x) * 0.04, 0.81, z);
    c.add(arch);
  }
  cabin(car, {
    open: true,
    glass: [[-1.2, 1.46], [0.95, 1.46], [0.8, 2.15], [-1.2, 2.15]],
    width: 2.0, pillar: S('#1d1d23', { roughness: 0.5 }),
    interior: '#2b2b33', seat: '#3a3a30',
    avatar, head: 0.5, seatY: 0.86, driverZ: -0.2, sill: 1.46,
  });
  // the roll cage
  const cage = S('#1d1d23', { roughness: 0.5, metalness: 0.3 });
  for (const s of [1, -1]) {
    c.add(tube([s * 0.92, 2.15, 0.8], [s * 0.9, 2.62, 0.3], 0.07, cage));
    c.add(tube([s * 0.9, 2.62, 0.3], [s * 0.92, 2.6, -1.25], 0.07, cage));
    c.add(tube([s * 0.92, 2.6, -1.25], [s * 0.98, 1.44, -1.7], 0.07, cage));
    c.add(tube([s * 0.92, 2.6, -1.25], [s * 0.98, 1.44, -0.9], 0.05, cage));
  }
  for (const z of [0.3, -1.25]) c.add(tube([0.9, 2.62, z], [-0.9, 2.62, z], 0.07, cage));
  c.add(tube([0.9, 2.6, -1.25], [-0.9, 1.46, -1.7], 0.065, cage));
  car.fit.roof = { zF: 0.3, zR: -1.25, top: 2.69, half: 0.9, y: () => 2.69 };
  car.fit.cargo = { z: -1.45, y: 1.49, half: 0.7, len: 0.7 };
  // a vertical-slot grille between round lamps, side steps, hood latches
  const nz = fit.noseZ(1.1);
  for (let k = 0; k < 7; k++) c.add(rbox(0.07, 0.5, 0.05, DARK(), -0.36 + k * 0.12, 1.06, nz + 0.01, 0.02));
  for (const side of [-1, 1]) {
    const lamp = domeLamp(0.17, LENS(), CHROME(), 0.1);
    lamp.position.set(side * 0.74, 1.12, nz + 0.01);
    c.add(lamp);
    c.add(tube([side * 1.12, 0.6, -0.7], [side * 1.12, 0.6, 0.75], 0.085, cage));
    c.add(rbox(0.06, 0.12, 0.25, DARK(), side * 0.73, fit.topOf(1.45) + 0.04, 1.45, 0.02));
    const tail = rectLamp(0.16, 0.2, TAIL());
    tail.position.set(side * 0.82, 1.14, fit.tailZ(1.14) - 0.02);
    tail.rotation.y = Math.PI;
    c.add(tail);
  }
  if (stock(cfg, 'acabado')) finish(car, 'camuflaje');
  if (stock(cfg, 'calcomania')) decal(car, 'numero', 8);
  // bolt-ons
  if (stock(cfg, 'techo')) detachable(car, lightBar(2, 0.58, 2.66, 0.34, 0.25));
  const winch = new THREE.Group();
  const wz = fit.noseZ(0.68) + 0.2;
  for (const s of [1, -1]) winch.add(tube([s * 0.6, 0.55, wz], [s * 0.6, 1.2, wz], 0.06, cage));
  winch.add(tube([0.6, 1.2, wz], [-0.6, 1.2, wz], 0.06, cage));
  winch.add(rbox(1.0, 0.24, 0.3, DARK(), 0, 0.68, wz, 0.05));
  const drum = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 10), M('#c9ccd4', { metalness: 0.5, roughness: 0.4 }), 0, 0.68, wz + 0.18);
  drum.rotation.z = Math.PI / 2;
  winch.add(drum);
  for (let i = -3; i <= 3; i++) {
    const coil = mesh(new THREE.TorusGeometry(0.125, 0.022, 4, 10), M('#ce692c'), i * 0.065, 0.68, wz + 0.18);
    coil.rotation.y = Math.PI / 2;
    winch.add(coil);
  }
  for (const side of [-1, 1]) winch.add(towLoop(side * 0.84, 0.61, wz + 0.05));
  winch.add(mesh(new THREE.TorusGeometry(0.07, 0.025, 5, 10, Math.PI * 1.4), M('#ff4b4b'), 0, 0.52, wz + 0.28));
  detachable(car, winch);
  const can = new THREE.Group();
  can.add(rbox(0.2, 0.46, 0.36, S('#e0262f'), -1.0, 1.7, -1.45, 0.04));
  can.add(rbox(0.06, 0.08, 0.12, DARK(), -1.0, 1.96, -1.36, 0.02));
  detachable(car, can);
  const spare = spareWheel(0.6, 0.52);
  spare.position.set(0, 1.44, fit.tailZ(1.4) - 0.32);
  detachable(car, spare);
  const shovel = new THREE.Group();
  shovel.add(tube([1.0, 1.5, -1.65], [0.9, 2.55, -1.16], 0.05, M('#95612f')));
  const blade = rbox(0.29, 0.39, 0.065, M('#777b7d'), 1.0, 1.5, -1.65, 0.02);
  blade.rotation.x = 0.4; shovel.add(blade);
  detachable(car, shovel);
  return car;
}
