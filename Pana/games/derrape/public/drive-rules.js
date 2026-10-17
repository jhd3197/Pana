// Derrape's driving skills as plain math: drift charge, start boost, ramp
// tricks, slipstream and coin loss. game.js applies them in stepCar;
// tests/drive-rules.test.js checks them. No Three.js, no DOM.

export const DRIFT_MIN_SPEED = 12;          // m/s needed to start (and keep) a drift
export const DRIFT_LEVELS = [0.75, 1.6, 2.5]; // charge (s) for blue, orange, purple sparks
export const DRIFT_BOOST = [0, 0.55, 0.95, 1.45];   // turbo seconds per level on release
export const HOP_SPEED = 2.8;               // short entry hop: steering returns sooner
export const DRIFT_EXIT_TIME = 0.45;        // settle the car before the release turbo

// Charge level 0..3 for a drift charge in seconds.
export const driftLevel = (charge) => DRIFT_LEVELS.filter(t => charge >= t).length;

// A small natural turn leaves room to adjust the line. Countersteering can
// actually straighten the car instead of forcing it deeper into the corner.
export function driftSteer(dir, steer) {
  const into = Math.max(-1, Math.min(1, steer * dir));   // +1 tightens, -1 widens
  return dir * (0.15 + into * 0.7);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = v => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };

// Only intervene when the projected path approaches an edge, or the driver
// keeps turning after the nose has passed the useful corner heading.
// Geometry/eligibility stays in game.js; this rule never moves or teleports a car.
export function assistDrift(steer, aimError, projectedOffset, halfWidth, turnScale) {
  const edge = smooth((Math.abs(projectedOffset) - halfWidth * 0.45) / Math.max(1, halfWidth * 0.55 - 2.7));
  const overshoot = steer * aimError < 0 ? smooth((Math.abs(aimError) - 0.12) / 0.3) : 0;
  const amount = Math.max(edge, overshoot);
  const correction = clamp(aimError * 3.2 / Math.max(0.3, turnScale), -1, 1);
  return { steer: steer + (correction - steer) * amount, amount };
}

// Tight drifts charge faster than lazy ones, so steering into the turn pays.
export const driftCharge = (dir, steer) => 0.75 + Math.max(0, steer * dir) * 0.5;

// Rocket start. `pressedAt` is the countdown value (3.999 → 1) when the
// throttle went down and stayed down, or null when it is not held at "¡YA!".
// Press during the second half of "1" for a turbo; mash it on "3" and stall.
export function startBoost(pressedAt) {
  if (pressedAt == null) return { boost: 0, stall: 0 };
  if (pressedAt <= 1.6) return { boost: 1.3, stall: 0 };
  if (pressedAt > 2.85) return { boost: 0, stall: 0.9 };
  return { boost: 0, stall: 0 };
}

// A trick in the air pays out a short turbo on a clean landing.
export const TRICK_MIN_AIR = 0.35;          // seconds airborne before a trick counts
export const trickBoost = (airTime, upright) => upright && airTime >= TRICK_MIN_AIR ? 0.75 : 0;

// Slipstream: b sits in a's wake when it is 3–20 m directly behind a, both
// moving fast. Returns true when b should build draft this step.
export function inSlipstream(a, b) {
  if (Math.min(a.vf, b.vf) < 16) return false;
  const fx = Math.sin(a.h), fz = Math.cos(a.h);
  const dx = b.x - a.x, dz = b.z - a.z;
  const back = -(dx * fx + dz * fz);          // metres b is behind a
  const side = Math.abs(dx * fz - dz * fx);   // metres b is off a's line
  return back > 3 && back < 20 && side < 2.6;
}
export const DRAFT_TIME = 1.3;              // seconds in the wake for a slingshot
export const DRAFT_BOOST = 0.8;

// Getting hit spills coins onto the road. Returns how many fell.
export function loseCoins(c, n) {
  const lost = Math.min(Math.max(0, c.coins || 0), n);
  c.coins = (c.coins || 0) - lost;
  return lost;
}
