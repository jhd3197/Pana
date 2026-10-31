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
    if (r.hit) return { points, x: ball.x, y: ball.y, t: ball.t, hit: r.hit, victim: r.victim };
  }
  return { points, x: ball.x, y: ball.y, t: ball.t, hit: null, victim: null };
}
