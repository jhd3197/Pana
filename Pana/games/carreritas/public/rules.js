// Carreritas's race rules: plain math on car records, no Three.js and no DOM.
// game.js drives the cars and plays the sounds; tests/rules.test.js checks these.
// (Online pose packing lives in online-rules.js, inventory in item-rules.js.)

export const CAR_RADIUS = 1.65;          // two cars touch closer than 2 × this
export const CONTACT_HEIGHT = 1.6;       // a car this far above another passes over it
export const BOUNCE = 1.08;              // mostly inelastic: door rubs stay grounded
export const CRASH_SPEED = 14;           // only a hard impact interrupts a drift
export const BUMP_SPEED = 2;             // closing speed that still makes a bonk

// Race clock as m:ss.s (1:12.4), seconds only under a minute.
export function clockText(t) {
  const d = Math.floor(t * 10), m = Math.floor(d / 600), s = (d % 600) / 10;
  return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : s.toFixed(1);
}

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Finishers by time, then everyone else by distance raced (lap × total + progress).
export function raceOrder(cars, total) {
  return [...cars].sort((a, b) => {
    if (a.done && b.done) return a.time - b.time;
    if (a.done !== b.done) return a.done ? -1 : 1;
    return (b.lap * total + b.prog) - (a.lap * total + a.prog);
  });
}

// A rival's pedals from its heading error (diff, radians) and how far it is
// ahead of the player (gap, metres): ease off in turns and when far ahead.
export function aiPedals(diff, gap) {
  const throttle = Math.abs(diff) > 0.6 ? 0.55 : gap > 40 ? 0.75 : 1;
  return { throttle, steer: Math.max(-1, Math.min(1, diff * 2.8)) };
}

// Pushes two touching cars apart and trades momentum by mass. Online, each
// client resolves only its own car's share (a remote car's share is 0); the
// rival's client resolves the other half from the same two poses.
// Returns null without contact, else { speed, kind, a: {hit, power, side}, b: {…} }
// where kind is 'crash', 'bump' or 'touch'. Car contact power only feeds the
// suspension response; airborne crashes belong to weapons and world hazards.
export function resolveContact(a, b) {
  if (Math.abs(a.y - b.y) > CONTACT_HEIGHT) return null;
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz), min = CAR_RADIUS * 2;
  if (d >= min) return null;
  const nx = d > 0.001 ? dx / d : Math.cos(a.h), nz = d > 0.001 ? dz / d : -Math.sin(a.h);
  // the composed tune carries taller parts (a cava adds weight); bare defs still work
  const ma = (a.tune ?? a.def.tune).mass, mb = (b.tune ?? b.def.tune).mass;
  const ka = a.remote ? 0 : 1, kb = b.remote ? 0 : 1;
  if (!ka && !kb) return null;
  const push = min - d;
  a.x -= nx * push * mb / (ma + mb) * ka;
  a.z -= nz * push * mb / (ma + mb) * ka;
  b.x += nx * push * ma / (ma + mb) * kb;
  b.z += nz * push * ma / (ma + mb) * kb;
  const speed = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;   // closing speed
  if (speed <= 0) return { speed, kind: 'touch', a: { hit: false }, b: { hit: false } };
  const j = BOUNCE * Math.min(speed, 18) / (1 / ma + 1 / mb);
  a.vx -= j / ma * nx * ka; a.vz -= j / ma * nz * ka;
  b.vx += j / mb * nx * kb; b.vz += j / mb * nz * kb;
  const kind = speed > CRASH_SPEED ? 'crash' : speed > BUMP_SPEED ? 'bump' : 'touch';
  // which side each car got hit on decides which way it rolls
  return {
    speed, kind,
    a: { hit: !!ka, power: Math.min(10, speed * mb / (ma + mb)), side: Math.sign(nx * -Math.cos(a.h) + nz * Math.sin(a.h)) || 1 },
    b: { hit: !!kb, power: Math.min(10, speed * ma / (ma + mb)), side: Math.sign(nx * Math.cos(b.h) - nz * Math.sin(b.h)) || 1 },
  };
}
