import * as THREE from 'three';
import { buildCharacter } from '/engine/character.js';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { sound } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton as hold } from '/engine/touch.js';
import { shout } from '/engine/kit.js';
import { pixelRatio, bindRenderer } from '/engine/settings.js';
import { mummy, sunRelic, expeditionLantern } from '/engine/models/props/reliquia.js';
import { Expedition, interaction, objective } from './rules.js';
import { ExpeditionRoom } from './network.js';
import { createExpeditionWorld, groundAt } from './scene.js';
import { CAMP, ALTAR, WINCHES, ROOMS, regionAt, distance } from './layout.js';

const $ = id => document.getElementById(id), show = (id, on) => $(id).classList.toggle('hidden', !on);
const qs = new URLSearchParams(location.search), code = (qs.get('room') || Math.random().toString(36).slice(2, 8)).slice(0, 24);
const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState(null, '', url);
const avatar = loadAvatar(), name = qs.get('name')?.slice(0, 16) || loadName();
const renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true });
renderer.setPixelRatio(pixelRatio(1.5)); const unbind = bindRenderer(renderer, 1.5);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x183b34); scene.fog = new THREE.FogExp2(0x183b34, 0.012);
scene.add(new THREE.HemisphereLight(0xe4f2d3, 0x425c4a, 2.25));
const sun = new THREE.DirectionalLight(0xffd49a, 3.3); sun.position.set(-16, 35, 23); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 100 }); sun.shadow.bias = -0.001; sun.shadow.normalBias = 0.06; scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0x77bca9, 1.3); fill.position.set(20, 15, -25); scene.add(fill);
const lanternLight = new THREE.PointLight(0xffc267, 20, 15, 1.8); scene.add(lanternLight);
const world = createExpeditionWorld(); scene.add(world.group);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 250);
let state = new Expedition().snapshot(), paused = false, failed = false, phase = '', lastEvent = 0, last = performance.now(), elapsed = 0, dead = false;
let yaw = 0.25, pitch = 0.76, zoom = 15, toastTimer, rosterKey = '', uiElapsed = 0;
const cameraTarget = new THREE.Vector3(0, 1.1, 15), temp = new THREE.Vector3(), desired = new THREE.Vector3();
const actors = new Map(), enemyActors = new Map(), keys = new Set(), touch = new Set();
const colors = ['#dfb86d', '#81c8c4', '#d2a0a0', '#a3bc74', '#d9966e', '#b7a8ce', '#6ea6d0', '#c1c5a6'];
function notify(text) { if (!text) return; $('toast').textContent = text; show('toast', true); clearTimeout(toastTimer); toastTimer = setTimeout(() => show('toast', false), 3600); }
function clearInput() { keys.clear(); touch.clear(); }
const menu = createGameMenu({
  orientation: 'vertical',
  title: 'Reliquia', heading: 'Un respiro', resumeLabel: 'Volver a la expedición', sound, notify,
  note: () => room.offline || room.members.size === 1 ? 'La expedición está pausada.' : 'Tus panas siguen explorando.',
  controls: [['W A S D / ↑ ← ↓ →', 'Moverte'], ['Espacio', 'Golpear; también puedes hacer clic'], ['Shift', 'Esquivar un golpe'], ['E', 'Interactuar; mantén para girar o revivir'], ['R', 'Usar un botiquín'], ['Q', 'Centrar la cámara'], ['M', 'Sonido']],
  tips: ['Arrastra el escenario para girar la cámara. Las marcas rojas en el suelo anuncian un ataque: sal de ellas o esquiva.', 'Mantén E en cada rueda. Al soltarla queda activa doce segundos: puedes llegar a la otra incluso jugando solo.', 'Al recoger la reliquia se abre el túnel de regreso. Levanten a los panas caídos, reúnanse en el círculo del campamento y mantengan E.'],
  actions: [{ id: 'offline', label: 'Abrir expedición local', kind: 'link', visible: () => failed, run: () => room.practice() }],
  invite() { const link = new URL(location.href); ['debug', 'name', 'manual'].forEach(k => link.searchParams.delete(k)); return link.href; },
  onOpen() { paused = true; clearInput(); }, onClose() { paused = false; },
});
const navButton = 'pk-btn pk-btn--sm';
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: navButton }), menu.createSoundButton({ id: 'sound', className: navButton }), menu.createButton({ id: 'menu', className: navButton }));
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));
const room = new ExpeditionRoom({ code, name, avatar, onState: receive, onNotice: notify,
  onStatus(text, error = false) { failed = error; $('connection').textContent = text; show('practice', error); show('disconnect', error && state.phase === 'playing'); menu.update(); updateUI(); },
});
const me = () => state.players.find(p => p.id === room.id);

