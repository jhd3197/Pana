// Save and resume: a game's sessions kept for next week, offline-first. No DOM,
// no Three.js, so a rules file can import it (by relative path);
// engine/save-widget.js draws it.
//
//   const store = createSaveStore({ game: 'reliquia', version: 1 });
//   const autosave = createAutosave({ store, every: 5000, key: () => jornada, ready: () => betweenFloors(), make: () => ({ id, data, meta }) });
//   setInterval(() => { if (isHost) autosave.tick(); }, 50);       // only the host writes
//   store.list();                                                  // [{ id, at, meta }], newest first
//   store.load(id);                                                // the data, or null
//   store.remove(id);                                              // when the session really ended
//
// Saves live in the browser of whoever hosted, under `pana:save:<game>`: the host
// owns them. A new `version` makes older saves disappear rather than half load.
// A slot is a player in the saved session: there are no accounts, so a returning
// player finds theirs by name (findSlot), case and spaces ignored. Storage
// trouble never throws: a failed save is a false, and the game plays on.

const KEEP = 3;
function defaultStorage() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }

export const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
// The first free slot with this name. `free` says what counts as free.
export const findSlot = (slots, name, free = s => s.held) => slots.find(s => free(s) && sameName(s.name, name)) ?? null;

export function createSaveStore({ game, version = 1, keep = KEEP, storage = defaultStorage(), now = () => Date.now() }) {
  const KEY = `pana:save:${game}`;
  const read = () => {
    try {
      const raw = JSON.parse(storage?.getItem(KEY) ?? 'null');
      return raw?.version === version && Array.isArray(raw.saves) ? raw.saves : [];
    } catch { return []; }
  };
  const write = saves => { storage.setItem(KEY, JSON.stringify({ version, saves })); return true; };
  return {
    // One entry per id, newest first. Out of room, the oldest saves go first.
    save(id, data, meta = {}) {
      if (!storage) return false;
      let saves = [{ id, at: now(), meta, data }, ...read().filter(s => s.id !== id)].slice(0, keep);
      for (;;) {
        try { return write(saves); }
        catch { if (saves.length < 2) return false; saves = saves.slice(0, -1); }
      }
    },
    list: () => read().map(({ id, at, meta }) => ({ id, at, meta })),
    load: id => read().find(s => s.id === id)?.data ?? null,
    remove(id) { try { const saves = read(), rest = saves.filter(s => s.id !== id); if (rest.length !== saves.length) write(rest); } catch { /* blocked: nothing to forget */ } },
  };
}

// Writes when the game says it may (ready), at once when `key` changed (a new
// floor) and otherwise every `every` ms. make() returns { id, data, meta }.
export function createAutosave({ store, ready, make, key = () => '', every = 5000, now = () => Date.now() }) {
  let lastKey, lastAt = -Infinity;
  return {
    tick() {
      if (!ready()) return false;
      const k = key(), t = now();
      if (k === lastKey && t - lastAt < every) return false;
      const { id, data, meta } = make();
      if (!store.save(id, data, meta)) return false;
      lastKey = k; lastAt = t;
      return true;
    },
    reset() { lastKey = undefined; lastAt = -Infinity; },
  };
}
