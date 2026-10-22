// A little bush plane: a round-nosed fuselage in the team colour with a
// white band, a high wing on struts, a spinning two-blade propeller, fat
// landing wheels and the pana in an open cockpit with one paw on the stick.
// Used by Carreritas's flight gates. +Z is the nose, metres; the origin is the
// ground under the main wheels.
//
// update(dt, p, time) reads p.steer (-1 left … 1 right), p.v (m/s), p.vy
// (climb, m/s) and p.boost (seconds of turbo left).
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { rounded } from '/engine/models/core/architecture-kit.js';

export const AVIONETA = Object.freeze({ length: 4.6, span: 7.2, seat: 1.05 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createAvioneta(avatar = {}, color = '#e8443a') {
  const group = new THREE.Group(), body = new THREE.Group();
  group.name = 'Avioneta'; group.add(body);
  const paint = M(new THREE.Color(color).getHex(), { roughness: .45 }), white = M(0xfaf6ec, { roughness: .5 });
  const dark = M(0x2b2d42, { roughness: .6 }), steel = M(0xb8c0c4, { metalness: .5, roughness: .35 }), tyre = M(0x1d1f24, { roughness: .9 });
  // Fuselage: fat at the cockpit, tapering to the tail; a white band behind the seat.
  const hull = mesh(new THREE.CylinderGeometry(.62, .2, 4.2, 18).rotateX(Math.PI / 2), paint, 0, 1.15, -.25);
  hull.scale.set(1, 1.05, 1); body.add(hull);
  body.add(mesh(new THREE.CylinderGeometry(.6, .63, .3, 18).rotateX(Math.PI / 2), white, 0, 1.15, -.55));
  // Cowling, spinner and the propeller.
  body.add(mesh(new THREE.CylinderGeometry(.5, .62, .6, 18).rotateX(Math.PI / 2), white, 0, 1.15, 2.05));
  body.add(mesh(new THREE.ConeGeometry(.2, .42, 14).rotateX(Math.PI / 2), paint, 0, 1.15, 2.55));
  const prop = new THREE.Group(); prop.position.set(0, 1.15, 2.42); body.add(prop);
  for (const s of [-1, 1]) { const blade = rounded(.16, 1.05, .05, dark, 0, s * .55, 0, .02); blade.rotation.y = s * .25; prop.add(blade); }
  // The high wing on two struts a side, its tips in the team colour.
  body.add(rounded(AVIONETA.span, .14, 1.15, white, 0, 1.95, .45, .05));
  // Navigation lights (red port, green starboard) so it reads on night maps too.
  const lights = [0xff3b3b, 0x3bff7a].map(c => new THREE.MeshBasicMaterial({ color: c }));
  for (const [i, s] of [-1, 1].entries()) body.add(mesh(new THREE.SphereGeometry(.12, 10, 8), lights[i], s * (AVIONETA.span / 2 + .05), 1.96, .6));
  for (const s of [-1, 1]) {
    body.add(rounded(.9, .15, 1.16, paint, s * (AVIONETA.span / 2 - .45), 1.96, .45, .05));
    body.add(tube([s * .5, .9, .6], [s * 1.9, 1.9, .5], .045, steel), tube([s * .5, .9, .1], [s * 1.9, 1.9, .3], .045, steel));
  }
  // Tail: stabilizer and a fin with a white stripe.
  body.add(rounded(2.3, .08, .62, white, 0, 1.25, -2.15, .03));
  body.add(rounded(.08, .95, .75, paint, 0, 1.72, -2.2, .03), box(.1, .14, .5, white, 0, 1.62, -2.15));
  // Open cockpit: a windscreen in front of the pana.
  const glass = mesh(new THREE.PlaneGeometry(.9, .42), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .45, roughness: .1, side: THREE.DoubleSide }), 0, 1.86, .62);
  glass.rotation.x = -.5; body.add(glass);
  // Landing gear: two fat wheels on legs and a tail wheel.
  for (const s of [-1, 1]) {
    body.add(tube([s * .3, .75, .75], [s * .78, .32, .8], .05, steel));
    body.add(mesh(new THREE.CylinderGeometry(.32, .32, .22, 16).rotateZ(Math.PI / 2), tyre, s * .82, .32, .8));
  }
  body.add(mesh(new THREE.CylinderGeometry(.12, .12, .08, 10).rotateZ(Math.PI / 2), tyre, 0, .14, -2.3), tube([0, .2, -2.3], [0, .9, -2.1], .03, steel));
  const pana = buildCharacter(avatar, { seated: true }); pana.group.scale.setScalar(.62); pana.group.position.set(0, AVIONETA.seat, .05); body.add(pana.group);
  const glassMaterial = glass.material;
  let bank = 0, pitch = 0, spin = 0, disposed = false;
  return {
    group, body, prop, pana,
    update(dt, p = {}, time = 0) {
      if (disposed) return;
      const k = 1 - Math.exp(-dt * 5), steer = clamp(p.steer || 0, -1, 1);
      bank += (-steer * .55 - bank) * k;
      pitch += (clamp(-(p.vy || 0) * .03, -.25, .25) - pitch) * k;
      body.rotation.set(pitch, 0, bank);
      body.position.y = Math.sin(time * 1.7) * .08;
      spin += dt * (40 + Math.abs(p.v || 0) * 2 + (p.boost > 0 ? 30 : 0)); prop.rotation.z = spin;
      pana.update(dt, { look: 0 });
      const arms = pana.arms;
      if (arms) { arms[1].rotation.set(-.9 - steer * .2, 0, -.3 - steer * .25); arms[0].rotation.set(p.boost > 0 ? -2.6 : -.7, 0, .35); }
    },
    dispose() {
      if (disposed) return; disposed = true;
      // M() materials are shared across models; only the windscreen and lights own theirs.
      pana.dispose();
      group.traverse(o => o.geometry?.dispose());
      glassMaterial.dispose(); lights.forEach(m => m.dispose());
      group.removeFromParent();
    },
  };
}
