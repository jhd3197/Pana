// Derrape's driving skills as plain math: drift charge, start boost, ramp
// tricks, slipstream and coin loss. game.js applies them in stepCar;
// tests/drive-rules.test.js checks them. No Three.js, no DOM.

export const DRIFT_MIN_SPEED = 12;          // m/s needed to start (and keep) a drift
export const DRIFT_LEVELS = [0.75, 1.6, 2.5]; // charge (s) for blue, orange, purple sparks
export const DRIFT_BOOST = [0, 0.55, 0.95, 1.45];   // turbo seconds per level on release
export const HOP_SPEED = 4.2;               // upward speed of the drift hop

// Charge level 0..3 for a drift charge in seconds.
export const driftLevel = (charge) => DRIFT_LEVELS.filter(t => charge >= t).length;

// While drifting the car always turns into the drift (dir ±1). The stick
// only widens (counter-steer) or tightens it: 0.45..1.3 of a normal turn.
export function driftSteer(dir, steer) {
  const into = Math.max(-1, Math.min(1, steer * dir));   // +1 tightens, -1 widens
  return dir * (0.875 + into * 0.425);
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
