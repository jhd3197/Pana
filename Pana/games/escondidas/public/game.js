import { prepareScene } from '/engine/game-load.js';
import * as THREE from 'three';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { createPlazaProp, PLAZA_PROPS, propDefinition } from '/engine/models/props/plaza.js';
import { sound } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { holdButton } from '/engine/touch.js';
import { pixelRatio, bindRenderer } from '/engine/settings.js';
import { createPlaza } from './plaza.js';
import { createHuntEnvironment } from './scene.js';
import { createMapPicker } from '/engine/map-picker.js';
import { arenaInfo } from '/engine/arena-layouts.js';
import { huntLayout } from './layout.js';
import { RULES, HIDE_TIMES } from './rules.js';
import { HuntRoom } from './network.js';
import { elapsedClock } from '/engine/live-room.js';

const $ = id => document.getElementById(id), show = (id, visible) => $(id).classList.toggle('hidden', !visible);
const qs = new URLSearchParams(location.search), DEBUG = qs.has('debug');
const code = roomFromUrl() || newRoomCode();
const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState(null, '', url);
const avatar = loadAvatar(), name = loadName();
await Promise.race([document.fonts.load('900 64px Nunito'), new Promise(resolve => setTimeout(resolve, 1600))]);

const renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true });
renderer.setPixelRatio(pixelRatio(1.75)); renderer.setSize(innerWidth, innerHeight); bindRenderer(renderer, 1.75);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.13;
const plaza = createPlaza({ environment: false }), { scene } = plaza;
const environment = createHuntEnvironment(scene); environment.setMap('plaza');
const camera = new THREE.PerspectiveCamera(49, innerWidth / innerHeight, 0.1, 200);
camera.position.set(25, 20, 32); camera.lookAt(-1, 1.5, -2);
const actors = new Map(), previews = new Map();
const previewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
previewRenderer.setSize(160, 150); previewRenderer.setPixelRatio(1);
previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
function preview(object, character = false) {
  const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0xb49bca, 2.6));
  const light = new THREE.DirectionalLight(0xffe6b0, 3); light.position.set(-3, 5, 7); s.add(light, object);
  const c = new THREE.PerspectiveCamera(35, 160 / 150, 0.1, 20);
  c.position.set(character ? 0.8 : 3.1, character ? 1.6 : 2.7, character ? 3.8 : 4.3); c.lookAt(0, character ? 1 : 0.9, 0);
  previewRenderer.render(s, c);
  const data = previewRenderer.domElement.toDataURL();
  // Materials are cached by the shared kit; dispose only temporary geometries.
  if (object.userData.dispose) object.userData.dispose();
  else { const geos = new Set(); object.traverse(o => { if (o.geometry) geos.add(o.geometry); }); geos.forEach(g => g.dispose()); }
  return data;
}
for (const def of PLAZA_PROPS) previews.set(def.id, preview(createPlazaProp(def.id)));
const seekerFace = preview(buildCharacter({ ...avatar, hatColor: '#3d7bf2' }).group, true);
$('seeker-face').src = seekerFace;
for (const [i, def] of PLAZA_PROPS.entries()) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'pk-slot'; button.dataset.prop = def.id;
  button.setAttribute('aria-label', `${def.label}, tecla ${i + 1}`); button.setAttribute('aria-pressed', 'false');
  const img = document.createElement('img'); img.src = previews.get(def.id); img.alt = '';
  const label = document.createElement('b'); label.textContent = def.label;
  const key = document.createElement('kbd'); key.className = 'pk-slot-n'; key.textContent = i + 1;
  button.append(img, label, key); button.onclick = () => transform(def.id); $('prop-list').append(button);
}

