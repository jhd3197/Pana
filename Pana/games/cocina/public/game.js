import * as THREE from 'three';
import { buildCharacter } from '/engine/character.js';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { canvasMat } from '/engine/props.js';
import { food } from '/engine/kitchen-props.js';
import { sound } from '/engine/fx.js';
import { Kitchen, RECIPES, STATIONS, recipe, nearestStation } from './rules.js';
import { KitchenRoom } from './network.js';
import { createKitchenScene, mealModel } from './scene.js';

const $ = id => document.getElementById(id), show = (id, v) => $(id).classList.toggle('hidden', !v);
const qs = new URLSearchParams(location.search), code = (qs.get('room') || Math.random().toString(36).slice(2, 8)).slice(0, 24);
const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState(null, '', url);
await Promise.race([document.fonts.load('900 48px Nunito'), new Promise(resolve => setTimeout(resolve, 1200))]);
const avatar = loadAvatar(), name = loadName();
sound.muted = true;
const renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
const world = createKitchenScene(), { scene } = world;
const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 200);
const actors = new Map(), keys = new Set(), touch = new Set(), previews = new Map();
let state = new Kitchen().snapshot(), paused = false, lastEvent = 0, lastPhase = '', toastTimer, renderedOrders = '', teamKey = '', heldKey = '', last = performance.now(), elapsed = 0;
let aimWidth = innerWidth, aimHeight = innerHeight;
function resize() {
  renderer.setSize(innerWidth, innerHeight); aimWidth = innerWidth; aimHeight = innerHeight;
  const ratio = innerWidth / innerHeight;
  const half = innerWidth <= 760 ? 14.5 / ratio : state.phase === 'lobby' ? 16 : 13.3;
  camera.left = -half * ratio; camera.right = half * ratio; camera.top = half; camera.bottom = -half;
  camera.position.set(17, 28, 34); camera.lookAt(state.phase === 'lobby' && innerWidth > 760 ? -3 : -0.5, 0.5, 2);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
// Render the real food models into order tickets, so HUD and world agree.
const artRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); artRenderer.setSize(220, 150); artRenderer.setPixelRatio(1);
artRenderer.toneMapping = THREE.ACESFilmicToneMapping;
const artScene = new THREE.Scene(); artScene.add(new THREE.HemisphereLight(0xffffff, 0x9e6d43, 2.5));
const light = new THREE.DirectionalLight(0xffe9ba, 3); light.position.set(-3, 5, 4); artScene.add(light);
const artCamera = new THREE.PerspectiveCamera(27, 220 / 150, 0.1, 20); artCamera.position.set(1.2, 1.85, 2.55); artCamera.lookAt(0, 0.15, 0);
for (const r of RECIPES) for (const stage of ['raw', 'prepared', 'cooked']) {
  const model = food(r.id, { stage }); artScene.add(model); artRenderer.render(artScene, artCamera);
  previews.set(`${r.id}:${stage}`, artRenderer.domElement.toDataURL()); artScene.remove(model);
  model.traverse(o => { o.geometry?.dispose(); });
}
artRenderer.dispose();
for (const r of RECIPES) { const img = document.createElement('img'); img.src = previews.get(`${r.id}:cooked`); img.alt = r.name; $('tasting').append(img); }
function notify(text) { $('toast').textContent = text; show('toast', true); clearTimeout(toastTimer); toastTimer = setTimeout(() => show('toast', false), 3100); }
const room = new KitchenRoom({ code, name, avatar, onState: receive, onNotice: notify, onStatus(text, failed = false) {
  $('connection').textContent = text; show('practice', failed); show('offline', failed); if (failed) notify(text); updateUI();
} });
const me = () => state.players.find(p => p.id === room.id);
const colors = ['#eb574b', '#4789e3', '#3aae77', '#e4b52c', '#a974d5', '#e584a9', '#57bcc0', '#e68a3c'];
function actorLabel(p, color) {
  const mat = canvasMat(256, 96, ctx => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(5, 5, 246, 74, 18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(113, 78); ctx.lineTo(128, 94); ctx.lineTo(143, 78); ctx.fill();
    ctx.fillStyle = '#fff9e7'; ctx.font = '900 35px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.id === room.id ? `${p.name} · tú` : p.name, 128, 43, 228);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: mat.map, depthTest: false })); mat.dispose(); sprite.scale.set(2, 0.75, 1); sprite.position.y = 3.55; return sprite;
}
function removeActor(a) {
  scene.remove(a.root);
  a.label.material.map.dispose(); a.label.material.dispose();
  // Carried foods share baked geometry. Only the character owns its geometry.
  a.character.group.traverse(o => { if (o.geometry && !a.character.carry.children.some(c => c === o || c.getObjectById(o.id))) o.geometry.dispose(); });
}
function syncActors() {
  for (const [id, a] of actors) if (!state.players.some(p => p.id === id)) { removeActor(a); actors.delete(id); }
  for (const [i, p] of state.players.entries()) {
    const skin = JSON.stringify(p.avatar); let a = actors.get(p.id);
    if (!a || a.skin !== skin) {
      if (a) removeActor(a);
      const character = buildCharacter(p.avatar, { chef: true }), root = new THREE.Group(), label = actorLabel(p, colors[i % colors.length]);
      character.group.scale.setScalar(1.2); root.add(character.group, label); root.position.set(p.x, 0.16, p.z); scene.add(root);
      a = { root, character, label, skin, held: '' }; actors.set(p.id, a);
    }
    const held = p.held ? `${p.held.recipe}:${p.held.stage}` : '';
    if (a.held !== held) { a.character.carry.clear(); if (p.held) { const model = mealModel(p.held.recipe, p.held.stage); model.scale.setScalar(0.85); a.character.carry.add(model); } a.held = held; }
  }
}
function receive(next) {
  state = next; syncActors();
  if (state.phase !== lastPhase) { lastPhase = state.phase; resize(); paused = false; show('pause', false); heldKey = ''; }
  const event = state.events.at(-1);
  if (event && event.id !== lastEvent) {
    lastEvent = event.id; notify(event.text);
    if (event.kind === 'serve') { sound.tone(660, 0, 0.1, 'sine', 0.1); sound.tone(880, 0.11, 0.18, 'sine', 0.1); }
    if (event.kind === 'fire') sound.tone(220, 0, 0.3, 'sawtooth', 0.06);
  }
  updateUI();
}
const stars = score => score >= 1500 ? 3 : score >= 850 ? 2 : score >= 350 ? 1 : 0;
function updateUI() {
  const playing = state.phase === 'playing', player = me();
  show('lobby', state.phase === 'lobby'); show('welcome-label', state.phase === 'lobby'); show('hud', playing); show('results', state.phase === 'results');
  $('start').disabled = !room.connected || !room.isHost; $('start').textContent = !room.connected ? 'Entrando a la cocina…' : room.isHost ? '¡A cocinar! →' : 'El anfitrión abre la cocina';
  $('helpers').disabled = !room.isHost;
  $('again').disabled = !room.connected || !room.isHost; $('again').textContent = room.isHost ? 'Otro turno →' : 'Esperando al anfitrión…';
  $('timer').textContent = `${String(Math.floor(Math.ceil(state.remaining) / 60)).padStart(2, '0')}:${String(Math.ceil(state.remaining) % 60).padStart(2, '0')}`;
  $('timer').parentElement.classList.toggle('urgent', state.remaining < 30);
  $('score').textContent = state.score; $('stars').textContent = '★ '.repeat(stars(state.score)) + '☆ '.repeat(3 - stars(state.score));
  const orderKey = state.orders.map(o => o.id).join(',');
  if (orderKey !== renderedOrders) {
    renderedOrders = orderKey; $('orders').replaceChildren();
    for (const order of state.orders) {
      const r = recipe(order.recipe), el = document.createElement('article'); el.className = 'order'; el.dataset.order = order.id;
      const h = document.createElement('h2'); h.textContent = r.name;
      const img = document.createElement('img'); img.src = previews.get(`${r.id}:cooked`); img.alt = r.name;
      const desc = document.createElement('small'); desc.textContent = r.ingredients;
      const bar = document.createElement('div'); bar.className = 'meter'; bar.innerHTML = '<i></i>'; el.append(h, img, desc, bar); $('orders').append(el);
    }
  }
  for (const order of state.orders) {
    const el = $('orders').querySelector(`[data-order="${order.id}"]`); el.querySelector('i').style.width = `${Math.max(0, order.remaining / order.total) * 100}%`; el.classList.toggle('urgent', order.remaining < 18); el.setAttribute('aria-label', `${recipe(order.recipe).name}, ${Math.ceil(order.remaining)} segundos`);
  }
  const tk = state.players.map(p => `${p.id}:${p.name}`).join('|');
  if (tk !== teamKey) {
    teamKey = tk; $('team').replaceChildren();
    state.players.forEach((p, i) => { const el = document.createElement('span'); el.textContent = `${p.name}${p.id === room.id ? ' · tú' : p.bot ? ' · ayudante' : ''}`; el.style.setProperty('--player-color', colors[i % colors.length]); $('team').append(el); });
  }
  const hk = player?.held ? `${player.held.recipe}:${player.held.stage}` : 'empty';
  if (hk !== heldKey) {
    heldKey = hk; $('held-image').src = previews.get(hk) || ''; $('held-image').style.display = player?.held ? '' : 'none';
    $('held-name').textContent = player?.held ? recipe(player.held.recipe).name : 'Manos libres';
    $('held-next').textContent = !player?.held ? 'Busca ingredientes para un pedido.' : ({ raw: 'Llévalos a una tabla de preparar.', prepared: 'Al fogón. ¡Que agarre color!', cooked: '¡Al mostrador para servir!', burnt: 'Llévalo al cubo de basura.' })[player.held.stage];
  }
  const near = player && nearestStation(player), station = near && state.stations.find(s => s.id === near.id);
  $('action-label').textContent = station?.fire ? 'Apagar fuego' : near ? station?.item ? station.item.stage === 'cooked' || near.type === 'prep' && station.item.stage === 'prepared' ? 'Recoger plato' : 'Revisar preparación' : near.label : 'Acércate a una estación';
  $('action').disabled = !near || !room.connected;
  if (state.phase === 'results') {
    $('result-stars').textContent = '★'.repeat(stars(state.score)) + '☆'.repeat(3 - stars(state.score));
    $('result-copy').textContent = state.served ? `La plaza se fue contenta. ${state.burnt ? `Se quemaron ${state.burnt} platos; en el próximo turno salen mejor.` : '¡Y ningún plato quemado!'} Estrellas: 350 / 850 / 1500 puntos.` : 'El secreto es recoger, preparar, cocinar y servir. ¡Vamos otra vez!';
    $('result-score').textContent = state.score; $('result-served').textContent = state.served; $('result-missed').textContent = state.missed;
    $('result-team').replaceChildren(); for (const p of state.players) { const row = document.createElement('div'); row.textContent = `${p.name}${p.bot ? ' (ayudante)' : ''} · ${p.deliveries} platos servidos`; $('result-team').append(row); }
  }
}
function togglePause(value = !paused) {
  paused = value; keys.clear(); touch.clear(); show('pause', paused);
  $('pause-note').textContent = room.offline || room.members.size === 1 ? 'Tu turno está pausado.' : 'La cocina sigue para los demás panas.';
  if (paused) $('resume').focus();
}
function interact() { if (!paused && state.phase === 'playing') room.action('interact'); }
$('start').onclick = () => room.action('start', { helpers: $('helpers').checked });
$('again').onclick = () => { lastEvent = 0; room.action('start', { helpers: state.helpers }); };
$('action').onclick = interact; $('menu').onclick = () => togglePause(); $('resume').onclick = () => togglePause(false);
for (const id of ['practice', 'offline']) $(id).onclick = () => { room.practice(); togglePause(false); };
async function invite() {
  const share = new URL(location.href); share.searchParams.delete('debug'); share.searchParams.delete('name');
  try { await navigator.clipboard.writeText(share.href); notify('¡Enlace copiado! Pásaselo a tus panas.'); }
  catch { togglePause(true); show('share-label', true); $('share-url').value = share.href; $('share-url').focus(); $('share-url').select(); }
}
$('invite').onclick = invite; $('copy-room').onclick = invite;
$('sound').onclick = () => { sound.unlock(); sound.muted = !sound.muted; $('sound').textContent = `Sonido: ${sound.muted ? 'no' : 'sí'}`; $('sound').setAttribute('aria-pressed', String(!sound.muted)); if (!sound.muted) sound.tone(660, 0, 0.1, 'sine', 0.08); };
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  const key = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
  if (key === 'escape' && !e.repeat) togglePause();
  if ((key === 'e' || key === ' ') && !e.repeat) { e.preventDefault(); interact(); }
  if (!paused) keys.add(key);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); touch.clear(); });
