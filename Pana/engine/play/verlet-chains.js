// Many chains of point masses, nothing rigid and nothing rotated: Verlet
// integration, distance constraints between neighbours, a push out of a baked
// distance field (distance-field.js) and separation through a spatial hash
// (spatial-hash.js). Everything lives in typed arrays made up front, and step()
// allocates nothing. Point i of chain c is index c * points + i; point 0 is the
// head, which the caller steers with nudge() while the body follows through the
// constraints. Renderer-free. A scatter() throws points apart and lets go of the
// links for a while; they pull back together when it ends.
//
//   const chains = new VerletChains({ chains: 100, points: 12, rest: .17, field, grid });
//   chains.place(0, x, z);
//   chains.nudge(0, vx * chains.h, vz * chains.h); chains.step();
import { SpatialHash } from './spatial-hash.js';

export class VerletChains {
  // grid: { cell, x0, z0, w, h } turns on separation, keeping points `gap` apart.
  constructor({ chains, points, rest, h = 1 / 30, radius = .06, field = null, grid = null, gap = 0, friction = .55, drag = .985, gravity = 14, iterations = 2, recover = .7, maxStretch = rest * 7, neighbours = 6 }) {
    const total = chains * points;
    Object.assign(this, { chains, points, total, rest, h, radius, field, gap, friction, drag, iterations, recover, maxStretch, neighbours, fall: gravity * h * h, carry: 0, maxMove: 7 * h });
    for (const key of ['x', 'y', 'z', 'ox', 'oy', 'oz']) this[key] = new Float32Array(total);
    this.alive = new Uint8Array(chains); this.loose = new Float32Array(chains); this.stiff = new Float32Array(chains).fill(1);
    this.hash = grid && gap > 0 ? new SpatialHash({ ...grid, capacity: total }) : null;
    this.found = new Int32Array(64);
  }
  // Lay a chain out from (x, z) trailing along (dx, dz), `spacing` between points.
  place(c, x, z, dx = 1, dz = 0, spacing = this.rest) {
    const start = c * this.points;
    for (let i = 0; i < this.points; i++) {
      const k = start + i;
      this.x[k] = this.ox[k] = x + dx * spacing * i; this.y[k] = this.oy[k] = 0; this.z[k] = this.oz[k] = z + dz * spacing * i;
    }
    this.alive[c] = 1; this.loose[c] = 0; this.stiff[c] = 1;
  }
  remove(c) { this.alive[c] = 0; }
  // Carry a head along without giving it speed of its own.
  nudge(c, dx, dz) { const k = c * this.points; this.x[k] += dx; this.ox[k] += dx; this.z[k] += dz; this.oz[k] += dz; }
  // Every chain with a point within `radius` lets go; its nearby points fly out
  // at `power` m/s and up at `lift`. A `spot` test can refuse a chain (a wall
  // between). Returns how many chains it scattered.
  scatter(x, z, radius, { power = 6, lift = 5, seconds = 1.1, spot = null } = {}) {
    const { points, h, x: xs, y: ys, z: zs, ox, oy, oz } = this, far = radius * 1.6;
    let hit = 0;
    for (let c = 0; c < this.chains; c++) {
      if (!this.alive[c]) continue;
      const start = c * points;
      let near = -1, close = radius * radius;
      for (let k = start; k < start + points; k++) { const dx = xs[k] - x, dz = zs[k] - z, d = dx * dx + dz * dz; if (d < close) { close = d; near = k; } }
      if (near < 0 || (spot && !spot(xs[near], zs[near]))) continue;
      hit++; this.loose[c] = seconds; this.stiff[c] = 0;
      for (let k = start; k < start + points; k++) {
        const dx = xs[k] - x, dz = zs[k] - z, d = Math.sqrt(dx * dx + dz * dz) || .01; if (d > far) continue;
        // Each point on its own heading and speed, from its index alone.
        const spin = Math.sin(k * 12.9898) * .9, cs = Math.cos(spin), sn = Math.sin(spin), each = power * (.6 + .4 * Math.abs(Math.sin(k * 78.233))) * (1 - d / far * .5);
        ox[k] = xs[k] - (dx * cs - dz * sn) / d * each * h; oz[k] = zs[k] - (dx * sn + dz * cs) / d * each * h;
        oy[k] = ys[k] - lift * (.5 + .5 * Math.abs(Math.sin(k * 37.719))) * h;
      }
    }
    return hit;
  }
  // Fixed steps for a span of real time (at most `most`); how many it ran.
  advance(dt, most = 4) {
    this.carry = Math.min(this.carry + dt, this.h * most);
    let n = 0;
    while (this.carry >= this.h) { this.carry -= this.h; this.step(); n++; }
    return n;
  }
  step() {
    this.integrate();
    if (this.hash) this.separate();
    for (let i = 0; i < this.iterations; i++) this.constrain();
    if (this.field) this.collide();
  }
  integrate() {
    const { x, y, z, ox, oy, oz, points, chains, alive, loose, stiff, friction, drag, fall, h, recover, maxMove } = this, most = maxMove * maxMove;
    for (let c = 0; c < chains; c++) {
      if (!alive[c]) continue;
      if (loose[c] > 0) { loose[c] -= h; stiff[c] = 0; } else if (stiff[c] < 1) { const s = stiff[c] + h / recover; stiff[c] = s > 1 ? 1 : s; }
      const end = (c + 1) * points;
      for (let k = c * points; k < end; k++) {
        const air = y[k] > 0 || y[k] !== oy[k], keep = air ? drag : friction;
        let vx = (x[k] - ox[k]) * keep, vz = (z[k] - oz[k]) * keep;
        const v = vx * vx + vz * vz; if (v > most) { const s = maxMove / Math.sqrt(v); vx *= s; vz *= s; }
        ox[k] = x[k]; oz[k] = z[k]; x[k] += vx; z[k] += vz;
        if (air) {
          const py = y[k]; let ny = py + (py - oy[k]) * drag - fall;
          if (ny <= 0) { ny = 0; oy[k] = 0; } else oy[k] = py;
          y[k] = ny;
        }
      }
    }
  }
  constrain() {
    const { x, y, z, ox, oy, oz, points, chains, alive, stiff, rest, maxStretch } = this;
    for (let c = 0; c < chains; c++) {
      const s = stiff[c]; if (!alive[c] || s <= 0) continue;
      const start = c * points;
      for (let i = 1; i < points; i++) {
        const a = start + i - 1, b = a + 1;
        let dx = x[b] - x[a], dy = y[b] - y[a], dz = z[b] - z[a], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Stacked points have no direction: a fixed one, varied by index.
        if (d < 1e-5) { dx = Math.cos(b) * 1e-3; dz = Math.sin(b) * 1e-3; dy = 0; d = 1e-3; }
        // A link caught on a corner past all reason: the tail catches up at once.
        if (d > maxStretch && s >= 1) {
          const u = rest / d; x[b] = ox[b] = x[a] + dx * u; y[b] = oy[b] = y[a]; z[b] = oz[b] = z[a] + dz * u;
          continue;
        }
        // The head leads: it gives nothing up, and each point mostly follows the one before.
        const wa = i === 1 ? 0 : .1, wb = 1 - wa, e = (d - rest) / d * s;
        x[a] += dx * e * wa; y[a] += dy * e * wa; z[a] += dz * e * wa;
        x[b] -= dx * e * wb; y[b] -= dy * e * wb; z[b] -= dz * e * wb;
        if (y[a] < 0) y[a] = 0;
        if (y[b] < 0) y[b] = 0;
      }
    }
  }
  collide() {
    const { x, z, field, points, chains, alive, radius } = this;
    for (let c = 0; c < chains; c++) {
      if (!alive[c]) continue;
      const end = (c + 1) * points;
      for (let k = c * points; k < end; k++) {
        const d = field.sample(x[k], z[k]);
        if (d < radius) { const push = radius - d; x[k] += field.gx * push; z[k] += field.gz * push; }
      }
    }
  }
  separate() {
    const { x, y, z, points, chains, alive, hash, found, gap, neighbours } = this, wide = gap * gap;
    hash.clear();
    for (let c = 0; c < chains; c++) {
      if (!alive[c]) continue;
      const end = (c + 1) * points;
      for (let k = c * points; k < end; k++) hash.insert(k, x[k], z[k]);
    }
    for (let c = 0; c < chains; c++) {
      if (!alive[c]) continue;
      const end = (c + 1) * points;
      for (let k = c * points; k < end; k++) {
        const n = hash.query(x[k], z[k], gap, found);
        let pushes = 0;
        for (let q = 0; q < n && pushes < neighbours; q++) {
          const m = found[q]; if (m <= k) continue;          // each pair once
          if (m < end && m - k < 3) continue;                // its own neighbours are the links' business
          const dy = y[m] - y[k]; if (dy > gap || dy < -gap) continue;
          let dx = x[m] - x[k], dz = z[m] - z[k], d = dx * dx + dz * dz;
          if (d >= wide) continue;
          if (d < 1e-8) { dx = Math.cos(m) * 1e-3; dz = Math.sin(m) * 1e-3; d = 1e-6; }
          d = Math.sqrt(d);
          const e = (gap - d) / d * .5;
          x[k] -= dx * e; z[k] -= dz * e; x[m] += dx * e; z[m] += dz * e;
          pushes++;
        }
      }
    }
  }
}
