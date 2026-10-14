// Thumbnail persistence is shared with settings, which does not initialize WebGL.
export const DB_NAME = 'pana-studio-previews';
export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    let rejected = false;
    request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'id' });
    request.onsuccess = () => { if (rejected) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { rejected = true; reject(new Error('Caché bloqueada por otra pestaña.')); };
  });
}
export function transaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', mode), request = action(tx.objectStore('assets'));
    tx.oncomplete = () => resolve(request?.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
