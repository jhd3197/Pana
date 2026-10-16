// ¡Embuste! wiring: input → network (room or practice) → view → scene and HUD.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { sound } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { holdButton } from '/engine/touch.js';
import { shout } from '/engine/kit.js';
import { pixelRatio, bindRenderer } from '/engine/settings.js';
import { OnlineNight, PracticeNight } from './network.js';
import { createCampWorld } from './scene.js';
import { zoneAt, FIRE } from './layout.js';
import { mummyCount, MIN_PLAYERS } from './rules.js';

const $ = id => document.getElementById(id), show = (id, on) => $(id).classList.toggle('hidden', !on);
const qs = new URLSearchParams(location.search), code = roomFromUrl() || newRoomCode();
const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState(null, '', url);
const avatar = loadAvatar(), name = qs.get('name')?.slice(0, 16) || loadName(), quick = qs.has('quick');
const colors = ['#ffb36b', '#81c8c4', '#d2a0a0', '#a3bc74', '#f2d16b', '#b7a8ce', '#6ea6d0', '#e58fb6', '#c1c5a6'];

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true });
renderer.setPixelRatio(pixelRatio(1.5)); const unbind = bindRenderer(renderer, 1.5);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d22); scene.fog = new THREE.FogExp2(0x0b0d22, 0.018);
const moon = new THREE.HemisphereLight(0x6f7fd8, 0x121226, 0.9); scene.add(moon);
const fireLight = new THREE.PointLight(0xff9a45, 90, 26, 1.5); fireLight.position.set(FIRE.x, 2.2, FIRE.z); scene.add(fireLight);
const lantern = new THREE.PointLight(0xffd08a, 26, 12, 1.6); scene.add(lantern);
const world = createCampWorld(); scene.add(world.group);
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 220);
const cameraTarget = new THREE.Vector3(0, 0, 0), temp = new THREE.Vector3();

// ---------- state ----------
let net = null, view = null, lobby = { phase: 'lobby', players: [], isHost: false }, paused = false, dead = false, phase = '';
let toastTimer, last = performance.now(), elapsed = 0, rosterKey = '';
const actors = new Map(), keys = new Set(), touch = new Set();
const me = () => view?.me;
const rosterOf = seat => view?.roster.find(r => r.seat === seat);
const colorOf = seat => { const i = view?.roster.findIndex(r => r.seat === seat) ?? 0; return colors[Math.max(0, i) % colors.length]; };

function notify(text) { if (!text) return; $('toast').textContent = text; show('toast', true); clearTimeout(toastTimer); toastTimer = setTimeout(() => show('toast', false), 3400); }
function clearInput() { keys.clear(); touch.clear(); }

const menu = createGameMenu({
  title: '¡Embuste!', heading: 'Un respiro', resumeLabel: 'Volver a la noche', sound, notify,
  note: () => net && !net.online ? 'La práctica está en pausa.' : 'La noche sigue: no te quedes solo.',
  controls: [['W A S D / ↑ ← ↓ →', 'Moverte'], ['E', 'Usar: tareas, escondites, la campana; mantén para reparar'], ['R', 'Reportar una estatua de vendas'], ['Q', 'Envolver (momia)'], ['F', 'Sabotaje (momia)'], ['C', 'Disfraz (momia)'], ['M', 'Sonido']],
  tips: ['Las tareas tapan la pantalla: mira a tu alrededor antes de empezar.', 'Si encuentras a un pana envuelto, repórtalo y discutan en la fogata.', 'Las momias pueden meterse en los troncos huecos y aparecer al otro lado del mapa.'],
  actions: [{ id: 'menu-practice', label: 'Practicar con bots', kind: 'link', visible: () => !!net?.online, run: () => practice() }],
  invite: () => inviteUrl(code),
  onOpen() { paused = true; clearInput(); if (net && !net.online) net.paused = true; },
  onClose() { paused = false; if (net && !net.online) net.paused = false; },
});
const navButton = 'pk-btn pk-btn--sm';
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: navButton }), menu.createSoundButton({ id: 'sound', className: navButton }), menu.createButton({ id: 'menu', className: navButton }));
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));