let state = { mapId: 'plaza', layoutSeed: 1, hideSeconds: RULES.hideSeconds, phase: 'lobby', players: [], round: 0, events: [] }, previousPhase = 'lobby';
let drag = null, preference = 'hide', paused = false, yaw = 0.28, pitch = 0.22, eventId = 0, uiKey = '', snapRound = -1;
let toastTimer, motionTime = 0, last = performance.now();
let portraitKey = '';
const keys = new Set(), touch = new Set(), actorRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.88, 40), new THREE.MeshBasicMaterial({ color: 0x54e2ca, transparent: true, opacity: 0.8, depthWrite: false }));
actorRing.rotation.x = -Math.PI / 2; actorRing.position.y = 0.07; scene.add(actorRing);
const room = new HuntRoom({ code, name, avatar, onState: receive,
  onStatus(text, failed = false) { $('connection').textContent = text; show('practice', failed); if (failed) notify(text); updateHUD(); }, onNotice: notify });
const mapPicker = createMapPicker($('map-picker'), mapId => room.action('map', { mapId }));
for (const seconds of HIDE_TIMES) $('hide-seconds').append(new Option(`${seconds} segundos`, seconds));
$('hide-seconds').onchange = () => room.action('configure', { options: { hideSeconds: Number($('hide-seconds').value) } });
function notify(message) { $('toast').textContent = message; show('toast', true); clearTimeout(toastTimer); toastTimer = setTimeout(() => show('toast', false), 3300); }
const menu = createGameMenu({
  orientation: 'vertical',
  title: 'Escondidas', heading: 'Un momentico.', resumeLabel: 'Volver al juego', sound, notify,
  note: () => room.members.size === 1 ? 'La práctica queda en pausa mientras descansas.' : 'La ronda continúa para los demás panas.',
  controls: [['W A S D / ↑ ← ↓ →', 'Moverte'], ['Arrastrar', 'Mirar'], ['Shift', 'Correr'], ['1 2 3 4 5', 'Transformarte'],
    ['Q', 'Volver a pana'], ['E', 'Copiar objeto cercano o buscar'], ['M', 'Sonido']],
  tips: ['Una revisión fallida espera 1,6 segundos.'],
  invite: () => inviteUrl(code),
  onOpen() { paused = true; keys.clear(); touch.clear(); drag = null; },
  onClose() { paused = false; },
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn pk-btn--sm' }), menu.createSoundButton({ id: 'sound', className: 'pk-btn pk-btn--sm' }), menu.createButton({ id: 'menu', className: 'pk-btn pk-btn--sm' }));
$('menu').querySelector('kbd')?.classList.add('pk-kbd');
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));
function getMe() { return state.players.find(p => p.id === room.id); }

