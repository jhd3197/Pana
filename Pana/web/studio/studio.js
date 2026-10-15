import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ASSETS, CATEGORIES, sourcePath, assetContext } from './catalog.js';
import { createPreview, release, ownMaterials, inspect, fitCamera } from './preview.js';
import { createThumbnails } from './thumbnails.js';
import { updateStartup, previewSettled } from './startup.js';

const $ = id => document.getElementById(id), canvas = $('preview');
const stage = createPreview(canvas), { scene, camera, renderer } = stage;
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.autoRotateSpeed = 1.2; controls.maxPolarAngle = Math.PI * 0.54;
let current = null, selected = '', category = 'Todos', generation = 0, stopped = false, loading = true;
let bounds = new THREE.Box3(), grid, wireframe = false, thumbnails, lastInput = 0, renderNeeded = true, animated = false;
const nodes = new Map(), number = value => value.toLocaleString('es');
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const resize = () => {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  renderNeeded = true;
};
const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
const interacted = () => { lastInput = performance.now(); };
document.addEventListener('pointerdown', interacted); document.addEventListener('keydown', interacted); document.addEventListener('wheel', interacted, { passive: true });

function frame() {
  if (!current) return;
  const { center, distance } = fitCamera(camera, bounds, current.map, $('camera-view').value);
  controls.target.copy(center); controls.minDistance = distance * 0.15; controls.maxDistance = distance * 4;
  controls.enableDamping = false; controls.update(); controls.enableDamping = true;
  renderNeeded = true;
}
function updateGrid() {
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
  const size = bounds.getSize(new THREE.Vector3()), step = 10 ** Math.floor(Math.log10(Math.max(1, size.x, size.z)));
  grid = new THREE.GridHelper(step * 20, 20, '#a1aaa0', '#d2d8ce');
  grid.material.transparent = true; grid.material.opacity = 0.35;
  grid.position.y = bounds.min.y - 0.01; grid.visible = $('grid').getAttribute('aria-pressed') === 'true';
  scene.add(grid); $('grid-scale').textContent = 'Cuadrícula ' + number(step) + ' u · XYZ';
}
function assetNode(asset) {
  if (nodes.has(asset.id)) return nodes.get(asset.id);
  const button = document.createElement('button'); button.className = 'asset'; button.dataset.asset = asset.id; button.title = asset.name + '\n' + sourcePath(asset.source);
  const thumb = document.createElement('span'); thumb.className = 'thumbnail'; thumb.setAttribute('aria-hidden', 'true');
  const placeholder = document.createElement('span'); placeholder.textContent = 'Pendiente'; thumb.append(placeholder);
  const label = document.createElement('span'); label.className = 'asset-label';
  const title = document.createElement('strong'); title.textContent = asset.name;
  const id = document.createElement('small'); id.textContent = asset.id;
  const meta = document.createElement('span'); meta.className = 'asset-meta';
  const type = document.createElement('span'); type.textContent = asset.category;
  const triangles = document.createElement('span'); triangles.className = 'tri-count'; triangles.textContent = '— tri';
  meta.append(type, triangles); label.append(title, id, meta); button.append(thumb, label);
  button.onclick = () => select(asset.id); nodes.set(asset.id, button); return button;
}
function updateThumbnails(service) {
  for (const [id, button] of nodes) {
    const entry = service.entries.get(id), thumb = button.querySelector('.thumbnail');
    if (entry) {
      if (thumb.dataset.url !== entry.url) {
        const img = document.createElement('img'); img.src = entry.url; img.alt = ''; img.loading = 'lazy'; img.width = 320; img.height = 240;
        // Adjacent asset name provides the accessible label; this image is its preview.
        thumb.replaceChildren(img); thumb.dataset.url = entry.url;
      }
      button.querySelector('.tri-count').textContent = number(entry.stats.triangles) + ' tri';
    } else {
      const status = service.errors.has(id) ? 'Error de vista previa' : 'Pendiente';
      if (thumb.dataset.url || thumb.textContent !== status) {
        delete thumb.dataset.url; const text = document.createElement('span'); text.textContent = status; thumb.replaceChildren(text);
      }
      button.querySelector('.tri-count').textContent = '— tri';
    }
  }
}
function renderList() {
  const query = normalize($('search').value);
  const matches = ASSETS.filter(a => (category === 'Todos' || a.category === category) &&
    normalize([a.name, a.id, a.source, ...a.usedBy, ...(a.tags || [])].join(' ')).includes(query));
  if ($('sort').value === 'name') matches.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if ($('sort').value === 'triangles') matches.sort((a, b) => (thumbnails?.entries.get(b.id)?.stats.triangles ?? -1) - (thumbnails?.entries.get(a.id)?.stats.triangles ?? -1));
  const focus = document.activeElement?.dataset.asset;
  $('asset-list').replaceChildren(...matches.map(asset => { const button = assetNode(asset); button.setAttribute('aria-pressed', String(selected === asset.id)); return button; }));
  if (focus && matches.some(a => a.id === focus)) nodes.get(focus).focus({ preventScroll: true });
  $('asset-list').hidden = matches.length === 0; $('empty').hidden = matches.length > 0;
  $('result-count').textContent = matches.length + ' recursos';
  document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
  thumbnails?.prioritize([selected, ...matches.map(a => a.id)]); if (thumbnails) updateThumbnails(thumbnails);
}
async function select(id) {
  const asset = ASSETS.find(a => a.id === id) || ASSETS[0]; id = asset.id;
  const ticket = ++generation; selected = id; loading = true;
  $('settings-link').href = '/studio/settings.html?asset=' + encodeURIComponent(id);
  history.replaceState(null, '', '#' + encodeURIComponent(id)); renderList();
  $('asset-category').textContent = asset.category; $('asset-id').textContent = asset.id; $('asset-name').textContent = asset.name;
  $('description').textContent = asset.description || ''; $('used-by').textContent = asset.usedBy.join(' · ');
  $('source').href = asset.source; $('source').textContent = sourcePath(asset.source); $('factory').textContent = asset.factory;
  $('edit-character').hidden = !['Personajes', 'Vestuario'].includes(asset.category); $('open-game').hidden = !asset.game; $('open-game').href = asset.game || '#';
  $('preview-status').hidden = false; $('preview-status').classList.remove('error'); $('preview-status').textContent = 'Preparando la vista 3D…';
  for (const name of ['dimensions', 'geometry', 'vertices', 'materials', 'textures']) $(name).textContent = '—';
  $('copy-status').textContent = ''; release(current); current = null;
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  let runtime;
  try {
    if (ticket !== generation || stopped) return;
    runtime = await asset.build();
    if (ticket !== generation || stopped) { release(runtime); return; }
    ownMaterials(runtime, wireframe); runtime.map = asset.category === 'Mapas'; runtime.update?.(0, 0); scene.add(runtime.group);
    const result = inspect(runtime); bounds = result.frameBounds;
    const stats = result.stats;
    $('dimensions').textContent = stats.dimensions.map(n => n.toFixed(2)).join(' × ') + ' u';
    $('geometry').textContent = number(stats.triangles) + ' tri · ' + number(stats.meshes) + ' mallas';
    for (const name of ['vertices', 'materials', 'textures']) $(name).textContent = number(stats[name]);
    current = runtime; updateGrid(); frame(); $('preview-status').hidden = true;
  } catch (error) {
    release(runtime); if (ticket !== generation) return; current = null;
    $('preview-status').classList.add('error'); $('preview-status').textContent = 'No se pudo abrir este recurso: ' + error.message;
    console.error(error);
  } finally { if (ticket === generation) { loading = false; previewSettled(); } }
}
function cacheStatus(service) {
  updateThumbnails(service);
  updateStartup(service);
  if ($('sort').value === 'triangles') renderList();
}
$('categories').replaceChildren(...CATEGORIES.map(name => {
  const button = document.createElement('button'); button.textContent = name; button.dataset.category = name;
  button.onclick = () => { category = name; renderList(); }; return button;
}));
$('search').addEventListener('input', renderList); $('sort').onchange = renderList;
document.querySelector('.skip-link').onclick = event => { event.preventDefault(); $('asset-list').focus(); };
$('clear-search').onclick = () => { category = 'Todos'; $('search').value = ''; renderList(); };
for (const view of ['grid', 'list']) $('view-' + view).onclick = () => {
  $('asset-list').classList.toggle('list', view === 'list');
  for (const option of ['grid', 'list']) $('view-' + option).setAttribute('aria-pressed', String(option === view));
};
$('frame').onclick = frame; $('camera-view').onchange = frame;
$('grid').onclick = () => { const enabled = $('grid').getAttribute('aria-pressed') !== 'true'; $('grid').setAttribute('aria-pressed', String(enabled)); if (grid) grid.visible = enabled; renderNeeded = true; };
$('animate').onclick = () => { animated = !animated; $('animate').setAttribute('aria-pressed', String(animated)); renderNeeded = true; };
$('rotate').onclick = () => { controls.autoRotate = !controls.autoRotate; $('rotate').setAttribute('aria-pressed', String(controls.autoRotate)); };
$('wireframe').onclick = () => {
  wireframe = !wireframe; $('wireframe').setAttribute('aria-pressed', String(wireframe));
  current?.group.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) m.wireframe = wireframe; });
  renderNeeded = true;
};
controls.addEventListener('change', () => { renderNeeded = true; });
controls.addEventListener('start', () => { controls.autoRotate = false; $('rotate').setAttribute('aria-pressed', 'false'); });
document.addEventListener('keydown', event => {
  if ($('studio-app').inert) return;
  if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === '/') { event.preventDefault(); $('search').focus(); }
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); frame(); }
});
async function copy(text) {
  try { await navigator.clipboard.writeText(text); $('copy-status').textContent = 'Copiado.'; }
  catch { $('copy-status').textContent = 'No se pudo copiar. Selecciona la ruta o exporta el inventario.'; }
}
$('copy-path').onclick = () => copy(sourcePath(ASSETS.find(a => a.id === selected).source));
$('copy-context').onclick = () => copy(assetContext(ASSETS.find(a => a.id === selected)));
$('export').onclick = () => {
  const inventory = ASSETS.map(({ build, source, ...asset }) => ({ ...asset, source: sourcePath(source), metrics: thumbnails?.entries.get(asset.id)?.stats || null }));
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schema: 2, assets: inventory }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'pana-studio-inventario.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
let previous = performance.now(), time = 0;
function tick(now) {
  if (stopped) return;
  const dt = Math.min(0.05, (now - previous) / 1000); previous = now; time += dt;
  if (!document.hidden) {
    if (animated) { current?.update?.(time, dt); renderNeeded = true; }
    controls.update();
    if (renderNeeded) {
      renderer.render(scene, camera); renderNeeded = false;
      $('draw-calls').textContent = renderer.info.render.calls + ' draw calls · visor';
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
function selectFromHash() {
  let id = 'pana'; try { id = decodeURIComponent(location.hash.slice(1)) || id; } catch { /* Malformed links use the default asset. */ }
  if (id === 'track-playa') { id = 'track-bululu'; history.replaceState(null, '', '#track-bululu'); }
  select(id);
}
selectFromHash(); addEventListener('hashchange', selectFromHash);
thumbnails = createThumbnails(ASSETS, { onChange: cacheStatus, isBusy: () => loading || performance.now() - lastInput < 700 });
thumbnails.prioritize([selected, ...ASSETS.map(asset => asset.id)]);
addEventListener('pagehide', event => {
  if (event.persisted) return;
  stopped = true; generation++; observer.disconnect(); controls.dispose(); release(current); thumbnails.dispose();
  if (grid) { grid.geometry.dispose(); grid.material.dispose(); } stage.dispose();
});
window.panaLibrary = { assets: ASSETS, renderer, scene, camera, thumbnails, get selected() { return selected; }, get current() { return current; } };
