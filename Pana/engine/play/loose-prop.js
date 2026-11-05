// A thing lying loose on destructible ground seen from the side (terrain-mask.js):
// a crate on a parachute, a tombstone, a dropped flag. It falls, rests, falls
// again when the ground under it is blown away, flies when a blast throws it,
// and sinks in the water. Pure, so rules, tests and a room's copy share it.
//
//   const p = dropProp({ x, y: mask.height, chute: 6, id: 1 });   // any fields of your own
//   const r = stepProp(p, dt, mask, { water: 4 });                // every tick
//   if (r.landed) sfx.land(); if (r.sunk) remove(p);
//   throwProp(p, blast.x, blast.y, 10);                           // a blast throws it
//   if (propTouches(p, body.x, body.y, 1.5)) collect(p);          // generous on purpose
import { groundBelow, solidAt } from './terrain-mask.js';

export const LOOSE_PROP = Object.freeze({
  gravity: 18,
  drag: .4,        // air slows a thrown prop this much a second
  height: .45,     // its middle stands this far over its base (propTouches measures from it)
});

// `chute`: the steady speed it comes down at under a parachute (0: it just falls).
export const dropProp = (fields = {}) => ({ x: 0, y: 0, vx: 0, vy: 0, grounded: false, chute: 0, ...fields });

// Off the ground, thrown away from (fromX, fromY) at `speed` and a little up. The parachute is gone.
export function throwProp(p, fromX, fromY, speed) {
  const dx = p.x - fromX, dy = p.y + LOOSE_PROP.height - fromY + 1, l = Math.hypot(dx, dy) || 1;
  p.vx = dx / l * speed; p.vy = dy / l * speed; p.grounded = false; p.chute = 0;
}

// Is the point (x, y) within `reach` of the prop's middle?
export const propTouches = (p, x, y, reach) => Math.hypot(p.x - x, p.y + LOOSE_PROP.height - y) < reach;

export function stepProp(p, dt, mask, { water = -Infinity, gravity = LOOSE_PROP.gravity, drag = LOOSE_PROP.drag } = {}) {
  const out = { landed: false, sunk: false }, cell = mask.cell;
  if (p.grounded) {
    // The ground under it may have been blown away.
    const floor = groundBelow(mask, p.x, p.y + cell, cell * 3);
    if (floor !== null) { p.y = floor; return out; }
    p.grounded = false; p.vx = p.vy = 0;
  }
  if (p.chute) p.vy = -p.chute; else p.vy -= gravity * dt;
  p.vx *= Math.exp(-dt * drag);
  const dx = p.vx * dt, dy = p.vy * dt, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cell * .5)));
  for (let i = 0; i < steps; i++) {
    let nx = p.x + dx / steps;
    const ny = p.y + dy / steps;
    if (nx < 0 || nx > mask.width) { p.vx = 0; nx = p.x; }
    if (!solidAt(mask, nx, ny)) { p.x = nx; p.y = ny; continue; }
    // A wall: lose the sideways speed and keep falling.
    if (!solidAt(mask, p.x, ny)) { p.vx = 0; p.y = ny; continue; }
    // A ceiling, or the ground.
    if (p.vy > 0) { p.vy = 0; break; }
    p.y = groundBelow(mask, p.x, p.y + cell * 2, cell * 4) ?? p.y;
    p.grounded = true; p.chute = 0; p.vx = p.vy = 0; out.landed = true;
    break;
  }
  if (p.y < water) out.sunk = true;
  return out;
}