function disposeActor(actor) {
  scene.remove(actor.root);
  if (actor.character) { actor.character.dispose(); return; }
  const geometries = new Set(); actor.root.traverse(o => { if (o.geometry) geometries.add(o.geometry); });
  geometries.forEach(g => g.dispose());
}
function syncActors() {
  for (const [id, actor] of actors) if (!state.players.some(p => p.id === id)) { disposeActor(actor); actors.delete(id); }
  for (const p of state.players) {
    const skin = JSON.stringify(p.avatar || {}), disguise = p.caught ? null : p.prop;
    let a = actors.get(p.id);
    if (!a || a.prop !== disguise || a.skin !== skin) {
      if (a) disposeActor(a);
      const character = disguise ? null : buildCharacter(p.avatar || {});
      const model = disguise ? createPlazaProp(disguise) : character.group;
      const root = new THREE.Group(); root.add(model); root.position.set(p.x, 0, p.z); root.rotation.y = p.h;
      scene.add(root); a = { root, model, character, prop: disguise, skin }; actors.set(p.id, a);
    }
    a.root.visible = !p.spectator && !p.caught;
    if (state.round !== snapRound) a.root.position.set(p.x, 0, p.z);
  }
  snapRound = state.round;
}
function receive(next) {
  state = next; environment.setMap(state.mapId, state.layoutSeed); syncActors();
  if (state.phase !== previousPhase) {
    if (state.phase === 'hide') { yaw = 0.28; uiKey = ''; sound.tone(660, 0, 0.15, 'sine', 0.1); }
    if (state.phase === 'hunt') { sound.tone(440, 0, 0.2, 'triangle', 0.12); sound.tone(660, 0.22, 0.25, 'triangle', 0.12); }
    previousPhase = state.phase;
  }
  const latest = state.events.at(-1);
  if (latest && latest.id !== eventId) { eventId = latest.id; notify(latest.text); }
  updateHUD();
}
function updateHUD() {
  mapPicker.update(state.mapId, room.connected && room.isHost && state.phase === 'lobby');
  $('hide-seconds').value = state.hideSeconds || RULES.hideSeconds;
  $('hide-seconds').disabled = !room.connected || !room.isHost || state.phase !== 'lobby';
  $('hide-seconds-stat').textContent = `${state.hideSeconds || RULES.hideSeconds}s`;
  $('world').setAttribute('aria-label', `${arenaInfo(state.mapId).name}, escenario de Escondidas`);
  $('scene-label').querySelector('b').textContent = arenaInfo(state.mapId).name;
  $('minimap').closest('aside').querySelector('span').textContent = arenaInfo(state.mapId).name;
  const me = getMe(), active = room.connected && ['hide', 'hunt'].includes(state.phase), lobby = state.phase === 'lobby' || !room.connected;
  show('lobby', lobby); show('scene-label', lobby); show('hud', active); document.body.classList.toggle('in-lobby', lobby);
  show('results', room.connected && ['results', 'finished'].includes(state.phase));
  $('start').disabled = !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? 'Entrando a la sala…' : room.isHost ? '¡A jugar! →' : 'Esperando al anfitrión…';
  $('role-hide').disabled = $('role-seek').disabled = !room.isHost;
  $('room-code').textContent = room.offline ? '● Práctica' : `● Sala ${code}`;
  if (room.connected) $('connection').textContent = room.offline ? 'Práctica con 3 panas de la máquina.'
    : `Sala ${code} · ${room.members.size} pana${room.members.size === 1 ? '' : 's'} conectado${room.members.size === 1 ? '' : 's'}${room.members.size < 4 ? ' · completamos con bots' : ''}`;
  const rosterKey = [...room.members.values()].map(p => p.name).join('|');
  if ($('roster').dataset.key !== rosterKey) {
    $('roster').dataset.key = rosterKey; $('roster').replaceChildren();
    for (const p of room.members.values()) { const el = document.createElement('span'); el.textContent = p.name + (p.id === room.id ? ' (tú)' : ''); $('roster').append(el); }
    $('roster').prepend(Object.assign(document.createElement('i'), { className: 'pk-dot' }));
  }
  if (lobby) { $('world').style.filter = ''; eventId = 0; return; }
  const seeker = state.players.find(p => p.id === state.seeker), seeking = me?.id === state.seeker;
  const nextPortraitKey = JSON.stringify(seeker?.avatar || {});
  if (nextPortraitKey !== portraitKey) { portraitKey = nextPortraitKey; $('seeker-face').src = preview(buildCharacter(seeker?.avatar || {}).group, true); }
  $('timer').textContent = `${String(Math.floor(Math.ceil(Math.max(0, state.remaining)) / 60)).padStart(2, '0')}:${String(Math.ceil(Math.max(0, state.remaining)) % 60).padStart(2, '0')}`;
  $('phase').textContent = state.phase === 'hide' ? seeking ? 'ESPERA TU TURNO' : '¡A ESCONDERSE!' : seeking ? '¡A BUSCAR!' : '¡QUE NO TE PILLEN!';
  $('round').textContent = `RONDA ${state.round} / ${state.totalRounds}`;
  $('seeker-name').textContent = seeking ? '¡Eres tú!' : seeker?.name || 'Buscador';
  $('seeker-caption').textContent = seeker?.bot ? 'BUSCADOR · MÁQUINA' : 'BUSCADOR';
  const left = state.players.filter(p => p.id !== state.seeker && !p.caught && !p.spectator).length;
  $('remaining-players').textContent = `${left} pana${left !== 1 ? 's' : ''} escondido${left !== 1 ? 's' : ''}`;
  const spectating = me?.spectator || me?.caught;
  show('center-message', active && (spectating || seeking && state.phase === 'hide'));
  if (spectating) {
    $('center-message').querySelector('b').textContent = me?.caught ? '¡Te pillaron, pana!' : 'Llegaste con la ronda empezada.';
    $('center-message').querySelector('span').textContent = 'Mira el mapa. Vuelves a jugar en la siguiente ronda.';
  } else {
    $('center-message').querySelector('b').textContent = 'Prepárate para buscar…';
    $('center-message').querySelector('span').textContent = 'Los panas se están escondiendo.';
  }
  // A seeker cannot peek at preparations using the scene or the minimap.
  $('world').style.filter = seeking && state.phase === 'hide' ? 'blur(30px) brightness(.45)' : '';
  show('disguise-panel', !seeking && !spectating);
  $('prop-name').textContent = propDefinition(me?.prop)?.label || 'Tu pana';
  $('charges').replaceChildren(...Array.from({ length: RULES.changes }, (_, i) => Object.assign(document.createElement('i'), { className: i < (me?.changes || 0) ? 'on' : '' })));
  $('charges').setAttribute('aria-label', `${me?.changes || 0} cambios restantes`);
  $('disguise-tip').textContent = me?.prop ? 'Quédate quieto para camuflarte.' : 'Elige un objeto para camuflarte.';
  $('revert').disabled = !me?.prop || seeking || spectating;
  for (const button of $('prop-list').children) {
    const selected = button.dataset.prop === me?.prop;
    button.classList.toggle('selected', selected); button.classList.toggle('is-active', selected); button.setAttribute('aria-pressed', String(selected));
    button.disabled = !active || seeking || spectating || (me?.changes ?? 0) <= 0 || selected;
  }
  const near = nearestProp();
  $('action-label').textContent = spectating ? 'Observando la ronda' : seeking
    ? state.phase === 'hide' ? 'Espera a que termine la cuenta' : me?.cooldown > 0 ? `Revisando… ${me.cooldown.toFixed(1)} s` : 'Revisar alrededor'
    : near ? `Copiar ${propDefinition(near.type).label.toLowerCase()}` : 'Acércate a un objeto para copiar';
  $('action').disabled = spectating || seeking && (state.phase !== 'hunt' || me?.cooldown > 0) || !seeking && (!near || me?.changes <= 0);
  const suspicion = me?.suspicion || 0; show('suspicion', suspicion > 3 && !spectating && !seeking);
  $('suspicion-fill').style.width = `${suspicion}%`;
  const resultKey = state.phase + state.round + state.players.map(p => `${p.id}:${p.score}:${p.caught}`).join(',') + room.isHost;
  if (['results', 'finished'].includes(state.phase) && uiKey !== resultKey) {
    uiKey = resultKey;
    $('result-round').textContent = state.phase === 'finished' ? 'PARTIDA TERMINADA' : `RONDA ${state.round} DE ${state.totalRounds}`;
    $('result-title').textContent = state.winner === 'hiders' ? '¡Bien escondidos!' : '¡Los pillaron a todos!';
    $('result-copy').textContent = 'Cada captura suma 1 punto. Sobrevivir a la ronda suma 3. El buscador cambia en cada ronda.';
    fillRoster($('scores'), [...state.players].sort((a, b) => b.score - a.score).map(p => ({
      className: 'score-row', name: p.name + (p.id === room.id ? ' (tú)' : ''), me: p.id === room.id, end: p.score, score: true,
      detail: p.spectator ? 'Espectador' : p.id === state.seeker ? 'Buscador' : p.caught ? 'Encontrado' : 'A salvo' })));
    $('next').disabled = !room.isHost;
    $('next').textContent = !room.isHost ? 'Esperando al anfitrión…' : state.phase === 'finished' ? 'Otra partida →' : 'Siguiente ronda →';
  }
}