// ---------- connection ----------
function wire(n) {
  n.on('lobby', l => { lobby = l; updateLobby(); });
  n.on('view', v => receive(v));
  n.on('status', (text, error) => {
    $('connection').textContent = text;
    show('disconnect', !!error && !!view && view.phase !== 'lobby' && n.online);
    updateLobby();
  });
}
async function goOnline() {
  net = new OnlineNight({ code, name, avatar, quick }); wire(net);
  await net.connect(); updateLobby();
}
function practice() {
  net?.leave(); view = null;
  net = new PracticeNight({ name, avatar, quick }); wire(net); net.connect();
  show('disconnect', false); menu.update(); updateLobby();
}

// ---------- actors ----------
function label(text, color) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0e0b24d8'; ctx.beginPath(); ctx.roundRect(8, 7, 240, 48, 8); ctx.fill();
  ctx.fillStyle = color; ctx.font = '800 25px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 32, 224);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })); sprite.scale.set(2.6, 0.65, 1); sprite.position.y = 3.1; sprite.renderOrder = 5; return sprite;
}
function disposeObject(root) {
  const geometries = new Set(), materials = new Set(); root.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(m); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => { m.map?.dispose(); m.dispose(); }); root.removeFromParent();
}
function removeActor(a) { a.character.dispose(); disposeObject(a.root); }
function actorFor(seat) {
  const r = rosterOf(seat); if (!r) return null;
  const skin = JSON.stringify(r.avatar) + r.name + (r.role || '');
  let a = actors.get(seat);
  if (a && a.skin === skin) return a;
  if (a) removeActor(a);
  const root = new THREE.Group(), character = buildCharacter(r.avatar);
  const partner = view.partners.includes(seat);
  const tag = label(seat === me().seat ? `${r.name} · tú` : r.name, partner ? '#9fe0c8' : colorOf(seat));
  root.add(character.group, tag); scene.add(root);
  a = { seat, root, character, tag, skin, seen: false }; actors.set(seat, a);
  return a;
}
function syncActors() {
  for (const [seat, a] of actors) if (!rosterOf(seat)) { removeActor(a); actors.delete(seat); }
  const seen = new Set(view.players.map(p => p.seat));
  for (const p of view.players) {
    const a = actorFor(p.seat); if (!a) continue;
    if (!a.seen) a.root.position.set(p.x, 0, p.z);
    a.seen = true; a.target = p;
  }
  for (const a of actors.values()) if (!seen.has(a.seat)) { a.seen = false; a.root.visible = false; }
}

// ---------- view ----------
function receive(v) {
  view = v;
  if (phase !== v.phase) enterPhase(v.phase);
  syncActors();
  for (const e of v.events) handleEvent(e);
  updateHud();
}
function enterPhase(next) {
  const was = phase; phase = next;
  menu.close(); clearInput();
  document.body.classList.toggle('playing', next === 'playing');
  if (next === 'reveal') showReveal();
  if (next === 'playing' && was === 'reveal') { const p = me(); if (p) cameraTarget.set(p.x ?? 0, 0, p.z ?? 0); }
  updateLobby();
}
function handleEvent(e) {
  if (e.kind === 'night') shout('¡Cayó la noche!', { tone: 'yellow' });
  if (e.kind === 'left') notify(`${e.name} se fue del campamento${e.role === 'momia' ? ': era una momia.' : '.'}`);
  if (e.kind === 'end') sound.tone(e.winner === 'panas' ? 660 : 160, 0, 0.6, 'triangle', 0.08);
}
function showReveal() {
  const role = me()?.role, mummy = role === 'momia';
  $('reveal').classList.toggle('is-mummy', mummy);
  $('reveal-title').textContent = mummy ? 'Una momia' : 'Un pana';
  const partners = view.partners.map(s => rosterOf(s)?.name).filter(Boolean);
  $('reveal-copy').textContent = mummy
    ? `Tienes vendas debajo de la camisa. Finge las tareas, envuelve a los panas cuando estén solos y que nadie lo sepa.${partners.length ? ` Tu compinche: ${partners.join(', ')}.` : ''}`
    : 'Mantén el campamento funcionando hasta que amanezca. Si ves algo raro, llama a una reunión en la fogata.';
  sound.tone(mummy ? 140 : 520, 0, 0.5, 'triangle', 0.08);
}

