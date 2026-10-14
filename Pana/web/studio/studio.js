import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ASSETS, CATEGORIES, sourcePath, assetContext } from './catalog.js';

const $ = id => document.getElementById(id), canvas = $('preview');
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.01, 12000);
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1; renderer.outputColorSpace = THREE.SRGBColorSpace;
const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = pmrem.fromScene(room, 0.04);
scene.environment = environment.texture; room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fff4df', '#b79d81', 1.5));
const key = new THREE.DirectionalLight('#fff2df', 2.3); key.position.set(-3.5, 7, 5); scene.add(key);
const fill = new THREE.DirectionalLight('#edf2ff', 1); fill.position.set(4, 3, -4); scene.add(fill);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 1.2; controls.maxPolarAngle = Math.PI * 0.54;
let current = null, selected = '', category = 'Todos', generation = 0, stopped = false, bounds = new THREE.Box3(), wireframe = false;
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

function release(runtime) {
  if (!runtime) return;
  const geometries = new Set(), materials = new Set(), owned = [];
  runtime.group.traverse(o => { if (o.userData.dispose) owned.push(o.userData.dispose); if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
  runtime.dispose?.(); owned.forEach(dispose => dispose());
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); runtime.group.removeFromParent();
}
function frame() {
  if (!current) return;
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const distance = Math.max(size.y, size.x / camera.aspect, size.z * 0.7) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.45;
  controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(-0.58, current.map ? 0.95 : 0.25, 1).normalize().multiplyScalar(distance));
  controls.minDistance = distance * 0.15; controls.maxDistance = distance * 4; camera.near = Math.max(0.01, distance / 2000); camera.far = Math.max(100, distance * 12); camera.updateProjectionMatrix();
  controls.enableDamping = false; controls.update(); controls.enableDamping = true;
}
function renderList() {
  const query = normalize($('search').value);
  const matches = ASSETS.filter(a => (category === 'Todos' || a.category === category) && normalize([a.name, a.id, a.source, ...a.usedBy, ...(a.tags || [])].join(' ')).includes(query));
  $('asset-list').replaceChildren(...matches.map(asset => {
    const button = document.createElement('button'); button.className = 'asset'; button.dataset.asset = asset.id; button.setAttribute('aria-pressed', String(selected === asset.id));
    const mark = document.createElement('span'); mark.className = 'asset-mark'; mark.textContent = { Personajes: 'Pa', Vestuario: 'Ve', Objetos: 'Ob', Vegetación: 'Na', Vehículos: 'Au', Mapas: 'Ma' }[asset.category]; mark.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'), title = document.createElement('strong'), detail = document.createElement('small'); title.textContent = asset.name; detail.textContent = asset.category;
    label.append(title, detail); const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true'); button.append(mark, label, arrow);
    button.onclick = () => select(asset.id); return button;
  }));
  $('result-count').textContent = `${matches.length} recursos`; $('empty').hidden = matches.length > 0;
  document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
}
async function select(id) {
  const asset = ASSETS.find(a => a.id === id) || ASSETS[0]; id = asset.id;
  const ticket = ++generation; selected = id; history.replaceState(null, '', `#${encodeURIComponent(id)}`); renderList();
  $('asset-category').textContent = asset.category; $('asset-name').textContent = asset.name;
  $('description').textContent = asset.description || ''; $('used-by').textContent = asset.usedBy.join(' · ');
  $('source').href = asset.source; $('source').textContent = sourcePath(asset.source); $('factory').textContent = asset.factory;
  $('edit-character').hidden = !['Personajes', 'Vestuario'].includes(asset.category); $('open-game').hidden = !asset.game; $('open-game').href = asset.game || '#';
  $('preview-status').hidden = false; $('preview-status').classList.remove('error'); $('preview-status').textContent = 'Preparando la vista 3D…';
  $('dimensions').textContent = '—'; $('geometry').textContent = '—'; $('copy-status').textContent = '';
  release(current); current = null;
  // Give the loading label a frame before constructing large procedural maps.
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
    const runtime = await asset.build();
    if (ticket !== generation || stopped) { release(runtime); return; }
    runtime.map = asset.category === 'Mapas'; current = runtime;
    // Factory materials may be cached by the kit. Preview controls own their copies.
    const clones = new Map(); runtime.group.traverse(o => { if (!o.material) return; const own = m => { if (!clones.has(m)) { const copy = m.clone(); copy.wireframe = wireframe; clones.set(m, copy); } return clones.get(m); }; o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material); });
    scene.add(runtime.group); runtime.group.updateMatrixWorld(true);
    bounds = new THREE.Box3(); runtime.group.traverseVisible(o => { if (o.isMesh) bounds.union(new THREE.Box3().setFromObject(o)); });
    if (runtime.bounds) bounds.copy(runtime.bounds);
    const dimensions = bounds.getSize(new THREE.Vector3()); $('dimensions').textContent = `${dimensions.x.toFixed(2)} × ${dimensions.y.toFixed(2)} × ${dimensions.z.toFixed(2)} u`;
    let triangles = 0, meshes = 0; runtime.group.traverseVisible(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; } });
    $('geometry').textContent = `${Math.round(triangles).toLocaleString('es')} triángulos · ${meshes} mallas`;
    frame(); $('preview-status').hidden = true;
  } catch (error) { if (ticket !== generation) return; $('preview-status').classList.add('error'); $('preview-status').textContent = `No se pudo abrir este recurso: ${error.message}`; console.error(error); }
}
$('total').textContent = `${ASSETS.length} recursos`;
$('categories').replaceChildren(...CATEGORIES.map(name => { const button = document.createElement('button'); button.textContent = name; button.dataset.category = name; button.setAttribute('aria-pressed', String(category === name)); button.onclick = () => { category = name; renderList(); }; return button; }));
$('search').addEventListener('input', renderList);
$('clear-search').onclick = () => { category = 'Todos'; $('search').value = ''; renderList(); };
$('frame').onclick = frame;
$('rotate').onclick = () => { controls.autoRotate = !controls.autoRotate; $('rotate').setAttribute('aria-pressed', String(controls.autoRotate)); };
$('wireframe').onclick = () => { wireframe = !wireframe; $('wireframe').setAttribute('aria-pressed', String(wireframe)); current?.group.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) m.wireframe = wireframe; }); };
async function copy(text) { try { await navigator.clipboard.writeText(text); $('copy-status').textContent = 'Copiado.'; } catch { $('copy-status').textContent = 'El navegador no permitió copiar. Selecciona la ruta o exporta el inventario.'; } }
$('copy-path').onclick = () => copy(sourcePath(ASSETS.find(a => a.id === selected).source));
$('copy-context').onclick = () => copy(assetContext(ASSETS.find(a => a.id === selected)));
$('export').onclick = () => {
  const inventory = ASSETS.map(({ build, source, ...asset }) => ({ ...asset, source: sourcePath(source) }));
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schema: 1, assets: inventory }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'pana-studio-inventario.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
let previous = performance.now(), time = 0;
function tick(now) { if (stopped) return; const dt = Math.min(0.05, (now - previous) / 1000); previous = now; time += dt; if (!document.hidden) { current?.update?.(time, dt); controls.update(); renderer.render(scene, camera); } requestAnimationFrame(tick); }
requestAnimationFrame(tick);
function selectFromHash() {
  let id = 'pana'; try { id = decodeURIComponent(location.hash.slice(1)) || id; } catch { /* Fall back for malformed links. */ }
  select(id);
}
selectFromHash();
addEventListener('hashchange', selectFromHash);
addEventListener('pagehide', event => { if (event.persisted) return; stopped = true; generation++; observer.disconnect(); controls.dispose(); release(current); environment.texture.dispose(); renderer.dispose(); });
window.panaLibrary = { assets: ASSETS, renderer, scene, camera, get selected() { return selected; }, get current() { return current; } };
