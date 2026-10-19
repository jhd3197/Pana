import { createLobbyRoster } from '/engine/lobby-roster.js';
import { createRoomOptions } from '/engine/room-options.js';
import { FIELDS, DEFAULT_OPTIONS } from './options.js';
import { prepareScene } from '/engine/game-load.js';
import { createMapPicker } from '/engine/map-picker.js';
import { createDifficultyPicker, DEFAULT_DIFFICULTY } from '/engine/difficulty.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton } from '/engine/touch.js';
import { fillRoster } from '/engine/results.js';
import { sound } from '/engine/fx.js';
import { PaintConnection } from './network.js';
import { createScene } from './scene.js';
import { createMinimap } from './minimap.js';
import { sfx } from './sounds.js';
import { createLookControls, SENSITIVITY_CHOICES } from '/engine/first-person.js';
import { coverFor, TARGET, segmentBox, paintSeats, variantName } from './rules.js';

const $ = id => document.getElementById(id), code = roomFromUrl() || newRoomCode();
const params = new URLSearchParams(location.search); params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
const held = new Set(), pads = []; let aim = null, firing = false, touchFire = false, queuedFire = false, queuedReload = false, stopped = false, lastPhase = 'lobby', lastEvent = null, lastRound = 0, lastLocal = false, lastBall = 0, lastKiller = '';
const canvas = $('world'), world = createScene(canvas), minimap = createMinimap($('minimap'));
let weapon = 'pistol';
let cameraView = 'primera', pointerPosition = null;
const room = new PaintConnection({ code, name: loadName(), avatar: loadAvatar(), onState: render, onStatus(text, failed = false) {
  $('connection').textContent = text; $('recovery-copy').textContent = text; $('recovery').hidden = !failed || room.state.phase === 'lobby';
} });
const teamRoster = createLobbyRoster($('team-roster'), { onMove: (from, to) => room.moveSeat(from, to) });
const optionsUI = createRoomOptions($('room-options'), { title: 'Pepazo', fields: FIELDS, change: options => room.configure(options), reset() {
  room.configure(DEFAULT_OPTIONS); room.selectMap('plaza'); room.selectDifficulty(DEFAULT_DIFFICULTY);
} });
const mapPicker = createMapPicker($('map-picker'), mapId => room.selectMap(mapId), { paint: true });
const difficultyPicker = createDifficultyPicker($('difficulty-picker'), difficulty => room.selectDifficulty(difficulty), { label: 'Puntería de los bots',
  notes: { facil: 'Los bots fallan seguido y disparan menos.', normal: 'Bots con buena mano, pero se les va alguna.', dificil: 'Los bots apuntan fino y no sueltan el gatillo.', experto: 'Casi no fallan: muévete y cúbrete.' } });