function label(text, color) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0e0b24e0'; ctx.beginPath(); ctx.roundRect(8, 7, 240, 48, 8); ctx.fill();
  ctx.fillStyle = color; ctx.font = '800 25px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 32, 224);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false })); sprite.scale.set(2.7, 0.675, 1); sprite.position.y = 3.25; return sprite;
}
function disposeObject(root) {
  const geometries = new Set(), materials = new Set(); root.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(m); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => { m.map?.dispose(); m.dispose(); }); root.removeFromParent();
}
function removeActor(a) { a.character.carry.remove(a.carried); a.root.remove(a.lantern); a.character.dispose(); disposeObject(a.root); disposeObject(a.carried); disposeObject(a.lantern); }
function syncActors() {
  for (const [id, actor] of actors) if (!state.players.some(p => p.id === id)) { removeActor(actor); actors.delete(id); }
  for (const [i, p] of state.players.entries()) {
    const skin = JSON.stringify(p.avatar); let actor = actors.get(p.id);
    if (!actor || actor.skin !== skin) {
      if (actor) removeActor(actor);
      const root = new THREE.Group(), character = buildCharacter(p.avatar), tag = label(p.id === room.id ? `${p.name} · tú` : p.name, colors[i % 8]);
      root.add(character.group, tag); root.position.set(p.x, groundAt(p.x, p.z), p.z); scene.add(root);
      const carried = sunRelic(); carried.scale.setScalar(0.55); character.carry.add(carried);
      const lantern = expeditionLantern(); lantern.position.set(-0.6, 1.25, 0.1); root.add(lantern);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.25), new THREE.MeshStandardMaterial({ color: 0xd8d3b4, metalness: 0.55, roughness: 0.35 }));
      blade.position.set(0.8, 1.2, 0.7); blade.rotation.z = -0.4; root.add(blade);
      actor = { root, character, tag, carried, lantern, blade, skin }; actors.set(p.id, actor);
    }
    actor.carried.visible = state.carrier === p.id; actor.tag.visible = state.phase === 'playing'; actor.root.visible = !p.spectator;
  }
  for (const [id, actor] of enemyActors) if (!state.enemies.some(e => e.id === id)) { disposeObject(actor.root); enemyActors.delete(id); }
  for (const e of state.enemies) if (!enemyActors.has(e.id)) {
    const root = new THREE.Group(), model = mummy({ guardian: e.kind === 'guardian' }); root.add(model); root.position.set(e.x, groundAt(e.x, e.z), e.z); scene.add(root);
    const danger = new THREE.Mesh(new THREE.RingGeometry(e.kind === 'guardian' ? 3.55 : 1.9, e.kind === 'guardian' ? 3.8 : 2.2, 48), new THREE.MeshBasicMaterial({ color: 0xff7047, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    danger.rotation.x = -Math.PI / 2; danger.position.y = 0.06; root.add(danger);
    const hp = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.09), new THREE.MeshBasicMaterial({ color: 0xd6b871, side: THREE.DoubleSide })); hp.position.y = e.kind === 'guardian' ? 5.2 : 3; root.add(hp);
    enemyActors.set(e.id, { root, model, danger, hp });
  }
}
function receive(next) {
  state = next; syncActors();
  if (phase !== state.phase) { phase = state.phase; menu.close(); clearInput(); document.body.classList.toggle('playing', phase === 'playing'); if (phase === 'playing') { const p = me(); if (p) cameraTarget.set(p.x, 1.1, p.z); } }
  const events = state.events.filter(e => e.id > lastEvent); lastEvent = Math.max(lastEvent, ...state.events.map(e => e.id), 0);
  for (const e of events) {
    if (e.text) notify(e.text);
    if (e.kind === 'hit') sound.bonk(0.2);
    if (e.kind === 'swing') sound.tone(130, 0, 0.08, 'triangle', 0.025);
    if (['gate', 'relic', 'win', 'revive'].includes(e.kind)) { sound.tone(440, 0, 0.16, 'sine', 0.08); sound.tone(660, 0.12, 0.2, 'sine', 0.06); }
    if (e.kind === 'boss') sound.tone(90, 0, 0.8, 'triangle', 0.1);
    const big = SHOUTS[e.kind]; if (big) shout(big[0], { tone: big[1] });
  }
  updateUI();
}
// Big tilted callouts for the beats of a run; the toast keeps the full sentence.
const SHOUTS = { awaken: ['¡Una momia despertó!', 'coral'], gate: ['¡Templo abierto!', 'teal'], boss: ['¡El guardián despertó!', 'coral'],
  guardian: ['¡Guardián vencido!', 'yellow'], relic: ['¡La reliquia es nuestra!', 'yellow'], down: ['¡Pana caído!', 'coral'] };