function updateLobby() {
  const inLobby = !view || view.phase === 'lobby' || lobby.phase === 'lobby';
  show('lobby', inLobby); show('loading', false);
  show('reveal', view?.phase === 'reveal'); show('hud', !!view && ['playing'].includes(view.phase));
  show('results', view?.phase === 'ended');
  const connected = !!net?.connected, host = lobby.isHost;
  const count = lobby.players.length, filled = lobby.bots ? Math.max(6, count) : count;
  $('start').disabled = !connected || !host || (!lobby.bots && count < MIN_PLAYERS && !quick);
  $('start').textContent = !connected ? 'Conectando…' : !host ? 'El anfitrión prende la fogata' : !lobby.bots && count < MIN_PLAYERS ? `Faltan panas (mínimo ${MIN_PLAYERS})` : '¡Que caiga la noche!';
  $('stat-mummies').textContent = mummyCount(Math.min(8, filled));
  $('lobby-options').classList.toggle('is-guest', !host);
  for (const k of ['bots', 'reveal', 'chat']) $(`opt-${k}`).setAttribute('aria-checked', String(lobby[k] !== false));
  $('practice').textContent = net && !net.online ? 'Volver a la sala online' : 'Practicar con bots en este navegador';
  const key = lobby.players.map(p => `${p.seat}:${p.name}:${p.host}`).join('|');
  if (key !== rosterKey) {
    rosterKey = key;
    $('lobby-team').replaceChildren(...lobby.players.map((p, i) => {
      const chip = document.createElement('span'), dot = document.createElement('i'); chip.className = 'pk-chip'; dot.className = 'pk-dot'; dot.style.background = colors[i % colors.length];
      chip.append(dot, document.createTextNode(`${p.name}${p.me ? ' · tú' : ''}${p.host ? ' · anfitrión' : ''}`)); return chip;
    }));
  }
  $('again').disabled = $('to-lobby').disabled = !host;
  $('again').textContent = host ? 'Otra noche' : 'Esperando al anfitrión…';
}

function updateHud() {
  const p = me(); if (!p) return;
  const mine = view.players.find(q => q.seat === p.seat);
  if (mine) $('zone').textContent = zoneAt(mine).name;
  if (view.phase === 'ended') showResults();
}

function showResults() {
  const e = view.ending; if (!e) return;
  const panas = e.winner === 'panas', mine = me()?.role === (panas ? 'pana' : 'momia');
  $('result-eyebrow').textContent = panas ? 'Amaneció' : 'La noche no termina';
  $('result-title').textContent = mine ? '¡Ganaste!' : panas ? 'Ganaron los panas' : 'Ganaron las momias';
  $('result-copy').textContent = {
    tasks: 'La reliquia brilló, salió el sol y las momias volvieron a ser panas (un poco avergonzados).',
    votes: 'Mandaron a todas las momias río abajo en la curiara. El bote llega al amanecer.',
    numbers: 'Ya no quedan suficientes panas para mantener la reliquia encendida.',
    flood: 'Nadie cerró la represa a tiempo y el río se llevó el campamento.',
  }[e.reason] || '';
  $('result-roster').replaceChildren(...view.roster.filter(r => !r.spectator).map(r => {
    const li = document.createElement('li'); li.className = `pk-row${r.seat === me().seat ? ' is-me' : ''}${r.role === 'momia' ? ' is-mummy' : ''}`;
    const nameNode = document.createElement('span'); nameNode.className = 'pk-row-name'; nameNode.textContent = r.name;
    const end = document.createElement('b'); end.className = 'pk-row-end'; end.textContent = r.role === 'momia' ? 'Momia' : 'Pana';
    li.append(nameNode, end); return li;
  }));
}

// ---------- input ----------
function input() {
  if (paused || view?.phase !== 'playing') return { x: 0, z: 0, hold: false };
  const x = +(keys.has('d') || keys.has('arrowright') || touch.has('right')) - +(keys.has('a') || keys.has('arrowleft') || touch.has('left'));
  const z = +(keys.has('s') || keys.has('arrowdown') || touch.has('down')) - +(keys.has('w') || keys.has('arrowup') || touch.has('up'));
  return { x, z, hold: keys.has('e') || touch.has('use') };
}
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || paused) return;
  const key = e.key.toLowerCase(); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
  keys.add(key); if (e.repeat) return;
  if (key === 'm') toggleMute();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); addEventListener('blur', clearInput); document.addEventListener('visibilitychange', clearInput);
