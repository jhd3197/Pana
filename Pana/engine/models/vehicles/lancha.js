// A racing lancha: a light peñero hull in the team colour, a fuera de borda
// on the transom that swivels with the steering and spins its propeller, and
// the pana at the tiller. Used by Lancha. +Z is the bow, metres; origin at the
// waterline under the hull's middle.
//
// update(dt, b, time) reads b.steer (-1 left … 1 right), b.throttle (0–1),
// b.v (m/s), b.vy, b.air, b.stalled (seconds the motor is dead) and b.turbo
// (seconds of turbo left).
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { rounded, curve } from '/engine/models/core/architecture-kit.js';
import { sampleWaterWave } from '/engine/models/effects/water-surface.js';

export const LANCHA = Object.freeze({ length: 4.8, beam: 1.7, seat: -1.45 });
const SINK = .2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Half-beam along the hull, stern to bow; the last section is the stem.
const SECTIONS = [[-2.2, .72], [-1.6, .82], [-.3, .85], [1, .72], [1.9, .4], [2.6, .02]];
const lift = i => i === 5 ? .32 : i === 4 ? .08 : 0;

function skin(side, inner, mat) {
  const ps = [], ix = [];
  SECTIONS.forEach(([z, w], i) => {
    for (const [f, y] of [[.24, .05], [.74, .36], [1, .78]]) ps.push(side * Math.max(.005, w * f - (inner ? .07 : 0)), y + lift(i) + (inner ? .05 : 0), z);
    if (i < SECTIONS.length - 1) for (let j = 0; j < 2; j++) { const k = i * 3 + j; ix.push(k, k + 3, k + 1, k + 1, k + 3, k + 4); }
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); geo.setIndex(ix); geo.computeVertexNormals();
  return mesh(geo, mat);
}

function outboard(tint) {
  const g = new THREE.Group(); g.name = 'Fuera de borda';
  const black = M(0x22272b, { roughness: .45 }), steel = M(0x8a9599, { metalness: .5, roughness: .4 }), white = M(0xf2efe6);
  // Cowl with a painted band, the leg down into the water and the skeg.
  g.add(rounded(.42, .46, .56, black, 0, .38, -.12, .08));
  g.add(box(.44, .07, .58, M(tint, { roughness: .5 }), 0, .3, -.12), box(.3, .05, .3, white, 0, .62, -.1));
  g.add(box(.12, .75, .16, black, 0, -.15, -.18), box(.05, .22, .3, black, 0, -.55, -.24));
  g.add(mesh(new THREE.CylinderGeometry(.07, .07, .26, 10).rotateX(Math.PI / 2), black, 0, -.46, -.2));
  const prop = new THREE.Group(); prop.position.set(0, -.46, -.36); g.add(prop);
  for (let i = 0; i < 3; i++) { const arm = new THREE.Group(), blade = box(.05, .2, .02, steel, 0, .1, 0); arm.rotation.z = i * Math.PI * 2 / 3; blade.rotation.y = .5; arm.add(blade); prop.add(arm); }
  // The tiller reaches forward to the pana's right hand.
  const tiller = new THREE.Group(); tiller.position.set(0, .22, .1); g.add(tiller);
  tiller.add(tube([0, 0, 0], [.18, .1, .62], .035, black), mesh(new THREE.CylinderGeometry(.045, .045, .2, 8).rotateX(Math.PI / 2 - .2), M(0xd64f3a), .2, .11, .7));
  g.userData.prop = prop; g.userData.tiller = tiller;
  return g;
}

// The bare peñero: hull, rims, thwarts, bow deck, pennant, cava and the
// outboard, with no pana aboard. createLancha seats the pana in it; `open`
// leaves out the thwarts and the cava so Derrape can fold it around a car;
// `body` paints the hull itself apart from the team colour (pennant, motor).
export function createLanchaHull(color = '#e2683c', { open = false, body = color } = {}) {
  const hull = new THREE.Group(), tint = new THREE.Color(color).getHex();
  hull.name = 'Casco de lancha';
  const paint = M(new THREE.Color(body).getHex(), { side: THREE.DoubleSide, roughness: .5 }), inside = M(0xe8d3a6, { side: THREE.DoubleSide, roughness: .8 });
  const cream = M(0xf3e5c3), wood = M(0xac8354, { roughness: 1 }), dark = M(0x2d3a3e);
  for (const side of [-1, 1]) {
    hull.add(skin(side, false, paint), skin(side, true, inside));
    const rim = SECTIONS.map(([z, w], i) => [side * w, .8 + lift(i), z]);
    hull.add(curve(rim, .05, cream, 28), curve(rim.map(([x, y, z]) => [x * .93, y - .2, z]), .03, dark, 28));
  }
  // Flat bottom, transom, thwarts, a bow deck and the bow's pennant.
  const bottom = [], bix = [];
  SECTIONS.forEach(([z, w], i) => { const y = .05 + lift(i); bottom.push(-w * .24, y, z, w * .24, y, z); if (i < SECTIONS.length - 1) { const k = i * 2; bix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.Float32BufferAttribute(bottom, 3)); bgeo.setIndex(bix); bgeo.computeVertexNormals(); hull.add(mesh(bgeo, paint));
  hull.add(box(1.46, .72, .1, paint, 0, .44, -2.2), box(1.5, .07, .14, cream, 0, .82, -2.2));
  if (!open) for (const z of [-1.45, .2]) hull.add(rounded(1.55, .1, .36, wood, 0, .55, z));
  const deck = new THREE.Mesh(new THREE.ConeGeometry(.74, 1.3, 3, 1).rotateX(Math.PI / 2).scale(1, .12, 1), cream); deck.position.set(0, .86, 1.95); deck.rotation.z = Math.PI; hull.add(deck);
  hull.add(tube([0, .95, 2.35], [0, 1.85, 2.45], .02, M(0x5b4330)));
  const flag = mesh(new THREE.PlaneGeometry(.4, .24), M(tint, { side: THREE.DoubleSide, roughness: .7 }), 0, 1.72, 2.45);
  // A team-colour stripe under the rim on both sides.
  for (const side of [-1, 1]) hull.add(curve(SECTIONS.slice(0, 5).map(([z, w], i) => [side * (w + .012), .6 + lift(i), z]), .07, M(tint, { roughness: .5 }), 24));
  flag.rotation.y = Math.PI / 2; flag.geometry.translate(-.2, 0, 0); hull.add(flag);
  // A blue cava (cooler) up front: the lancha's cargo.
  if (!open) hull.add(rounded(.6, .36, .42, M(0x2f7fc4), 0, .72, .85, .05), box(.62, .05, .44, M(0xf4f4ee), 0, .92, .85));
  const motor = outboard(tint); motor.position.set(0, .62, -2.32); hull.add(motor);
  hull.userData.motor = motor;
  return hull;
}

export function createLancha(avatar = {}, color = '#e2683c') {
  const group = new THREE.Group(), hull = createLanchaHull(color), motor = hull.userData.motor;
  group.name = 'Lancha'; group.add(hull);
  // The pana sits aft, by the motor, one hand on the tiller.
  const pana = buildCharacter(avatar, { seated: true }); pana.group.scale.setScalar(.62); pana.group.position.set(-.12, .62, LANCHA.seat); hull.add(pana.group);
  let bob = 0, spin = 0, lean = 0, pitch = 0, yaw = 0, disposed = false;
  return {
    group, hull, motor, pana,
    update(dt, b = {}, time = 0) {
      if (disposed) return;
      bob += dt;
      const speed = Math.abs(b.v || 0), steer = clamp(b.steer || 0, -1, 1), dead = (b.stalled || 0) > 0, k = 1 - Math.exp(-dt * 8);
      const wave = sampleWaterWave(b.x ?? group.position.x, b.z ?? group.position.z, bob, .04 + Math.min(.05, speed * .004));
      // Planing lifts the bow; in the air the nose follows the fall.
      const wantPitch = b.air > 0 ? clamp(-(b.vy || 0) * .05, -.22, .3) : -clamp(speed / 9, 0, 1) * .12 * (b.throttle ?? 0) - (b.turbo > 0 ? .05 : 0);
      pitch += (wantPitch - pitch) * k; lean += (steer * clamp(speed / 8, 0, 1) * .16 - lean) * k; yaw += (-steer * .45 - yaw) * Math.min(1, dt * 10);
      hull.rotation.set(pitch + wave.pitch * .6, 0, lean + wave.roll * .6);
      hull.position.y = -SINK + wave.y + clamp(speed / 12, 0, 1) * .1;
      motor.rotation.y = yaw; motor.rotation.x = dead ? Math.sin(time * 40) * .02 : 0;
      spin += dt * (dead ? 0 : 6 + (b.throttle ?? 0) * 60 + (b.turbo > 0 ? 30 : 0)); motor.userData.prop.rotation.z = spin;
      pana.update(dt, { look: 0 });
      const arms = pana.arms;
      if (arms) { arms[1].rotation.set(-.5 + yaw * .4, 0, -.45 - yaw * .6); arms[0].rotation.set(b.turbo > 0 ? -2.6 : -.9, 0, .3); }
      pana.group.rotation.y = -.25 - yaw * .3; pana.group.rotation.z = -lean * .5;
    },
    dispose() {
      if (disposed) return; disposed = true;
      pana.dispose();
      const gs = new Set(); group.traverse(o => { if (o.geometry) gs.add(o.geometry); }); gs.forEach(g => g.dispose());
      group.removeFromParent();
    },
  };
}
