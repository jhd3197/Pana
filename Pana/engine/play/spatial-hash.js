// A uniform grid of ids for "who is near here?" among thousands of moving
// points, without comparing every pair. Rebuild it each step: clear, insert,
// then query. Nothing allocates after construction.
//
//   const hash = new SpatialHash({ cell: .4, x0, z0, w, h, capacity: points });
//   hash.clear(); hash.insert(id, x, z);
//   const n = hash.query(x, z, radius, buffer);       // candidates in buffer[0…n)
//
// A query only walks the cells its radius touches. It returns candidates, not
// matches: check the real distance yourself. Past the grid's edge a point lands
// in the nearest border cell. Ids go from 0 to capacity - 1.
export class SpatialHash {
  constructor({ cell, x0 = 0, z0 = 0, w, h, capacity }) {
    Object.assign(this, { cell, x0, z0, w, h, count: 0 });
    this.head = new Int32Array(w * h).fill(-1); this.next = new Int32Array(capacity);
  }
  clear() { this.head.fill(-1); this.count = 0; }
  column(x) { const i = Math.floor((x - this.x0) / this.cell); return i < 0 ? 0 : i >= this.w ? this.w - 1 : i; }
  row(z) { const j = Math.floor((z - this.z0) / this.cell); return j < 0 ? 0 : j >= this.h ? this.h - 1 : j; }
  insert(id, x, z) { const c = this.row(z) * this.w + this.column(x); this.next[id] = this.head[c]; this.head[c] = id; this.count++; }
  // How many ids it wrote to out (never more than max).
  query(x, z, radius, out, max = out.length) {
    const i0 = this.column(x - radius), i1 = this.column(x + radius), j0 = this.row(z - radius), j1 = this.row(z + radius), { head, next, w } = this;
    let n = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (let id = head[j * w + i]; id >= 0; id = next[id]) {
      if (n >= max) return n;
      out[n++] = id;
    }
    return n;
  }
}
