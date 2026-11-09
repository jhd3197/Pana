// Complete human placements without crowding automatic starts. A prefix DP
// finds a complete spaced set; greedy farthest-first can strand the last capi.
import { standable } from './map-rules.js';

export const AUTO_GAP = 20;
const candidates = new WeakMap();
function legalStarts(ground) {
  if (candidates.has(ground)) return candidates.get(ground);
  const { map, mask, graph, fromHub, toHub } = ground, xs = [];
  for (let x = 8; x <= map.width - 8; x += .5) {
    const y = standable(mask, x); if (y === null) continue;
    const node = graph.near(x, y, .6);
    if (node >= 0 && fromHub[node] && toHub[node]) xs.push(x);
  }
  candidates.set(ground, xs); return xs;
}

// `auto`: the fair spots in seat order (setup-rules seatSpawns).
export function completeSpawns(places, ground, count = 6, auto = ground.auto) {
  const xs = Array(count).fill(null);
  for (const [capi, x] of Object.entries(places)) if (Number(capi) < count) xs[Number(capi)] = x;
  const fixed = xs.filter(x => x !== null), needed = count - fixed.length;
  if (!needed) return xs;
  if (!fixed.length) return auto.slice(0, count);
  const pool = legalStarts(ground).filter(x => fixed.every(y => Math.abs(x - y) >= AUTO_GAP));
  const n = pool.length, before = new Int32Array(n), weights = pool.map(x =>
    (auto.includes(x) ? 1000 : 0) + Math.min(56, ...fixed.map(y => Math.abs(x - y))));
  for (let j = 0, p = -1; j < n; j++) {
    while (p + 1 < j && pool[j] - pool[p + 1] >= AUTO_GAP) p++;
    before[j] = p + 1;
  }
  const scores = Array.from({ length: needed + 1 }, () => new Float64Array(n + 1).fill(-Infinity));
  const picked = Array.from({ length: needed + 1 }, () => new Uint8Array(n + 1));
  scores[0].fill(0);
  for (let k = 1; k <= needed; k++) for (let j = 1; j <= n; j++) {
    const take = scores[k - 1][before[j - 1]] + weights[j - 1];
    scores[k][j] = scores[k][j - 1];
    if (take > scores[k][j]) { scores[k][j] = take; picked[k][j] = 1; }
  }
  if (!Number.isFinite(scores[needed][n])) return null;
  const free = [];
  for (let k = needed, j = n; k > 0;) {
    if (!picked[k][j]) { j--; continue; }
    free.push(pool[j - 1]); j = before[j - 1]; k--;
  }
  free.sort((a, b) => a - b);
  for (let i = 0; i < count; i++) if (xs[i] === null) {
    let best = 0;
    for (let j = 1; j < free.length; j++) if (Math.abs(free[j] - auto[i]) < Math.abs(free[best] - auto[i])) best = j;
    xs[i] = free.splice(best, 1)[0];
  }
  return xs;
}
