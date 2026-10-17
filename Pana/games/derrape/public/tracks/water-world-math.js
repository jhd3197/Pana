// Authored land/water queries shared by the four water circuits; renderer-free.
export const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const hill = (x, z, cx, cz, rx, rz, h) => h * Math.exp(-(((x - cx) / rx) ** 2) - ((z - cz) / rz) ** 2);

// A downstream distance and interpolated height, not an unrelated shader flow.
export function channelAt(points, x, z) {
  let best = { distance: Infinity, along: 0, height: 0 }, along = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (length * length || 1)));
    const distance = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    if (distance < best.distance) best = { distance, along: along + length * t, height: (a[2] || 0) * (1 - t) + (b[2] || 0) * t };
    along += length;
  }
  return best;
}

export function pondAt(pond, x, z) {
  const dx = (x - pond.x) / pond.rx, dz = (z - pond.z) / pond.rz;
  const angle = Math.atan2(dz, dx), rim = 1 + .045 * Math.sin(angle * 5 + pond.x);
  return Math.hypot(dx, dz) / rim;
}
