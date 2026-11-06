// Building and checking side-view ground (terrain-mask.js) from a seed. Pure
// (no DOM, no Three.js), so a game's rules, its bot, Node tests and a future
// server all build the same cells from the same seed.
//
//   const r = seededStream(`capis:${seed}:${attempt}`);        // one stream per attempt: a re-roll replays too
//   const h = bumps(d, hills);                                  // smooth hills and valleys along x
//   const { removed, floating } = dropFloating(mask, 1500);      // no stray specks in the air
//   const spans = walkSpans(mask, { water: 4.2 });               // which columns a walker can reach from which
//   skyExposure(mask, x, y);                                     // 0..1 of the sky open above a point
//
// The game owns the design (what a river, a mesa or a cave is); this file owns
// the generic pieces: seeded streams, envelopes, clean-up and the checks.
import { rng, seedOf, smoothstep } from '../random.js';

// A deterministic stream from any text key (seed, size, attempt…).
export const seededStream = key => rng(seedOf(String(key)));

// Smooth bumps along a line: [{ at, height, width }] gaussian hills (or
// valleys, with a negative height) summed at `d`. A bump's steepest slope is
// about 0.86 × height / width, so width ≥ 1.4 × |height| keeps it walkable at 52°.
export function bumps(d, list) {
  let h = 0;
  for (const b of list) h += b.height * Math.exp(-(((d - b.at) / b.width) ** 2));
  return h;
}

// 0 inside `from`, 1 past `to`, smooth between (either order).
export const ramp = (d, from, to) => smoothstep((d - from) / (to - from));

