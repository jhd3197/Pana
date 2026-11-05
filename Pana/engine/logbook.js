// Logbook: what a player has come across in a game, on this device, under
// `pana:logbook:<game>`. Same shape as progress.js: storage is injectable for tests
// and falls back to memory when the browser blocks it. No Three.js, no DOM.
//
//   const ENTRIES = [{ id: 'lugar:mina', group: 'lugar', title: locKey('La mina') }, …];
//   const logbook = createLogbook({ game: 'reliquia', entries: ENTRIES });
//   const found = logbook.discover('lugar:mina');   // found.isNew only the first time
//   if (found.isNew) progress.award(5, `logbook:${found.entry.id}`, { dive: false });
//   logbook.percent();   // whole percent of the catalog; 100 only when all of it is found
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const clean = value => ({ found: Array.isArray(value?.found) ? [...new Set(value.found.filter(id => typeof id === 'string' && id.length <= 80))] : [] });

export const logbookKey = game => `pana:logbook:${game}`;
export const completion = (owned, total) => total > 0 ? Math.floor(Math.min(owned, total) / total * 100) : 0;

export function createLogbook({ game, entries = [], storage = defaultStorage() }) {
  const key = logbookKey(game), byId = new Map(entries.map(entry => [entry.id, entry])), listeners = new Set();
  // `stuck`: a write failed, so what storage holds is older than memory.
  let memory = clean(), stuck = false;
  const read = () => {
    if (stuck) return memory;
    try { const raw = storage?.getItem(key); if (raw != null) memory = clean(JSON.parse(raw)); } catch { /* blocked or malformed */ }
    return memory;
  };
  const write = doc => { memory = clean(doc); try { storage?.setItem(key, JSON.stringify(memory)); stuck = false; } catch { stuck = true; } return memory; };
  // Only what the catalog still lists counts; an id it dropped stays saved, in case it returns.
  const known = doc => doc.found.filter(id => byId.has(id));
  const summary = doc => { const owned = known(doc).length; return { owned, total: entries.length, percent: completion(owned, entries.length) }; };
  return {
    // Writes an id down once; an id the catalog does not list is never new.
    discover(id) {
      const doc = read(), entry = byId.get(id) ?? null;
      if (!entry || doc.found.includes(id)) return { isNew: false, entry, ...summary(doc) };
      const report = summary(write({ found: [...doc.found, id] }));
      for (const fn of listeners) fn(report);
      return { isNew: true, entry, ...report };
    },
    has: id => byId.has(id) && read().found.includes(id),
    // Ids found, oldest first.
    owned: () => known(read()),
    // The whole catalog in its own order, each entry with `found`.
    list() { const found = new Set(read().found); return entries.map(entry => ({ ...entry, found: found.has(entry.id) })); },
    newest() { const ids = known(read()); return ids.length ? byId.get(ids[ids.length - 1]) : null; },
    percent: () => summary(read()).percent,
    total: entries.length,
    // A discovery here or in another tab; returns the unsubscribe.
    onChange(fn) {
      const listen = event => { if (event.key === key) fn(summary(read())); };
      listeners.add(fn); globalThis.addEventListener?.('storage', listen);
      return () => { listeners.delete(fn); globalThis.removeEventListener?.('storage', listen); };
    },
  };
}