function nearestProp() {
  const p = getMe(); if (!p) return null;
  return huntLayout(state.mapId, state.layoutSeed).props.filter(o => Math.hypot(o.x - p.x, o.z - p.z) < 3.8)
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
}
function transform(id) { room.action('transform', { prop: id }); }
function act() {
  if (paused) return;
  if (room.id === state.seeker) room.action('check');
  else { const near = nearestProp(); if (near) transform(near.type); else notify('Acércate a un barril, caja, cava, mata o banco.'); }
}
for (const mode of ['hide', 'seek']) $(`role-${mode}`).onclick = () => {
  preference = mode;
  for (const m of ['hide', 'seek']) { $(`role-${m}`).classList.toggle('selected', m === mode); $(`role-${m}`).setAttribute('aria-pressed', String(m === mode)); }
};
$('start').onclick = $('next').onclick = () => { sound.unlock(); room.action('start', { preference }); };
$('practice').onclick = () => { room.practice(); show('practice', false); };
$('action').onclick = act;
$('revert').onclick = () => transform(null);
addEventListener('keydown', event => {
  if (event.target.closest?.('input, select, textarea')) return;
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  keys.add(key); if (event.repeat) return;
  if (paused) return;
  if (key === 'm') toggleMute();
  if (key === 'e') act(); if (key === 'q') transform(null);
  if (/^[1-5]$/.test(key)) transform(PLAZA_PROPS[Number(key) - 1].id);
});
addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); touch.clear(); });
document.addEventListener('visibilitychange', () => { keys.clear(); touch.clear(); });
// Held touch buttons (engine/touch.js).
for (const button of document.querySelectorAll('[data-move]')) {
  holdButton(button, { down: () => touch.add(button.dataset.move), up: () => touch.delete(button.dataset.move) });
}
$('world').onpointerdown = event => { if (paused) return; drag = { x: event.clientX, y: event.clientY }; $('world').setPointerCapture(event.pointerId); };
$('world').onpointermove = event => {
  if (!drag) return;
  yaw -= (event.clientX - drag.x) * 0.006; pitch = THREE.MathUtils.clamp(pitch + (event.clientY - drag.y) * 0.004, 0.18, 0.95);
  drag = { x: event.clientX, y: event.clientY };
};
$('world').onpointerup = $('world').onpointercancel = () => { drag = null; };
function input() {
  if (paused) return { x: 0, z: 0 };
  const x = Number(keys.has('d') || keys.has('arrowright') || touch.has('right')) - Number(keys.has('a') || keys.has('arrowleft') || touch.has('left'));
  const z = Number(keys.has('s') || keys.has('arrowdown') || touch.has('down')) - Number(keys.has('w') || keys.has('arrowup') || touch.has('up'));
  return { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: z * Math.cos(yaw) - x * Math.sin(yaw), sprint: keys.has('shift') };
}

