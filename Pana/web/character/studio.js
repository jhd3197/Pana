import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSoftCharacter, REFERENCE_PALETTE } from '/engine/models/characters/pana/model.js';
import { saveAvatar } from '/engine/avatar.js';

const canvas = document.querySelector('#character-canvas');
const status = document.querySelector('#load-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (error) {
  status.textContent = 'No se pudo iniciar la vista 3D. Activa la aceleración gráfica y vuelve a cargar la página.';
  status.classList.add('error');
  document.querySelectorAll('button:not(#expand-reference):not([data-reference])').forEach(b => { b.disabled = true; });
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.85, 0);
controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 5.5; controls.maxDistance = 15;
controls.minPolarAngle = 0.4; controls.maxPolarAngle = Math.PI / 2 + 0.07;
controls.autoRotateSpeed = 1.1;
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, 0.04);
scene.environment = environment.texture; room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fff4df', '#b79d81', 1.3));
const key = new THREE.DirectionalLight('#fff2df', 1.8);
key.position.set(-3.5, 7, 5); key.castShadow = true;
key.shadow.mapSize.set(512, 512); key.shadow.camera.left = -4; key.shadow.camera.right = 4;
key.shadow.camera.top = 5; key.shadow.camera.bottom = -3; key.shadow.camera.near = 0.1; key.shadow.camera.far = 20;
key.shadow.normalBias = 0.008; key.shadow.bias = -0.0001; key.shadow.radius = 6; key.shadow.blurSamples = 12;
scene.add(key);
const fill = new THREE.DirectionalLight('#eef3ff', 1.1); fill.position.set(4, 3, 4); scene.add(fill);
const rim = new THREE.DirectionalLight('#fff2d1', 1.9); rim.position.set(1, 5, -4); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: '#5d4631', opacity: 0.035 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.012; floor.receiveShadow = true; scene.add(floor);

