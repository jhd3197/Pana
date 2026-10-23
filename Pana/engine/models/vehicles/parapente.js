// A paraglider: an arched ram-air wing in the team colour with white cell
// stripes, the line cascade down to two risers, a seat harness and the pana
// in it, both paws up on the brake handles. Used by Parapente. +Z is
// forward, metres; the origin is the harness seat.
//
// update(dt, p, time) reads p.steer (-1 left … 1 right), p.bar, p.brake,
// p.ears (0/1), p.v (airspeed), p.vy (climb), p.down (seconds on the ground)
// and p.finish (non-null once landed).
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { M, mesh, box } from '/engine/models/core/primitives.js';
import { rounded } from '/engine/models/core/architecture-kit.js';

export const PARAPENTE = Object.freeze({ span: 9.4, height: 6.4, chord: 2.5, cells: 22 });
const ARCH = 1.05, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Where the canopy sits for a spanwise position u (−1 … 1) and a chordwise
// one c (0 leading edge … 1 trailing edge); top is the upper skin.
function canopyPoint(u, c, top) {
  const a = u * ARCH, R = PARAPENTE.span / 2 / Math.sin(ARCH);
  const chord = PARAPENTE.chord * (1 - .42 * u * u), thick = chord * .13 * Math.sin(Math.PI * Math.min(1, c * 1.15)) * (top ? 1 : .25);
  const z = chord * (.42 - c), lift = (top ? thick : -thick) - .18 * c * c;
  return new THREE.Vector3(R * Math.sin(a) * (1 + lift / R), PARAPENTE.height + R * (Math.cos(a) - 1) + lift * Math.cos(a), z);
}

function canopy(color) {
  const tint = new THREE.Color(color), white = new THREE.Color(0xfaf6ec), under = tint.clone().lerp(white, .35), cols = 2 * PARAPENTE.cells, rows = 8;
  const ps = [], cs = [], ix = [];
  for (const top of [true, false]) {
    const base = ps.length / 3;
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
      const u = i / cols * 2 - 1, p = canopyPoint(u, j / rows, top), cell = Math.floor(i / 2) % 4 === 1;
      ps.push(p.x, p.y, p.z);
      const c = top ? (cell ? white : tint) : under;
      cs.push(c.r, c.g, c.b);
      if (i < cols && j < rows) {
        const k = base + i * (rows + 1) + j;
        if (top) ix.push(k, k + 1, k + rows + 1, k + 1, k + rows + 2, k + rows + 1);
        else ix.push(k, k + rows + 1, k + 1, k + 1, k + rows + 1, k + rows + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  geo.setIndex(ix); geo.computeVertexNormals();
  const wing = mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, side: THREE.DoubleSide }));
  wing.name = 'Vela';
  return wing;
}

// Three line rows (A, B, brakes) from the underside down to the risers.
function cascade() {
  const ps = [], risers = [[-.32, 1.55, .05], [.32, 1.55, .05]];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10 * 2 - 1, riser = risers[u < 0 ? 0 : 1];
    for (const c of [.08, .45, .98]) { const p = canopyPoint(u * .96, c, false); ps.push(p.x, p.y, p.z, ...riser); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5a5f66, transparent: true, opacity: .7 }));
  lines.name = 'Líneas';
  return lines;
}

export function createParapente(avatar = {}, color = '#2fa3e0') {
  const group = new THREE.Group(), rig = new THREE.Group(), sail = new THREE.Group();
  group.name = 'Parapente'; group.add(rig); rig.add(sail);
  const wing = canopy(color), lines = cascade();
  sail.add(wing, lines);
  // The seat harness, a reserve pouch and the two risers.
  const strap = M(0x2b2d42, { roughness: .8 }), trim = M(new THREE.Color(color).getHex(), { roughness: .6 });
  rig.add(rounded(.78, .18, .7, strap, 0, -.08, -.02, .06), rounded(.7, .5, .14, strap, 0, .22, -.36, .05), box(.72, .06, .12, trim, 0, .44, -.36));
  rig.add(rounded(.34, .22, .28, M(0xf3e5c3), 0, -.22, .32, .05));
  for (const s of [-1, 1]) rig.add(box(.04, 1.0, .04, strap, s * .32, 1.05, .05));
  const pana = buildCharacter(avatar, { seated: true }); pana.group.position.set(0, -.02, 0); rig.add(pana.group);
  let bank = 0, pitch = 0, swing = 0, ears = 0, flap = 0, disposed = false;
  return {
    group, rig, wing: sail, pana,
    update(dt, p = {}, time = 0) {
      if (disposed) return;
      const k = 1 - Math.exp(-dt * 4), grounded = (p.down || 0) > 0 || p.finish != null, steer = grounded ? 0 : clamp(p.steer || 0, -1, 1);
      // The pilot swings out of a turn under the wing; bar dives, brakes sit back.
      bank += (-steer * .55 * clamp((p.v ?? 16) / 14, .5, 1.2) - bank) * k;
      pitch += ((p.bar ? .12 : 0) - (p.brake ? .1 : 0) + clamp(-(p.vy || 0) * .015, -.08, .08) - pitch) * k;
      ears += ((p.ears ? 1 : 0) - ears) * Math.min(1, dt * 6);
      rig.rotation.set(grounded ? 0 : pitch, 0, grounded ? 0 : bank);
      swing += dt; flap += dt * (2 + Math.abs(p.vy || 0));
      // On the ground the wing lies collapsed behind the pana.
      if (grounded) { sail.position.set(0, -PARAPENTE.height + .9, -3.6); sail.rotation.set(-1.25, 0, 0); sail.scale.set(.9, .35, 1); }
      else { sail.position.set(0, 0, 0); sail.rotation.set(Math.sin(flap * .9) * .01, 0, Math.sin(swing * 1.3) * .015); sail.scale.set(1 - ears * .24, 1 - ears * .08, 1); }
      pana.update(dt, { look: 0, dizzy: (p.down || 0) > 0 });
      const arms = pana.arms;
      if (arms) {
        // Paws on the brake handles; pulling one side turns that way.
        const left = grounded ? .9 : -2.7 + (p.brake ? .5 : 0) + Math.max(0, -steer) * .6, right = grounded ? .9 : -2.7 + (p.brake ? .5 : 0) + Math.max(0, steer) * .6;
        arms[0].rotation.set(p.finish != null ? -2.9 : left, 0, .22); arms[1].rotation.set(p.finish != null ? -2.9 : right, 0, -.22);
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      // M() materials are shared across models; only the wing and lines own theirs.
      pana.dispose();
      group.traverse(o => o.geometry?.dispose());
      wing.material.dispose(); lines.material.dispose();
      group.removeFromParent();
    },
  };
}
