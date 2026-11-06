// Hiding spots: places a player has to search (hold the interact key for a
// moment) before they give up what they hide: a treasure, a lesser find,
// junk, nothing at all, or now and then a nasty surprise. Pure and seeded
// (no Three.js), so a host and its guests deal the same spots from the same
// seed and a snapshot only carries which spots are open.
//
//   const { spots, left } = dealHidingSpots(rng, places, { treasures, lesser, junk, traps });
//   // places: [{ id, x, z, hard = 0 … 1, ... }] where the level can hide something
//   // spots[i].content: the item kinds inside ([] empty); .decoy (junk), .trap (a kind)
//
//   // Every tick, for each player holding the key on a spot:
//   if (searchStep(state.searching, spot.id, dt, spot.need ?? 1)) open(spot);   // true once
//   decaySearches(state.searching, held, dt);   // let go and the progress fades
//
// Treasures go to harder spots more often than easy ones (a few still sit
// in plain reach so a search is never hopeless); `left` lists treasures that
// found no spot, for the game to put somewhere else.

// Seeded weighted pick: index into `weights`.
function pickWeighted(rng, weights) {
  let total = 0; for (const w of weights) total += w;
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) return i; }
  return weights.length - 1;
}

// places: spots the level offers. treasures: item kinds that must be hidden
// (most valuable first is best); once every place holds one, the rest share
// places that already hide a treasure, so nothing is left out. lesser: kinds
// for a minor find; junk: decoys; traps: kinds of surprise (enemies, a trap)
// the game knows how to spring. decoys / finds / trapChance: shares of the
// places left over after the treasures. Each spot's `content` is a list.
export function dealHidingSpots(rng, places, { treasures = [], lesser = [], junk = [], traps = [], decoys = .35, finds = .2, trapChance = .08, easyShare = .25 } = {}) {
  const spots = places.map(p => ({ ...p, hard: Math.max(0, Math.min(1, p.hard ?? 0)), content: [], decoy: false, trap: null }));
  const free = spots.map((_, i) => i), stocked = [], left = [];
  treasures.forEach((kind, n) => {
    if (!spots.length) { left.push(kind); return; }
    if (!free.length) { const i = stocked[Math.floor(rng() * stocked.length)]; spots[i].content.push(kind); return; }
    // The first treasure of a level may land anywhere easy, so nobody leaves
    // empty-handed; the rest prefer the hard places.
    const easy = n === 0 || rng() < easyShare;
    const weights = free.map(i => easy ? 1.2 - spots[i].hard : .25 + spots[i].hard * 1.5);
    const at = free.splice(pickWeighted(rng, weights), 1)[0];
    spots[at].content.push(kind); stocked.push(at);
  });
  for (const i of free) {
    const roll = rng(), spot = spots[i];
    if (traps.length && roll < trapChance) spot.trap = traps[Math.floor(rng() * traps.length)];
    else if (junk.length && roll < trapChance + decoys) { spot.content.push(junk[Math.floor(rng() * junk.length)]); spot.decoy = true; }
    else if (lesser.length && roll < trapChance + decoys + finds) spot.content.push(lesser[Math.floor(rng() * lesser.length)]);
  }
  return { spots, left };
}

// One player's hold on a spot: adds dt to its progress in `store` (a plain
// object kept in the synced state). True exactly once, when it completes;
// the caller marks the spot open and deletes nothing else.
export function searchStep(store, id, dt, need = 1) {
  const before = store[id] || 0;
  if (before >= need) return false;
  store[id] = Math.min(need, before + dt);
  return store[id] >= need;
}

// On a client, for sound or dust: calls start(id) once for each search that
// began since the last call (a spot that appeared in the synced `store`) and
// forgets the ones that ended. `seen` is a Set the caller keeps between calls.
export function searchesStarted(store, seen, start) {
  for (const id of seen) if (!store || !(id in store)) seen.delete(id);
  if (store) for (const id in store) if (!seen.has(id)) { seen.add(id); start(id); }
}

// Searches nobody holds fade back (rate per second); finished ones are dropped.
export function decaySearches(store, held, dt, { rate = 1.5, done = () => false } = {}) {
  for (const id of Object.keys(store)) {
    if (done(id)) { delete store[id]; continue; }
    if (held.has(id) || held.has(String(id))) continue;
    store[id] -= dt * rate;
    if (store[id] <= 0) delete store[id];
  }
}
