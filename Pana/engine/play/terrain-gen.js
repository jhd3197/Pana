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
