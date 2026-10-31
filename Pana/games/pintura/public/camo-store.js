// The armory's view of the player's camos, from pana.sh's browser bridge:
// window.PanaSh.camos() resolves to GET /auth/camos ({ owned, progress, prices,
// balance, equipped }) and window.PanaSh.buyCamo(id) buys one and resolves to the
// fresh JSON. Public Pana has no bridge, and a bridge without a session rejects:
// either way only the start camos count (`online: false`; `signedOut` when the bridge refused).
// Answers are cached for `ttl` ms; a call slower than `timeout` ms falls back.
import { START_CAMOS } from './armory-data.js';
import { camoById } from './camos.js';

const offline = online => ({ online, owned: [...START_CAMOS], progress: {}, prices: {}, balance: 0, equipped: null });
// The bridge's JSON, checked: only known ids, finite numbers, the start camos always owned.
export function normalize(data) {
  if (!data || typeof data !== 'object') return offline(true);
  const owned = new Set(START_CAMOS);
  for (const id of Array.isArray(data.owned) ? data.owned : []) if (camoById(id)) owned.add(id);
  const progress = {};
  for (const [weapon, row] of Object.entries(data.progress && typeof data.progress === 'object' ? data.progress : {}))
    if (row && typeof row === 'object') progress[weapon] = { hits: Math.max(0, Number(row.hits) || 0), need: Math.max(0, Number(row.need) || 0), camo: typeof row.camo === 'string' ? row.camo : '' };
  const prices = {};
  for (const [id, price] of Object.entries(data.prices && typeof data.prices === 'object' ? data.prices : {})) if (camoById(id) && Number(price) > 0) prices[id] = Number(price);
  return { online: true, owned: [...owned], progress, prices, balance: Math.max(0, Number(data.balance) || 0), equipped: camoById(data.equipped) ? data.equipped : null };
}

export function createCamoStore({ bridge = () => globalThis.PanaSh, timeout = 5000, ttl = 30000, now = () => Date.now() } = {}) {
  let cached = null, at = -Infinity, pending = null;
  const within = promise => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
  const store = {
    // Whether pana.sh's bridge is on this page at all.
    get available() { return typeof bridge()?.camos === 'function'; },
    // The last answer (or the offline one before any).
    get data() { return cached || offline(store.available); },
    // The player's camos; `fresh` skips the cache. Never rejects.
    load({ fresh = false } = {}) {
      if (!fresh && cached && now() - at < ttl) return Promise.resolve(cached);
      if (pending) return pending;
      const api = bridge();
      if (typeof api?.camos !== 'function') return Promise.resolve(cached = offline(false));
      pending = within(Promise.resolve().then(() => api.camos())).then(data => { cached = normalize(data); at = now(); return cached; },
        // No session (or pana.sh did not answer): keep a good earlier answer, else start camos only.
        () => { if (!cached?.online) cached = { ...offline(false), signedOut: true }; at = -Infinity; return cached; })
        .finally(() => { pending = null; });
      return pending;
    },
    // Buys one camo: { ok: true, data } or { ok: false, error } with pana.sh's (Spanish) reason.
    async buy(id) {
      const api = bridge();
      if (!camoById(id) || typeof api?.buyCamo !== 'function') return { ok: false, error: '' };
      try { cached = normalize(await within(Promise.resolve().then(() => api.buyCamo(id)))); at = now(); return { ok: true, data: cached }; }
      catch (error) { return { ok: false, error: error?.message === 'timeout' ? '' : String(error?.message || '') }; }
    },
  };
  return store;
}
