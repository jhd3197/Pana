// A racing curiara: the shared dugout, one or two seated panas and their
// paddles. The paddle pose is read from the canoe's paddle state
// (/engine/paddle.js), so a stroke on the host is a stroke on every screen.
// Used by Curiara and Bululú's river minigames. +Z is the bow, metres.
//
// update(dt, b, time) reads b.paddle {last, side, back, rudder}, b.capsized
// (seconds left upside down), b.rollSide, b.vy, b.air, b.splashAt/splashSide.
import * as THREE from 'three';
import { riverCanoe } from '/engine/models/props/llano-life.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { M, mesh, tube } from '/engine/models/core/primitives.js';

// Thwarts of riverCanoe(): z −1.55 (popa) and .9 (proa). A solo pana sits aft.
export const SEATS = { solo: [-1.55], pair: [.9, -1.55] };
const SINK = .18, CAPSIZE = 1.8;
const ease = t => t * t * (3 - 2 * t);

function makePaddle(color) {
  const g = new THREE.Group(); g.name = 'Canalete';
  const wood = M(0xb88a55, { roughness: .8 });
  g.add(tube([0, .25, 0], [0, -1.15, 0], .025, wood));
  g.add(mesh(new THREE.SphereGeometry(.045, 8, 6), wood, 0, .27, 0));
  // Leaf blade, painted in the canoe's colour at the tip.
  const blade = mesh(new THREE.CylinderGeometry(.11, .09, .5, 10, 1), wood, 0, -1.35, 0); blade.scale.z = .22; g.add(blade);
  const tip = mesh(new THREE.CylinderGeometry(.09, .03, .12, 10, 1), M(color, { roughness: .6 }), 0, -1.65, 0); tip.scale.z = .22; g.add(tip);
  return g;
}

