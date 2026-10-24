// Carreritas's driving skills as plain math: drift charge, start boost, ramp
// tricks, slipstream and coin loss. game.js applies them in stepCar;
// tests/drive-rules.test.js checks them. No Three.js, no DOM.

import { clamp } from '../../../engine/random.js';

// Consume elapsed time in fixed physics steps, including slow 4–12 FPS
// frames. A suspended tab still cannot request an unbounded catch-up burst.
export function physicsFrame(remainder, elapsed, speed = 1, scale = 1) {
  const accumulated = remainder + clamp(elapsed, 0, .25) * speed * scale;
  const steps = Math.floor(accumulated * 60 + 1e-9);
  return { steps, remainder: Math.max(0, accumulated - steps / 60) };
}

// Suspension and head motion must not explode when presentation covers
// several physics ticks. Substeps retain the existing 60 Hz spring response.
export class DrivingSpring {
  constructor() { this.x = 0; this.v = 0; }
  step(target, k, c, dt) {
    const steps = Math.max(1, Math.ceil(dt * 60)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.v += (k * (target - this.x) - c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}
export const DRIFT_MIN_SPEED = 12;          // m/s needed to start (and keep) a drift
export const DRIFT_LEVELS = [0.75, 2.1, 3.2]; // charge (s) for blue, orange, purple sparks
export const DRIFT_BOOST = [0, 0.45, 0.8, 1.2];   // turbo seconds per level on release
export const HOP_SPEED = 2.8;               // short entry hop: steering returns sooner
export const DRIFT_EXIT_TIME = 0.45;        // settle the car before the release turbo

// Charge level 0..3 for a drift charge in seconds.
export const driftLevel = (charge) => DRIFT_LEVELS.filter(t => charge >= t).length;

// Purple is a window, not a parking spot: hold it past OVERHEAT_TIME and the
// tyres burn — the whole charge is lost and the car scrubs speed. The sparks
// flicker red from OVERHEAT_WARN on, so a good driver lets go in time.
export const OVERHEAT_WARN = 0.7;           // purple seconds before the warning flicker
export const OVERHEAT_TIME = 1.4;           // purple seconds before the tyres burn
export const BURN_SCRUB = 0.8;              // share of speed kept after a burn
export const overheatWarn = (charge) => charge >= DRIFT_LEVELS[2] + OVERHEAT_WARN;
export const overheated = (charge) => charge >= DRIFT_LEVELS[2] + OVERHEAT_TIME;

// Hot tyres: every paid release heats them by HEAT_PER_LEVEL per charge
// level, they cool at HEAT_COOL per second, and while hot the next drift
// charges slower — chaining a turbo out of every bend stops paying.
export const HEAT_PER_LEVEL = 0.2;
export const HEAT_COOL = 0.25;
export const HEAT_MAX_SLOW = 0.55;          // hottest tyres charge at 45%
export const heatedCharge = (heat) => 1 - Math.min(HEAT_MAX_SLOW, Math.max(0, heat || 0));

// A small natural turn leaves room to adjust the line. Countersteering can
// actually straighten the car instead of forcing it deeper into the corner.
export function driftSteer(dir, steer) {
  const into = Math.max(-1, Math.min(1, steer * dir));   // +1 tightens, -1 widens
  return dir * (0.15 + into * 0.7);
}

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
// Holding the gas early always gets you going at "¡YA!"; the timing only
// grades it: late in "1" a full turbo, early in "1" a small one, from "2" a
// plain start, and from "3" a flooded engine that pulls weakly for a moment.
export const START_WINDOWS = { rocket: 1.6, good: 2, early: 2.85 };
export function startBoost(pressedAt) {
  if (pressedAt == null) return { boost: 0, stall: 0 };
  if (pressedAt <= START_WINDOWS.rocket) return { boost: 1.3, stall: 0 };
  if (pressedAt <= START_WINDOWS.good) return { boost: 0.6, stall: 0 };
  if (pressedAt > START_WINDOWS.early) return { boost: 0, stall: 0.6 };
  return { boost: 0, stall: 0 };
}
// How a held throttle reads during the countdown, for the HUD.
export const startCue = (count) => count > START_WINDOWS.early ? 'early' : count > START_WINDOWS.good ? 'ok' : 'good';
// A flooded engine still pulls, only weakly: the car moves, just slower.
export const STALL_THROTTLE = 0.35;

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
