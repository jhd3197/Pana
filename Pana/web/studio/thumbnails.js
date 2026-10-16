import { createFingerprinter } from './fingerprints.js';
import { openDatabase, transaction } from './cache-store.js';

const idle = () => new Promise(resolve => {
  if ('requestIdleCallback' in window) requestIdleCallback(resolve, { timeout: 1000 }); else setTimeout(resolve, 30);
});

// Only explicit requests may validate or construct previews. Replacing the queue
// never appends the rest of the catalog.
export function createThumbnails(assets, { onChange, isBusy = () => false }) {
  const entries = new Map(), errors = new Map(), byId = new Map(assets.map(asset => [asset.id, asset]));
  let db, renderer, timer, job, disposed = false, initialized = false, paused = false;
  let active = '', validating = false, persistent = true, generated = 0, reused = 0, order = [];
  let fingerprint = createFingerprinter();
  const emit = () => { if (!disposed) onChange(api); };
  const forget = id => { const entry = entries.get(id); if (entry) URL.revokeObjectURL(entry.url); entries.delete(id); };
  const remember = record => { forget(record.id); entries.set(record.id, { ...record, url: URL.createObjectURL(record.blob) }); };
  const storageFailed = () => { persistent = false; db?.close(); db = null; };
  function schedule() { clearTimeout(timer); if (!disposed) timer = setTimeout(pump, 180); }
  async function pump() {
    if (disposed || !initialized || job || paused) return;
    if (document.hidden || isBusy()) { schedule(); return; }
    await idle();
    if (disposed || paused || job) return;
    if (document.hidden || isBusy()) { schedule(); return; }
    const asset = order.map(id => byId.get(id)).find(asset => !entries.has(asset.id) && !errors.has(asset.id));
    if (!asset) return;
    active = asset.name; validating = true; emit();
    job = (async () => {
      try {
        const key = (await fingerprint([asset])).get(asset.id);
        if (disposed) return;
        validating = false;
        let cached;
        if (db) try { cached = await transaction(db, 'readonly', store => store.get(asset.id)); } catch { storageFailed(); }
        if (disposed) return;
        if (cached?.fingerprint === key && cached.blob instanceof Blob && cached.blob.size && Number.isFinite(cached.stats?.triangles)) {
          remember(cached); reused++; return;
        }
        if (!order.includes(asset.id)) return;
        if (!renderer) {
          const { thumbnailRenderer } = await import('./preview.js');
          if (disposed || paused || !order.includes(asset.id)) return;
          renderer = thumbnailRenderer();
        }
        if (disposed || paused || !order.includes(asset.id) || document.hidden || isBusy()) return;
        const result = await renderer.capture(asset);
        if (disposed) return;
        const record = { id: asset.id, fingerprint: key, ...result, createdAt: Date.now() };
        remember(record); generated++;
        if (db) try { await transaction(db, 'readwrite', store => store.put(record)); } catch { storageFailed(); }
      } catch (error) { if (!disposed) errors.set(asset.id, error.message); }
    })();
    await job; job = null; active = ''; validating = false; emit(); schedule();
  }
  const api = {
    entries, errors,
    get state() { return { paused, validating: !initialized || validating, persistent, active, generated, reused, validationError: '',
      ready: entries.size, total: assets.length, requested: order.length, completed: order.filter(id => entries.has(id)).length,
      pending: order.filter(id => !entries.has(id) && !errors.has(id)).length,
      bytes: [...entries.values()].reduce((n, entry) => n + entry.blob.size, 0) }; },
    toggle() { paused = !paused; emit(); schedule(); },
    prioritize(ids) { order = [...new Set(ids)].filter(id => byId.has(id)); emit(); schedule(); },
    retry() { errors.clear(); fingerprint = createFingerprinter(); emit(); schedule(); },
    async regenerate() {
      paused = true; await job;
      if (disposed) return;
      if (db) try { await transaction(db, 'readwrite', store => store.clear()); } catch { storageFailed(); }
      // Reload so imported ES modules and new fingerprints agree.
      location.reload();
    },
    dispose() { disposed = true; clearTimeout(timer); db?.close(); for (const id of entries.keys()) forget(id); Promise.resolve(job).finally(() => renderer?.dispose()); },
  };
  (async () => {
    try {
      db = await openDatabase();
      if (disposed) { db.close(); return; }
      db.onversionchange = () => { storageFailed(); emit(); };
      // Prune IDs without reading every stored image into memory.
      const ids = await transaction(db, 'readonly', store => store.getAllKeys());
      if (disposed) return;
      const removed = ids.filter(id => !byId.has(id));
      if (removed.length) await transaction(db, 'readwrite', store => removed.forEach(id => store.delete(id)));
    } catch { storageFailed(); }
    initialized = true; emit(); schedule();
  })();
  return api;
}