// Solid cells not joined to the bottom row (4-connected) float in the air.
// Removes every floating piece of at most `maxCells` and returns how many cells
// went and the sizes of the floating pieces that were too big to drop (the
// caller decides whether that is a bad map).
export function dropFloating(mask, maxCells = 1500) {
  const { cols, rows, solid } = mask, n = cols * rows, seen = new Uint8Array(n), queue = new Int32Array(n);
  let head = 0, tail = 0;
  for (let c = 0; c < cols; c++) if (solid[c]) { seen[c] = 1; queue[tail++] = c; }
  const spread = () => {
    while (head < tail) {
      const i = queue[head++], c = i % cols;
      if (c > 0 && solid[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; queue[tail++] = i - 1; }
      if (c < cols - 1 && solid[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; queue[tail++] = i + 1; }
      if (i >= cols && solid[i - cols] && !seen[i - cols]) { seen[i - cols] = 1; queue[tail++] = i - cols; }
      if (i + cols < n && solid[i + cols] && !seen[i + cols]) { seen[i + cols] = 1; queue[tail++] = i + cols; }
    }
  };
  spread();
  let removed = 0; const floating = [];
  for (let i = 0; i < n; i++) {
    if (!solid[i] || seen[i]) continue;
    const start = tail; seen[i] = 1; queue[tail++] = i; spread();
    const size = tail - start;
    if (size <= maxCells) { for (let k = start; k < tail; k++) solid[queue[k]] = 0; removed += size; }
    else floating.push(size);
  }
  if (removed) { mask.dirty = { c0: 0, r0: 0, c1: cols - 1, r1: rows - 1 }; mask.revision++; }
  return { removed, floating };
}

// The top of the ground in each sample column (every `step` world units), or
// -Infinity where a column is empty.
export function topLine(mask, step = .2) {
  const count = Math.floor(mask.width / step), out = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const c = Math.min(mask.cols - 1, Math.floor((k + .5) * step / mask.cell));
    let top = -Infinity;
    for (let r = mask.rows - 1; r >= 0; r--) if (mask.solid[r * mask.cols + c]) { top = (r + 1) * mask.cell; break; }
    out[k] = top;
  }
  return out;
}

// Stretches of the top surface a walker can cover on foot: neighbouring
// samples join when the slope between them is walkable (`maxSlope`, rise over
// run) or a run of steeper steps climbs no more than `jump` in all (a hop),
// and both stand above `water`. Returns { step, top, span } where span[k] is
// the stretch id of sample k (-1 in the water) and `spans` lists each
// stretch's { from, to } in world x.
export function walkSpans(mask, { step = .2, maxSlope = Math.tan(50 * Math.PI / 180), jump = 1, water = -Infinity, dry = .3 } = {}) {
  const top = topLine(mask, step), span = new Int32Array(top.length).fill(-1), spans = [];
  let id = -1, climb = 0;
  for (let k = 0; k < top.length; k++) {
    if (!(top[k] > water + dry)) { climb = 0; continue; }
    const prev = k > 0 && span[k - 1] >= 0 ? top[k - 1] : null;
    let joined = false;
    if (prev !== null) {
      const rise = Math.abs(top[k] - prev);
      if (rise <= maxSlope * step) { joined = true; climb = 0; }
      else { climb += rise; joined = climb <= jump; }
    }
    if (!joined) { id = spans.length; spans.push({ from: k * step, to: (k + 1) * step }); climb = 0; }
    span[k] = id; spans[id].to = (k + 1) * step;
  }
  const at = x => { const k = Math.floor(x / step); return k >= 0 && k < span.length ? span[k] : -1; };
  return { step, top, span, spans, at };
}

// How far a walker gets from x heading `dir` (±1) along the top surface:
// down any drop that lands on dry ground, up walkable slopes and hops of at
// most `jump`. Returns the x where it stops (a wall, the water, the map's end).
export function walkTo(mask, x, dir, { step = .2, maxSlope = Math.tan(50 * Math.PI / 180), jump = 1, water = -Infinity, dry = .3, top = topLine(mask, step) } = {}) {
  let k = Math.floor(x / step), climb = 0;
  while (k + dir >= 0 && k + dir < top.length) {
    const next = top[k + dir];
    if (!(next > water + dry)) break;
    const rise = next - top[k];
    if (rise > maxSlope * step) { climb += rise; if (climb > jump) break; } else climb = 0;
    k += dir;
  }
  return (k + .5) * step;
}

// How much of the sky is open above (x, y): the share of `rays` rays fanned
// from 10° to 170° that travel `length` without touching ground.
export function skyExposure(mask, x, y, { rays = 13, length = 20, step = .25 } = {}) {
  let open = 0;
  for (let k = 0; k < rays; k++) {
    const a = (10 + 160 * k / (rays - 1)) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
    let clear = true;
    for (let t = step; t <= length && clear; t += step) {
      const px = x + dx * t, py = y + dy * t;
      if (py >= mask.height) break;
      const c = Math.floor(px / mask.cell), r = Math.floor(py / mask.cell);
      if (c >= 0 && c < mask.cols && r >= 0 && mask.solid[r * mask.cols + c]) clear = false;
    }
    if (clear) open++;
  }
  return open / rays;
}

// Air straight above (x, y) for `height` world units (room to stand and jump).
export function headroom(mask, x, y, height = 2.4) {
  const c = Math.floor(x / mask.cell);
  if (c < 0 || c >= mask.cols) return false;
  for (let r = Math.floor((y + .05) / mask.cell); r <= Math.floor((y + height) / mask.cell) && r < mask.rows; r++) if (r >= 0 && mask.solid[r * mask.cols + c]) return false;
  return true;
}

// Where a walker can stand and where it can get, caves, tunnels, ledges and
// bridges included (walkSpans only sees the top surface). The ground is sampled
// every `step` along x; a floor is the top of solid ground with `clearance` of
// air over it, above `water + dry`. From a floor a walker can:
//   walk  to the next column, up at most `maxSlope × step` (or a `stepUp`
//         bump), or off a ledge, falling to the first ground below;
//   hop   with a jump (`hop`: take-off speed up and forward, `gravity`),
//         landing on the first ground its arc meets within `leap`.
// Never into the water. Edges are found as they are visited, so a search
// only pays for the floors it reaches.
//
//   const g = floorGraph(mask, { water: 4.2 });
//   const seen = g.reach(g.near(x, y));            // Uint8Array over g.y
//   seen[g.near(x2, y2)]                           // can it get there?
//   g.reach(from, { hops: false })                 // on foot only
export function floorGraph(mask, { step = .2, water = -Infinity, dry = .3, clearance = 1.7, maxSlope = Math.tan(50 * Math.PI / 180), stepUp = .35,
  hop = { up: 7, forward: 2.6, gravity: 18 }, leap = 2.4, body = 1.5 } = {}) {
  const { cols, rows, solid, cell } = mask, count = Math.floor(mask.width / step), need = Math.ceil(clearance / cell);
  const colOf = k => Math.min(cols - 1, Math.floor((k + .5) * step / cell));
  const air = (c, r) => r >= rows || (r >= 0 && !solid[r * cols + c]);
  const start = new Int32Array(count + 1), ys = [], ks = [];
  for (let k = 0; k < count; k++) {
    start[k] = ys.length;
    const c = colOf(k);
    for (let r = 0; r < rows; r++) {
      if (!solid[r * cols + c] || !air(c, r + 1)) continue;
      const y = (r + 1) * cell;
      if (y <= water + dry) continue;
      let open = true;
      for (let q = r + 1; q <= r + need && open; q++) open = air(c, q);
      if (open) { ys.push(y); ks.push(k); }
    }
  }
  start[count] = ys.length;
  const y = Float32Array.from(ys), col = Int32Array.from(ks);
  // The floor of column k at height h (within half a cell), or -1.
  const at = (k, h) => { if (k < 0 || k >= count) return -1; for (let i = start[k]; i < start[k + 1]; i++) if (Math.abs(y[i] - h) < cell * .6) return i; return -1; };
  // The first ground at or under height h in column k: its floor id, or -1 (water, no room).
  const landing = (k, h) => {
    if (k < 0 || k >= count) return -1;
    const c = colOf(k);
    for (let r = Math.min(rows - 1, Math.floor(h / cell)); r >= 0; r--) if (solid[r * cols + c]) return at(k, (r + 1) * cell);
    return -1;
  };
  const clear = (k, from, to) => { const c = colOf(k); for (let r = Math.max(0, Math.floor(from / cell)); r <= Math.floor(to / cell); r++) if (!air(c, r)) return false; return true; };
  function edges(i, hops, out) {
    out.length = 0;
    const k = col[i], h = y[i], rise = Math.max(stepUp, maxSlope * step);
    for (const dir of [-1, 1]) {
      const n = k + dir;
      if (n >= 0 && n < count && clear(n, h + rise + cell, h + body)) { const j = landing(n, h + rise); if (j >= 0) out.push(j); }
      if (!hops || !clear(k, h + cell, h + body + hop.up * hop.up / (2 * hop.gravity))) continue;
      // The arc of a jump, column by column: blocked by ground in the body's
      // way, landed where the feet meet ground while coming down.
      for (let s = 1; s * step <= leap; s++) {
        const m = k + dir * s;
        if (m < 0 || m >= count) break;
        const t = s * step / hop.forward, feet = h + hop.up * t - hop.gravity * t * t / 2;
        if (!clear(m, feet + .1, feet + body)) break;
        if (hop.up - hop.gravity * t < 0) {
          const j = landing(m, feet + .1);
          if (j >= 0 && y[j] >= feet - .5) { out.push(j); break; }
        }
        if (s * step + step > leap) { const j = landing(m, feet); if (j >= 0) out.push(j); }
      }
    }
    return out;
  }
  // Each floor's edges, worked out once (with and without hops).
  const cache = [new Array(y.length), new Array(y.length)], scratch = [];
  const linked = (i, hops) => { const c = cache[hops ? 1 : 0]; return c[i] || (c[i] = Int32Array.from(edges(i, hops, scratch))); };
  // Every floor reachable from floor `from` (one id or a list), as a Uint8Array.
  function reach(from, { hops = true } = {}) {
    const seen = new Uint8Array(y.length), queue = new Int32Array(y.length);
    let head = 0, tail = 0;
    for (const f of [].concat(from)) if (f >= 0 && !seen[f]) { seen[f] = 1; queue[tail++] = f; }
    while (head < tail) for (const j of linked(queue[head++], hops)) if (!seen[j]) { seen[j] = 1; queue[tail++] = j; }
    return seen;
  }
  // How many floors a walker crosses from `from` to `to` (Infinity if it cannot), times the step: about the distance walked.
  function distance(from, to, { hops = true } = {}) {
    if (from < 0 || to < 0) return Infinity;
    const dist = new Int32Array(y.length).fill(-1), queue = new Int32Array(y.length);
    let head = 0, tail = 0; dist[from] = 0; queue[tail++] = from;
    while (head < tail) {
      const i = queue[head++];
      if (i === to) return dist[i] * step;
      for (const j of linked(i, hops)) if (dist[j] < 0) { dist[j] = dist[i] + Math.abs(col[j] - col[i]); queue[tail++] = j; }
    }
    return Infinity;
  }
  // The floor nearest (x, h) in x's column (within `within` up or down), or -1.
  function near(x, h, within = 1) {
    const k = Math.floor(x / step); if (k < 0 || k >= count) return -1;
    let best = -1;
    for (let i = start[k]; i < start[k + 1]; i++) if (Math.abs(y[i] - h) <= within && (best < 0 || Math.abs(y[i] - h) < Math.abs(y[best] - h))) best = i;
    return best;
  }
  // Columns with more than one floor: ledges over ground, caves, bridges, overhangs.
  let layered = 0; for (let k = 0; k < count; k++) if (start[k + 1] - start[k] > 1) layered++;
  return { step, y, col, start, count, layered: layered / Math.max(1, count), near, reach, distance, edges: (i, hops = true) => [...linked(i, hops)] };
}

// How sheltered (x, y) is from shots coming from side `dir` (±1): the share
// of `rays` rays fanned from `from`° to `to`° above the horizon, towards that
// side, that meet ground within `length`. 0 in the open, 1 behind a wall.
export function coverToward(mask, x, y, dir, { rays = 9, from = 5, to = 80, length = 12, step = .25 } = {}) {
  let blocked = 0;
  for (let k = 0; k < rays; k++) {
    const a = (from + (to - from) * k / (rays - 1)) * Math.PI / 180, dx = Math.cos(a) * dir, dy = Math.sin(a);
    for (let t = step; t <= length; t += step) {
      const px = x + dx * t, py = y + dy * t;
      if (py >= mask.height) break;
      const c = Math.floor(px / mask.cell), r = Math.floor(py / mask.cell);
      if (c >= 0 && c < mask.cols && r >= 0 && mask.solid[r * mask.cols + c]) { blocked++; break; }
    }
  }
  return blocked / rays;
}

// The shape of the top of the ground above the water: its relief (highest
// minus lowest dry top), how bumpy it is (mean rise over 2 units), and the
// share of the width that is dry land.
export function relief(mask, { water = -Infinity, step = .2 } = {}) {
  const top = topLine(mask, step), span = Math.max(1, Math.round(2 / step));
  let hi = -Infinity, lo = Infinity, dry = 0, bump = 0, n = 0;
  for (let k = 0; k < top.length; k++) {
    if (top[k] > water) { dry++; hi = Math.max(hi, top[k]); lo = Math.min(lo, top[k]); }
    if (k >= span && top[k] > water && top[k - span] > water) { bump += Math.abs(top[k] - top[k - span]); n++; }
  }
  return { relief: dry ? hi - lo : 0, high: hi, low: lo, bumpy: n ? bump / n : 0, land: dry / Math.max(1, top.length) };
}
