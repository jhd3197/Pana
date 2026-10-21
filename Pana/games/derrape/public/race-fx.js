// Race glow: the turbo exhaust, impact sparks and coin sparkles, drawn as
// glowing points (particles.js) instead of low-poly puffs — one additive
// draw for all of it. game.js installs it as race.glow when it loads (the
// slow-mo pattern); until then race.glow is a no-op stub.
import { getSettings } from '/engine/settings.js';
import { createParticleField } from './particles.js';
import { statCount } from '/engine/stats.js';

// A hit counts toward El Chocón on the results (c.hits); the local player's
// hits also reach the stats pipe as derrape.crashes.

const GOLD = [0xffe066, 0xffc629, 0xffffff, 0xffb000];
const HOT = [0xffffff, 0xfff1b8, 0xffb347, 0xff7a1a];

export function createRaceFx(scene) {
  const glow = createParticleField(scene, { capacity: 1600, additive: true, core: 0.85, name: 'race-glow' });
  const low = () => getSettings().quality === 'baja';
  const pick = list => list[Math.floor(Math.random() * list.length)];
  return {
    // Turbo exhaust: flame-coloured embers off both tailpipes, carried with
    // the car and blown back, with a fat flare at each pipe.
    boost(c, colors, dt) {
      const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
      const carry = 0.85 * (c.vf || 0);
      c.boostCarry = (c.boostCarry || 0) + dt * (low() ? 45 : 90);
      const n = Math.floor(c.boostCarry);
      c.boostCarry -= n;
      for (const side of [-0.45, 0.45]) {
        const x = c.x - fx * 2.2 + rx * side, z = c.z - fz * 2.2 + rz * side, y = c.y + 0.55;
        glow.emit(x, y, z, fx * carry, 0, fz * carry, { color: colors[0], size: 1.1, life: 0.05, gravity: 0, drag: 0 });
        for (let i = 0; i < n; i++) {
          const back = 4 + Math.random() * 6;
          glow.emit(x, y, z, fx * (carry - back) + (Math.random() - 0.5) * 1.5, 0.5 + Math.random() * 1.2, fz * (carry - back) + (Math.random() - 0.5) * 1.5,
            { color: pick(colors), size: 0.45, life: 0.28, gravity: -2, drag: 2 });
        }
      }
    },
    // A hit: hot sparks sprayed from the contact side, more for harder hits.
    // side: -1 left, 1 right, 0 head-on.
    impact(c, power, side = 0) {
      c.hits = (c.hits || 0) + 1;
      if (c.isPlayer) statCount('derrape.crashes', 1);
      const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
      const n = Math.min(80, Math.round(power * (low() ? 1.5 : 3)));
      const x = c.x + rx * side * 1.1 + (side ? 0 : fx * 1.8), z = c.z + rz * side * 1.1 + (side ? 0 : fz * 1.8);
      const carry = 0.6 * (c.vf || 0);
      for (let i = 0; i < n; i++) {
        const out = side || (Math.random() - 0.5) * 2, speed = 4 + Math.random() * 8;
        glow.emit(x, c.y + 0.6, z,
          fx * (carry + (Math.random() - 0.5) * 6) + rx * out * speed, 2 + Math.random() * 6, fz * (carry + (Math.random() - 0.5) * 6) + rz * out * speed,
          { color: pick(HOT), size: 0.32, life: 0.45, gravity: 18, drag: 1.8 });
      }
    },
    // Coins: a golden burst at pos (picked up or spilled).
    coins(pos, n = 12) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, out = 2 + Math.random() * 4;
        glow.emit(pos.x, pos.y, pos.z, Math.cos(a) * out, 2 + Math.random() * 5, Math.sin(a) * out,
          { color: pick(GOLD), size: 0.4, life: 0.6, gravity: 9, drag: 1.5 });
      }
    },
  };
}