document.addEventListener('visibilitychange', () => { keys.clear(); touch.clear(); });
for (const button of document.querySelectorAll('[data-move]')) {
  button.onpointerdown = e => { e.preventDefault(); button.setPointerCapture(e.pointerId); touch.add(button.dataset.move); };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => touch.delete(button.dataset.move));
}
$('dash').onpointerdown = e => { e.preventDefault(); $('dash').setPointerCapture(e.pointerId); touch.add('dash'); };
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('dash').addEventListener(event, () => touch.delete('dash'));
function input() {
  if (paused || state.phase !== 'playing') return { x: 0, z: 0 };
  const x = Number(keys.has('d') || keys.has('arrowright') || touch.has('right')) - Number(keys.has('a') || keys.has('arrowleft') || touch.has('left'));
  const y = Number(keys.has('s') || keys.has('arrowdown') || touch.has('down')) - Number(keys.has('w') || keys.has('arrowup') || touch.has('up'));
  // Camera-relative ground movement: right really means screen-right.
  const angle = Math.atan2(camera.position.x + 0.5, camera.position.z - 2), c = Math.cos(angle), s = Math.sin(angle);
  return { x: x * c + y * s, z: -x * s + y * c, dash: keys.has('shift') || touch.has('dash') };
}
const ticker = setInterval(() => room.tick(0.05, input(), paused && (room.offline || room.members.size === 1)), 50);
function frame(now) {
  const dt = Math.min(0.06, (now - last) / 1000); last = now; elapsed += dt;
  if (aimWidth !== innerWidth || aimHeight !== innerHeight) resize();
  for (const p of state.players) {
    const a = actors.get(p.id); if (!a) continue;
    a.root.position.lerp(new THREE.Vector3(p.x, 0.16, p.z), Math.min(1, dt * 17));
    let delta = p.h - a.character.group.rotation.y; delta = Math.atan2(Math.sin(delta), Math.cos(delta)); a.character.group.rotation.y += delta * Math.min(1, dt * 15);
    a.character.update(dt, { walk: p.moving ? 1 : 0, carry: !!p.held, run: p.dash > 1.7, open: p.dash > 1.7 });
    a.label.visible = state.phase === 'playing';
  }
  const player = me(), near = player && nearestStation(player);
  world.ring.visible = state.phase === 'playing' && !!player;
  if (player) world.ring.position.set(actors.get(player.id).root.position.x, 0.18, actors.get(player.id).root.position.z);
  world.update(elapsed, state, camera, near, state.phase === 'playing');
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
show('loading', false); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { clearInterval(ticker); room.dispose(); });
if (qs.has('debug')) window.cocina = { room, camera, actors, renderer, get state() { return state; },
  step(seconds) { if (!room.isHost) return; for (let i = 0; i < seconds; i += 0.05) room.game.update(Math.min(0.05, seconds - i)); room.publish(); },
  place(id, x, z) { const p = room.game?.players.find(p => p.id === id); if (p) { p.x = x; p.z = z; room.publish(); } }, STATIONS };
