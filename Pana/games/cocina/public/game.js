import { createRoomOptions } from '/engine/room-options.js';
import { FIELDS, DEFAULT_OPTIONS } from './options.js';
import { prepareScene } from '/engine/game-load.js';
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { canvasMat } from '/engine/models/core/primitives.js';
import { food } from '/engine/models/props/kitchen.js';
import { sound } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl } from '/engine/invite.js';
import { roomCode } from '/engine/game-shell.js';
import { holdButton } from '/engine/touch.js';
import { shout } from '/engine/kit.js';
import { pixelRatio, bindRenderer, rendererOptions } from '/engine/settings.js';
import { Kitchen, RECIPES, STATIONS, recipe, nearestStation, say } from './rules.js';
import { KitchenRoom } from './network.js';
import { elapsedClock } from '/engine/live-room.js';
import { createKitchenScene, mealModel } from './scene.js';
import { createToast } from '/engine/hud.js';
import { loc, locn } from '/engine/i18n.js';

const $ = id => document.getElementById(id), show = (id, v) => $(id).classList.toggle('hidden', !v);
const notify = createToast($('toast'), { ms: 3100 });
const qs = new URLSearchParams(location.search), code = roomCode();
await Promise.race([document.fonts.load('900 48px Nunito'), new Promise(resolve => setTimeout(resolve, 1200))]);
const avatar = loadAvatar(), name = loadName();
const renderer = new THREE.WebGLRenderer(rendererOptions({ canvas: $('world'), antialias: true }));
renderer.setPixelRatio(pixelRatio(1.6)); bindRenderer(renderer, 1.6); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
const world = createKitchenScene(), { scene } = world;
const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 200);
const actors = new Map(), keys = new Set(), touch = new Set(), previews = new Map();
let state = new Kitchen().snapshot(), paused = false, canGoOffline = false, lastEvent = 0, lastPhase = '', renderedOrders = '', teamKey = '', heldKey = '', last = performance.now(), elapsed = 0;
let aimWidth = innerWidth, aimHeight = innerHeight, quiet = false;
function resize() {
  renderer.setSize(innerWidth, innerHeight); aimWidth = innerWidth; aimHeight = innerHeight;
  const ratio = innerWidth / innerHeight;
  const half = innerWidth <= 760 ? 14.5 / ratio : state.phase === 'lobby' ? 16 : 13.3;
  // In the lobby, centre the kitchen in the space right of the launcher column.
  const shift = state.phase === 'lobby' && innerWidth > 760 ? Math.min(560, innerWidth) / innerWidth * half * ratio : 0;
  camera.left = -half * ratio - shift; camera.right = half * ratio - shift; camera.top = half; camera.bottom = -half;
  camera.position.set(17, 28, 34); camera.lookAt(-0.5, 0.5, 2);
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
const menu = createGameMenu({
  pad: { move: 'wasd', keys: { a: ['KeyE', loc('Recoger, dejar o apagar')], x: ['KeyE', loc('Recoger, dejar o apagar')], b: ['ShiftLeft', loc('Un empujoncito')], rb: ['ShiftLeft', loc('Un empujoncito')] } },
  orientation: 'vertical',
  title: 'Pana Cocina', heading: loc('¿Y la sazón?'), resumeLabel: loc('Volver a cocinar'), // i18n-ignore: game name sound, notify,
  note: () => room.offline || room.members.size === 1 ? loc('Tu turno está pausado.') : loc('La cocina sigue para los demás panas.'),
  controls: [['W A S D / ↑ ← ↓ →', loc('Moverte')], [loc('E / Espacio'), loc('Recoger, dejar o apagar un fuego')], ['Shift', loc('Un empujoncito')], ['M', loc('Sonido')]],
  tips: [loc('Busca un cajón de ingredientes, déjalos en una tabla y recoge la preparación. Llévala al fogón; cuando esté verde, recoge el plato y sírvelo en el mostrador.'),
    loc('La mesa «Para tu pana» permite pasar platos.')],
  actions: [{ id: 'offline', label: loc('Abrir cocina local'), kind: 'link', visible: () => canGoOffline, run: () => room.practice() }],
  invite: () => inviteUrl(code),
  onOpen() { paused = true; keys.clear(); touch.clear(); },
  onClose() { paused = false; },
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn pk-btn--sm' }), menu.createSoundButton({ id: 'sound', className: 'pk-btn pk-btn--sm' }), menu.createButton({ id: 'menu', className: 'pk-btn pk-btn--sm' }));
$('menu').querySelector('kbd')?.classList.add('pk-kbd');
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));
const room = new KitchenRoom({ code, name, avatar, onState: receive, onNotice: text => notify(say(text)), onStatus(text, failed = false) {
  $('connection').textContent = text; show('practice', failed); canGoOffline = failed; menu.update(); if (failed) notify(text); updateUI();
} });
const optionsUI = createRoomOptions($('room-options'), { title: 'Pana Cocina', fields: FIELDS, // i18n-ignore: game name
  change: options => room.action('configure', { options }), reset: () => room.action('configure', { options: DEFAULT_OPTIONS }) });
// A guest draws its own cook where it predicts it (KitchenRoom's predict), not a round trip behind.
const me = () => room.predicted ?? state.players.find(p => p.id === room.id);
const colors = ['#eb574b', '#4789e3', '#3aae77', '#e4b52c', '#a974d5', '#e584a9', '#57bcc0', '#e68a3c'];
function actorLabel(p, color) {
  const mat = canvasMat(256, 96, ctx => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(5, 5, 246, 74, 18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(113, 78); ctx.lineTo(128, 94); ctx.lineTo(143, 78); ctx.fill();
    ctx.fillStyle = '#fff9e7'; ctx.font = '900 35px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.id === room.id ? loc('{name} · tú', { name: p.name }) : p.name, 128, 43, 228);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: mat.map, depthTest: false })); mat.dispose(); sprite.scale.set(2, 0.75, 1); sprite.position.y = 3.55; return sprite;
}
function removeActor(a) {
  scene.remove(a.root);
  a.label.material.map.dispose(); a.label.material.dispose();
  // Carried foods share baked geometry. Only the character owns its geometry.
  a.character.carry.clear(); a.character.dispose();
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
  if (state.phase !== lastPhase) { lastPhase = state.phase; resize(); menu.close(); heldKey = ''; document.querySelector('.pk-banner-layer')?.replaceChildren(); }
  const event = state.events.at(-1);
  if (event && event.id !== lastEvent) {
    lastEvent = event.id;
    if (event.kind === 'serve') { shout(say(event), { tone: 'teal', ms: 1500 }); sound.tone(660, 0, 0.1, 'sine', 0.1); sound.tone(880, 0.11, 0.18, 'sine', 0.1); }
    else notify(say(event));
    if (event.kind === 'start') shout(loc('¡A cocinar!'), { tone: 'yellow', ms: 1500 });
    if (event.kind === 'fire') { shout(burnShout(state.stations.find(s => s.fire && s.item)?.item.recipe)); sound.tone(220, 0, 0.3, 'sawtooth', 0.06); }
  }
  updateUI();
}
const burnShout = id => id === 'tequenos' ? loc('¡Se queman los tequeños!') : id ? loc('¡Se quema la {dish}!', { dish: recipe(id).name.toLowerCase() }) : loc('¡Fuego en el fogón!');
const carrying = { raw: r => loc('Ingredientes de {dish}', { dish: r.toLowerCase() }), prepared: r => loc('{dish} al fogón', { dish: r }), cooked: r => loc('{dish} al mostrador', { dish: r }), burnt: r => loc('{dish} a la basura', { dish: r }) };
const tone = { raw: 'yellow', prepared: 'yellow', cooked: 'teal', burnt: 'coral' };
function chip(i, p) {
  const el = document.createElement('span'); el.className = 'chef-chip'; el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--player-color', colors[i % colors.length]); el.textContent = (p.name || '?').trim().charAt(0).toUpperCase(); return el;
}
const stars = score => score >= 1500 ? 3 : score >= 850 ? 2 : score >= 350 ? 1 : 0;
function updateUI() {
  optionsUI.update(state.options || DEFAULT_OPTIONS, room.connected && room.isHost && state.phase !== 'playing');
  if (['playing', 'hide', 'hunt'].includes(state.phase) && optionsUI.isOpen) optionsUI.close();
  const playing = state.phase === 'playing', player = me();
  document.body.classList.toggle('is-playing', playing);
  show('lobby', state.phase === 'lobby'); show('welcome-label', state.phase === 'lobby'); show('hud', playing); show('results', state.phase === 'results');
  $('start').disabled = !room.connected || !room.isHost; $('start').textContent = !room.connected ? loc('Entrando a la cocina…') : room.isHost ? loc('¡A cocinar! →') : loc('El anfitrión abre la cocina');
  show('lobby-status', !room.connected);
  $('room-code').textContent = room.offline ? `● ${loc('Cocina local')}` : `● ${loc('Sala {code}', { code })}`;
  const lk = state.players.map(p => `${p.id}:${p.name}`).join('|');
  if ($('lobby-names').dataset.key !== lk) {
    $('lobby-names').dataset.key = lk; const people = state.players.filter(p => !p.bot);
    $('lobby-avatars').replaceChildren(...people.slice(0, 4).map(p => chip(state.players.indexOf(p), p)));
    $('lobby-names').textContent = people.map(p => p.id === room.id ? loc('{name} (tú)', { name: p.name }) : p.name).join(', ');
  }
  $('again').disabled = !room.connected || !room.isHost; $('again').textContent = room.isHost ? loc('Otro turno →') : loc('Esperando al anfitrión…');
  $('shift-minutes').textContent = loc('{n} min', { n: (state.options?.duration || 180) / 60 });
  $('timer').textContent = `${String(Math.floor(Math.ceil(state.remaining) / 60)).padStart(2, '0')}:${String(Math.ceil(state.remaining) % 60).padStart(2, '0')}`;
  $('timer').parentElement.classList.toggle('urgent', state.remaining < 30);
  $('score').textContent = state.score; $('stars').textContent = '★ '.repeat(stars(state.score)) + '☆ '.repeat(3 - stars(state.score));
  const orderKey = state.orders.map(o => o.id).join(',');
  $('orders').style.setProperty('--order-count', Math.max(1, state.orders.length));
  if (orderKey !== renderedOrders) {
    renderedOrders = orderKey; $('orders').replaceChildren();
    for (const order of state.orders) {
      const r = recipe(order.recipe), el = document.createElement('article'); el.className = 'order'; el.dataset.order = order.id;
      const h = document.createElement('h2'); h.textContent = r.name;
      const n = document.createElement('span'); n.className = 'order-n'; n.textContent = `#${order.id}`;
      const img = document.createElement('img'); img.src = previews.get(`${r.id}:cooked`); img.alt = '';
      const desc = document.createElement('small'); desc.textContent = loc(r.ingredients).toLowerCase().replace(' + ', ' · ');
      const bar = document.createElement('div'); bar.className = 'meter'; bar.innerHTML = '<i></i>'; el.append(h, n, img, desc, bar); $('orders').append(el);
    }
  }
  for (const order of state.orders) {
    const el = $('orders').querySelector(`[data-order="${order.id}"]`); const left = Math.max(0, order.remaining / order.total); el.querySelector('i').style.width = `${left * 100}%`; el.classList.toggle('urgent', state.options.impatient && order.remaining < 18); el.classList.toggle('half', state.options.impatient && left < 0.5); el.setAttribute('aria-label', state.options.impatient ? loc('{dish}, {n} segundos', { dish: recipe(order.recipe).name, n: Math.ceil(order.remaining) }) : loc('{dish}, sin prisa', { dish: recipe(order.recipe).name }));
  }
  const tk = state.players.map(p => `${p.id}:${p.name}:${p.held ? `${p.held.recipe}:${p.held.stage}` : ''}`).join('|');
  if (tk !== teamKey) {
    teamKey = tk; $('team').replaceChildren();
    state.players.forEach((p, i) => {
      const el = document.createElement('li'); el.className = `pk-row${p.id === room.id ? ' is-me' : ''}`;
      const who = document.createElement('div'), b = document.createElement('b'), doing = document.createElement('span');
      b.translate = false; b.textContent = p.id === room.id ? loc('{name} · tú', { name: p.name }) : p.bot ? loc('{name} · ayudante', { name: p.name }) : p.name;
      doing.textContent = p.held ? carrying[p.held.stage](recipe(p.held.recipe).name) : loc('Manos libres'); doing.className = `doing ${p.held ? tone[p.held.stage] : ''}`;
      who.append(b, doing); el.append(chip(i, p), who); $('team').append(el);
    });
  }
  const hk = player?.held ? `${player.held.recipe}:${player.held.stage}` : 'empty';
  if (hk !== heldKey) {
    heldKey = hk; $('held-image').src = previews.get(hk) || ''; $('held-image').style.display = player?.held ? '' : 'none';
    $('held-name').textContent = player?.held ? recipe(player.held.recipe).name : loc('Manos libres');
    $('held-next').textContent = !player?.held ? loc('Busca ingredientes para un pedido.') : ({ raw: loc('Llévalos a una tabla de preparar.'), prepared: loc('Al fogón. ¡Que agarre color!'), cooked: loc('¡Al mostrador para servir!'), burnt: loc('Llévalo al cubo de basura.') })[player.held.stage];
  }
  const near = player && nearestStation(player), station = near && state.stations.find(s => s.id === near.id);
  $('action-label').textContent = station?.fire ? loc('Apagar fuego') : near ? station?.item ? station.item.stage === 'cooked' || near.type === 'prep' && station.item.stage === 'prepared' ? loc('Recoger plato') : loc('Revisar preparación') : loc(near.label) : loc('Acércate a una estación');
  $('action').disabled = !near || !room.connected;
  if (state.phase === 'results') {
    $('result-stars').textContent = '★'.repeat(stars(state.score)) + '☆'.repeat(3 - stars(state.score));
    $('result-copy').textContent = state.served ? [loc('La plaza se fue contenta.'), state.burnt ? locn(state.burnt, 'Se quemó {n} plato; en el próximo turno sale mejor.', 'Se quemaron {n} platos; en el próximo turno salen mejor.') : loc('¡Y ningún plato quemado!'), loc('Estrellas: 350 / 850 / 1500 puntos.')].join(' ') : loc('El secreto es recoger, preparar, cocinar y servir. ¡Vamos otra vez!');
    $('result-score').textContent = state.score; $('result-served').textContent = state.served; $('result-missed').textContent = state.missed;
    fillRoster($('result-team'), state.players.map((p, i) => ({
      lead: chip(i, p), name: p.bot ? loc('{name} (ayudante)', { name: p.name }) : p.name, end: locn(p.deliveries, '{n} plato servido', '{n} platos servidos'), me: p.id === room.id })));
  }
}
function interact() { if (!paused && state.phase === 'playing') room.action('interact'); }
$('start').onclick = () => room.action('start');
$('again').onclick = () => { lastEvent = 0; room.action('start', { helpers: state.helpers }); };
$('action').onclick = interact;
$('practice').onclick = () => room.practice();
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  const key = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
  if (key === 'm' && !e.repeat) toggleMute();
  if ((key === 'e' || key === ' ') && !e.repeat) { e.preventDefault(); interact(); }
  if (!paused) keys.add(key);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
// Losing focus or hiding lets go of everything: the held buttons too, so a
// button never looks held while it moves nothing. Becoming visible again
// (another tab brought to the front first) must not drop a touch just made.
const holds = [];
function releaseAll() { keys.clear(); for (const h of holds) h.release(); touch.clear(); }
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
// Held touch buttons (engine/touch.js).
for (const button of document.querySelectorAll('[data-move]')) {
  holds.push(holdButton(button, { down: () => touch.add(button.dataset.move), up: () => touch.delete(button.dataset.move) }));
}
holds.push(holdButton($('dash'), { down: () => touch.add('dash'), up: () => touch.delete('dash') }));
function input() {
  if (paused || state.phase !== 'playing') return { x: 0, z: 0 };
  const x = Number(keys.has('d') || keys.has('arrowright') || touch.has('right')) - Number(keys.has('a') || keys.has('arrowleft') || touch.has('left'));
  const y = Number(keys.has('s') || keys.has('arrowdown') || touch.has('down')) - Number(keys.has('w') || keys.has('arrowup') || touch.has('up'));
  // Camera-relative ground movement: right really means screen-right.
  const angle = Math.atan2(camera.position.x + 0.5, camera.position.z - 2), c = Math.cos(angle), s = Math.sin(angle);
  return { x: x * c + y * s, z: -x * s + y * c, dash: keys.has('shift') || touch.has('dash') };
}
// Real elapsed time: a host in a background tab gets timers once a second.
const simClock = elapsedClock();
const ticker = setInterval(() => room.tick(simClock(), input(), paused && (room.offline || room.members.size === 1)), 50);
const actorTarget = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.06, (now - last) / 1000); last = now; elapsed += dt;
  if (aimWidth !== innerWidth || aimHeight !== innerHeight) resize();
  for (const shown of state.players) {
    const a = actors.get(shown.id); if (!a) continue;
    const p = shown.id === room.id ? me() : shown;
    a.root.position.lerp(actorTarget.set(p.x, 0.16, p.z), Math.min(1, dt * 17));
    let delta = p.h - a.character.group.rotation.y; delta = Math.atan2(Math.sin(delta), Math.cos(delta)); a.character.group.rotation.y += delta * Math.min(1, dt * 15);
    a.character.update(dt, { walk: p.moving ? 1 : 0, carry: !!p.held, run: p.dash > 1.7, open: p.dash > 1.7 });
    a.label.visible = state.phase === 'playing';
  }
  const player = me(), near = player && nearestStation(player);
  world.ring.visible = state.phase === 'playing' && !!player;
  if (player) world.ring.position.set(actors.get(player.id).root.position.x, 0.18, actors.get(player.id).root.position.z);
  world.update(elapsed, state, camera, near, state.phase === 'playing');
  if (!quiet) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
show('loading', false); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { clearInterval(ticker); room.dispose(); });
if (qs.has('debug')) window.cocina = { room, camera, actors, renderer, menu, get state() { return state; },
  step(seconds) { if (!room.isHost) return; for (let i = 0; i < seconds; i += 0.05) room.game.update(Math.min(0.05, seconds - i)); room.publish(); },
  place(id, x, z) { const p = room.game?.players.find(p => p.id === id); if (p) { p.x = x; p.z = z; room.publish(); } }, STATIONS,
  // Suites stop drawing on clients that only watch: software WebGL frames
  // otherwise starve the host's ticks past the input timeout.
  quiet(value) { quiet = !!value; } };

await prepareScene({ renderer, scene, camera });