// `pull` is how long a stroke's pull lasts (PADDLE.pull in /engine/paddle.js).
export function createCanoe(crew, color = '#e2683c', { pull = .3 } = {}) {
  const group = new THREE.Group(), hull = new THREE.Group(), tint = new THREE.Color(color).getHex();
  group.name = 'Curiara'; group.add(hull);
  const canoe = riverCanoe(); hull.add(canoe);
  // A painted band and a stern pennant so every canoe reads from behind.
  for (const side of [-1, 1]) {
    const band = tube([side * .6, .6, -1.9], [side * .6, .6, 1.6], .035, M(tint, { roughness: .55 }));
    hull.add(band);
  }
  const pole = tube([0, .55, -2.6], [0, 1.65, -2.75], .02, M(0x5b4330)); hull.add(pole);
  const flag = mesh(new THREE.PlaneGeometry(.38, .22), M(tint, { side: THREE.DoubleSide, roughness: .7 }), 0, 1.52, -2.76);
  flag.rotation.y = Math.PI / 2; flag.geometry.translate(.19, 0, 0); hull.add(flag);
  const seats = crew.length === 2 ? SEATS.pair : SEATS.solo;
  // The crew rides with the hull, except while swimming beside it.
  const aboard = new THREE.Group(); aboard.name = 'Tripulación'; group.add(aboard);
  const panas = crew.map((c, i) => {
    const body = buildCharacter(c.avatar || {}, { seated: true });
    body.group.scale.setScalar(.62); body.group.position.set(0, .62, seats[i]);
    const paddle = makePaddle(tint); aboard.add(body.group, paddle);
    return { body, paddle, seat: seats[i], role: crew.length === 2 ? (i ? 'popa' : 'proa') : 'solo', swim: new THREE.Vector3(), empty: !!c.empty };
  });
  for (const p of panas) p.body.group.visible = p.paddle.visible = !p.empty;
  let bob = 0, disposed = false, roll = 0;

  // Pull: blade from the bow (catch) to the hip; recovery swings it forward.
  function posePaddle(p, side, since, back, time) {
    const g = p.paddle, arms = p.body.arms;
    let sweep, lift;
    if (back) { sweep = .55 + Math.sin(time * 7) * .35; lift = 0; }
    else if (since < pull) { sweep = -.85 + 1.7 * ease(since / pull); lift = 0; }
    else if (since < pull + .3) { const u = ease((since - pull) / .3); sweep = .85 - 1.4 * u; lift = Math.sin(u * Math.PI) * .45; }
    else { sweep = -.55 + Math.sin(time * 2.2) * .04; lift = .25; }
    g.position.set(side * .42, 1.32, p.seat + .1);
    g.rotation.set(sweep, 0, side * (.42 + lift));
    arms[0].rotation.set(-1.1 + sweep * .5, 0, .25 + (side < 0 ? .25 : -.1));
    arms[1].rotation.set(-1.1 + sweep * .5, 0, -.25 + (side > 0 ? -.25 : .1));
    p.body.group.rotation.y = side * (.18 - sweep * .12);
    p.body.group.rotation.x = since < pull && !back ? .12 * Math.sin(since / pull * Math.PI) : 0;
  }
  // The popa holds a rudder blade trailing on its side.
  function poseRudder(p, dir, back, time) {
    const side = dir || 1, g = p.paddle, arms = p.body.arms;
    g.position.set(side * .45, 1.25, p.seat - .2);
    g.rotation.set(back ? .5 + Math.sin(time * 7) * .35 : .75, 0, side * (.55 - (dir ? .15 : 0)));
    arms.forEach(a => a.rotation.set(-.6, 0, side * -.25));
    p.body.group.rotation.y = side * .3;
  }

  return {
    group, hull, panas,
    update(dt, b, time) {
      if (disposed) return;
      bob += dt;
      const P = b.paddle || {}, since = P.last == null ? 9 : time - P.last;
      // Capsize: roll under, swim beside it, right it and climb back in.
      const left = b.capsized || 0, t = left > 0 ? CAPSIZE - left : 0;
      const target = left > 0 ? (t < .35 ? ease(t / .35) : t < 1.35 ? 1 : 1 - ease((t - 1.35) / .45)) * Math.PI : 0;
      roll += (target - roll) * Math.min(1, dt * 14);
      hull.rotation.z = roll * (b.rollSide || 1) + Math.sin(bob * 1.7) * .02 + (b.lean || 0);
      hull.rotation.x = Math.sin(bob * 1.3) * .012 - (b.vy < -1 ? .18 : 0) + (b.air > 0 && b.vy > 0 ? -.06 : 0);
      // Upside down the keel shows above the water.
      hull.position.y = -SINK + Math.sin(bob * 2.1) * .02 + roll / Math.PI * .72;
      const swimming = left > 0 && t > .3 && t < 1.55;
      if (swimming) { aboard.position.set(0, 0, 0); aboard.rotation.set(0, 0, 0); }
      else { aboard.position.copy(hull.position); aboard.rotation.copy(hull.rotation); }
      for (const [i, p] of panas.entries()) {
        if (p.empty) continue;
        p.body.update(dt, { look: 0 });
        if (swimming) {
          // Out of the hull: heads above water, paddling with the arms.
          p.body.group.position.set((i ? -1 : 1) * 1.3, -.72 + Math.sin(bob * 6 + i) * .05, p.seat);
          p.body.group.rotation.set(-.4, 0, 0);
          p.body.arms.forEach((a, k) => a.rotation.set(-2.6 + Math.sin(bob * 9 + k * 3) * .6, 0, 0));
          p.paddle.visible = false;
          continue;
        }
        p.paddle.visible = true;
        p.body.group.position.set(0, .62, p.seat);
        p.body.group.rotation.z = 0;
        if (p.role === 'popa') poseRudder(p, P.rudder || 0, !!P.back, time);
        else posePaddle(p, P.side || (i ? 1 : -1), since, !!P.back, time);
        // ¡Salpicón!: the blade sweeps flat across the water toward the target.
        const slap = time - (b.splashAt ?? -9);
        if (slap >= 0 && slap < .45 && (p.role !== 'proa')) {
          const side = b.splashSide || 1, u = slap / .45;
          p.paddle.position.set(side * .55, 1.1, p.seat + .2);
          p.paddle.rotation.set(-.2, 0, side * (1.25 - Math.sin(u * Math.PI) * .5));
          p.body.group.rotation.y = side * (.6 - u * .9);
        }
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const p of panas) p.body.dispose();
      const gs = new Set(); group.traverse(o => { if (o.geometry) gs.add(o.geometry); }); gs.forEach(g => g.dispose());
      group.removeFromParent();
    },
  };
}
