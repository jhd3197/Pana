import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createPreview, release, ownMaterials, inspect, fitCamera } from './preview.js';
import { createTrackTour } from './track-tour.js';

export function createInspector({ copy }) {
  const $ = id => document.getElementById(id), canvas = $('preview');
  const stage = createPreview(canvas), { scene, camera, renderer } = stage;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.autoRotateSpeed = 1.2; controls.maxPolarAngle = Math.PI * 0.54;
  let current = null, generation = 0, stopped = false, loading = false, visible = false;
  let bounds = new THREE.Box3(), grid, wireframe = false, renderNeeded = true, animated = false;
  const number = value => value.toLocaleString('es');
  const tour = createTrackTour({ scene, camera, controls, canvas, invalidate: () => { renderNeeded = true; }, overview: frame, copy, animate: (t, dt) => current?.update?.(t, dt) });
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); renderNeeded = true;
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  function frame() {
    if (!current) return;
    if (tour.active) { tour.overview(); return; }
    const { center, distance } = fitCamera(camera, bounds, current.map, $('camera-view').value);
    controls.target.copy(center); controls.minDistance = distance * 0.15; controls.maxDistance = distance * 4;
    controls.enableDamping = false; controls.update(); controls.enableDamping = true; renderNeeded = true;
  }
  function updateGrid() {
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
    const size = bounds.getSize(new THREE.Vector3()), step = 10 ** Math.floor(Math.log10(Math.max(1, size.x, size.z)));
    grid = new THREE.GridHelper(step * 20, 20, '#a1aaa0', '#d2d8ce');
    grid.material.transparent = true; grid.material.opacity = 0.35;
    grid.position.y = bounds.min.y - 0.01; grid.visible = $('grid').getAttribute('aria-pressed') === 'true';
    scene.add(grid); $('grid-scale').textContent = 'Cuadrícula ' + number(step) + ' u · XYZ';
  }
  function clear() {
    generation++; loading = false; visible = false;
    tour.setTrack(null, null); release(current); current = null;
    controls.autoRotate = false; $('rotate').setAttribute('aria-pressed', 'false');
    $('draw-calls').textContent = ''; $('grid-scale').textContent = '';
  }
  async function select(asset) {
    clear(); visible = true; loading = true; const ticket = generation;
    $('preview-status').hidden = false; $('preview-status').classList.remove('error'); $('preview-status').textContent = 'Preparando la vista 3D…';
    $('retry-preview').hidden = true;
    for (const name of ['dimensions', 'geometry', 'vertices', 'materials', 'textures']) $(name).textContent = '—';
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    let runtime;
    try {
      if (ticket !== generation || stopped) return;
      runtime = await asset.build();
      if (ticket !== generation || stopped) { release(runtime); return; }
      ownMaterials(runtime, wireframe); runtime.map = asset.category === 'Mapas'; runtime.update?.(0, 0); scene.add(runtime.group);
      const result = inspect(runtime); bounds = result.frameBounds; const stats = result.stats;
      $('dimensions').textContent = stats.dimensions.map(n => n.toFixed(2)).join(' × ') + ' u';
      $('geometry').textContent = number(stats.triangles) + ' tri · ' + number(stats.meshes) + ' mallas';
      for (const name of ['vertices', 'materials', 'textures']) $(name).textContent = number(stats[name]);
      current = runtime; resize(); updateGrid(); frame(); tour.setTrack(runtime.route, asset); $('preview-status').hidden = true;
    } catch (error) {
      release(runtime); if (ticket !== generation) return; current = null;
      $('preview-status').classList.add('error'); $('preview-status').textContent = 'No se pudo abrir este recurso: ' + error.message;
      $('retry-preview').hidden = false;
    } finally { if (ticket === generation) loading = false; }
  }
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
  const keydown = event => {
    if (!visible || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); frame(); }
  };
  document.addEventListener('keydown', keydown);
  let previous = performance.now(), time = 0;
  function tick(now) {
    if (stopped) return;
    const elapsed = (now - previous) / 1000, dt = Math.min(0.05, elapsed); previous = now; time += dt;
    if (visible && !document.hidden) {
      if (tour.active) { if (tour.playing) tour.step(elapsed); }
      else if (animated) { current?.update?.(time, dt); renderNeeded = true; }
      if (!tour.playing) controls.update();
      if (renderNeeded) { renderer.render(scene, camera); renderNeeded = false; $('draw-calls').textContent = renderer.info.render.calls + ' draw calls · visor'; }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return { select, clear, renderer, scene, camera, tour, get current() { return current; }, get loading() { return loading; },
    dispose() { stopped = true; clear(); observer.disconnect(); controls.dispose(); document.removeEventListener('keydown', keydown); if (grid) { grid.geometry.dispose(); grid.material.dispose(); } stage.dispose(); } };
}
