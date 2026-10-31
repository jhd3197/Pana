// One walk step for every game where a pana moves on foot (Reliquia, Pepazo):
// the movement vector, sprint with stamina, speed, optional inertia, collision
// through the game's own `move`, and the shared jump. It writes only
// p.stamina, p.x/p.z (through move), the jump fields (see jump.js), p.y when
// `ground` is given, and `velocity.vx/vz` when `velocity` is given. What the
// game stores from the result ({ sprinting, moving, speed }) is its own call,
// so a game keeps its snapshot as it is.
import { clamp } from '../random.js';
import { stepJump } from './jump.js';

// The input as a vector: each axis clamped to -1..1, reversed when asked, and
// capped to length 1 so walking diagonally is no faster. `length` is the
// length before the cap.
export function walkVector(input, reversed = false) {
  let x = Number.isFinite(input?.x) ? clamp(input.x, -1, 1) : 0, z = Number.isFinite(input?.z) ? clamp(input.z, -1, 1) : 0;
  if (reversed) { x = 0 - x; z = 0 - z; }
  const length = Math.hypot(x, z);
  return length > 1 ? { x: x / length, z: z / length, length } : { x, z, length };
}

// A `move` for games that test one point at a time: slides along walls by
// trying each axis alone. `isBlocked(x, z)` is the game's own test.
export const axisMove = isBlocked => (p, dx, dz) => {
  const x = p.x + dx; if (!isBlocked(x, p.z)) p.x = x;
  const z = p.z + dz; if (!isBlocked(p.x, z)) p.z = z;
};

// Options (o):
//   walk, run      speeds (m/s) on foot and sprinting; `scale` multiplies either
//   move(p, dx, dz) moves p by that much, stopped by the game's walls
//   canSprint      a game rule on top of the input (default true)
//   minStamina     sprint needs more than this much stamina (default 0)
//   deadzone       sprint needs a vector longer than this (default 0)
//   drain, regen   seconds to empty / refill the stamina (default 3 and 4)
//   reversed       flip the input (a curse)
//   inertia        rate (1/s) the velocity follows the input; 0 is instant
//   velocity       the object holding vx/vz, so inertia carries between steps
//   jump           options for stepJump, or false to leave the jump alone
//   ground(p)      the floor height; p.y = ground + jumpHeight
export function stepWalker(p, input, dt, o) {
  const v = walkVector(input, o.reversed), sprinting = (o.canSprint ?? true) && !!input?.sprint && p.stamina > (o.minStamina || 0) && v.length > (o.deadzone || 0);
  p.stamina = clamp(p.stamina + (sprinting ? -dt / (o.drain || 3) : dt / (o.regen || 4)), 0, 1);
  const speed = (sprinting ? o.run : o.walk) * (o.scale ?? 1), tx = v.x * speed, tz = v.z * speed, held = o.velocity || {};
  if (o.inertia > 0) { const k = Math.min(1, dt * o.inertia); held.vx = (held.vx || 0) + (tx - (held.vx || 0)) * k; held.vz = (held.vz || 0) + (tz - (held.vz || 0)) * k; }
  else { held.vx = tx; held.vz = tz; }
  o.move(p, held.vx * dt, held.vz * dt);
  if (o.jump !== false) stepJump(p, input, dt, o.jump);
  if (o.ground) p.y = o.ground(p) + p.jumpHeight;
  return { sprinting, speed, moving: Math.hypot(held.vx, held.vz) > .4 };
}
