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

const SLIP_SCAN = .1;

// A `move` for games that test one point at a time: slides along walls by
// trying each axis alone. `isBlocked(x, z)` is the game's own test.
export const axisMove = isBlocked => (p, dx, dz) => {
  const x = p.x + dx; if (!isBlocked(x, p.z)) p.x = x;
  const z = p.z + dz; if (!isBlocked(p.x, z)) p.z = z;
};

// A `move` for a body with a size. `free(x, z)` says the whole body fits there.
// Each axis runs up to contact, so a body stops against a wall instead of one
// step short of it. Axis tests alone stall a round body on a corner it only
// grazes: the step straight ahead is blocked and nothing pushes it aside. With
// `slip` (the body's radius is the honest value) a blocked step looks up to that
// far sideways for a way past and spends the blocked motion getting there, so
// no step travels further than asked. Returns whether the body moved.
export function slideMove(p, dx, dz, free, { slip = 0, step = .2 } = {}) {
  const length = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(length / step)), sx = dx / n, sz = dz / n, stride = length / n;
  const fits = (axis, d) => axis === 'x' ? free(p.x + d, p.z) : free(p.x, p.z + d);
  const advance = (axis, d) => {
    if (!d) return true;
    if (fits(axis, d)) { p[axis] += d; return true; }
    let lo = 0, hi = d;
    for (let k = 0; k < 3; k++) { const mid = (lo + hi) / 2; if (fits(axis, mid)) lo = mid; else hi = mid; }
    p[axis] += lo;
    return false;
  };
  // Blocked along `axis`: is there room a little to the side? The side the step
  // already leans to, or either one for a step that is nearly head-on.
  const round = (axis, d, along, x0, z0) => {
    const other = axis === 'x' ? 'z' : 'x', sides = Math.abs(along) > Math.abs(d) * .25 ? [Math.sign(along)] : [1, -1], open = [true, true];
    for (let k = 1; k * SLIP_SCAN <= slip + 1e-9; k++) for (let i = 0; i < sides.length; i++) {
      if (!open[i]) continue;
      const off = sides[i] * k * SLIP_SCAN, x = other === 'x' ? p.x + off : p.x, z = other === 'z' ? p.z + off : p.z;
      if (!free(x, z)) { open[i] = false; continue; }
      if (!free(axis === 'x' ? x + d : x, axis === 'z' ? z + d : z)) continue;
      const nudge = sides[i] * Math.min(k * SLIP_SCAN, Math.abs(d), Math.max(0, stride - Math.hypot(p.x - x0, p.z - z0)));
      if (nudge && fits(other, nudge)) { p[other] += nudge; return true; }
      return false;
    }
    return false;
  };
  let moved = false;
  for (let i = 0; i < n; i++) {
    const x0 = p.x, z0 = p.z, clearX = advance('x', sx), clearZ = advance('z', sz);
    if (slip > 0 && !clearZ) round('z', sz, sx, x0, z0);
    if (slip > 0 && !clearX) round('x', sx, sz, x0, z0);
    if (p.x !== x0 || p.z !== z0) moved = true;
  }
  return moved;
}

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
