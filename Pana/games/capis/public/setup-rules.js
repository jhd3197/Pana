// The free-for-all's setup, between the host pressing start and the first
// turn: no match ticks. Pure and deterministic, so the host's room runs it and
// every client replays the same picks.
//
//   const s = createSetup({ setupSeed, hostId, owners });  // owners: { [capi]: playerId }
//   choose(s, hostId, 1, s.rev)          // preview another of the three maps
//   place(s, playerId, capi, x, ground, s.rev)  // ground: setupGround(map, mask)
//   const { seed, spawns } = launch(s, hostId, ground)   // locks both
//
// Three candidate seeds come from one shared setup seed. Only the host
// switches maps, and a switch clears every chosen spot (they belong to the old
// ground). A pana may pick a start for each capi it owns: on the map, on
// ground a capi can stand on, apart from the other picks, and on ground that
// walks to every other spot. Every capi nobody placed takes a fair spot of its
// own. Each accepted change bumps `rev`; a message carrying an older rev is
// stale and turned down, so a late pick never lands on the next map.
import { seededStream } from '../../../engine/play/terrain-gen.js';
import { surfaceY } from '../../../engine/play/terrain-mask.js';
import { mapSeed, spreadSpawns, standable, ffaGraph, generateMap, ffaLayout, FFA_TEPUY } from './map-rules.js';

export const CANDIDATES = 3;
export const PLACE_GAP = 10;   // the least room between two capis' starts (spreadSpawns keeps more)

// Three map seeds from a setup seed, the same on every client, each of its
// own layout (map-rules ffaLayout), so the three maps differ in shape.
export function candidateSeeds(setupSeed) {
  const r = seededStream(`capis-setup:${setupSeed}`), out = [], kinds = new Set();
  while (out.length < CANDIDATES) {
    const s = mapSeed(1 + Math.floor(r() * 99998)), k = ffaLayout(s).kind;
    if (!out.includes(s) && !kinds.has(k)) { out.push(s); kinds.add(k); }
  }
  return out;
}

export function createSetup({ setupSeed = 1, hostId = null, owners = {} } = {}) {
  return { phase: 'setup', setupSeed, seeds: candidateSeeds(setupSeed), pick: 0, rev: 0, hostId, owners: { ...owners }, places: {} };
}
export const seedOf = s => s.seeds[s.pick];

// What placing reads about a candidate's ground, built once per map.
export function setupGround(map, mask) {
  // The same strict graph the generator proves the starts with (map-rules ffaGraph).
  const graph = ffaGraph(mask), auto = spreadSpawns(map, mask), y = surfaceY(mask, auto[0]);
  return { map, mask, graph, auto, hub: graph.near(auto[0], y, .6) };
}

// A candidate's ground from its seed, the last few kept (making a map takes a moment).
const grounds = new Map();
export function groundOf(seed) {
  if (!grounds.has(seed)) {
    const { map, mask } = generateMap(seed, 'large', { mode: 'ffa' });
    grounds.set(seed, setupGround(map, mask));
    if (grounds.size > 4) grounds.delete(grounds.keys().next().value);
  }
  return grounds.get(seed);
}

const no = reason => ({ ok: false, reason });
const yes = s => { s.rev++; return { ok: true, rev: s.rev }; };
const open = (s, rev) => s.phase !== 'setup' ? 'locked' : rev !== undefined && rev !== s.rev ? 'stale' : null;

export function choose(s, by, index, rev) {
  const shut = open(s, rev); if (shut) return no(shut);
  if (by !== s.hostId) return no('not-host');
  if (!Number.isInteger(index) || index < 0 || index >= CANDIDATES) return no('bad-pick');
  if (index === s.pick) return { ok: true, rev: s.rev };
  s.pick = index; s.places = {};
  return yes(s);
}

// Why spot x is no good for `capi` on `ground`, or null.
export function spotProblem(s, capi, x, ground) {
  const { map, mask, graph, hub } = ground, m = FFA_TEPUY.margin;
  if (!Number.isFinite(x) || x < m || x > map.width - m) return 'out-of-bounds';
  const y = standable(mask, x);
  if (y === null) return 'unsafe';
  for (const [other, ox] of Object.entries(s.places)) if (Number(other) !== capi && Math.abs(ox - x) < PLACE_GAP) return 'overlap';
  const node = graph.near(x, y, .6);
  if (node < 0 || hub < 0 || !graph.reach(node)[hub] || !graph.reach(hub)[node]) return 'unreachable';
  return null;
}

export function place(s, by, capi, x, ground, rev) {
  const shut = open(s, rev); if (shut) return no(shut);
  if (!Object.hasOwn(s.owners, capi) || s.owners[capi] !== by) return no('not-owner');
  const bad = spotProblem(s, capi, x, ground); if (bad) return no(bad);
  s.places[capi] = Math.round(x * 100) / 100;
  return yes(s);
}

export function unplace(s, by, capi, rev) {
  const shut = open(s, rev); if (shut) return no(shut);
  if (s.owners[capi] !== by) return no('not-owner');
  if (!Object.hasOwn(s.places, capi)) return { ok: true, rev: s.rev };
  delete s.places[capi];
  return yes(s);
}

// Who owns a capi changes (a late join takes a bot's seat, a pana leaves):
// its chosen spot goes with the old owner.
export function setOwner(s, capi, playerId) {
  if (s.phase !== 'setup' || s.owners[capi] === playerId) return;
  if (playerId === null || playerId === undefined) delete s.owners[capi]; else s.owners[capi] = playerId;
  delete s.places[capi];
  s.rev++;
}
export function dropPlayer(s, playerId) { for (const [capi, owner] of Object.entries(s.owners)) if (owner === playerId) setOwner(s, Number(capi), null); }

// A start for each of `count` capis: the placed ones where they chose, the
// rest on spreadSpawns' fair spots, each its own if no pick crowds it, else
// the free one farthest from everybody.
export function resolveSpawns(s, ground, count = 6) {
  const { auto } = ground, xs = Array(count).fill(null);
  for (const [capi, x] of Object.entries(s.places)) if (Number(capi) < count) xs[Number(capi)] = x;
  const taken = () => xs.filter(x => x !== null), clear = x => taken().every(o => Math.abs(o - x) >= PLACE_GAP);
  for (let i = 0; i < count; i++) {
    if (xs[i] !== null) continue;
    if (clear(auto[i])) { xs[i] = auto[i]; continue; }
    const free = auto.filter(x => !xs.includes(x));
    xs[i] = free.reduce((best, x) => Math.min(...taken().map(o => Math.abs(o - x))) > Math.min(...taken().map(o => Math.abs(o - best))) ? x : best);
  }
  return xs;
}

// The host starts the match: the seed and every start are locked.
export function launch(s, by, ground, count = 6) {
  const shut = open(s); if (shut) return no(shut);
  if (by !== s.hostId) return no('not-host');
  s.phase = 'locked'; s.rev++;
  s.locked = { seed: seedOf(s), spawns: resolveSpawns(s, ground, count) };
  return { ok: true, rev: s.rev, ...s.locked };
}