const hearts = hp => { const n = Math.ceil(Math.max(0, hp) / 34); return '♥'.repeat(n) + '♡'.repeat(3 - n); };
function missionSteps() {
  const wheels = Object.values(state.winches).filter(w => w.latched > 0).length;
  const steps = [[state.gateOpen ? 'Girar las dos ruedas' : `Girar las dos ruedas (${wheels}/2)`, state.gateOpen], ['Vencer al guardián', state.guardianDefeated], ['Recoger la reliquia', state.relicTaken], ['Volver al campamento', state.phase === 'results' && state.outcome === 'win']];
  const current = steps.findIndex(s => !s[1]);
  return steps.map(([text, done], i) => ({ text, state: done ? 'done' : i === current ? 'now' : 'todo' }));
}
let stepsKey = '';
function updateUI() {
  const playing = state.phase === 'playing', p = me();
  show('lobby', state.phase === 'lobby'); show('location-card', state.phase === 'lobby'); show('hud', playing); show('results', state.phase === 'results');
  $('start').disabled = !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? 'Conectando…' : room.isHost ? '¡A la mina!' : 'El anfitrión prepara la salida';
  $('again').disabled = !room.connected || !room.isHost; $('again').textContent = room.isHost ? '¡Otra expedición!' : 'Esperando al anfitrión…';
  const roster = state.players.map(p => `${p.id}:${p.name}`).join('|');
  if (roster !== rosterKey) {
    rosterKey = roster; $('lobby-team').replaceChildren(); $('team').replaceChildren();
    state.players.forEach((p, i) => {
      const chip = document.createElement('span'), dot = document.createElement('i'); chip.className = 'pk-chip'; dot.className = 'pk-dot'; dot.style.background = colors[i % 8]; chip.append(dot, document.createTextNode(p.id === room.id ? `${p.name} · tú` : p.name)); $('lobby-team').append(chip);
      const row = document.createElement('li'); row.className = `pk-row teammate${p.id === room.id ? ' is-me' : ''}`; row.dataset.player = p.id;
      const face = document.createElement('span'); face.className = 'pk-avatar'; face.style.background = colors[i % 8]; face.textContent = p.name.slice(0, 1).toUpperCase();
      const name = document.createElement('span'); name.className = 'teammate-name'; name.textContent = p.name;
      const value = document.createElement('b'); value.className = 'pk-row-end'; row.append(face, name, value); $('team').append(row);
    });
  }
  state.players.forEach(p => { const row = $('team').querySelector(`[data-player="${p.id}"]`); if (!row) return; const value = row.querySelector('b'); value.textContent = p.downed ? 'AYUDA' : p.spectator ? 'EN ESPERA' : hearts(p.hp); value.title = `${Math.ceil(p.hp)} de vitalidad`; row.classList.toggle('fallen', p.downed); row.classList.toggle('waiting', p.spectator); });
  $('objective').textContent = state.relicTaken ? 'Vuelvan al campamento' : !state.gateOpen ? 'Abre el templo' : !state.guardianDefeated ? 'Vence al guardián' : 'Toma la reliquia';
  $('objective').title = objective(state);
  const steps = missionSteps(), key = steps.map(s => s.text + s.state).join('|');
  if (key !== stepsKey) { stepsKey = key; $('mission-steps').replaceChildren(...steps.map(s => { const li = document.createElement('li'); li.className = `is-${s.state}`; li.textContent = s.text; return li; })); }
  $('region').textContent = p ? regionAt(p).name : 'Campamento';
  $('health-number').textContent = Math.ceil(p?.hp || 0); $('health-fill').parentElement.style.setProperty('--pk-value', String((p?.hp || 0) / 100));
  $('meds').textContent = `×${p?.heals || 0}`; $('slot-meds').classList.toggle('is-empty', !p?.heals); $('slot-relic').classList.toggle('is-active', state.carrier === p?.id); $('slot-relic').classList.toggle('is-empty', state.carrier !== p?.id);
  $('player-note').textContent = state.carrier === p?.id ? 'Llevas la reliquia. Tus panas te cubren.' : p?.downed ? 'Un pana puede levantarte.' : state.relicTaken ? 'El túnel de regreso está abierto.' : 'Juntos hasta la salida.';
  const target = interaction(state, p); show('interact', playing && !!target && !paused);
  if (target) { $('interaction-label').textContent = target.text; $('interaction-fill').style.width = `${Math.min(1, target.progress) * 100}%`; }
  for (const id of ['attack', 'dodge', 'heal']) $(id).disabled = !room.connected || !p || p.downed || p.spectator || (id === 'dodge' && p.dodgeCooldown > 0) || (id === 'heal' && (p.hp >= 100 || !p.heals));
  show('downed', playing && !!p?.downed); document.body.classList.toggle('hurt', !!p && p.hit > 0);
  const guardian = state.enemies.find(e => e.kind === 'guardian');
  const bossVisible = playing && !!guardian && !!p && distance(p, guardian) < 32;
  show('boss', bossVisible); show('compass', !bossVisible);
  if (guardian) $('boss-fill').parentElement.style.setProperty('--pk-value', String(guardian.hp / guardian.maxHp));
  $('destination').textContent = state.relicTaken ? 'CAMPAMENTO' : !state.gateOpen ? 'LAS RUEDAS' : 'LA RELIQUIA';
  if (state.phase === 'results') {
    $('result-eyebrow').textContent = state.outcome === 'win' ? 'Expedición completada' : 'El templo sigue en pie';
    $('result-title').textContent = state.outcome === 'win' ? 'Volvimos juntos.' : 'Una vuelta más.';
    $('result-copy').textContent = state.outcome === 'win' ? 'Una reliquia recuperada. Una historia más para contar con tus panas.' : 'Las momias ganaron esta vez. Esquiven las marcas rojas y levanten a sus panas antes de seguir.';
    $('result-time').textContent = `${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`;
    $('result-kills').textContent = state.kills; $('result-revives').textContent = state.players.reduce((n, p) => n + p.revives, 0);
  }
}
function act(action) { if (!paused && state.phase === 'playing') room.action(action); }
$('start').onclick = () => room.action('start'); $('again').onclick = () => room.action('start');
$('practice').onclick = $('offline-inline').onclick = () => room.practice();
$('attack').onclick = () => act('attack'); $('dodge').onclick = () => act('dodge'); $('heal').onclick = () => act('heal');
function holdButton(button, key, begin) {  // engine/touch.js, one key per button
  hold(button, { paused: () => paused, down: () => { touch.add(key); begin?.(); }, up: () => touch.delete(key) });
}
holdButton($('interact'), 'hold', () => act('interact'));
for (const button of document.querySelectorAll('[data-move]')) holdButton(button, button.dataset.move);
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || paused) return;
  const key = e.key.toLowerCase(); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
  keys.add(key); if (e.repeat) return;
  if (key === ' ') act('attack'); if (key === 'shift') act('dodge'); if (key === 'e') act('interact'); if (key === 'r') act('heal'); if (key === 'q') yaw = 0; if (key === 'm') toggleMute();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); addEventListener('blur', clearInput); document.addEventListener('visibilitychange', clearInput);
