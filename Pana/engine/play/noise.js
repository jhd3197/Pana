// Noise for creatures that hunt by ear: renderer-free and pure, so it runs in
// a host's simulation and in Node tests. A game emits a noise where something
// loud happens (a run, a landing, a book thrown on the boards, a search) with
// a radius; a listener hears the newest one that reaches it.
//
//   const board = createNoiseBoard();
//   emitNoise(board, { x, z, floor, radius: 10, kind: 'run', source: p.id, time });
//   const n = hearNoise(board, enemy, { floor, since: enemy.heardAt, time });   // or null
//   if (noisySince(board, p.id, time - .8)) ...   // this pana made noise just now
//   pruneNoises(board, time);
//
// A steady source (someone running) updates its own entry instead of piling
// up new ones: one entry per source and kind within `merge` seconds. The board
// is plain data the game keeps out of its snapshots (it is the host's ears).

export const createNoiseBoard = () => ({ list: [], last: {} });

export function emitNoise(board, { x, z, floor = 0, radius = 8, kind = 'noise', source = null, time = 0, merge = .4 }) {
  if (!board || !Number.isFinite(x) || !Number.isFinite(z) || !(radius > 0)) return null;
  if (source != null) board.last[source] = time;
  if (source != null) for (const n of board.list) if (n.source === source && n.kind === kind && time - n.time < merge) {
    n.x = x; n.z = z; n.floor = floor; n.time = time; n.radius = Math.max(radius, n.radius * .5); return n;
  }
  const n = { x, z, floor, radius, kind, source, time };
  board.list.push(n);
  if (board.list.length > 32) board.list.shift();
  return n;
}

// The newest noise after `since` that reaches the listener (`muffled(n)`
// may shrink a noise behind walls: return a factor 0…1).
export function hearNoise(board, at, { floor = 0, since = -Infinity, time = Infinity, life = 3, muffled = null } = {}) {
  let best = null;
  for (const n of board?.list || []) {
    if (n.floor !== floor || n.time <= since || time - n.time > life) continue;
    if (best && n.time <= best.time) continue;
    const reach = n.radius * (muffled ? muffled(n) : 1);
    if ((n.x - at.x) ** 2 + (n.z - at.z) ** 2 < reach * reach) best = n;
  }
  return best;
}

// Did this source make any noise at or after `since`?
export const noisySince = (board, source, since) => source != null && (board?.last[source] ?? -Infinity) >= since;

export function pruneNoises(board, time, life = 3) {
  if (!board) return;
  if (board.list.some(n => time - n.time > life)) board.list = board.list.filter(n => time - n.time <= life);
  for (const k of Object.keys(board.last)) if (time - board.last[k] > life) delete board.last[k];
}
