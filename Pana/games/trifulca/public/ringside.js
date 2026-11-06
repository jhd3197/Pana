// Where everyone who isn't fighting may stand: a band outside the ring. The ref
// and the crowd only ever move along it, around the ring and never across it,
// and they give way to a fighter by stepping further out, never in. Nothing here
// writes to a fighter. Pure; scene.js draws the result and the tests prove it.
import { BODY_GAP } from './fight-rules.js';

// How far past the ring's line the band starts. The tent's ropes are square, so
// its round crowd comes closest at the corners.
export const RING_MARGIN = { circle: .9, square: .15 };
const WALK_OUT = 4;

export const marginOf = (arena) => arena.shape === 'square' ? RING_MARGIN.square : RING_MARGIN.circle;
const fenceAt = (arena, ux, uz) => arena.shape === 'square'
  ? (arena.half + RING_MARGIN.square) / (Math.max(Math.abs(ux), Math.abs(uz)) || 1)
  : arena.r + RING_MARGIN.circle;

// The nearest radius on this heading that is past the fence and BODY_GAP clear
// of every body. Each pass can only move further out, so it never turns inward.
function clearRadius(arena, ux, uz, radius, bodies) {
  let r = Math.max(radius, fenceAt(arena, ux, uz));
  for (let pass = 0; pass <= bodies.length; pass++) {
    let moved = false;
    for (const b of bodies) {
      const along = b.x * ux + b.z * uz, off = Math.abs(b.x * uz - b.z * ux);
      if (off >= BODY_GAP) continue;
      const reach = Math.sqrt(BODY_GAP * BODY_GAP - off * off);
      if (Math.abs(r - along) < reach - 1e-9) { r = along + reach; moved = true; }
    }
    if (!moved) break;
  }
  return r;
}

const heading = (a) => ({ ux: Math.sin(a), uz: Math.cos(a) });

// A spot on the band: the same heading as `spot`, pushed out as far as it takes.
export function ringside(arena, spot, bodies = []) {
  const { ux, uz } = heading(Math.atan2(spot.x, spot.z));
  const r = clearRadius(arena, ux, uz, Math.hypot(spot.x, spot.z), bodies);
  return { x: ux * r, z: uz * r };
}

// One frame of walking toward `goal`. Along the band the heading turns by the
// short way round, so a goal across the ring is reached around it. Someone who
// starts inside (a fighter whose fight just ended) first walks straight out.
export function stepRingside(pos, goal, arena, bodies = [], dt = 1 / 60, { rate = 3, speed = 4.5 } = {}) {
  const r0 = Math.hypot(pos.x, pos.z), a0 = r0 > 1e-6 ? Math.atan2(pos.x, pos.z) : Math.atan2(goal.x, goal.z);
  const start = heading(a0), fence = fenceAt(arena, start.ux, start.uz);
  if (r0 < fence - 1e-6) {
    const r = Math.min(fence, r0 + WALK_OUT * dt);
    pos.x = start.ux * r; pos.z = start.uz * r;
    return pos;
  }
  const k = 1 - Math.exp(-dt * rate), a1 = Math.atan2(goal.x, goal.z);
  const diff = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
  const turn = Math.sign(diff) * Math.min(Math.abs(diff) * k, speed * dt / Math.max(r0, 1));
  const { ux, uz } = heading(a0 + turn), r1 = Math.hypot(goal.x, goal.z);
  const r = clearRadius(arena, ux, uz, r0 + (r1 - r0) * k, bodies);
  pos.x = ux * r; pos.z = uz * r;
  return pos;
}