let drag = null;
$('world').addEventListener('pointerdown', e => { if (paused || state.phase !== 'playing') return; drag = { x: e.clientX, y: e.clientY, distance: 0, id: e.pointerId }; $('world').setPointerCapture(e.pointerId); });
$('world').addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; yaw -= dx * 0.006; pitch = THREE.MathUtils.clamp(pitch + dy * 0.003, 0.65, 1.12); drag.distance += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY; });
$('world').addEventListener('pointerup', e => { if (drag && drag.distance < 5 && e.pointerType === 'mouse') act('attack'); drag = null; });
$('world').addEventListener('pointercancel', () => { drag = null; });
$('world').addEventListener('wheel', e => { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom + e.deltaY * 0.01, 12, 23); }, { passive: false });
function input() {
  if (paused || state.phase !== 'playing') return { x: 0, z: 0, hold: false };
  const x = +(keys.has('d') || keys.has('arrowright') || touch.has('right')) - +(keys.has('a') || keys.has('arrowleft') || touch.has('left'));
  const z = +(keys.has('s') || keys.has('arrowdown') || touch.has('down')) - +(keys.has('w') || keys.has('arrowup') || touch.has('up'));
  return { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: -x * Math.sin(yaw) + z * Math.cos(yaw), hold: keys.has('e') || touch.has('hold') };
}
const mapCtx = $('minimap').getContext('2d');
function minimap() {
  const c = mapCtx, sx = x => 18 + (x + 14) * 1.75, sz = z => 10 + (z + 127) * 1.25;
  c.clearRect(0, 0, 170, 220);
  for (const r of ROOMS) { c.fillStyle = r.id === 'shortcut' || r.id === 'return' ? (state.relicTaken ? '#148f78' : '#231a47') : '#4a3f80'; c.fillRect(sx(r.x - r.w / 2), sz(r.z - r.d / 2), r.w * 1.75, r.d * 1.25); }
  const target = state.relicTaken ? CAMP : !state.gateOpen ? { x: 40, z: -38 } : ALTAR;
  c.fillStyle = '#ffc629'; c.beginPath(); c.arc(sx(target.x), sz(target.z), 4, 0, Math.PI * 2); c.fill();
  for (const [i, p] of state.players.entries()) { c.fillStyle = p.downed ? '#ff4b4b' : colors[i % 8]; c.beginPath(); c.arc(sx(p.x), sz(p.z), p.id === room.id ? 3.5 : 2.5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#0e0b24'; c.lineWidth = 1; c.stroke(); }
}
// Compass strip: +-90 degrees around the camera heading. North is -z.
const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'].map((text, i) => ({ text, angle: i * Math.PI / 4 }));
const compassNodes = new Map();
function compassNode(key, text, className) {
  let node = compassNodes.get(key);
  if (!node) { node = Object.assign(document.createElement('span'), { className }); $('compass-strip').append(node); compassNodes.set(key, node); }
  if (node.textContent !== text) node.textContent = text; return node;
}
function compass(p, destination) {
  // Cardinals scroll off the strip; place tags pin to its edge so the way back is never lost.
  const place = (node, bearing, pin = false) => {
    const rel = Math.atan2(Math.sin(bearing + yaw), Math.cos(bearing + yaw)), x = 50 + rel / Math.PI * 100;
    node.hidden = !pin && Math.abs(rel) > Math.PI / 2; node.style.left = `${pin ? Math.max(12, Math.min(88, x)) : x}%`;
  };
  for (const c of CARDINALS) place(compassNode(c.text, c.text, `compass-mark${c.text === 'N' ? ' is-north' : ''}`), c.angle);
  place(compassNode('camp', 'CAMPAMENTO', 'compass-tag is-camp'), Math.atan2(CAMP.x - p.x, -(CAMP.z - p.z)), true);
  const goal = compassNode('goal', $('destination').textContent.replace(/^(LAS?|EL) /, ''), 'compass-tag is-goal');
  place(goal, Math.atan2(destination.x - p.x, -(destination.z - p.z)), true); if (destination === CAMP) goal.hidden = true;
}
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const ticker = setInterval(() => { if (!qs.has('manual')) room.tick(0.05, input(), paused && (room.offline || room.members.size === 1)); }, 50);
function frame(now) {
  if (dead) return;
  const dt = Math.min(0.06, (now - last) / 1000); last = now; elapsed += dt; uiElapsed += dt;
  for (const p of state.players) {
    const a = actors.get(p.id); if (!a) continue;
    temp.set(p.x, groundAt(p.x, p.z), p.z); if (a.root.position.distanceTo(temp) > 8) a.root.position.copy(temp); else a.root.position.lerp(temp, Math.min(1, dt * 16));
    const diff = Math.atan2(Math.sin(p.h - a.character.group.rotation.y), Math.cos(p.h - a.character.group.rotation.y)); a.character.group.rotation.y += diff * Math.min(1, dt * 14);
    a.character.group.rotation.z = p.downed ? 1.3 : p.dodge > 0 ? -0.25 : 0;
    a.character.update(dt, { walk: p.moving && !p.downed ? 1 : 0, carry: state.carrier === p.id, run: p.dodge > 0, dizzy: p.downed });
    a.blade.visible = !p.downed && state.carrier !== p.id;
    const angle = p.h + (p.attack > 0 ? (1 - p.attack / 0.3) * 3 - 1.5 : 0.5);
    a.blade.position.set(Math.sin(angle) * (p.attack > 0 ? 1.7 : 0.8), 1.35, Math.cos(angle) * (p.attack > 0 ? 1.7 : 0.8)); a.blade.rotation.y = angle; a.blade.rotation.z = p.attack > 0 ? 1.2 : -0.4;
  }
  for (const e of state.enemies) {
    const a = enemyActors.get(e.id); temp.set(e.x, groundAt(e.x, e.z), e.z); a.root.position.lerp(temp, Math.min(1, dt * 15));
    a.model.rotation.y = e.h; a.model.userData.animate(elapsed + e.id, e.windup <= 0, e.windup > 0);
    a.model.position.y = e.hit > 0 ? 0.12 : 0; a.danger.visible = e.windup > 0; a.danger.material.opacity = 0.55 + Math.sin(elapsed * 18) * 0.2;
    a.hp.scale.x = Math.max(0.01, e.hp / e.maxHp); a.hp.quaternion.copy(camera.quaternion); a.hp.visible = e.hp < e.maxHp;
  }
  const p = me(), a = p && actors.get(p.id);
  if (state.phase === 'lobby') {
    const mobile = innerWidth < 761;
    camera.position.set(mobile ? 25 : 29, mobile ? 33 : 26, mobile ? 34 : 33);
    camera.lookAt(mobile ? 0 : -17, 0, mobile ? -4 : -6);
  } else if (a) {
    temp.copy(a.root.position); temp.y += 1.1; cameraTarget.lerp(temp, Math.min(1, dt * 8));
    desired.set(Math.sin(yaw) * Math.cos(pitch) * zoom, Math.sin(pitch) * zoom, Math.cos(yaw) * Math.cos(pitch) * zoom).add(cameraTarget);
    camera.position.lerp(desired, Math.min(1, dt * 10)); camera.lookAt(cameraTarget);
    sun.position.set(p.x - 16, 35, p.z + 23); sun.target.position.set(p.x, 0, p.z);
    const destination = state.relicTaken ? CAMP : !state.gateOpen ? { x: 40, z: -38 } : ALTAR;
    $('compass-arrow').style.transform = `rotate(${Math.atan2(destination.x - p.x, -(destination.z - p.z)) + yaw}rad)`;
    compass(p, destination);
  }
  lanternLight.position.set(p?.x || 0, 2.8, p?.z || 15);
  world.update(elapsed, state, dt); renderer.render(scene, camera);
  if (uiElapsed > 0.1) { minimap(); uiElapsed = 0; }
  requestAnimationFrame(frame);
}
show('loading', false); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => {
  dead = true; clearInterval(ticker); clearTimeout(toastTimer); room.dispose(); menu.dispose?.(); unbind?.();
  actors.forEach(removeActor); enemyActors.forEach(a => disposeObject(a.root)); world.dispose(); renderer.dispose();
});
if (qs.has('debug')) window.reliquia = { room, scene, camera, renderer, actors, enemyActors, world, menu, input, WINCHES, CAMP, ALTAR,
  get state() { return state; },
  step(seconds) { if (!room.isHost) return; for (let t = 0; t < seconds; t += 0.05) room.game.update(Math.min(0.05, seconds - t), room.inputs); room.publish(); },
  place(id, x, z) { const p = room.game?.players.find(p => p.id === id); if (p) { p.x = x; p.z = z; room.publish(); } },
};
