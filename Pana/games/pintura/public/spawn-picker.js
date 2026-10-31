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