for (const button of document.querySelectorAll('[data-move]')) holdButton(button, { paused: () => paused, down: () => touch.add(button.dataset.move), up: () => touch.delete(button.dataset.move) });

$('start').onclick = () => net?.start();
$('again').onclick = () => net?.start();
$('to-lobby').onclick = () => net?.toLobby();
$('practice').onclick = () => (net && !net.online ? (net.leave(), view = null, goOnline()) : practice());
$('offline-inline').onclick = () => practice();
for (const k of ['bots', 'reveal', 'chat']) $(`opt-${k}`).onclick = () => { if (lobby.isHost) net?.options({ [k]: lobby[k] === false }); };

// ---------- frame ----------
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const ticker = setInterval(() => { if (net?.connected && view && view.phase !== 'lobby') net.input(input()); }, 50);

function frame(now) {
  if (dead) return;
  const dt = Math.min(0.06, (now - last) / 1000); last = now; elapsed += dt;
  for (const a of actors.values()) {
    const p = a.target; if (!a.seen || !p) continue;
    a.root.visible = true;
    temp.set(p.x, 0, p.z); if (a.root.position.distanceTo(temp) > 6) a.root.position.copy(temp); else a.root.position.lerp(temp, Math.min(1, dt * 14));
    const diff = Math.atan2(Math.sin(p.h - a.character.group.rotation.y), Math.cos(p.h - a.character.group.rotation.y)); a.character.group.rotation.y += diff * Math.min(1, dt * 12);
    a.character.update(dt, { walk: p.moving ? 1 : 0 });
  }
  const mine = view && actors.get(me()?.seat);
  if (!view || view.phase === 'lobby') {
    const a = elapsed * 0.08; camera.position.set(Math.sin(a) * 26, 17, Math.cos(a) * 26); camera.lookAt(0, 0, 0);
  } else if (view.phase === 'reveal' && mine) {
    temp.copy(mine.root.position); camera.position.lerp(temp.clone().add(new THREE.Vector3(0, 2.4, 5.2)), Math.min(1, dt * 3)); camera.lookAt(temp.x, 1.2, temp.z);
  } else if (mine) {
    temp.copy(mine.root.position); cameraTarget.lerp(temp, Math.min(1, dt * 8));
    camera.position.set(cameraTarget.x, 16, cameraTarget.z + 11); camera.lookAt(cameraTarget.x, 0, cameraTarget.z);
  }
  if (mine) lantern.position.set(mine.root.position.x, 2.6, mine.root.position.z + 0.6);
  darkness(mine);
  world.update(elapsed, view, dt); renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// The lantern circle on screen: an ellipse around your pana, sized by your vision.
function darkness(mine) {
  const dark = $('dark'), p = me();
  document.body.classList.toggle('ghost', !!p?.ghost);
  if (!mine || !p || !p.vision) return;
  const center = mine.root.position.clone().project(camera), side = mine.root.position.clone().add(new THREE.Vector3(p.vision, 0, 0)).project(camera), depth = mine.root.position.clone().add(new THREE.Vector3(0, 0, -p.vision)).project(camera);
  const w = innerWidth / 2, h = innerHeight / 2;
  dark.style.setProperty('--fx', `${(center.x + 1) * w}px`); dark.style.setProperty('--fy', `${(1 - center.y) * h}px`);
  dark.style.setProperty('--rx', `${Math.abs(side.x - center.x) * w}px`); dark.style.setProperty('--ry', `${Math.abs(depth.y - center.y) * h}px`);
}

if (qs.has('practice')) practice(); else goOnline();
requestAnimationFrame(frame);
addEventListener('pagehide', () => {
  dead = true; clearInterval(ticker); clearTimeout(toastTimer); net?.leave(); menu.dispose?.(); unbind?.();
  actors.forEach(removeActor); world.dispose(); renderer.dispose();
});
if (qs.has('debug')) window.embuste = { scene, camera, renderer, actors, world, menu, input,
  get net() { return net; }, get view() { return view; }, get lobby() { return lobby; } };
