// Things thrown by hand across a 3D court: a grenade, a ball, a water balloon.
// Gravity pulls them into an arc; they bounce off the floor and box tops with
// `restitution` (vertical speed kept) and `friction` (sliding speed kept), bounce
// off box sides and the court's edge, then roll to a stop. Pure and
// renderer-free, so a server room, the aim preview and a bot's throw search all
// run the same flight. y is up; boxes are the court's cover `{ x, z, w, d, h }`
// (centre, full size, height), so a throw sails over a box lower than itself.
//
//   const g = { x, y: 1.45, z, ...lobVelocity(ax, az, elevation, speed) };
//   const hit = stepLob(g, dt, { boxes: cover, bounds: { x: 27, z: 27 }, restitution: .4 });
//   const path = traceLob(start, opts, { time: fuse, out });   // the preview arc, where it ends
//   const k = falloff(distance, radius);                        // 1 near the centre … min at the edge
import { segmentBox } from './projectile.js';

export const LOB = Object.freeze({ gravity: 9.81, radius: .12 });

// Velocity for a throw along the ground direction (ax, az), `elevation` radians above the horizon.
export function lobVelocity(ax, az, elevation, speed) {
  const l = Math.hypot(ax, az) || 1, c = Math.cos(elevation) * speed;
  return { vx: ax / l * c, vy: Math.sin(elevation) * speed, vz: az / l * c };
}

const top = o => o.h ?? o.height ?? Infinity;

// The floor under (x, z): `floor`, or the top of the highest box the point is over.
export function groundAt(x, z, boxes = [], floor = 0) {
  let y = floor;
  for (const o of boxes) { const h = top(o); if (h > y && h < Infinity && Math.abs(x - o.x) <= o.w / 2 && Math.abs(z - o.z) <= o.d / 2) y = h; }
  return y;
}

// One step of flight. Fast throws are cut into sub-steps no longer than
// `maxStep` metres, so nothing tunnels through a thin box. Returns the first
// contact this step ({ type: 'ground' | 'wall', speed }) or null. `g.bounces`
// counts real bounces; `g.resting` is set once it stops. `sticky` stops dead
// at the first touch (it still drops down a wall it hit).
export function stepLob(g, dt, options = {}) {
  if (g.resting) return null;
  const { maxStep = .2 } = options, n = Math.max(1, Math.ceil(Math.hypot(g.vx, g.vy, g.vz) * dt / maxStep));
  let event = null;
  for (let i = 0; i < n && !g.resting; i++) { const e = subStep(g, dt / n, options); if (e && !event) event = e; }
  g.t = (g.t || 0) + dt;
  return event;
}

function subStep(g, h, { gravity = LOB.gravity, boxes = [], bounds = null, radius = LOB.radius, restitution = .4, friction = .7, roll = 3, settle = 1.2, sticky = false, floor = 0 }) {
  let event = null;
  if (g.rolling) {
    const keep = Math.exp(-roll * h); g.vx *= keep; g.vz *= keep; g.vy = 0;
    if (Math.hypot(g.vx, g.vz) < .15) { g.vx = g.vz = 0; g.resting = true; return null; }
  } else g.vy -= gravity * h;
  let dx = g.vx * h, dz = g.vz * h, t = Infinity, wall = null;
  // Sides of boxes taller than the throw, then the court's edge.
  for (const o of boxes) {
    if (top(o) <= g.y - radius * .5) continue;
    if (Math.abs(g.x - o.x) < o.w / 2 + radius && Math.abs(g.z - o.z) < o.d / 2 + radius) continue;
    const hit = segmentBox(g.x, g.z, dx, dz, o, radius);
    if (hit !== null && hit < t) { t = hit; wall = o; }
  }
  if (t <= 1) {
    const cx = g.x + dx * t, cz = g.z + dz * t;
    const across = Math.abs(Math.abs(cx - wall.x) - (wall.w / 2 + radius)) < Math.abs(Math.abs(cz - wall.z) - (wall.d / 2 + radius));
    g.x = cx - Math.sign(dx) * 1e-4; g.z = cz - Math.sign(dz) * 1e-4;
    event = bounceWall(g, across ? 'x' : 'z', restitution, friction, sticky);
    dx = dz = 0;
  } else if (bounds) {
    if (Math.abs(g.x + dx) > bounds.x - radius) { g.x = Math.sign(g.x + dx) * (bounds.x - radius); event = bounceWall(g, 'x', restitution, friction, sticky); dx = 0; }
    if (Math.abs(g.z + dz) > bounds.z - radius) { g.z = Math.sign(g.z + dz) * (bounds.z - radius); event = bounceWall(g, 'z', restitution, friction, sticky) || event; dz = 0; }
  }
  g.x += dx; g.z += dz; g.y += g.vy * h;
  const ground = groundAt(g.x, g.z, boxes, floor);
  if (g.rolling && g.y - radius > ground + .02) g.rolling = false;   // rolled off a box top
  if (g.y - radius < ground) {
    const speed = -g.vy; g.y = ground + radius;
    if (sticky) { g.vx = g.vy = g.vz = 0; g.resting = true; return event || { type: 'ground', speed }; }
    if (speed > settle) { g.vy = speed * restitution; g.vx *= friction; g.vz *= friction; g.bounces = (g.bounces || 0) + 1; event ||= { type: 'ground', speed }; }
    else if (!g.rolling) { g.vy = 0; g.rolling = true; }
  }
  return event;
}

