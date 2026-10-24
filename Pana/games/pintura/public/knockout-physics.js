// Verlet distance constraints adapted from Cla-Go (MIT), see docs/licenses/.
// Cosmetic only: this simulation never moves authoritative player positions.
const STEP = 1 / 120;
export class KnockoutPhysics {
  constructor(points, pairs, impulse = { x: 0, z: 1 }, hit = 2, cover = []) {
    this.points = points.map(p => ({ ...p }));
    this.previous = points.map((p, i) => ({ ...p,
      x: p.x - impulse.x * STEP * (i === hit ? 2.6 : 1.1),
      z: p.z - impulse.z * STEP * (i === hit ? 2.6 : 1.1) }));
    this.links = pairs.map(([a, b]) => [a, b, Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y, points[a].z - points[b].z)]);
    this.cover = cover; this.accumulator = 0; this.age = 0;
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.age >= 3) return;
    this.accumulator += Math.min(dt, .1);
    while (this.accumulator + 1e-10 >= STEP) {
      this.accumulator -= STEP; this.age += STEP;
      this.points.forEach((p, i) => {
        const q = this.previous[i], x = p.x, y = p.y, z = p.z;
        p.x += (p.x - q.x) * .994; p.y += (p.y - q.y) * .994 - 12 * STEP * STEP; p.z += (p.z - q.z) * .994;
        Object.assign(q, { x, y, z });
      });
      for (let iteration = 0; iteration < 8; iteration++) {
        for (const [a, b, length] of this.links) {
          const p = this.points[a], q = this.points[b], dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
          const d = Math.hypot(dx, dy, dz) || 1e-8, k = (d - length) / d * .5;
          p.x += dx * k; p.y += dy * k; p.z += dz * k;
          q.x -= dx * k; q.y -= dy * k; q.z -= dz * k;
        }
        this.points.forEach((p, i) => this.collide(p, this.previous[i]));
      }
    }
  }
  collide(p, previous) {
    const radius = p.radius || .12;
    if (p.y < radius) { p.y = radius; previous.x += (p.x - previous.x) * .3; previous.z += (p.z - previous.z) * .3; }
    for (const box of this.cover) {
      const x = box.w / 2 + radius, z = box.d / 2 + radius, top = (box.h ?? box.height) + radius;
      if (p.y > top || Math.abs(p.x - box.x) >= x || Math.abs(p.z - box.z) >= z) continue;
      const exits = [[top - p.y, 'y', top], [x - Math.abs(p.x - box.x), 'x', box.x + (Math.sign(p.x - box.x) || 1) * x], [z - Math.abs(p.z - box.z), 'z', box.z + (Math.sign(p.z - box.z) || 1) * z]];
      exits.sort((a, b) => a[0] - b[0]); p[exits[0][1]] = exits[0][2]; previous[exits[0][1]] = p[exits[0][1]];
    }
  }
}