const map = $('minimap').getContext('2d');
function drawMap() {
  const { bounds: BOUNDS, blockers: BLOCKERS } = huntLayout(state.mapId, state.layoutSeed);
  const W = 300, H = 270, scale = 5.7, px = x => W / 2 + x * scale, pz = z => H / 2 + z * scale;
  map.clearRect(0, 0, W, H); map.fillStyle = '#2e2558'; map.fillRect(px(-BOUNDS.x), pz(-BOUNDS.z), BOUNDS.x * scale * 2, BOUNDS.z * scale * 2);
  map.fillStyle = '#120d2c';
  for (const b of BLOCKERS) {
    if (b.r) { map.beginPath(); map.arc(px(b.x), pz(b.z), Math.max(2, b.r * scale), 0, Math.PI * 2); map.fill(); }
    else map.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * scale, b.d * scale);
  }
  for (const p of state.players) {
    if (p.caught || p.spectator) continue;
    // Do not reveal hiders to the seeker, even during preparations.
    if (p.id !== room.id && p.id !== state.seeker) continue;
    map.fillStyle = p.id === room.id ? '#ffc629' : '#ff4b4b';
    map.strokeStyle = '#0e0b24'; map.lineWidth = 2.5;
    map.beginPath(); map.arc(px(p.x), pz(p.z), p.id === room.id ? 7 : 5, 0, Math.PI * 2); map.fill(); map.stroke();
    if (p.id === room.id) {
      map.beginPath(); map.moveTo(px(p.x), pz(p.z)); map.lineTo(px(p.x) - Math.sin(yaw) * 13, pz(p.z) - Math.cos(yaw) * 13); map.strokeStyle = '#f3e9d7'; map.stroke();
    }
  }
}

