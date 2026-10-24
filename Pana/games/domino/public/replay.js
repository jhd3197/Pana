import { DominoGame } from './rules.js';

// Parlour-inspired rule re-execution, not a checksum-as-anti-cheat claim.
// A new peer trusts its first checkpoint; subsequent host claims must follow
// the rules from its last verified state. Hidden hands are still host-visible.
const copy = value => JSON.parse(JSON.stringify(value));
const METHODS = new Set(['accept', 'addPlayer', 'removePlayer', 'play', 'pass', 'clock', 'stepCachos']);
export function plainState(state) { const { audit, ...plain } = state; return copy(plain); }
const canonical = value => JSON.stringify(value, function(key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item;
});
export const sameState = (a,b) => canonical(a) === canonical(b);
const restore = state => Object.assign(new DominoGame(), plainState(state));

export function journalGame(state, epoch) {
  const game = restore(state), journal = { epoch, base: 0, checkpoint: game.snapshot(), events: [] };
  let depth = 0, serial = 0;
  const archive = [];
  const proxy = new Proxy(game, { get(target, key) {
    const method = target[key];
    if (!METHODS.has(key)) return typeof method === 'function' ? method.bind(target) : method;
    return (...args) => {
      if (depth) return method.apply(proxy,args);
      const before = target.snapshot(); let result;
      depth++;
      try { result = method.apply(proxy,args); } finally { depth--; }
      if (!sameState(before,target.snapshot())) {
        // Keep ordinary packets bounded, retaining older segments for a peer
        // that missed a checkpoint boundary. Recovery is still rule-verified.
        if (journal.events.length >= 256) {
          archive.push(copy(journal)); if (archive.length > 31) archive.shift();
          journal.checkpoint = before; journal.base = serial; journal.events = [];
        }
        journal.events.push({ seq: ++serial, method:key, args:copy(args) });
      }
      return result;
    };
  } });
  return { game: proxy, packet: (recovery = false) => ({ ...game.snapshot(), audit: copy(recovery && archive.length
    ? { ...archive[0], events:[...archive.flatMap(segment => segment.events), ...journal.events] }
    : journal) }) };
}

export function verifyPacket(previous, incoming, hostId, members, bootstrap = false) {
  try {
    const log = incoming?.audit;
    if (!log || !Array.isArray(log.events) || log.events.length > 8192 || !Number.isSafeInteger(log.base) || log.base < 0) return null;
    let game, cursor;
    if (!bootstrap && previous) {
      if (previous.epoch === log.epoch) { game = restore(previous.state); cursor = previous.seq; if (cursor < log.base) return null; }
      else { if (!sameState(previous.state, log.checkpoint) || log.base !== 0) return null; game = restore(log.checkpoint); cursor = 0; }
    } else { game = restore(log.checkpoint); cursor = log.base; }
    // Recovery can include a member joining and leaving while this peer was
    // away, or leaving and returning. Compare the final membership operation
    // with the authenticated roster, not every intermediate historical one.
    const membershipFinal = new Map();
    for (const event of log.events) if (['addPlayer','removePlayer'].includes(event.method)) membershipFinal.set(event.args?.[0],event.seq);
    let last = log.base;
    for (const event of log.events) {
      if (event.seq !== ++last || !METHODS.has(event.method) || !Array.isArray(event.args)) return null;
      if (event.seq <= cursor) continue;
      const [id, data, claimedHost] = event.args;
      if (event.method === 'accept' && (claimedHost !== hostId || !game.players.some(p => p.id === id))) return null;
      if (['play','pass'].includes(event.method) && game.players[id]?.id !== null) return null;
      if (['clock','stepCachos'].includes(event.method) && (!Number.isFinite(id) || id <= 0 || id > 1)) return null;
      if (!bootstrap && membershipFinal.get(id) === event.seq) {
        if (event.method === 'addPlayer' && !members.has(id)) return null;
        if (event.method === 'removePlayer' && members.has(id)) return null;
      }
      const before = game.snapshot(); const ok = game[event.method](...event.args);
      if (event.method === 'accept' && !ok) return null;
      if (sameState(before, game.snapshot())) return null;
      cursor = event.seq;
    }
    if (last < cursor || !sameState(game.snapshot(), plainState(incoming))) return null;
    return { epoch:log.epoch, seq:cursor, state:game.snapshot() };
  } catch { return null; }
}
