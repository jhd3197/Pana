// A racing lancha: a light peñero hull in the team colour, a fuera de borda
// on the transom that swivels with the steering and spins its propeller, and
// the pana at the tiller. Used by Lancha; Carreritas's kit adds the curiara
// and El Rayo variants at the bottom. +Z is the bow, metres; origin at the
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
// A hull spec: the sections, the extra height each one gets (bow/stern rise)
// and the side profile as [flare, height] rows. This is the peñero's; the kit
// variants pass their own.
const PENERO_HULL = { sections: SECTIONS, rise: lift, profile: [[.24, .05], [.74, .36], [1, .78]] };

function skin(side, inner, mat, spec = PENERO_HULL) {
  const { sections, rise, profile } = spec, ps = [], ix = [];
  sections.forEach(([z, w], i) => {
    for (const [f, y] of profile) ps.push(side * Math.max(.005, w * f - (inner ? .07 : 0)), y + rise(i) + (inner ? .05 : 0), z);
    if (i < sections.length - 1) for (let j = 0; j < profile.length - 1; j++) { const k = i * profile.length + j; ix.push(k, k + profile.length, k + 1, k + 1, k + profile.length, k + profile.length + 1); }
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); geo.setIndex(ix); geo.computeVertexNormals();
  return mesh(geo, mat);
}

// The bare shell every lancha variant shares: an outer and an inner skin per
// side, the rim tubes (gunwale, and the rub rail below it when `railMat` is
// given) and the flat bottom. Variants decorate it in their own way.
function shell(spec, { paint, inside, rimMat, railMat }) {
  const g = new THREE.Group(), { sections, rise, profile } = spec, top = profile[profile.length - 1][1];
  for (const side of [-1, 1]) {
    g.add(skin(side, false, paint, spec), skin(side, true, inside, spec));
    const rim = sections.map(([z, w], i) => [side * w, top + .02 + rise(i), z]);
    g.add(curve(rim, .05, rimMat, 28));
    if (railMat) g.add(curve(rim.map(([x, y, z]) => [x * .93, y - .2, z]), .03, railMat, 28));
  }
  const bottom = [], bix = [];
  sections.forEach(([z, w], i) => { const y = profile[0][1] + rise(i); bottom.push(-w * profile[0][0], y, z, w * profile[0][0], y, z); if (i < sections.length - 1) { const k = i * 2; bix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.Float32BufferAttribute(bottom, 3)); bgeo.setIndex(bix); bgeo.computeVertexNormals(); g.add(mesh(bgeo, paint));
  return g;
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
// leaves out the thwarts and the cava so Carreritas can fold it around a car;
// `body` paints the hull itself apart from the team colour (pennant, motor).
export function createLanchaHull(color = '#e2683c', { open = false, body = color } = {}) {
  const hull = new THREE.Group(), tint = new THREE.Color(color).getHex();
  hull.name = 'Casco de lancha';
  const paint = M(new THREE.Color(body).getHex(), { side: THREE.DoubleSide, roughness: .5 }), inside = M(0xe8d3a6, { side: THREE.DoubleSide, roughness: .8 });
  const cream = M(0xf3e5c3), wood = M(0xac8354, { roughness: 1 }), dark = M(0x2d3a3e);
  hull.add(shell(PENERO_HULL, { paint, inside, rimMat: cream, railMat: dark }));
  // Transom, thwarts, a bow deck and the bow's pennant.
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

// The ride every lancha variant shares: bobbing on the waves, planing pitch,
// lean into the turn, the motor swivelling with the steering and the pana at
// the tiller. `owned` lists extra materials a variant created and must free
// (M() materials are shared across models and are never disposed).
function ride(group, hull, motor, pana, owned = []) {
  let bob = 0, spin = 0, lean = 0, pitch = 0, yaw = 0, disposed = false;
  return {
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
      owned.forEach(m => m.dispose());
      group.removeFromParent();
    },
  };
}

export function createLancha(avatar = {}, color = '#e2683c') {
  const group = new THREE.Group(), hull = createLanchaHull(color), motor = hull.userData.motor;
  group.name = 'Lancha'; group.add(hull);
  // The pana sits aft, by the motor, one hand on the tiller.
  const pana = buildCharacter(avatar, { seated: true }); pana.group.scale.setScalar(.62); pana.group.position.set(-.12, .62, LANCHA.seat); hull.add(pana.group);
  return { group, hull, motor, pana, ...ride(group, hull, motor, pana) };
}

// Kit 'curiara' (Carreritas): a dugout river canoe — far narrower and lower
// than the peñero, pointed at both ends, a little fuera de borda on the stern
// and the pana deep inside. Same interface as createLancha.
const CURIARA_HULL = {
  sections: [[-2.5, .04], [-1.9, .38], [-.5, .48], [.8, .44], [1.9, .28], [2.6, .02]],
  rise: i => i === 0 ? .28 : i === 4 ? .1 : i === 5 ? .34 : 0,
  profile: [[.3, .04], [.8, .22], [1, .5]],
};

export function createCuriaraRacer(avatar = {}, color = '#3f9e7a') {
  const group = new THREE.Group(), hull = new THREE.Group(), tint = new THREE.Color(color).getHex();
  group.name = 'Curiara'; group.add(hull);
  // A wooden dugout; the team colour goes on the gunwale band and the motor.
  const paint = M(0x9c7448, { side: THREE.DoubleSide, roughness: .95 }), inside = M(0x6f4f30, { side: THREE.DoubleSide, roughness: 1 });
  const wood = M(0x5b4330, { roughness: 1 }), band = M(tint, { roughness: .5 });
  hull.add(shell(CURIARA_HULL, { paint, inside, rimMat: wood }));
  for (const side of [-1, 1]) hull.add(curve(CURIARA_HULL.sections.map(([z, w], i) => [side * (w + .01), .36 + CURIARA_HULL.rise(i), z]), .035, band, 28));
  // Small carved decks close the pointed tips; two thwarts brace the waist.
  const bowDeck = new THREE.Mesh(new THREE.ConeGeometry(.32, .95, 3, 1).rotateX(Math.PI / 2).scale(1, .22, 1), wood); bowDeck.position.set(0, .56, 2.15); bowDeck.rotation.z = Math.PI; hull.add(bowDeck);
  const sternDeck = new THREE.Mesh(new THREE.ConeGeometry(.3, .85, 3, 1).rotateX(-Math.PI / 2).scale(1, .22, 1), wood); sternDeck.position.set(0, .56, -2.1); sternDeck.rotation.z = Math.PI; hull.add(sternDeck);
  for (const z of [-.9, .7]) hull.add(rounded(.8, .06, .24, wood, 0, .38, z));
  const motor = outboard(tint); motor.scale.setScalar(.7); motor.position.set(0, .4, -2.55); hull.add(motor);
  // The pana sits low in the dugout, aft by the little motor.
  const pana = buildCharacter(avatar, { seated: true }); pana.group.scale.setScalar(.6); pana.group.position.set(-.08, .3, -1.35); hull.add(pana.group);
  return { group, hull, motor, pana, ...ride(group, hull, motor, pana) };
}

// Kit 'rayo' (Carreritas): a racing speedboat — a long knife of a bow, a low
// wraparound windscreen, a fat fuera de borda and a stripe that means
// business. Same interface as createLancha.
const RAYO_HULL = {
  sections: [[-2.4, .6], [-1.7, .74], [-.2, .78], [1.2, .64], [2.3, .32], [3.1, .02]],
  rise: i => i === 5 ? .4 : i === 4 ? .1 : 0,
  profile: [[.28, .05], [.78, .3], [1, .62]],
};

export function createRayo(avatar = {}, color = '#e8b93a') {
  const group = new THREE.Group(), hull = new THREE.Group(), tint = new THREE.Color(color).getHex();
  group.name = 'El Rayo'; group.add(hull);
  const paint = M(tint, { side: THREE.DoubleSide, roughness: .4 }), inside = M(0x2d3a3e, { side: THREE.DoubleSide, roughness: .8 });
  const white = M(0xf7f4ea, { roughness: .45 }), dark = M(0x22272b, { roughness: .6 });
  hull.add(shell(RAYO_HULL, { paint, inside, rimMat: white, railMat: dark }));
  // The sporty stripe: a white slash under the rim, running to the bow.
  for (const side of [-1, 1]) hull.add(curve(RAYO_HULL.sections.slice(0, 5).map(([z, w], i) => [side * (w + .012), .4 + RAYO_HULL.rise(i), z]), .06, white, 24));
  // A closed foredeck over the long bow, then the open cockpit.
  const deck = new THREE.Mesh(new THREE.ConeGeometry(.66, 2.1, 3, 1).rotateX(Math.PI / 2).scale(1, .22, 1), white); deck.position.set(0, .64, 2.05); deck.rotation.z = Math.PI; hull.add(deck);
  // The wraparound windscreen owns its transparent material (dispose below).
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .45, roughness: .1, side: THREE.DoubleSide });
  const shield = new THREE.Group(); shield.position.set(0, .95, .55); shield.rotation.x = -.38; hull.add(shield);
  shield.add(mesh(new THREE.PlaneGeometry(1.1, .4), glassMat));
  for (const s of [-1, 1]) { const pane = mesh(new THREE.PlaneGeometry(.5, .36), glassMat, s * .57, -.02, -.16); pane.rotation.y = -s * .65; shield.add(pane); }
  hull.add(box(1.16, .56, .08, paint, 0, .36, -2.4), box(1.2, .06, .12, white, 0, .65, -2.4));
  const motor = outboard(tint); motor.scale.setScalar(1.25); motor.position.set(0, .5, -2.55); hull.add(motor);
  // A low bucket seat; the pana peers over the windscreen.
  hull.add(rounded(.5, .3, .5, dark, 0, .3, -1.15, .06));
  const pana = buildCharacter(avatar, { seated: true }); pana.group.scale.setScalar(.6); pana.group.position.set(0, .42, -1.15); hull.add(pana.group);
  return { group, hull, motor, pana, ...ride(group, hull, motor, pana, [glassMat]) };
}