const look = new THREE.Vector3(), desired = new THREE.Vector3();
function frame(now) {
  // rAF time can trail performance.now(); a negative dt would fling the camera.
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.06)); last = now; motionTime += dt;
  plaza.update(motionTime); environment.update(motionTime, dt);
  const me = getMe(), active = ['hide', 'hunt'].includes(state.phase);
  for (const p of state.players) {
    const a = actors.get(p.id); if (!a) continue;
    a.root.position.x = THREE.MathUtils.damp(a.root.position.x, p.x, 18, dt);
    a.root.position.z = THREE.MathUtils.damp(a.root.position.z, p.z, 18, dt);
    const delta = Math.atan2(Math.sin(p.h - a.root.rotation.y), Math.cos(p.h - a.root.rotation.y));
    a.root.rotation.y += delta * Math.min(1, dt * 14);
    a.model.position.y = p.moving && active ? Math.abs(Math.sin(motionTime * 12)) * 0.08 : 0;
    if (a.character) a.character.update(dt, { open: p.moving, walk: p.moving ? 1 : 0 });
  }
  if (active && me && !me.spectator && !me.caught) {
    const p = actors.get(me.id)?.root.position || new THREE.Vector3(me.x, 0, me.z);
    const dist = innerWidth < 600 ? 11.5 : 9;
    desired.set(p.x + Math.sin(yaw) * Math.cos(pitch) * dist, 1.7 + Math.sin(pitch) * dist, p.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    // Keep the follow camera inside the walls. Elevated view clears most props.
    const bounds = huntLayout(state.mapId, state.layoutSeed).bounds;
    desired.x = THREE.MathUtils.clamp(desired.x, -bounds.x - .6, bounds.x + .6); desired.z = THREE.MathUtils.clamp(desired.z, -bounds.z - .7, bounds.z + 3);
    camera.position.lerp(desired, 1 - Math.exp(-dt * 7)); look.set(p.x, 1.35, p.z); camera.lookAt(look);
    actorRing.visible = true; actorRing.position.set(p.x, 0.07, p.z);
    actorRing.scale.setScalar(me.prop ? propDefinition(me.prop).radius / 0.7 : 0.9);
  } else {
    desired.set(26 + Math.sin(motionTime * 0.06) * 2, 21, 32); camera.position.lerp(desired, 1 - Math.exp(-dt * 2));
    camera.lookAt(innerWidth < 600 ? 0 : -3, 1.5, -2); actorRing.visible = false;
  }
  // The launcher column covers the left of the lobby; shift the plaza right of it.
  const lobbyShift = (state.phase === 'lobby' || !room.connected) && innerWidth > 720 ? Math.min(560, innerWidth) / 2 : 0;
  if (lobbyShift !== (camera.view?.enabled ? -camera.view.offsetX : 0)) {
    if (lobbyShift) camera.setViewOffset(innerWidth, innerHeight, -lobbyShift, 0, innerWidth, innerHeight); else camera.clearViewOffset();
  }
  drawMap(); renderer.render(scene, camera); requestAnimationFrame(frame);
}
// Real elapsed time (the room catches up in fixed steps): a host in a
// background tab gets timers about once a second.
const simClock = elapsedClock();
const ticker = setInterval(() => room.tick(simClock(), input(), paused && room.members.size === 1), 50);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.clearViewOffset(); renderer.setSize(innerWidth, innerHeight); });
addEventListener('pagehide', () => { clearInterval(ticker); room.dispose(); environment.dispose(); plaza.sky.dispose(); renderer.dispose(); previewRenderer.dispose(); });
show('loading', false); show('lobby', true); room.connect(); requestAnimationFrame(frame);

if (DEBUG) window.hunt = { room, menu, environment, get state() { return state; }, scene, renderer, camera, actors,
  step(seconds) { if (!room.isHost) return; for (let t = 0; t < seconds; t += 1 / 60) room.game.update(1 / 60, new Map()); room.tick(0, {}); },
  place(id, x, z) { if (!room.isHost) return; const p = room.game.players.find(p => p.id === id); if (p) Object.assign(p, { x, z }); room.tick(0, {}); } };

await prepareScene({ renderer, scene, camera });
