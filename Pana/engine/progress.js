// Progress: a game's persistent rank and XP on this device, under
// `pana:progress:<game>`. Same shape as mangos.js: storage is injectable for
// tests and falls back to memory when the browser blocks it. No Three.js, no DOM.
//
//   const RANKS = [{ id: 'aprendiz', title: locKey('Aprendiz'), xp: 0, unlocks: [] }, …];   // sorted by xp
//   const progress = createProgress({ game: 'reliquia', ranks: RANKS });
//   progress.award(40, `${seed}:${outcome}`);   // once per finished round; a repeat pays nothing
//   progress.isUnlocked('traje:franja');        // derived from the rank, never stored
const RECEIPTS = 60;   // recent awards remembered so a reload cannot pay twice
const count = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const clean = value => ({
  xp: count(value?.xp),
  dives: count(value?.dives),
  receipts: Array.isArray(value?.receipts) ? value.receipts.filter(r => typeof r === 'string' && r.length <= 180).slice(-RECEIPTS) : [],
});
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export const progressKey = game => `pana:progress:${game}`;

// The rank held at this much XP (the first one below its threshold), or null with no ranks.
export function rankAt(ranks, xp) {
  let held = ranks[0] ?? null;
  for (const rank of ranks) if (rank.xp <= xp) held = rank;
  return held;
}
// The rank after this much XP, or null at the top.
export const nextRank = (ranks, xp) => ranks.find(rank => rank.xp > xp) ?? null;
// How far through the held rank, 0..1; the top rank stays full.
export function progressInRank(ranks, xp) {
  const held = rankAt(ranks, xp), next = nextRank(ranks, xp);
  if (!next) return 1;
  const span = next.xp - held.xp;
  return span > 0 ? Math.max(0, Math.min(1, (xp - held.xp) / span)) : 0;
}
export const unlocksAt = (ranks, xp) => ranks.filter(rank => rank.xp <= xp).flatMap(rank => rank.unlocks ?? []);

export function createProgress({ game, ranks = [], storage = defaultStorage() }) {
  const key = progressKey(game), listeners = new Set();
  // `stuck`: a write failed, so what storage holds is older than memory.
  let memory = clean(), stuck = false;
  const read = () => {
    if (stuck) return memory;
    try { const raw = storage?.getItem(key); if (raw != null) memory = clean(JSON.parse(raw)); } catch { /* blocked or malformed */ }
    return memory;
  };
  const write = doc => { memory = clean(doc); try { storage?.setItem(key, JSON.stringify(memory)); stuck = false; } catch { stuck = true; } return memory; };
  const summary = doc => ({ xp: doc.xp, dives: doc.dives, rank: rankAt(ranks, doc.xp) });
  return {
    // Adds XP once per receipt and counts one dive. A receipt already paid changes nothing.
    award(amount, receipt) {
      const doc = read(), before = rankAt(ranks, doc.xp);
      if (receipt && doc.receipts.includes(receipt)) return { gained: 0, xp: doc.xp, rank: before, rankedUp: false, newUnlocks: [] };
      const gained = count(amount), xp = doc.xp + gained, rank = rankAt(ranks, xp), owned = new Set(unlocksAt(ranks, doc.xp));
      const saved = write({ xp, dives: doc.dives + 1, receipts: receipt ? [...doc.receipts, receipt] : doc.receipts });
      for (const fn of listeners) fn(summary(saved));
      return { gained, xp, rank, rankedUp: rank !== before, newUnlocks: unlocksAt(ranks, xp).filter(id => !owned.has(id)) };
    },
    xp: () => read().xp,
    dives: () => read().dives,
    rank: () => rankAt(ranks, read().xp),
    next: () => nextRank(ranks, read().xp),
    inRank: () => progressInRank(ranks, read().xp),
    unlocked: () => unlocksAt(ranks, read().xp),
    isUnlocked: id => unlocksAt(ranks, read().xp).includes(id),
    paid: receipt => read().receipts.includes(receipt),
    // An award here or in another tab; returns the unsubscribe.
    onChange(fn) {
      const listen = event => { if (event.key === key) fn(summary(read())); };
      listeners.add(fn); globalThis.addEventListener?.('storage', listen);
      return () => { listeners.delete(fn); globalThis.removeEventListener?.('storage', listen); };
    },
  };
}