// Soft contact under both feet, independent of the directional shadow map.
const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
const ctx = shadowCanvas.getContext('2d');
const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
grad.addColorStop(0, 'rgba(70,43,17,0.25)'); grad.addColorStop(0.45, 'rgba(70,43,17,0.12)'); grad.addColorStop(1, 'rgba(70,43,17,0)');
ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.9), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
contact.rotation.x = -Math.PI / 2; contact.position.y = -0.008; scene.add(contact);
const pana = buildSoftCharacter(); scene.add(pana.group);
document.querySelector('#save-avatar').addEventListener('click', () => {
  const wardrobe = pana.wardrobe;
  const saved = saveAvatar({ fur: REFERENCE_PALETTE.fur,
    outfit: { shirt: 'franela', chef: 'chef', hoodie: 'hoodie', tropical: 'hawaiana', sport: 'deportivo' }[wardrobe.outfit],
    outfitColor: wardrobe.color, hat: { none: 'none', cap: 'gorra-atras', chef: 'chef', band: 'band' }[wardrobe.headwear],
    hatColor: wardrobe.headwearColor || wardrobe.color,
    glasses: { none: 'none', round: 'redondos', sun: 'sol' }[pana.eyewear.style],
    face: { natural: 'cool', smile: 'feliz', talk: 'lengua', laugh: 'wow' }[pana.mouth.expression],
    extra: wardrobe.wristbands ? 'pulseras' : 'none' });
  document.querySelector('#save-status').textContent = saved ? 'Combinación guardada. La verás al abrir o recargar un juego en este navegador.' : 'El navegador no permitió guardar. Activa el almacenamiento local e inténtalo de nuevo.';
});
scene.traverse(o => { if (o.material?.envMapIntensity !== undefined) o.material.envMapIntensity = o.material.name === 'Glossy black eyes' ? 0.18 : 0.7; });
let paused = reducedMotion.matches, disposed = false;
const views = { front: 0, 'three-quarter': -0.7, side: -Math.PI / 2, back: Math.PI };
const framing = () => {
  // Reserve the tallest hat's space for every outfit. Clothing never changes
  // the camera distance, so the same body keeps the same on-screen size.
  return { center: canvas.clientWidth < 500 ? 2.21 : 2.01, scale: 1.12 };
};
function pressed(selector, value, key) {
  document.querySelectorAll(selector).forEach(button => button.setAttribute('aria-pressed', String(button.dataset[key] === value)));
}
function setView(view) {
  const angle = views[view]; if (angle === undefined) return;
  controls.autoRotate = false; document.querySelector('#rotate').setAttribute('aria-pressed', 'false');
  controls.enableDamping = false; controls.update(); controls.enableDamping = true;
  const fit = framing(); controls.target.set(0, fit.center, 0);
  const distance = (canvas.clientWidth < 500 ? 10.9 : 11.2) * fit.scale;
  camera.position.set(Math.sin(angle) * distance, fit.center + 0.87, Math.cos(angle) * distance);
  controls.update(); pressed('[data-view]', view, 'view');
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // Keep the feet above the view controls, with breathing room above the ears.
  camera.fov = w / h < 0.8 ? 37 : 30; camera.updateProjectionMatrix();
}
const observer = new ResizeObserver(resize); observer.observe(canvas);
resize(); setView('three-quarter');
function setPause(value) {
  paused = value; const b = document.querySelector('#pause'); b.setAttribute('aria-pressed', String(value));
  b.innerHTML = `${value ? 'Reanudar animación' : 'Pausar animación'} <span aria-hidden="true">${value ? '▷' : 'Ⅱ'}</span>`;
}
setPause(paused);
function changeWardrobe(change) {
  change();
  syncWardrobeControls();
}
function setOutfit(value) { changeWardrobe(() => pana.setOutfit(value)); }
function syncWardrobeControls() {
  const wardrobe = pana.wardrobe;
  pressed('[data-outfit]', wardrobe.preset || '', 'outfit');
  pressed('[data-headwear]', wardrobe.headwear, 'headwear');
  document.querySelector('#garment').value = wardrobe.outfit;
  document.querySelector('#wristbands').checked = wardrobe.wristbands;
  document.querySelector('#customization-status').hidden = !!wardrobe.preset;
  syncColorControls(); syncHeadwearColors();
}
function syncColorControls() {
  const color = pana.wardrobe.color; pressed('[data-color]', color, 'color');
  const swatch = [...document.querySelectorAll('[data-color]')].find(b => b.dataset.color === color);
  document.querySelector('#color-label').textContent = `${pana.wardrobe.outfit === 'sport' ? 'Detalles · ' : ''}${swatch?.dataset.label || color}`;
  document.querySelector('#clothing-swatches').setAttribute('aria-label', pana.wardrobe.outfit === 'sport' ? 'Color de los detalles deportivos' : 'Color de la ropa');
}
function syncHeadwearColors() {
  const { headwear, headwearColor } = pana.wardrobe;
  document.querySelector('#headwear-colors').hidden = headwear === 'none';
  pressed('[data-headwear-color]', headwearColor || '', 'headwearColor');
  const swatch = [...document.querySelectorAll('[data-headwear-color]')].find(b => b.dataset.headwearColor === headwearColor);
  document.querySelector('#headwear-color-label').textContent = `${headwear === 'chef' ? 'Emblema · ' : ''}${swatch?.dataset.label || ''}`;
  document.querySelector('#headwear-swatches').setAttribute('aria-label', headwear === 'chef' ? 'Color del emblema del gorro' : 'Color del accesorio de cabeza');
}
function setGlasses(value) { pana.setGlasses(value); pressed('[data-glasses]', value, 'glasses'); }
const expressionHints = {
  natural: 'Descansa con la boca cerrada y sonríe de vez en cuando.',
  smile: 'Una sonrisa abierta, como la referencia.',
  talk: 'Abre y cierra la boca por frases, con pequeñas pausas.',
  laugh: 'Risas cortas, ojos sonrientes y un descanso entre cada risa.',
};
function setExpression(value, immediate = paused) {
  pana.setExpression(value, { immediate });
  pressed('[data-expression]', pana.mouth.expression, 'expression');
  document.querySelector('#expression-hint').textContent = expressionHints[pana.mouth.expression];
}
document.querySelectorAll('[data-expression]').forEach(b => b.addEventListener('click', () => setExpression(b.dataset.expression)));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('[data-outfit]').forEach(b => b.addEventListener('click', () => setOutfit(b.dataset.outfit)));
document.querySelector('#garment').addEventListener('change', e => changeWardrobe(() => pana.setGarment(e.target.value)));
document.querySelectorAll('[data-headwear]').forEach(b => b.addEventListener('click', () => changeWardrobe(() => pana.setHeadwear(b.dataset.headwear))));
document.querySelector('#wristbands').addEventListener('change', e => changeWardrobe(() => pana.setWristbands(e.target.checked)));
document.querySelectorAll('[data-headwear-color]').forEach(b => b.addEventListener('click', () => {
  pana.setHeadwearColor(b.dataset.headwearColor); syncHeadwearColors();
}));
document.querySelectorAll('[data-glasses]').forEach(b => b.addEventListener('click', () => setGlasses(b.dataset.glasses)));
document.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
  pana.setColor(b.dataset.color); syncColorControls();
}));
document.querySelectorAll('[data-pose]').forEach(b => b.addEventListener('click', () => {
  pana.setPose(b.dataset.pose); pressed('[data-pose]', b.dataset.pose, 'pose'); setPause(false);
}));
document.querySelector('#pause').addEventListener('click', () => setPause(!paused));
document.querySelector('#rotate').addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  document.querySelector('#rotate').setAttribute('aria-pressed', String(controls.autoRotate));
  if (controls.autoRotate) pressed('[data-view]', '', 'view');
});
controls.addEventListener('start', () => { controls.autoRotate = false; document.querySelector('#rotate').setAttribute('aria-pressed', 'false'); pressed('[data-view]', '', 'view'); });
canvas.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return;
  e.preventDefault();
  if (e.key === 'Home') return setView('three-quarter');
  const offset = camera.position.clone().sub(controls.target);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), e.key === 'ArrowLeft' ? -0.12 : 0.12);
  else offset.setLength(THREE.MathUtils.clamp(offset.length() * (e.key === 'ArrowUp' ? 0.92 : 1.08), controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset); controls.update(); pressed('[data-view]', '', 'view');
});
document.querySelectorAll('[data-reference]').forEach(b => b.addEventListener('click', () => {
  const view = b.dataset.reference;
  const src = `/character/references/${view}.png`;
  document.querySelector('#reference-image').src = src; document.querySelector('#large-reference').src = src;
  document.querySelector('#reference-image').alt = `Referencia original del capibara con franela roja, ${view === 'front' ? 'visto de frente' : 'visto de tres cuartos'}`;
  pressed('[data-reference]', view, 'reference'); setView(view);
}));
const dialog = document.querySelector('#reference-dialog');
document.querySelector('#expand-reference').addEventListener('click', () => dialog.showModal());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
document.querySelector('#reset').addEventListener('click', () => {
  pana.wardrobe.resetColors(); setOutfit('shirt'); pana.setColor(REFERENCE_PALETTE.shirt); syncColorControls();
  setGlasses('none');
  setExpression('natural', true);
  document.querySelector('#color-label').textContent = 'Rojo original';
  pana.resetPose(); pressed('[data-pose]', 'idle', 'pose'); setPause(reducedMotion.matches); setView('three-quarter');
});
document.querySelector('#capture').addEventListener('click', () => {
  const background = scene.background; scene.background = new THREE.Color('#f7f5ee'); renderer.render(scene, camera);
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'pana-personaje.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png'); scene.background = background;
});
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault(); status.hidden = false; status.classList.add('error');
  status.textContent = 'La vista 3D se interrumpió. Vuelve a cargar la página para continuar.';
});
const clock = new THREE.Clock();
function frame() {
  if (disposed) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!document.hidden) {
    if (!paused) pana.update(dt);
    controls.update(); renderer.render(scene, camera);
  }
}
renderer.setAnimationLoop(frame); status.hidden = true;
// Read-only inspection handle for geometry/interaction browser checks.
window.panaStudio = { pana, scene, camera, renderer, controls, get paused() { return paused; }, setView };
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); controls.dispose(); pana.dispose();
  floor.geometry.dispose(); floor.material.dispose(); contact.geometry.dispose(); contact.material.dispose();
  shadowTexture.dispose(); environment.dispose(); renderer.dispose();
}, { once: true });
