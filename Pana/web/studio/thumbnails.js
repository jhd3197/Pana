import { fingerprints } from './fingerprints.js';
import { thumbnailRenderer } from './preview.js';

const DB_NAME = 'pana-studio-previews';
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Caché bloqueada por otra pestaña.'));
  });
}
function transaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', mode), request = action(tx.objectStore('assets'));
    tx.oncomplete = () => resolve(request?.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
const idle = () => new Promise(resolve => {
  if ('requestIdleCallback' in window) requestIdleCallback(resolve, { timeout: 1000 }); else setTimeout(resolve, 30);
});

export function createThumbnails(assets, { onChange, isBusy = () => false }) {
  const entries = new Map(), errors = new Map();
  let db, renderer, keys, timer, job, epoch = 0, disposed = false, paused = false, validating = true, persistent = true, active = '', generated = 0, reused = 0, validationError = '', order = assets;
  const emit = () => { if (!disposed) onChange(api); };
  function forget(id) { const entry = entries.get(id); if (entry) URL.revokeObjectURL(entry.url); entries.delete(id); }
  function remember(record) { forget(record.id); entries.set(record.id, { ...record, url: URL.createObjectURL(record.blob) }); }
  function schedule() { clearTimeout(timer); if (!disposed) timer = setTimeout(pump, 180); }
  async function pump() {
    if (disposed || validating || job) return;
    const asset = order.find(a => !entries.has(a.id) && !errors.has(a.id));
    if (!asset || paused) return;
    if (document.hidden || isBusy()) { schedule(); return; }
    await idle(); if (disposed || paused || validating || job) return;
    if (document.hidden || isBusy()) { schedule(); return; }
    const token = epoch; active = asset.name; emit();
    job = (async () => {
      try {
        renderer ||= thumbnailRenderer(); const result = await renderer.capture(asset);
        if (disposed || token !== epoch) return;
        const record = { id: asset.id, fingerprint: keys?.get(asset.id), ...result, createdAt: Date.now() };
        remember(record); generated++;
        if (db && record.fingerprint) try { await transaction(db, 'readwrite', store => store.put(record)); } catch { persistent = false; db.close(); db = null; }
      } catch (error) { if (!disposed && token === epoch) errors.set(asset.id, error.message); }
    })();
    await job; job = null; active = ''; emit(); schedule();
  }
  async function validate() {
    validating = true; emit();
    let changed = false;
    try {
      const next = await fingerprints(assets);
      changed = !!keys && assets.some(asset => keys.get(asset.id) !== next.get(asset.id));
      keys = next; validationError = '';
      for (const [id, entry] of entries) if (entry.fingerprint !== keys.get(id)) forget(id);
      reused = entries.size;
    } catch (error) {
      validationError = error.message; keys = null;
      // Keep existing images visible, but don't call them verified or persist new ones.
      reused = 0;
    }
    validating = false; emit(); schedule();
    return changed;
  }
  const api = {
    entries, errors,
    get state() { return { paused, validating, persistent, active, generated, reused, validationError,
      ready: entries.size, total: assets.length, bytes: [...entries.values()].reduce((n, entry) => n + entry.blob.size, 0) }; },
    toggle() { paused = !paused; emit(); schedule(); },
    prioritize(ids) { const wanted = new Set(ids), byId = new Map(assets.map(asset => [asset.id, asset])); order = [...wanted].map(id => byId.get(id)).filter(Boolean).concat(assets.filter(a => !wanted.has(a.id))); },
    async regenerate() {
      if (validating) return;
      const wasPaused = paused; paused = true; epoch++; emit(); await job;
      if (disposed) return;
      for (const id of entries.keys()) forget(id); errors.clear(); generated = 0;
      if (db) try { await transaction(db, 'readwrite', store => store.clear()); } catch { persistent = false; db.close(); db = null; }
      const changed = await validate();
      // ES modules are cached for the page lifetime. Reload changed code before
      // labeling newly rendered images with its new fingerprint.
      if (changed) { location.reload(); return; }
      paused = wasPaused; emit(); schedule();
    },
    dispose() { disposed = true; epoch++; clearTimeout(timer); db?.close(); for (const id of entries.keys()) forget(id); Promise.resolve(job).finally(() => renderer?.dispose()); },
  };
  (async () => {
    try {
      db = await openDatabase();
      if (disposed) { db.close(); return; }
      db.onversionchange = () => { db?.close(); db = null; persistent = false; emit(); };
      const records = await transaction(db, 'readonly', store => store.getAll());
      if (disposed) return;
      const ids = new Set(assets.map(a => a.id));
      for (const record of records) if (ids.has(record.id) && record.blob instanceof Blob && record.blob.size && Number.isFinite(record.stats?.triangles)) remember(record);
      if (records.some(record => !ids.has(record.id))) await transaction(db, 'readwrite', store => { records.filter(record => !ids.has(record.id)).forEach(record => store.delete(record.id)); });
      emit();
    } catch { persistent = false; db?.close(); db = null; }
    if (!disposed) await validate();
  })();
  return api;
}
