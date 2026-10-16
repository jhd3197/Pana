import { ASSETS, CATEGORIES, sourcePath, assetContext } from './catalog.js';
import { createThumbnails } from './thumbnails.js';
import { previewSettled } from './startup.js';
import { readRoute, assetURL, libraryURL, filterAssets } from './routes.js';

const $ = id => document.getElementById(id), byId = new Map(ASSETS.map(asset => [asset.id, asset]));
const nodes = new Map(), workset = new Set(), storageKey = 'pana:studio:workset:v1';
let route, params, matches = [], inspector, inspectorPromise, navigation = 0, lastInput = 0, stopped = false;
let listScroll = 0;
try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(saved)) saved.forEach(id => { if (byId.has(id)) workset.add(id); }); } catch { /* Keep a usable session when storage is blocked. */ }
const number = n => n.toLocaleString('es');
const thumbnails = createThumbnails(ASSETS, { onChange: cacheStatus, isBusy: () => inspector?.loading || inspector?.tour.playing || performance.now() - lastInput < 500 });
for (const event of ['pointerdown', 'keydown', 'wheel']) document.addEventListener(event, () => { lastInput = performance.now(); }, { passive: true });
function assetSearch() { const search = new URLSearchParams(params); if (route.page === 'workspace') search.set('workspace', '1'); return search.size ? '?' + search : ''; }
function persistWorkset() {
  try { localStorage.setItem(storageKey, JSON.stringify([...workset])); $('workspace-status').textContent = ''; }
  catch { $('workspace-status').textContent = 'Selección guardada solo durante esta sesión: el almacenamiento local no está disponible.'; }
  updateWorkset();
}
function updateWorkset() {
  $('workspace-count').textContent = workset.size;
  for (const [id, node] of nodes) {
    const pin = node.querySelector('.asset-pin'); pin.setAttribute('aria-pressed', String(workset.has(id)));
    pin.textContent = workset.has(id) ? 'Quitar de selección' : 'Añadir a selección';
  }
  const pinned = workset.has(route?.id);
  $('pin-asset').setAttribute('aria-pressed', String(pinned)); $('pin-asset').textContent = pinned ? 'Quitar de mi selección' : 'Añadir a mi selección';
}
function toggleAsset(id) { if (workset.has(id)) workset.delete(id); else workset.add(id); persistWorkset(); if (route.page === 'workspace') renderList(); }
function assetNode(asset) {
  if (!nodes.has(asset.id)) {
    const card = document.createElement('article'); card.className = 'asset-card';
    const link = document.createElement('a'); link.className = 'asset'; link.dataset.asset = asset.id; link.dataset.route = '';
    const thumb = document.createElement('span'); thumb.className = 'thumbnail'; thumb.setAttribute('aria-hidden', 'true');
    const placeholder = document.createElement('span'); placeholder.textContent = asset.category; thumb.append(placeholder);
    const label = document.createElement('span'); label.className = 'asset-label';
    const title = document.createElement('strong'); title.textContent = asset.name;
    const id = document.createElement('small'); id.textContent = asset.id;
    const meta = document.createElement('span'); meta.className = 'asset-meta';
    const type = document.createElement('span'); type.textContent = asset.category;
    const triangles = document.createElement('span'); triangles.className = 'tri-count'; triangles.textContent = 'Sin medir';
    meta.append(type, triangles); label.append(title, id, meta); link.append(thumb, label);
    const pin = document.createElement('button'); pin.className = 'asset-pin'; pin.setAttribute('aria-label', 'Seleccionar ' + asset.name); pin.onclick = () => toggleAsset(asset.id);
    card.append(link, pin); nodes.set(asset.id, card);
  }
  const card = nodes.get(asset.id); card.querySelector('a').href = assetURL(asset.id, assetSearch()); return card;
}
function updateThumbnails(service) {
  for (const [id, card] of nodes) {
    const entry = service.entries.get(id), thumb = card.querySelector('.thumbnail');
    if (entry) {
      if (thumb.dataset.url !== entry.url) {
        const img = document.createElement('img'); img.src = entry.url; img.alt = ''; img.loading = 'lazy'; img.width = 320; img.height = 240;
        thumb.replaceChildren(img); thumb.dataset.url = entry.url;
      }
      card.querySelector('.tri-count').textContent = number(entry.stats.triangles) + ' tri';
    } else {
      const status = service.errors.has(id) ? 'Vista no disponible' : byId.get(id).category;
      if (thumb.dataset.url || thumb.textContent !== status) { delete thumb.dataset.url; const text = document.createElement('span'); text.textContent = status; thumb.replaceChildren(text); }
      card.querySelector('.tri-count').textContent = 'Sin medir';
    }
  }
}
function renderList() {
  matches = filterAssets(ASSETS, params, workset, route.page === 'workspace');
  if (params.get('sort') === 'name') matches.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (params.get('sort') === 'triangles') matches.sort((a, b) => (thumbnails.entries.get(b.id)?.stats.triangles ?? -1) - (thumbnails.entries.get(a.id)?.stats.triangles ?? -1));
  const focused = document.activeElement?.closest('.asset-card'), focusedId = focused?.querySelector('[data-asset]')?.dataset.asset;
  const pinFocused = document.activeElement?.classList.contains('asset-pin');
  $('asset-list').replaceChildren(...matches.map(assetNode));
  if (focusedId && matches.some(a => a.id === focusedId)) nodes.get(focusedId).querySelector(pinFocused ? 'button' : 'a').focus({ preventScroll: true });
  $('asset-list').hidden = matches.length === 0; $('empty').hidden = matches.length > 0;
  $('result-count').textContent = matches.length + ' de ' + ASSETS.length + ' recursos';
  $('prepare-results').disabled = !matches.length; $('add-results').disabled = !matches.length; $('export').disabled = !matches.length;
  $('prepare-results').textContent = 'Preparar ' + matches.length + ' miniaturas';
  $('asset-list').classList.toggle('list', (params.get('view') || 'list') === 'list');
  for (const view of ['grid','list']) $('view-' + view).setAttribute('aria-pressed', String((params.get('view') || 'list') === view));
  document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === (params.get('category') || 'Todos'))));
  updateWorkset(); updateThumbnails(thumbnails);
}
function cacheStatus(service) {
  updateThumbnails(service);
  const state = service.state;
  $('cache-status').textContent = state.active ? (state.validating ? 'Comprobando ' : 'Preparando ') + state.active + ' · ' + state.completed + '/' + state.requested :
    state.requested ? state.completed + ' de ' + state.requested + ' miniaturas listas' : 'Miniaturas a demanda. Prepara solo los resultados que necesites.';
  if (!state.persistent) $('cache-status').textContent += ' · Caché solo para esta sesión';
  if (service.errors.size) $('cache-status').textContent += ' · ' + service.errors.size + ' errores';
  $('retry-thumbnails').hidden = !service.errors.size;
  $('pause-thumbnails').hidden = !state.pending && !state.active;
  $('pause-thumbnails').textContent = state.paused ? 'Continuar' : 'Pausar';
  if (params?.get('sort') === 'triangles') renderList();
}
function syncFilters() {
  for (const [id, key] of [['search','q'],['game-filter','game'],['pack-filter','pack'],['sort','sort']]) $(id).value = params.get(key) || (key === 'sort' ? 'catalog' : '');
}
function filterChange(key, value, replace = false) {
  const next = new URLSearchParams(params); if (value && value !== 'Todos') next.set(key, value); else next.delete(key);
  navigate(libraryURL(next, route.page === 'workspace'), replace, false);
}
async function openAsset(asset, ticket) {
  $('asset-name').textContent = asset.name; $('asset-category').textContent = asset.category; $('asset-id').textContent = asset.id;
  $('asset-location').textContent = asset.category + ' / ' + asset.name;
  $('description').textContent = asset.description || '';
  $('used-by').replaceChildren(...asset.usedBy.map((game, index) => {
    const link = document.createElement('a'); link.href = '/studio/library?game=' + encodeURIComponent(game); link.dataset.route = ''; link.textContent = game + (index < asset.usedBy.length - 1 ? ' · ' : ''); return link;
  }));
  $('source').href = asset.source; $('source').textContent = sourcePath(asset.source); $('factory').textContent = asset.factory;
  $('edit-character').hidden = !['Personajes','Vestuario'].includes(asset.category); $('open-game').hidden = !asset.game; $('open-game').href = asset.game || '/';
  $('dependencies').replaceChildren(...(asset.dependencies || []).map(path => { const li = document.createElement('li'), link = document.createElement('a'); link.href = path; link.target = '_blank'; link.rel = 'noopener'; link.textContent = sourcePath(path); li.append(link); return li; }));
  if (!asset.dependencies?.length) { const li = document.createElement('li'); li.textContent = 'Sin dependencias adicionales declaradas.'; $('dependencies').append(li); }
  const related = ASSETS.filter(other => other.id !== asset.id && other.source === asset.source);
  $('related-assets').replaceChildren(...related.map(other => { const link = document.createElement('a'); link.dataset.route = ''; link.href = assetURL(other.id, assetSearch()); link.textContent = other.name; return link; }));
  if (!related.length) $('related-assets').textContent = 'Este recurso tiene su propia fuente.';
  $('copy-status').textContent = ''; $('preview-status').hidden = false; $('preview-status').classList.remove('error'); $('preview-status').textContent = 'Preparando la vista 3D…'; $('retry-preview').hidden = true;
  for (const name of ['dimensions','geometry','vertices','materials','textures']) $(name).textContent = '—';
  try {
    inspectorPromise ||= import('./inspector.js');
    const module = await inspectorPromise;
    if (ticket !== navigation || stopped) return;
    inspector ||= module.createInspector({ copy });
    await inspector.select(asset);
  } catch (error) {
    inspectorPromise = null;
    if (ticket !== navigation) return;
    $('preview-status').classList.add('error'); $('preview-status').textContent = 'No se pudo abrir el visor: ' + error.message; $('retry-preview').hidden = false;
  }
}
function renderRoute(focus = false) {
  const ticket = ++navigation; route = readRoute(new URL(location.href)); params = new URLSearchParams(location.search);
  const canonical = route.page === 'asset' ? assetURL(route.id, location.search) : libraryURL(params, route.page === 'workspace');
  if (location.pathname === '/studio.html' || location.pathname === '/studio' || location.pathname === '/studio/' || (route.page === 'asset' && !location.pathname.includes(encodeURIComponent(route.id)))) history.replaceState(null, '', canonical);
  const asset = route.page === 'asset' ? byId.get(route.id) : null;
  inspector?.clear(); thumbnails.prioritize([]);
  document.body.dataset.page = asset ? 'asset' : route.page === 'asset' || route.page === 'missing' ? 'missing' : route.page;
  document.querySelector('.library').hidden = !['library','workspace'].includes(route.page);
  document.querySelector('.workbench').hidden = !asset;
  $('missing-asset').hidden = document.body.dataset.page !== 'missing';
  $('missing-id').textContent = 'No existe el ID «' + route.id + '». Revisa el enlace o busca en la biblioteca.';
  for (const name of ['library','workspace']) { const link = $('nav-' + name); if (route.page === name) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); }
  $('library-title').textContent = route.page === 'workspace' ? 'Mi selección' : 'Biblioteca';
  $('library-description').textContent = route.page === 'workspace' ? 'Tu conjunto de trabajo, guardado en este navegador. Añadir recursos no los coloca en un mapa.' : 'Explora modelos compartidos, mapas y personajes. Abre solo lo que necesitas.';
  $('clear-workspace').hidden = route.page !== 'workspace' || !workset.size;
  $('add-results').hidden = route.page === 'workspace';
  $('back-library').href = libraryURL(params, params.get('workspace') === '1');
  $('back-library').textContent = params.get('workspace') === '1' ? '← Mi selección' : '← Biblioteca';
  $('settings-link').href = '/studio/settings?return=' + encodeURIComponent(location.pathname + location.search);
  document.title = (asset ? asset.name : route.page === 'workspace' ? 'Mi selección' : route.page === 'asset' ? 'Recurso no encontrado' : 'Biblioteca') + ' · Pana Studio';
  syncFilters(); renderList(); previewSettled();
  if (asset) openAsset(asset, ticket); else $('asset-list').scrollTop = listScroll;
  if (focus) { const target = asset ? $('asset-name') : $('library-title'); target.tabIndex = -1; target.focus({ preventScroll: true }); }
}
function navigate(url, replace = false, focus = true) {
  if (['library','workspace'].includes(route?.page)) listScroll = $('asset-list').scrollTop;
  history[replace ? 'replaceState' : 'pushState'](null, '', url); renderRoute(focus);
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-route]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); navigate(link.href);
});
addEventListener('popstate', () => renderRoute(true));
addEventListener('hashchange', () => { if (location.hash) { const legacy = readRoute(new URL('/studio.html' + location.hash, location.origin)); navigate(assetURL(legacy.id), true); } });
$('categories').replaceChildren(...CATEGORIES.map(name => { const button = document.createElement('button'); button.textContent = name; button.dataset.category = name; button.onclick = () => filterChange('category', name); return button; }));
for (const [id, values] of [['game-filter', [...new Set(ASSETS.flatMap(asset => asset.usedBy))]], ['pack-filter', [...new Set(ASSETS.map(asset => asset.pack).filter(Boolean))]]]) {
  for (const value of values.sort((a,b) => a.localeCompare(b,'es'))) { const option = document.createElement('option'); option.value = value; option.textContent = value; $(id).append(option); }
}
$('search').oninput = () => filterChange('q', $('search').value, true);
$('game-filter').onchange = () => filterChange('game', $('game-filter').value);
$('pack-filter').onchange = () => filterChange('pack', $('pack-filter').value);
$('sort').onchange = () => filterChange('sort', $('sort').value);
for (const view of ['grid','list']) $('view-' + view).onclick = () => filterChange('view', view);
$('clear-search').onclick = () => navigate(libraryURL('', route.page === 'workspace'));
$('pin-asset').onclick = () => toggleAsset(route.id);
$('add-results').onclick = () => { matches.forEach(asset => workset.add(asset.id)); persistWorkset(); };
$('clear-workspace').onclick = () => { workset.clear(); persistWorkset(); renderRoute(); };
$('prepare-results').onclick = () => { if (thumbnails.state.paused) thumbnails.toggle(); thumbnails.prioritize(matches.map(asset => asset.id)); };
$('pause-thumbnails').onclick = () => thumbnails.toggle();
$('retry-thumbnails').onclick = () => thumbnails.retry();
$('retry-preview').onclick = () => { const asset = byId.get(route.id); if (asset) openAsset(asset, ++navigation); };
document.querySelector('.skip-link').onclick = event => { event.preventDefault(); (route.page === 'asset' ? $('preview') : $('asset-list')).focus(); };
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === '/' && ['library','workspace'].includes(route.page)) { event.preventDefault(); $('search').focus(); }
});
async function copy(text) {
  try { await navigator.clipboard.writeText(text); $('copy-status').textContent = 'Copiado.'; return true; }
  catch { $('copy-status').textContent = 'No se pudo copiar. Selecciona la ruta o exporta los resultados.'; return false; }
}
$('copy-link').onclick = () => copy(location.origin + assetURL(route.id));
$('copy-path').onclick = () => copy(sourcePath(byId.get(route.id).source));
$('copy-context').onclick = () => copy(assetContext(byId.get(route.id)));
$('export').onclick = () => {
  const inventory = matches.map(({ build, source, ...asset }) => ({ ...asset, source: sourcePath(source), url: assetURL(asset.id), metrics: thumbnails.entries.get(asset.id)?.stats || null }));
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schema: 3, scope: route.page, filters: Object.fromEntries(params), assets: inventory }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'pana-studio-seleccion.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
renderRoute();
addEventListener('pagehide', event => { if (event.persisted) return; stopped = true; navigation++; inspector?.dispose(); thumbnails.dispose(); });
window.panaLibrary = { assets: ASSETS, thumbnails, get selected() { return route.id; }, get current() { return inspector?.current; }, get renderer() { return inspector?.renderer; }, get scene() { return inspector?.scene; }, get camera() { return inspector?.camera; }, get tour() { return inspector?.tour; } };
