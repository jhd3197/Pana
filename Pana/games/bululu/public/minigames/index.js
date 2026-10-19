// The minigame list without the minigames: each one's scene, models and sim
// load the first time it is dealt (or during idle time after the board is up),
// so opening Bululú doesn't download all twelve. Titles are repeated here for
// the practice menu; tests/minigames.test.js keeps them equal to the modules'.

const ENTRIES = [
  ['atrapa', '¡Atrapa los mangos!', () => import('./atrapa.js')],
  ['caigas', '¡No te caigas!', () => import('./caigas.js')],
  ['caida', '¡Caída!', () => import('./caida.js')],
  ['momia', '¡Un, dos, tres, momia!', () => import('./momia.js')],
  ['coleo', '¡Coleo!', () => import('./coleo.js')],
  ['choque', '¡Choque de carritos!', () => import('./choque.js')],
  ['embuste', '¡Embuste!', () => import('./embuste.js')],
  ['remada', '¡Remada!', () => import('./remada.js')],
  ['raudal', '¡Raudal!', () => import('./raudal.js')],
  ['remolino', '¡Remolino!', () => import('./remolino.js')],
  ['chinazo', '¡Chinazo!', () => import('./chinazo.js')],
  ['criollas', '¡Bolas Criollas!', () => import('./criollas.js')],
];

const loaded = new Map(), pending = new Map();

export const MINIGAMES = ENTRIES.map(([id, title]) => ({ id, title }));

// The full definition (create, howto, keys, input…), loading it if needed.
export function loadMinigame(id) {
  if (loaded.has(id)) return Promise.resolve(loaded.get(id));
  if (!pending.has(id)) {
    const entry = ENTRIES.find(e => e[0] === id);
    if (!entry) return Promise.reject(new Error(`unknown minigame ${id}`));
    pending.set(id, entry[2]().then(m => { loaded.set(id, m.default); return m.default; })
      .catch(err => { pending.delete(id); throw err; }));
  }
  return pending.get(id);
}

// The definition when it has already loaded, else null (and it starts loading).
export function loadedMinigame(id) {
  if (!loaded.has(id)) loadMinigame(id).catch(() => {});
  return loaded.get(id) || null;
}

// Fetches every minigame one after another in idle time, so the first one dealt starts at once.
export async function prefetchMinigames(ids = MINIGAMES.map(m => m.id)) {
  const idle = () => new Promise(r => (globalThis.requestIdleCallback || setTimeout)(r));
  for (const id of ids) { await idle(); await loadMinigame(id).catch(() => {}); }
}
