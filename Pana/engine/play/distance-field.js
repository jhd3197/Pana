// A signed 2D distance field baked once from a solid/free grid: positive in the
// open, negative inside a wall, zero on the boundary, in world units. Sampling
// is bilinear and allocation-free, so thousands of points can ask every step.
//
//   const field = bakeDistanceField({ w, h, cell: .25, x0, z0, solid: (i, j) => mask[j * w + i] });
//   const d = field.sample(x, z);                     // field.gx, field.gz: the way out
//   if (d < radius) { x += field.gx * (radius - d); z += field.gz * (radius - d); }
//
// Cell (i, j) is centred on (x0 + (i + .5) * cell, z0 + (j + .5) * cell). The
// exact Euclidean transform (Felzenszwalb) is linear in the cell count.
const FAR = 1e12;

// One row or column of squared distances, in place.
function transform(a, start, stride, n, out, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    const fq = a[start + q * stride] + q * q;
    let s = 0;
    for (;;) {
      const p = v[k];
      s = (fq - (a[start + p * stride] + p * p)) / (2 * (q - p));
      if (s > z[k]) break;
      k--;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; out[q] = (q - p) * (q - p) + a[start + p * stride]; }
  for (let q = 0; q < n; q++) a[start + q * stride] = out[q];
}
function squaredDistances(mask, w, h, target) {
  const a = new Float64Array(w * h), n = Math.max(w, h);
  for (let k = 0; k < a.length; k++) a[k] = mask[k] === target ? 0 : FAR;
  const out = new Float64Array(n), v = new Int32Array(n + 1), z = new Float64Array(n + 2);
  for (let i = 0; i < w; i++) transform(a, i, w, h, out, v, z);
  for (let j = 0; j < h; j++) transform(a, j * w, 1, w, out, v, z);
  return a;
}

export class DistanceField {
  constructor(w, h, cell, x0, z0, data) { Object.assign(this, { w, h, cell, x0, z0, data, gx: 0, gz: 0 }); }
  // The distance alone: the cheap question.
  at(x, z) {
    const { w, h, data } = this;
    let u = (x - this.x0) / this.cell - .5, v = (z - this.z0) / this.cell - .5;
    u = u < 0 ? 0 : u > w - 1 ? w - 1 : u; v = v < 0 ? 0 : v > h - 1 ? h - 1 : v;
    const i = u >= w - 1 ? w - 2 : u | 0, j = v >= h - 1 ? h - 2 : v | 0, s = u - i, t = v - j, k = j * w + i;
    return (data[k] * (1 - s) + data[k + 1] * s) * (1 - t) + (data[k + w] * (1 - s) + data[k + w + 1] * s) * t;
  }
  // The distance and, in gx / gz, the unit direction it grows fastest. Past the
  // grid's edge the distance keeps falling and the direction points back in.
  sample(x, z) {
    const { w, h, data, cell } = this, ru = (x - this.x0) / cell - .5, rv = (z - this.z0) / cell - .5;
    const u = ru < 0 ? 0 : ru > w - 1 ? w - 1 : ru, v = rv < 0 ? 0 : rv > h - 1 ? h - 1 : rv;
    const i = u >= w - 1 ? w - 2 : u | 0, j = v >= h - 1 ? h - 2 : v | 0, s = u - i, t = v - j, k = j * w + i;
    const a = data[k], b = data[k + 1], c = data[k + w], d = data[k + w + 1];
    let gx = (b - a) * (1 - t) + (d - c) * t, gz = (c - a) * (1 - s) + (d - b) * s, out = 0;
    if (ru !== u || rv !== v) { const ox = u - ru, oz = v - rv; out = Math.sqrt(ox * ox + oz * oz) * cell; gx = ox; gz = oz; }
    const len = Math.sqrt(gx * gx + gz * gz);
    if (len > 1e-9) { this.gx = gx / len; this.gz = gz / len; } else { this.gx = 1; this.gz = 0; }
    return (a * (1 - s) + b * s) * (1 - t) + (c * (1 - s) + d * s) * t - out;
  }
  // Nothing solid (closer than margin) on the straight line a→b: sphere tracing.
  clear(ax, az, bx, bz, margin = 0) {
    const dx = bx - ax, dz = bz - az, len = Math.sqrt(dx * dx + dz * dz), min = this.cell * .5;
    for (let t = 0; t < len;) {
      const f = t / len, d = this.at(ax + dx * f, az + dz * f) - margin;
      if (d < 0) return false;
      t += d > min ? d : min;
    }
    return this.at(bx, bz) >= margin;
  }
}

export function bakeDistanceField({ w, h, cell = 1, x0 = 0, z0 = 0, solid }) {
  if (w < 2 || h < 2) throw new Error('A distance field needs at least 2 x 2 cells');
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) mask[j * w + i] = solid(i, j) ? 1 : 0;
  const toSolid = squaredDistances(mask, w, h, 1), toFree = squaredDistances(mask, w, h, 0);
  const data = new Float32Array(w * h), most = w + h;
  // A cell's boundary is half a cell from its centre.
  for (let k = 0; k < data.length; k++) data[k] = (mask[k] ? -(Math.min(most, Math.sqrt(toFree[k])) - .5) : Math.min(most, Math.sqrt(toSolid[k])) - .5) * cell;
  return new DistanceField(w, h, cell, x0, z0, data);
}
