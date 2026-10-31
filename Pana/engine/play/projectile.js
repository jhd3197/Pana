// Projectiles that fly level across a court: a paintball, a sniper round, a
// slow rocket. Pure and renderer-free, so a server room and Node tests run the
// same flight. Every step is swept as a segment against cover boxes and round
// targets: at 85 m/s a ball moves 4 m per 50 ms tick, so testing only where it
// ends would let it pass through a crate or a pana.
//
//   const { vx, vz } = launch(p.ax, p.az, speed, angle);
//   const { t, victim } = sweep(ball, dt, { boxes: cover, targets, padding: .12 });
//   if (t <= 1) { ball.x += ball.vx * dt * t; ... }   // stopped by cover or a target
//
// Boxes are axis-aligned `{ x, z, w, d }` (centre and full size); targets are
// `{ x, z }` circles of `radius`.

// The fraction 0..1 of the segment (x, z) + t·(dx, dz) where it enters box o, or null.
export function segmentBox(x, z, dx, dz, o, padding = 0) {
  let near = 0, far = 1;
  for (const [p, d, lo, hi] of [[x, dx, o.x - o.w / 2 - padding, o.x + o.w / 2 + padding], [z, dz, o.z - o.d / 2 - padding, o.z + o.d / 2 + padding]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return null; }
    else { let a = (lo - p) / d, b = (hi - p) / d; if (a > b) [a, b] = [b, a]; near = Math.max(near, a); far = Math.min(far, b); if (near > far) return null; }
  }
  return near;
}

// The fraction 0..1 where the segment first touches a circle around p, 0 when it starts inside, or null.
export function segmentCircle(x, z, dx, dz, p, radius = .7) {
  const a = dx * dx + dz * dz, ox = x - p.x, oz = z - p.z, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - radius ** 2;
  if (c <= 0) return 0; const disc = b * b - 4 * a * c; if (!a || disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a); return t >= 0 && t <= 1 ? t : null;
}

// Velocity for a shot along the unit aim (ax, az), turned `angle` radians (spread).
export function launch(ax, az, speed, angle = 0) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { vx: (ax * c - az * s) * speed, vz: (az * c + ax * s) * speed };
}

// One step of flight: the earliest cover or target along this step's segment.
// `t` is that fraction (> 1 when nothing was touched) and `victim` the target hit
// first, or null when cover came first. The ball itself is not moved.
export function sweep(ball, dt, { boxes = [], targets = [], padding = 0, radius = .7 } = {}) {
  const dx = ball.vx * dt, dz = ball.vz * dt; let t = Infinity, victim = null;
  for (const o of boxes) { const hit = segmentBox(ball.x, ball.z, dx, dz, o, padding); if (hit !== null && hit < t) t = hit; }
  for (const p of targets) { const hit = segmentCircle(ball.x, ball.z, dx, dz, p, radius); if (hit !== null && hit < t) { t = hit; victim = p; } }
  return { t, victim, dx, dz };
}

// How far a straight shot from (x, z) along the unit (dx, dz) travels before cover or
// a target stops it, up to `range`: where a tracer line ends.
export function traceRay(x, z, dx, dz, range, { boxes = [], targets = [], padding = 0, radius = .7 } = {}) {
  const { t } = sweep({ x, z, vx: dx * range, vz: dz * range }, 1, { boxes, targets, padding, radius });
  return Math.min(1, t) * range;
}

// Seconds a projectile at `speed` needs to cover `distance`: how much a slow rocket must lead.
export const flightTime = (distance, speed) => speed > 0 ? distance / speed : Infinity;