function bounceWall(g, axis, restitution, friction, sticky) {
  const v = axis === 'x' ? 'vx' : 'vz', other = axis === 'x' ? 'vz' : 'vx', speed = Math.abs(g[v]);
  if (sticky) { g.vx = g.vz = 0; return { type: 'wall', speed }; }
  g[v] = -g[v] * Math.max(restitution, .3); g[other] *= friction; g.bounces = (g.bounces || 0) + 1;
  return { type: 'wall', speed };
}

// The whole throw from `start` for `time` seconds in `dt` steps (the game's
// tick, so it matches the server exactly). Points go into `out` (objects reused
// across calls: no allocation per frame), one every `every` steps. Returns
// `{ count, x, y, z, landed, land: index of the first floor contact, peak }`;
// x/y/z is where it is when time runs out: where a fused grenade blows. With
// `land`, a throw still in its first flight then keeps going until it touches
// down (at most `extra` seconds more), as a fuse that waits for impact would.
export const touched = g => !!(g.bounces || g.rolling || g.resting);
export function traceLob(start, options = {}, { dt = .05, time = 2, every = 1, out = [], result = {}, land: wait = false, extra = 4 } = {}) {
  const g = traceLob.ball ||= {};
  Object.assign(g, { x: start.x, y: start.y, z: start.z, vx: start.vx, vy: start.vy, vz: start.vz, t: 0, bounces: 0, rolling: false, resting: false });
  let count = 0, land = -1, peak = g.y;
  const put = () => { const p = out[count] ||= { x: 0, y: 0, z: 0 }; p.x = g.x; p.y = g.y; p.z = g.z; count++; };
  put();
  const steps = Math.ceil(time / dt - 1e-6), most = steps + Math.ceil(extra / dt);
  for (let i = 1; i <= most && (i <= steps || wait && !touched(g)); i++) {
    const e = stepLob(g, dt, options); peak = Math.max(peak, g.y);
    const first = land < 0 && (e?.type === 'ground' || touched(g));
    if (first || i % every === 0 || i >= steps) put();
    if (first) land = count - 1;
  }
  return Object.assign(result, { count, x: g.x, y: g.y, z: g.z, landed: land >= 0, land, peak });
}

// How much of a blast reaches `distance`: 1 inside `inner`·radius, falling
// linearly to `min` at the edge, 0 beyond it.
export function falloff(distance, radius, { inner = .4, min = .35 } = {}) {
  if (!(distance <= radius)) return 0;
  const start = inner * radius; if (distance <= start) return 1;
  return 1 - (1 - min) * (distance - start) / (radius - start);
}

// A throw that carries `distance` metres: tries each elevation in `pitches` and
// bisects the 0..1 power. `reach(pitch, power)` measures the throw (it should grow
// with power). Returns { pitch, power, reach, exact } or null; `exact` is false
// when no pitch reaches it and the result is the closest found.
export function solveLob(reach, distance, { pitches = [0], tolerance = .4, iterations = 14 } = {}) {
  let best = null;
  const keep = (pitch, power, r, exact) => { if (!best || exact && !best.exact || !best.exact && Math.abs(r - distance) < Math.abs(best.reach - distance)) best = { pitch, power, reach: r, exact }; };
  for (const pitch of pitches) {
    const near = reach(pitch, 0), far = reach(pitch, 1);
    if (distance < near - tolerance || distance > far + tolerance) { keep(pitch, 0, near, false); keep(pitch, 1, far, false); continue; }
    let lo = 0, hi = 1, power = .5, r = reach(pitch, power);
    for (let i = 0; i < iterations && Math.abs(r - distance) > tolerance * .25; i++) {
      if (r < distance) lo = power; else hi = power;
      power = (lo + hi) / 2; r = reach(pitch, power);
    }
    keep(pitch, power, r, true); return best;
  }
  return best;
}
