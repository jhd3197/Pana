// Drift presentation: the charge sparks under the rear wheels and the smoke
// plume behind them. Colours escalate with the charge: dust, blue, orange,
// purple. game.js calls driftSparks from syncCar; what only shows on screen
// lives here, never in game.js.
import * as THREE from 'three';
import { getSettings } from '/engine/settings.js';
import { driftLevel } from './drive-rules.js';

// Sparks under the rear wheels show the drift charge: dust, then blue,
// orange and purple. A stalled engine coughs black smoke instead.
export const SPARKS = [0xd8c6a8, 0x4fb6ff, 0xff9a1f, 0xc45bff];

export function driftSparks(puffs, c, dt) {
  c.sparkT = (c.sparkT || 0) - dt;
  if (c.sparkT > 0) return;
  c.sparkT = 0.05;
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
  if (c.drift && c.onGround) {
    const level = c.remote ? c.driftLvl || 0 : driftLevel(c.driftT);
    for (const side of [-1, 1]) {
      puffs.spawn(new THREE.Vector3(c.x - fx * 1.7 + rx * side * 1.1, c.y + 0.25, c.z - fz * 1.7 + rz * side * 1.1),
        { color: SPARKS[level], count: 1, size: level ? 0.42 : 0.6, rise: level ? 0.9 : 0.5, life: level ? 0.28 : 0.5, spread: 0.3 });
    }
    driftSmoke(puffs, c, level, fx, fz);
  }
  if (c.stall > 0) puffs.spawn(new THREE.Vector3(c.x - fx * 2.2, c.y + 0.7, c.z - fz * 2.2), { color: 0x3a3a40, count: 1, size: 0.8, rise: 1.6, life: 0.8 });
  if (c.draft > 0.2 && c.isPlayer) {
    puffs.spawn(new THREE.Vector3(c.x + fx * 2 + rx * (Math.random() * 4 - 2), c.y + 1 + Math.random(), c.z + fz * 2 + rz * (Math.random() * 4 - 2)),
      { color: 0xf4f8ff, count: 1, size: 0.25, rise: 0, life: 0.25, spread: 0.2 });
  }
}

// The plume: bigger and slower than the sparks, pooling behind the car and
// tinted by the same charge palette, so a held drift reads as escalating
// smoke. Half rate on quality baja.
function driftSmoke(puffs, c, level, fx, fz) {
  const low = getSettings().quality === 'baja';
  puffs.spawn(new THREE.Vector3(c.x - fx * 2.1, c.y + 0.3, c.z - fz * 2.1),
    { color: SPARKS[level], count: low ? 1 : 2, size: 0.8 + level * 0.22, rise: 1.1 + level * 0.25, life: 0.85 + level * 0.15, spread: 0.7 });
}
