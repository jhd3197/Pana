// Drift presentation: the charge sparks under the rear wheels and the smoke
// plume behind them. Colours escalate with the charge: dust, blue, orange,
// purple. game.js calls driftSparks from syncCar; what only shows on screen
// lives here, never in game.js.
//
// The sparks are glowing points (particles.js): one draw for every car's
// sparks, a hot white core inside the charge colour, flung back and outward
// off the rear tyres with gravity, with a bright flare at each tyre in the
// charge colour. The plume is soft sprites too (a second, normally blended
// field), so a drift draws no polyhedra at all. Held purple past OVERHEAT_WARN
// the sparks flicker red; a burn (drive.js) coughs a black cloud.
import * as THREE from 'three';
import { getSettings } from '/engine/settings.js';
import { driftLevel, overheatWarn } from './drive-rules.js';
import { createParticleField } from './particles.js';

// Sparks under the rear wheels show the drift charge: dust, then blue,
// orange and purple. A stalled engine coughs black smoke instead.
export const SPARKS = [0xd8c6a8, 0x4fb6ff, 0xff9a1f, 0xc45bff];
const RED = 0xff3b2f;
const RATE = [0, 70, 100, 135];   // sparks per second per rear tyre, by charge level

let field = null, smoke = null;
const sparkField = (scene) => field ??= createParticleField(scene, { capacity: 1400, additive: true, core: 0.9, name: 'drift-sparks' });
const smokeField = (scene) => smoke ??= createParticleField(scene, { capacity: 700, additive: false, core: 0, name: 'drift-smoke' });
const tint = new THREE.Color(), white = new THREE.Color(0xffffff);

export function driftSparks(puffs, c, dt) {
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
  if (c.drift && c.onGround && !c.boat && !c.plane) {   // on a river stretch transform-gates.js throws spray instead
    const level = c.remote ? c.driftLvl || 0 : driftLevel(c.driftT);
    if (level) emitSparks(sparkField(puffs.scene), c, level, dt, fx, fz, rx, rz);
  }
  // A burn: black smoke billowing off the rear for a moment.
  if (c.burnT > 0) {
    c.burnPuffT = (c.burnPuffT || 0) - dt;
    if (c.burnPuffT <= 0) {
      c.burnPuffT = 0.06;
      puffs.spawn(new THREE.Vector3(c.x - fx * 2, c.y + 0.5, c.z - fz * 2), { color: 0x26262b, count: 2, size: 1.3, rise: 1.8, life: 1.1, spread: 1.2 });
    }
  }
  c.sparkT = (c.sparkT || 0) - dt;
  if (c.sparkT > 0) return;
  c.sparkT = 0.05;
  if (c.drift && c.onGround && !c.boat && !c.plane) driftSmoke(smokeField(puffs.scene), c, c.remote ? c.driftLvl || 0 : driftLevel(c.driftT), fx, fz, rx, rz);
  if (c.stall > 0) puffs.spawn(new THREE.Vector3(c.x - fx * 2.2, c.y + 0.7, c.z - fz * 2.2), { color: 0x3a3a40, count: 1, size: 0.8, rise: 1.6, life: 0.8 });
  if (c.draft > 0.2 && c.isPlayer) {
    puffs.spawn(new THREE.Vector3(c.x + fx * 2 + rx * (Math.random() * 4 - 2), c.y + 1 + Math.random(), c.z + fz * 2 + rz * (Math.random() * 4 - 2)),
      { color: 0xf4f8ff, count: 1, size: 0.25, rise: 0, life: 0.25, spread: 0.2 });
  }
}

// Sparks off both rear tyres: thrown back and to the outside of the slide,
// a little up, inheriting some of the car's speed; gravity pulls them down.
function emitSparks(sparks, c, level, dt, fx, fz, rx, rz) {
  const low = getSettings().detail === 'baja';
  const warn = !c.remote && overheatWarn(c.driftT);
  c.sparkCarry = (c.sparkCarry || 0) + RATE[level] * (low ? 0.5 : 1) * dt;
  const n = Math.floor(c.sparkCarry);
  c.sparkCarry -= n;
  const out = -c.drift;   // the tail swings out away from the turn
  const carry = 0.9 * (c.vf || 0), hue = warn && Math.sin(performance.now() / 45) > 0 ? RED : SPARKS[level];
  for (const side of [-1, 1]) {
    const wx = c.x - fx * 1.7 + rx * side * 1.05, wz = c.z - fz * 1.7 + rz * side * 1.05;
    // The flare: one short, fat glow sitting on the tyre, every frame.
    sparks.emit(wx, c.y + 0.2, wz, fx * carry, 0, fz * carry, { color: hue, size: 0.9 + level * 0.25, life: 0.06, gravity: 0, drag: 0 });
    for (let i = 0; i < n; i++) {
      const back = 1 + Math.random() * 3, lateral = out * (1.5 + Math.random() * 3) + (Math.random() - 0.5) * 2, up = 1 + Math.random() * 3.5;
      const color = warn && Math.random() < 0.6 ? RED : Math.random() < 0.25 ? 0xffffff : SPARKS[level];
      sparks.emit(wx, c.y + 0.12, wz,
        fx * (carry - back) + rx * lateral, up, fz * (carry - back) + rz * lateral,
        { color, size: 0.28 + level * 0.06, life: 0.22 + level * 0.04, gravity: 16, drag: 2.5 });
    }
  }
}

// The plume: soft round puffs off both rear tyres, rising and spreading as
// they fade, pale and tinted by the charge, so a held drift reads as
// escalating smoke. Half rate on quality baja.
function driftSmoke(smoke, c, level, fx, fz, rx, rz) {
  const low = getSettings().detail === 'baja', carry = 0.35 * (c.vf || 0);
  tint.set(SPARKS[level]).lerp(white, level ? 0.55 : 0.2);
  const color = tint.getHex();
  for (const side of [-1, 1]) for (let i = 0; i < (low ? 1 : 2); i++) {
    smoke.emit(c.x - fx * 2 + rx * side * 1.05, c.y + 0.35, c.z - fz * 2 + rz * side * 1.05,
      fx * carry + (Math.random() - 0.5) * 2, 0.6 + Math.random() * 0.8, fz * carry + (Math.random() - 0.5) * 2,
      { color, size: 1.6 + level * 0.35, life: 0.9 + level * 0.12, gravity: -1.2, drag: 1.4 });
  }
}
