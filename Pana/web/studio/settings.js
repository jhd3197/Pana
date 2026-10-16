import { openDatabase, transaction } from './cache-store.js';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search), asset = params.get('asset'), back = params.get('return');
// Only allow known local Studio destinations in return links.
const inventoryURL = back && /^\/studio\/(library|workspace|assets\/[^/?#]+)(\?[^#]*)?$/.test(back) ? back : asset ? '/studio/assets/' + encodeURIComponent(asset) : '/studio/library';
$('inventory-link').href = inventoryURL;
function busy(value) { $('cache-clear').disabled = value; $('cache-rebuild').disabled = value; }
async function withStore(mode, action) {
  const db = await openDatabase();
  try { return await transaction(db, mode, action); } finally { db.close(); }
}
async function refresh() {
  const records = await withStore('readonly', store => store.getAll());
  const valid = records.filter(record => record.blob instanceof Blob && record.blob.size);
  const bytes = valid.reduce((sum, record) => sum + record.blob.size, 0);
  const newest = Math.max(0, ...valid.map(record => record.createdAt || 0));
  $('cache-count').textContent = String(valid.length);
  $('cache-size').textContent = (bytes / 1048576).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MB';
  $('cache-updated').textContent = newest ? new Date(newest).toLocaleString('es') : 'Sin miniaturas guardadas';
  busy(false); $('cache-clear').disabled = valid.length === 0;
}
async function clear(rebuild) {
  busy(true); $('cache-status').textContent = 'Vaciando caché…';
  try {
    await withStore('readwrite', store => store.clear());
    if (rebuild) { location.assign(inventoryURL); return; }
    await refresh(); $('cache-status').textContent = 'Caché vacía. Prepara los resultados que necesites desde la biblioteca.';
  } catch (error) { busy(false); $('cache-status').textContent = 'No se pudo vaciar la caché: ' + error.message; }
}
$('cache-clear').onclick = () => clear(false);
$('cache-rebuild').onclick = () => clear(true);
refresh().then(() => { $('cache-status').textContent = ''; }).catch(error => {
  $('cache-status').textContent = 'El almacenamiento local no está disponible. El estudio puede generar las miniaturas para esta sesión. ' + error.message;
});