const menu = createGameMenu({ title: 'Pepazo · Pana', orientation: 'libre', sound,
  options: [{ id: 'weapon', label: 'Marcadora (si la sala permite todas)', choices: [['pistol', 'Pistola'], ['scatter', 'Escopeta'], ['rapid', 'Automática']], get: () => weapon, set: value => { weapon = value; } },
    { id: 'view', label: 'Cámara', choices: [['primera', 'Primera persona'], ['cancha', 'Ver la cancha']], get: () => cameraView, set: value => { cameraView = value; world.setView(value); } },
    { id: 'mouse', label: 'Sensibilidad al mirar', choices: SENSITIVITY_CHOICES, get: () => looking.sensitivity, set: value => { looking.sensitivity = value; } }],
  note: () => room.local ? 'La práctica está en pausa.' : 'La ronda online sigue mientras estás en el menú.',
  controls: [['WASD / Flechas', 'Caminar hacia donde miras'], ['Ratón', 'Mirar y apuntar (haz clic en la cancha para capturarlo)'], ['Clic / Espacio', 'Disparar pintura'], ['Shift', 'Correr (no puedes disparar corriendo)'], ['Tab', 'Ver la tabla'], ['Q / E', 'Girar sin ratón'], ['R', 'Recargar'], ['1 / 2 / 3', 'Pistola / escopeta / automática'], ['M', 'Sonido'], ['Esc', 'Soltar el ratón y abrir el menú']],
  tips: ['Una pintada suma un punto. Gana quien llegue a diez o lidere al terminar el tiempo. Con vidas limitadas también gana el último pana o equipo en pie. En bandera gana el equipo con tres capturas.',
    'Las barricadas frenan las bolas. Tienes doce por carga; recargas con R o automáticamente al vaciarla.',
    'Vuelves a la cancha 2,5 segundos después de una pintada. Al reaparecer tienes 1,5 segundos de protección; disparar la cancela.',
    'En teléfono camina con las flechas y arrastra el dedo por la pantalla para mirar. Mantén Pinta: la mira se pega al rival visible que tengas delante.',
    'El mapa de la esquina muestra a tu equipo y solo a los rivales que tienes a la vista.',
    'Si estás solo, tres bots entran contigo. Con amigos la cancha es de ustedes. Puedes invitar hasta ocho panas.'],
  invite: () => inviteUrl(code), onOpen() { clearInput(); looking.release(); }, onClose() {}, canOpen: () => room.state.phase !== 'finished',
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('room-code').textContent = `Sala ${code}`; $('rules').onclick = () => menu.open('controls');
$('start').onclick = () => { sound.unlock(); room.start(); }; $('again').onclick = () => room.start();
for (const id of ['practice', 'fallback']) $(id).onclick = () => { menu.close(); $('recovery').hidden = true; room.practice(); };
function clearInput() { held.clear(); firing = touchFire = queuedFire = queuedReload = false; pads.forEach(p => p.release()); room.input({}); }
function active() { return room.connected && room.state.phase === 'playing' && !menu.isOpen; }
for (const [id, key] of [['up', 'w'], ['left', 'a'], ['down', 's'], ['right', 'd'], ['reload', 'r']]) pads.push(holdButton($(id), { down: () => { held.add(key); if (key === 'r') queuedReload = true; }, up: () => held.delete(key), paused: () => !active() }));
pads.push(holdButton($('fire'), { down: () => { touchFire = queuedFire = true; sound.unlock(); }, up: () => { touchFire = false; }, paused: () => !active() }));
const looking = createLookControls(canvas, { enabled: () => active() && cameraView === 'primera', look: (yaw, pitch) => world.look(yaw, pitch),
  press(event) { sound.unlock(); if (event.button === 0) firing = queuedFire = true; },
  release(event) { if (event.button === 0 || event.type === 'pointercancel') firing = false; },
  unlocked: () => menu.open('game') });
// The overview keeps the plane-projected mouse aim.
canvas.addEventListener('pointermove', event => { if (active() && cameraView === 'cancha') { pointerPosition = [event.clientX, event.clientY]; aim = world.point(...pointerPosition); } });
canvas.addEventListener('pointerdown', event => {
  if (!active() || cameraView !== 'cancha' || event.button !== 0) return; event.preventDefault(); sound.unlock();
  pointerPosition = [event.clientX, event.clientY]; aim = world.point(...pointerPosition); firing = queuedFire = true;
});
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, () => { if (cameraView === 'cancha') firing = false; });
addEventListener('blur', clearInput); document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
addEventListener('keydown', event => {
  if (menu.isOpen || event.target.closest?.('input, button, textarea, select, a')) return;
  const key = event.key.toLowerCase(); if (['1', '2', '3'].includes(key)) weapon = ['pistol', 'scatter', 'rapid'][Number(key) - 1]; if (key === 'm') toggleMute();
  if (key === 'tab') { event.preventDefault(); if (room.state.phase === 'playing') showBoard(true); }
  if (['w', 'a', 's', 'd', 'q', 'e', 'r', ' ', 'shift', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) { event.preventDefault(); if (active()) { held.add(key); if (key === ' ') queuedFire = true; if (key === 'r') queuedReload = true; } }
});
addEventListener('keyup', event => { const key = event.key.toLowerCase(); held.delete(key); if (key === 'tab') showBoard(false); });
// Hold Tab: everyone's knockouts, times painted and current streak.
function showBoard(open) {
  $('scoreboard').hidden = !open; if (!open) return;
  const state = room.state, teams = state.options?.mode === 'teams' || state.options?.flag;
  $('board-title').textContent = teams ? `Naranja ${state.teamScores?.[0] || 0} — Turquesa ${state.teamScores?.[1] || 0}` : `${variantName(state.mapId, state.variant || 0)} · ronda ${state.round}`;
  fillRoster($('board-list'), [...state.players].filter(p => p.connected).sort((a, b) => b.score - a.score || a.hits - b.hits).map((p, i) => ({ rank: i + 1, name: p.name,
    detail: `${p.hits} recibidas${p.streak > 1 ? ` · racha de ${p.streak}` : ''}${p.bot ? ' · Bot' : ''}`, end: p.score, score: true, me: p.id === room.id })));
}
function input() {
  if (!active()) return {};
  const me = room.state.players.find(p => p.id === room.id); if (!me) return {};
  let ax, az;
  if (cameraView === 'primera') ({ x: ax, z: az } = world.forward());
  else { if (pointerPosition) aim = world.point(...pointerPosition); ax = aim ? aim.x - me.x : me.ax; az = aim ? aim.z - me.z : me.az; }
  if (touchFire) {
    // Touch aim assist: the visible rival closest to the crosshair (in first person, within 20°).
    const length = Math.hypot(ax, az) || 1, rivals = room.state.players.filter(p => p.id !== me.id && p.connected && !p.respawn && !p.eliminated && !p.shield && (!(room.state.options?.mode === 'teams' || room.state.options?.flag) || p.team !== me.team) && !coverFor(room.state.mapId, room.state.variant || 0).some(o => segmentBox(me.x, me.z, p.x - me.x, p.z - me.z, o) !== null));
    const off = p => Math.acos(Math.max(-1, Math.min(1, ((p.x - me.x) * ax + (p.z - me.z) * az) / length / (Math.hypot(p.x - me.x, p.z - me.z) || 1))));
    const target = cameraView === 'primera' ? rivals.filter(p => off(p) < .35 && Math.hypot(p.x - me.x, p.z - me.z) < 40).sort((a, b) => off(a) - off(b))[0]
      : rivals.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    if (target) { ax = target.x - me.x; az = target.z - me.z; }
  }
  const length = Math.hypot(ax, az) || 1;
  return { weapon, ...world.movement(Number(held.has('d') || held.has('arrowright')) - Number(held.has('a') || held.has('arrowleft')),
    Number(held.has('s') || held.has('arrowdown')) - Number(held.has('w') || held.has('arrowup'))), sprint: held.has('shift'),
    ax: ax / length, az: az / length, fire: queuedFire || firing || touchFire || held.has(' '), reload: queuedReload || held.has('r') };
}
// A short CSS pulse: a hit marker on the crosshair or a paint flash when hit.
function flash(name) { document.body.classList.remove(name); void document.body.offsetWidth; document.body.classList.add(name); }
// Knockout callouts: the distance always, plus the moments worth shouting about.
function callout(e, state) {
  const victim = state.players.find(p => p.id === e.victim)?.name || 'un pana';
  const title = e.revenge ? '¡Venganza!' : e.streak >= 5 ? '¡Imparable!' : e.streak === 4 ? '¡Cuádruple!' : e.streak === 3 ? '¡Triple!' : e.streak === 2 ? '¡Doble pepazo!' : '¡Pepazo!';
  const tag = e.distance >= 25 ? ' · ¡Tiro largo!' : e.distance <= 4 ? ' · ¡A quemarropa!' : '';
  $('callout-title').textContent = title; $('callout-detail').textContent = `${victim} · ${e.distance} m${tag}`;
  $('callout').classList.toggle('callout--long', e.distance >= 25); flash('called');
  clearTimeout(callout.timer); callout.timer = setTimeout(() => document.body.classList.remove('called'), 1900);
}
function feedLine(e, state) {
  const owner = state.players.find(p => p.id === e.owner), victim = state.players.find(p => p.id === e.victim), item = document.createElement('li');
  const name = (p, fallback) => { const b = document.createElement('b'); b.textContent = p?.name || fallback; b.style.color = p?.color || ''; return b; };
  item.append(name(owner, 'Un pana'), ' pintó a ', name(victim, 'un pana'), ` · ${e.distance} m${e.distance >= 25 ? ' · tiro largo' : ''}`);
  $('killfeed').prepend(item); while ($('killfeed').children.length > 4) $('killfeed').lastChild.remove();
  setTimeout(() => item.remove(), 6000);
}
function announce(e, state) {
  const mine = e.owner === room.id, me = e.victim === room.id;
  if (e.type === 'out') feedLine(e, state);
  if (mine && e.type === 'hit') { sfx.hitTick(); flash('hitmark'); }
  if (mine && e.type === 'out') { sfx.knockout(e.distance >= 25, e.streak || 1); flash('scored'); callout(e, state); }
  if (me) {
    document.body.style.setProperty('--paint-hurt', `${e.color}aa`); flash('painted');
    if (e.type === 'out') { sfx.out(); lastKiller = `${state.players.find(p => p.id === e.owner)?.name || 'Un pana'} te pintó desde ${e.distance} m`; } else sfx.hurt();
  }
}
// Hearing the court: every new paintball pops, quieter with distance.
function shots(state, me) {
  const owners = new Set();
  for (const b of state.balls) {
    if (b.id <= lastBall) continue;
    if (owners.has(b.owner)) continue; owners.add(b.owner);
    const shooter = state.players.find(p => p.id === b.owner), d = me ? Math.hypot(b.x - me.x, b.z - me.z) : 20;
    sfx.shot(b.owner === room.id ? 1 : .7 / (1 + d / 7), shooter?.weapon);
  }
  lastBall = Math.max(lastBall, ...state.balls.map(b => b.id));
}
function aguante(state, me) {
  const total = state.options?.toughness || 3, left = me ? Math.max(0, total - (me.paint || 0)) : total, key = `${total}:${left}`;
  if ($('aguante').dataset.key === key) return; $('aguante').dataset.key = key;
  $('aguante').replaceChildren(...Array.from({ length: total }, (_, i) => { const pip = document.createElement('i'); pip.className = i < left ? 'pip' : 'pip pip--painted'; return pip; }));
  $('aguante').setAttribute('aria-label', `Aguante ${left} de ${total}`);
}
function render(state) {
  optionsUI.update(state.options || DEFAULT_OPTIONS, room.connected && room.isHost && state.phase !== 'playing');
  if (['playing', 'hide', 'hunt'].includes(state.phase) && optionsUI.isOpen) optionsUI.close();
  mapPicker.update(state.mapId, room.connected && room.isHost && state.phase === 'lobby');
  difficultyPicker.update(state.difficulty, room.connected && room.isHost && state.phase !== 'playing');
  $('round-minutes').textContent = `${(state.options?.duration || 180) / 60} min`;
  $('win-target').textContent = state.options?.flag ? 3 : TARGET;
  $('win-target-label').textContent = state.options?.flag ? 'banderas para ganar' : 'pintadas para ganar';
  const lobby = state.phase === 'lobby', finished = state.phase === 'finished';
  $('lobby').hidden = !lobby; $('hud').hidden = lobby || finished; document.body.classList.toggle('in-lobby', lobby);
  const teams = state.options?.mode === 'teams' || state.options?.flag, people = state.players.filter(p => p.connected);
  const missingTeam = teams && people.length > 1 && new Set(people.map(p => p.team)).size < 2;
  $('team-roster').hidden = !teams;
  $('roster').hidden = teams;
  if (teams) teamRoster.update(['Naranja', 'Turquesa'].map((title, team) => ({ id: team, title, color: team ? '#29c5cd' : '#f28b42', seats: paintSeats(state.players).map((player, key) => ({ key, player })).filter(s => s.key % 2 === team) })), { ownId: room.id, hostId: room.local ? room.id : room.link?.state.players.find(p => p.id === room.link.state.host)?.seat, enabled: room.connected && lobby, canArrange: room.isHost, members: room.link?.state.players || [] });
  $('start').disabled = !room.connected || !room.isHost || missingTeam; $('start').textContent = !room.connected ? 'Conectando…' : missingTeam ? 'Falta un pana en el otro equipo' : room.isHost ? '¡A la cancha!' : 'El anfitrión inicia la ronda';
  $('invite').disabled = room.local || !room.connected; $('roster').textContent = state.players.filter(p => p.connected).map(p => p.name).join(' · ');
  const me = state.players.find(p => p.id === room.id), order = [...state.players].sort((a, b) => b.score - a.score || a.hits - b.hits);
  $('score').textContent = `${me?.score || 0} / ${TARGET}`; $('position').textContent = `${Math.max(1, order.findIndex(p => p.id === room.id) + 1)} de ${state.players.length} panas`;
  const seconds = Math.ceil(state.time); $('timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('ammo').textContent = me?.reload > 0 ? `Recargando ${me.reload.toFixed(1)} s` : `${me?.ammo ?? 12} / 12 · ${{ pistol: 'Pistola', scatter: 'Escopeta', rapid: 'Automática' }[me?.weapon || 'pistol']}${state.options?.lives ? ` · ${Math.max(0, state.options.lives - (me?.hits || 0))} vidas` : ''}`;
  $('feed').textContent = `${state.message}${state.options?.mode === 'teams' || state.options?.flag ? ` · Naranja ${state.teamScores?.[0] || 0} — Turquesa ${state.teamScores?.[1] || 0}` : ''}`; $('respawn').hidden = !me?.respawn && !me?.eliminated; $('respawn').textContent = me?.eliminated ? `${lastKiller || '¡Te pintaron!'} · sin vidas, observando la ronda` : `${lastKiller || '¡Te pintaron!'} · vuelves en ${Math.ceil(me?.respawn || 0)}`;
  // Events and balls are numbered per simulation: starting practice begins a new count.
  if (room.local !== lastLocal) { lastLocal = room.local; lastEvent = null; lastBall = 0; lastRound = 0; }
  const events = state.events || [];
  if (lastEvent === null) lastEvent = Math.max(0, ...events.map(e => e.n));
  for (const e of events) if (e.n > lastEvent) { lastEvent = e.n; if (state.phase === 'playing') announce(e, state); }
  if (state.phase === 'playing') shots(state, me); else lastBall = 0;
  aguante(state, me);
  $('stamina').style.setProperty('--left', String(me?.stamina ?? 1)); $('stamina').classList.toggle('stamina--full', (me?.stamina ?? 1) >= 1);
  if (!$('scoreboard').hidden) showBoard(true);
  if (state.phase === 'playing' && state.round !== lastRound) { lastRound = state.round; $('variant').textContent = `Cancha ${variantName(state.mapId, state.variant || 0)}`; flash('round-start'); }
  $('results').hidden = !finished;
  if (finished) {
    menu.close(); looking.release(); showBoard(false); const winners = order.filter(p => state.winners?.includes(p.id));
    $('result-title').textContent = winners.length > 1 ? '¡Empate de pintura!' : `¡Ganó ${winners[0]?.name}!`;
    if (state.options?.mode === 'teams' || state.options?.flag) $('result-title').textContent = new Set(winners.map(p => p.team)).size !== 1 ? '¡Empate de equipos!' : `¡Ganó el equipo ${winners[0]?.team === 0 ? 'naranja' : 'turquesa'}!`;
    $('result-copy').textContent = `${order[0]?.score || 0} pintadas en la mejor marca. ¿Otra ronda?`;
    fillRoster($('result-board'), order.map((p, i) => ({ rank: i + 1, name: p.name, detail: `${p.hits} recibidas${p.bot ? ' · Bot' : ''}`, end: p.score, score: true, me: p.id === room.id })));
    $('again').disabled = !room.isHost || !room.connected; $('again').textContent = room.isHost ? 'Otra ronda' : 'El anfitrión prepara la revancha';
    if (lastPhase !== 'finished') { clearInput(); $('again').focus(); }
  }
  lastPhase = state.phase;
}
let previous = performance.now(), stoppedAt = previous;
const timer = setInterval(() => { const now = performance.now(), dt = (now - stoppedAt) / 1000; stoppedAt = now; room.input(input()); queuedFire = queuedReload = false; room.tick(dt, menu.isOpen); }, 50);
function frame(now) {
  if (stopped) return; const dt = Math.min(.05, (now - previous) / 1000); previous = now;
  if (active()) world.look((Number(held.has('q')) - Number(held.has('e'))) * dt * 2.2);
  document.body.classList.toggle('first-person', cameraView === 'primera' && room.state.phase === 'playing');
  world.draw(room.state, room.id, dt, aim); minimap.draw(room.state, room.id, world.forward()); requestAnimationFrame(frame);
}
render(room.state); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); teamRoster.dispose(); looking.dispose(); room.dispose(); world.dispose(); }, { once: true });
if (params.has('debug')) window.pinturaDebug = { room, world, menu, input };

await prepareScene(world);
