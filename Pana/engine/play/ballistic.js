// Lobbed shots seen from the side: gravity pulls down, wind pushes sideways,
// and every step is swept against the ground and round targets so a fast shell
// never tunnels through a thin ridge. Pure, so the bot can search shots with
// the same flight the game plays. x is across, y is up (engine/play/projectile.js
// is the level flight on a court; this is its arc).
//
//   const ball = { x, y, ...aimVelocity(angle, facing, power * 32) };
//   const r = stepFlight(ball, dt, { wind, solid: (x, y) => solidAt(mask, x, y), targets });
//   if (r.hit) explode(ball.x, ball.y);                     // 'ground' | 'target' | 'water' | 'out'
//   const { points, x, y } = simulateFlight(start, opts);   // aim preview, bots
import { segmentCircle } from './projectile.js';

export const FLIGHT = Object.freeze({ gravity: 18, windForce: 7 });
const UP_NORMAL = Object.freeze({ x: 0, y: 1 }), UP = () => UP_NORMAL;

// Velocity for an aim `angle` (radians above the horizon) towards `facing` (±1).
export function aimVelocity(angle, facing, speed) {
  return { vx: Math.cos(angle) * facing * speed, vy: Math.sin(angle) * speed };
}

// One step: velocity first (semi-implicit), then the segment is swept against
// targets (`{ x, y, radius }`) and the ground (`solid(x, y)`, marched in
// `step`-long pieces). The ball moves to where it stopped. `bounds` ends a shot
// that falls below `water` or leaves [left, right].
export function stepFlight(ball, dt, { gravity = FLIGHT.gravity, wind = 0, windForce = FLIGHT.windForce, solid = () => false, targets = [], radius = .7, step = .05, bounds = null } = {}) {
  ball.vx += wind * windForce * dt; ball.vy -= gravity * dt;
  const dx = ball.vx * dt, dy = ball.vy * dt;
  let t = Infinity, victim = null;
  for (const p of targets) {
    const hit = segmentCircle(ball.x, ball.y, dx, dy, { x: p.x, z: p.y }, p.radius ?? radius);
    if (hit !== null && hit < t) { t = hit; victim = p; }
  }
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
  for (let i = 1; i <= n; i++) {
    const k = i / n; if (k >= t) break;
    if (solid(ball.x + dx * k, ball.y + dy * k)) { t = (i - .5) / n; victim = null; break; }
  }
  ball.t = (ball.t || 0) + dt;
  if (t <= 1) { ball.x += dx * t; ball.y += dy * t; return { hit: victim ? 'target' : 'ground', victim }; }
  ball.x += dx; ball.y += dy;
  if (bounds) {
    if (ball.y < bounds.water) return { hit: 'water', victim: null };
    if (ball.x < bounds.left || ball.x > bounds.right) return { hit: 'out', victim: null };
  }
  return { hit: null, victim: null };
}

// The whole flight from `start` ({ x, y, vx, vy }), sampled every `every` steps:
// the points of the arc and where (and how) it ended. `hit` is null when it
// was still flying at `maxTime`.
export function simulateFlight(start, options = {}, { dt = 1 / 60, maxTime = 8, every = 3 } = {}) {
  const ball = { x: start.x, y: start.y, vx: start.vx, vy: start.vy, t: 0 }, points = [{ x: ball.x, y: ball.y }];
  for (let i = 1; ball.t < maxTime; i++) {
    const r = stepFlight(ball, dt, options);
    if (r.hit || i % every === 0) points.push({ x: ball.x, y: ball.y });
    if (r.hit) return { points, x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, t: ball.t, hit: r.hit, victim: r.victim };
  }
  return { points, x: ball.x, y: ball.y, t: ball.t, hit: null, victim: null };
}

// A thrown thing that bounces off the side-view ground instead of bursting on
// it (a grenade on a fuse): the same step, but on contact it backs up to the
// last free point and reflects off `normal(x, y)` (the ground's outward unit
// normal, e.g. terrain-mask.js `surfaceNormal`), keeping `restitution` of the
// speed into the ground and `friction` of the speed along it. A round target
// (a capi) is bounced off the same way. Slower than `settle` after a bounce
// it comes to rest (`ball.resting`) and stays until the ground under it goes,
// then falls again. Returns { hit: null | 'bounce' | 'water' | 'out', victim }.
export function stepBounce(ball, dt, options = {}) {
  const { normal = UP, restitution = .45, friction = .7, settle = 1.6, maxBounces = 24 } = options;
  const solid = options.solid || (() => false);
  if (ball.resting) {
    ball.t = (ball.t || 0) + dt;
    if (solid(ball.x, ball.y - .12)) return { hit: null, victim: null };
    ball.resting = false;
  }
  const px = ball.x, py = ball.y;
  const r = stepFlight(ball, dt, options);
  if (r.hit !== 'ground' && r.hit !== 'target') return r;
  // Back off to free air: halfway first, else where the step began.
  if (solid(ball.x, ball.y)) { const mx = (px + ball.x) / 2, my = (py + ball.y) / 2; if (!solid(mx, my)) { ball.x = mx; ball.y = my; } else { ball.x = px; ball.y = py; } }
  let n;
  if (r.victim) { const dx = ball.x - r.victim.x, dy = ball.y - r.victim.y, l = Math.hypot(dx, dy) || 1; n = { x: dx / l, y: dy / l }; }
  else n = normal(ball.x, ball.y);
  const into = ball.vx * n.x + ball.vy * n.y;
  if (into < 0) {
    const tx = ball.vx - into * n.x, ty = ball.vy - into * n.y;
    ball.vx = tx * friction - into * restitution * n.x; ball.vy = ty * friction - into * restitution * n.y;
  }
  ball.x += n.x * .02; ball.y += n.y * .02;
  ball.bounces = (ball.bounces || 0) + 1;
  // Wedged in a crevice it would jitter for ever: after `maxBounces` it stops where it is.
  if ((Math.hypot(ball.vx, ball.vy) < settle && n.y > .35) || ball.bounces >= maxBounces) { ball.vx = ball.vy = 0; ball.resting = true; }
  return { hit: 'bounce', victim: r.victim };
}

// A bouncing throw from `start` for `fuse` seconds: the points of its path
// and where it is when the fuse ends (or how it ended early: 'water', 'out').
export function simulateBounce(start, options = {}, { dt = 1 / 60, fuse = 3, every = 3 } = {}) {
  const ball = { x: start.x, y: start.y, vx: start.vx, vy: start.vy, t: 0 }, points = [{ x: ball.x, y: ball.y }];
  let bounces = 0;
  for (let i = 1; ball.t < fuse - 1e-9; i++) {
    const r = stepBounce(ball, dt, options);
    if (r.hit === 'bounce') bounces++;
    if (r.hit || i % every === 0) points.push({ x: ball.x, y: ball.y });
    if (r.hit === 'water' || r.hit === 'out') return { points, x: ball.x, y: ball.y, t: ball.t, hit: r.hit, bounces };
    // At rest on ground that does not change while it waits: that is where it bursts.
    if (ball.resting) { points.push({ x: ball.x, y: ball.y }); return { points, x: ball.x, y: ball.y, t: fuse, hit: 'fuse', bounces, rested: true }; }
  }
  return { points, x: ball.x, y: ball.y, t: ball.t, hit: 'fuse', bounces };
}
