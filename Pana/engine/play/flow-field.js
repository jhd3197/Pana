// "Which way to the nearest target?" for any number of walkers at the cost of
// one breadth-first search: mark the targets, compute, and each walker reads
// its own cell. Nobody plans a path, and no target lookup is per walker.
//
//   const flow = flowFromField(field, { cell: .5, margin: .25 });
//   flow.reset(); flow.add(player.x, player.z); flow.compute();
//   const steps = flow.toward(x, z);                  // -1: no way. flow.dx, flow.dz
//
// Moves are 8-way and never cut a blocked corner. Allocation-free after
// construction.
const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];

export class FlowField {
  constructor({ w, h, cell, x0 = 0, z0 = 0, free }) {
    Object.assign(this, { w, h, cell, x0, z0, dx: 0, dz: 0, sources: 0 });
    this.open = new Uint8Array(w * h); this.steps = new Int32Array(w * h).fill(-1); this.queue = new Int32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.open[j * w + i] = free(i, j) ? 1 : 0;
  }
  reset() { this.steps.fill(-1); this.sources = 0; }
  // The open cell at (x, z), or the closest one within `reach` cells; -1 if none.
  cellAt(x, z, reach = 0) {
    const { w, h, open } = this, i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    for (let r = 0; r <= reach; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < w && b < h && open[b * w + a]) return b * w + a;
    }
    return -1;
  }
  // A target. One standing against a wall counts from the nearest open cell.
  add(x, z, reach = 6) {
    const c = this.cellAt(x, z, reach); if (c < 0) return false;
    if (this.steps[c] !== 0) { this.steps[c] = 0; this.queue[this.sources++] = c; }
    return true;
  }
  compute() {
    const { w, h, open, steps, queue } = this;
    let tail = this.sources;
    for (let q = 0; q < tail; q++) {
      const c = queue[q], i = c % w, j = (c - i) / w, next = steps[c] + 1;
      for (let n = 0; n < 8; n++) {
        const a = i + DI[n], b = j + DJ[n];
        if (a < 0 || b < 0 || a >= w || b >= h) continue;
        const k = b * w + a;
        if (!open[k] || steps[k] >= 0) continue;
        if (n >= 4 && (!open[j * w + a] || !open[b * w + i])) continue;
        steps[k] = next; queue[tail++] = k;
      }
    }
  }
  // Steps left to the nearest target (0: there), with the unit way in dx, dz.
  toward(x, z) {
    const { w, h, open, steps, cell } = this, c = this.cellAt(x, z, 2);
    this.dx = this.dz = 0;
    if (c < 0 || steps[c] < 0) return -1;
    if (steps[c] === 0) return 0;
    const i = c % w, j = (c - i) / w;
    let best = -1, low = steps[c];
    for (let n = 0; n < 8; n++) {
      const a = i + DI[n], b = j + DJ[n];
      if (a < 0 || b < 0 || a >= w || b >= h) continue;
      const k = b * w + a;
      if (!open[k] || steps[k] < 0 || steps[k] >= low) continue;
      if (n >= 4 && (!open[j * w + a] || !open[b * w + i])) continue;
      low = steps[k]; best = k;
    }
    if (best < 0) return steps[c];
    const bi = best % w, bj = (best - bi) / w, gx = this.x0 + (bi + .5) * cell - x, gz = this.z0 + (bj + .5) * cell - z, len = Math.sqrt(gx * gx + gz * gz) || 1;
    this.dx = gx / len; this.dz = gz / len;
    return steps[c];
  }
}

// One over a baked distance field: open where the field clears `margin`.
export function flowFromField(field, { cell = .5, margin = .25 } = {}) {
  const w = Math.max(1, Math.ceil(field.w * field.cell / cell)), h = Math.max(1, Math.ceil(field.h * field.cell / cell));
  return new FlowField({ w, h, cell, x0: field.x0, z0: field.z0, free: (i, j) => field.at(field.x0 + (i + .5) * cell, field.z0 + (j + .5) * cell) >= margin });
}
