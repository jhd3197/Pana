// Where a pana (re)appears: as far as possible from living rivals, out of
// their sight when the cover allows, and not the spot they used last time.
// Pure and renderer-free: the room and practice both read it. Teammates never
// push a spawn away; in free-for-all everyone else is a rival.
const FAR = 1000;   // the distance a spawn scores with no rival on the court
const HIDDEN = 12;  // metres a spawn no rival can see is worth
const SLACK = 6;    // candidates within this of the best share the draw...
const TOP = 3;      // ...up to this many, so rounds do not repeat

// Every allowed spawn index with its score, best first.
// spawns: [{ x, z }]; enemies: [{ x, z }]; taken: indices already in use;
// last: the index this pana used before; allowed: the indices its side may use;
// sees(enemy, spawn): true when the line between them is clear.
export function rankSpawns(spawns, { enemies = [], taken = [], last = -1, allowed = null, sees = null } = {}) {
  let pool = spawns.map((_, i) => i).filter(i => !allowed || allowed.includes(i));
  const free = pool.filter(i => !taken.includes(i)); if (free.length) pool = free;
  const fresh = pool.filter(i => i !== last); if (fresh.length) pool = fresh;
  return pool.map(index => {
    const s = spawns[index], near = Math.min(FAR, ...enemies.map(e => Math.hypot(e.x - s.x, e.z - s.z)));
    const seen = !!sees && enemies.some(e => sees(e, s));
    return { index, near, seen, score: near + (seen ? 0 : HIDDEN) };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
}

// One spawn index, drawn among the best few with rng() in [0, 1).
export function pickSpawn(spawns, { rng = Math.random, ...options } = {}) {
  const ranked = rankSpawns(spawns, options); if (!ranked.length) return 0;
  const best = ranked.filter(c => c.score >= ranked[0].score - SLACK).slice(0, TOP);
  return best[Math.min(best.length - 1, Math.floor(rng() * best.length))].index;
}

// Free-for-all keeps every pana at least this many metres from every other one
// at round start, and respawns this far from the nearest living rival whenever
// a spawn allows it. Where a court's spawns cannot fit the round at this gap
// (El Puerto's bases hold four spawns 6 m apart), the spread falls back to the
// largest gap the court allows.
export const MIN_SPAWN_GAP = 20;

const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Every way to choose `count` of `size` indices, in a fixed order (8 spawns: at most 70).
function subsets(size, count) {
  const out = [], pick = [];
  const walk = from => {
    if (pick.length === count) { out.push([...pick]); return; }
    for (let i = from; i <= size - (count - pick.length); i++) { pick.push(i); walk(i + 1); pick.pop(); }
  };
  walk(0); return out;
}
// Each index's distance to the nearest other index of the set.
const nearest = (spawns, set) => set.map(i => Math.min(Infinity, ...set.filter(j => j !== i).map(j => apart(spawns[i], spawns[j]))));
const draw = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

// Round start in free-for-all: `count` distinct spawn indices, every pair at
// least `gap` metres apart. Exact search over the subsets: the sets within
// SLACK of the widest spread (never under `gap`) share the draw, so rounds
// vary. When no set reaches `gap`, only the widest sets are drawn and
// `fallback` is true. `first` panas (the people, before the bots) get the most
// isolated spots: among equal spreads, sets that isolate them best win when the court falls short.
// Returns { indices, minGap, fallback }; indices[k] is the k-th pana's spawn.
export function spreadSpawns(spawns, count, { rng = Math.random, gap = MIN_SPAWN_GAP, first = 0 } = {}) {
  if (count <= 0) return { indices: [], minGap: Infinity, fallback: false };
  if (count > spawns.length) {
    const indices = Array.from({ length: count }, (_, k) => k % spawns.length);
    return { indices, minGap: 0, fallback: true };
  }
  const sets = subsets(spawns.length, count).map(set => {
    const near = nearest(spawns, set);
    return { set, near, min: Math.min(...near) };
  });
  const best = Math.max(...sets.map(s => s.min)), fallback = best < gap;
  let pool = sets.filter(s => s.min >= (fallback ? best - 1e-9 : Math.max(gap, best - SLACK)));
  // The people's spots (the most isolated of the set), the least roomy first: the
  // worst-off person counts most, then the next.
  const lead = s => [...s.near].sort((a, b) => b - a).slice(0, Math.min(first, count)).reverse();
  const better = (a, b) => { for (let k = 0; k < a.length; k++) if (Math.abs(a[k] - b[k]) > 1e-9) return a[k] - b[k]; return 0; };
  if (first > 0 && fallback) { const top = pool.map(lead).reduce((m, l) => better(l, m) > 0 ? l : m); pool = pool.filter(s => better(lead(s), top) === 0); }
  const chosen = draw(pool, rng);
  // Shuffle with rng, then the most isolated spots go to the first panas.
  const order = chosen.set.map((index, k) => ({ index, near: chosen.near[k] }));
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const lead2 = [...order].sort((a, b) => b.near - a.near).slice(0, first), rest = order.filter(o => !lead2.includes(o));
  return { indices: [...lead2, ...rest].map(o => o.index), minGap: chosen.min, fallback };
}

// A free-for-all respawn: distance first. Spawns at least `gap` from the
// nearest living rival (or only the farthest when none is) and within SLACK of
// the farthest; out of sight is only a tie-break among those. Not the last spawn
// while another is open. Cheap: one pass over the spawns per death.
export function pickRespawn(spawns, { rng = Math.random, gap = MIN_SPAWN_GAP, ...options } = {}) {
  const ranked = rankSpawns(spawns, options); if (!ranked.length) return 0;
  const far = Math.max(...ranked.map(c => c.near));
  const floor = far < gap ? far : Math.max(gap, far - SLACK);
  let pool = ranked.filter(c => c.near >= floor - 1e-9);
  const hidden = pool.filter(c => !c.seen); if (hidden.length) pool = hidden;
  pool = pool.sort((a, b) => b.near - a.near || a.index - b.index).slice(0, TOP);
  return draw(pool, rng).index;
}
