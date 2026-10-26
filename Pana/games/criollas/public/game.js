import { prepareScene } from '/engine/game-load.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton } from '/engine/touch.js';
import { ICONS } from '/engine/icons.js';
import { createMapPicker } from '/engine/play/map-picker.js';
import { difficultyInfo } from '/engine/play/difficulty.js';
import { createRoomOptions } from '/engine/room-options.js';
import { optionDefaults } from '/engine/room-options-rules.js';
import { CRIOLLAS_OPTIONS, criollasOptions } from './options.js';
import { fillRoster } from '/engine/results.js';
import { createLobbyRoster } from '/engine/lobby-roster.js';
import { sound } from '/engine/fx.js';
import { shotPower, paintCharge } from '/engine/play/shot-charge.js';
import { aimAt, clamp, measure, distance } from '/engine/play/bolas-criollas.js';
import { CriollasRoom } from './network.js';
import { TEAM_NAMES } from './rules.js';
import { createScene, VIEWS } from './scene.js';
import { createToast } from '/engine/hud.js';
import { loc, locn } from '/engine/i18n.js';

await Promise.race([document.fonts.load('64px "Luckiest Guy"'), new Promise(resolve => setTimeout(resolve, 1500))]);
const $ = id => document.getElementById(id), code = roomFromUrl() || newRoomCode();
const notify = createToast($('toast'), { ms: 3500 });
const params = new URLSearchParams(location.search), world = createScene($('court'));
let shot = { angle: 0, power: .62, mode: 'arrime', loft: 2.5 }, charge = null, held = 0, stopped = false, connecting = false, view = 'calce', lastRevision = -1, previousPhase = 'lobby';
// The camera is a personal preference, remembered on this device.
try { const saved = localStorage.getItem('pana:criollas:view'); if (VIEWS.some(([v]) => v === saved)) view = saved; } catch { /* storage may be blocked */ }
function setView(value) {
  view = value; world.setView(value); $('camera').setAttribute('aria-label', loc('Cámara: {view}', { view: VIEWS.find(([v]) => v === value)[1] }));
  try { localStorage.setItem('pana:criollas:view', value); } catch { /* storage may be blocked */ }
}
let pads = [];
const room = new CriollasRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render, onNotice: notify,
  onStatus(message, failed = false) {
    if (failed) connecting = false;
    $('connection').textContent = message; $('recovery-copy').textContent = message;
    $('recovery').hidden = !failed || room.state.phase === 'lobby'; render(room.state);
  },
});
const teamRoster = createLobbyRoster($('lobby-roster'), { onMove: (from, to) => room.action('swap', { from, to }) });
room.state.players[0] = { id: null, name: loadName(), avatar: loadAvatar() };
const menu = createGameMenu({ pad: { move: 'arrows', moveLabel: loc('Afinar la dirección'), cursor: loc('Dirigir la bola'), keys: { a: ['Space', loc('Fuerza: mantén y suelta para lanzar')], y: ['KeyC', loc('Cámara')] } }, title: loc('Bolas Criollas'), orientation: 'libre', sound,
  note: () => room.offline ? loc('La partida está en pausa.') : loc('La sala sigue jugando mientras estás en el menú.'),
  controls: [[loc('Ratón / dedo'), loc('Toca la cancha para dirigir la bola')], ['← →', loc('Afina la dirección')], [loc('Mantén Espacio / Enter'), loc('La fuerza sube y baja; suelta para lanzar')], ['C', loc('Cambia la cámara')], ['M', loc('Sonido')], ['Esc', loc('Menú')]],
  tips: [
    loc('Reglas de la casa: dos equipos de tres, rojos y verdes. Cada pana lanza dos o cuatro bolas; los bots cubren los puestos libres. Los compañeros rotan sus lanzamientos.'),
    loc('El mingo se coloca automáticamente al comenzar la mano. Arrima tu bola lo más cerca posible o usa un boche rastrero para desplazar las otras bolas. Por el aire permite superar una bola: ajusta Altura antes de cargar y mira el aro azul de caída. El mingo también se mueve con los golpes.'),
    loc('Antes de la primera mano, una moneda decide qué equipo lanza el mingo: cara para los rojos, sello para los verdes. El anfitrión puede cambiarlo en Más ajustes: al azar, el orden de la mesa o que empiece el equipo que perdió la última partida.'),
    loc('Juega el equipo que está más lejos del mingo. Si ya no le quedan bolas, juega el otro. Un empate de distancia alterna el equipo que lanza.'),
    loc('Al gastar todas las bolas, el equipo más cercano suma un tanto por cada bola más cerca del mingo que la mejor del rival. A igual distancia, la mano no da tantos.'),
    loc('Las bolas que cruzan la línea quedan fuera. Si sale el mingo, la mano es nula: nadie suma. El anfitrión abre la siguiente mano o la revancha.'),
    loc('Gana quien llegue a la meta elegida, 12 o 24 tantos. Esta versión casual usa una cancha compacta, mingo automático, boches rastreros y por el aire.'),
    loc('La línea de tiro indica dónde frenaría la bola si no chocara. En Fácil muestra también los choques y dónde quedan las bolas; en Difícil y Experto se acorta. Cambiar a rastrero aumenta la velocidad: suelta antes si quieres mantener la misma distancia.'),
    loc('La dificultad también afina a los bots rivales: en Difícil y Experto sacan con boche las bolas que se pegan al mingo. Los bots de tu equipo juegan siempre en Normal.'),
  ],
  invite: () => inviteUrl(code),
  options: [{ id: 'view', label: loc('Cámara'), choices: VIEWS, get: () => view, set: setView }],
  onOpen() { clearInput(); render(room.state); }, onClose() { render(room.state); },
});
$('menu-slot').append(menu.createButton({ id: 'menu', className: 'pk-btn' }));
const inviteButton = menu.createInviteButton({ id: 'invite', className: 'pk-btn pk-btn--block' });
$('invite-slot').append(inviteButton); $('invite-slot').hidden = true;
$('rules').onclick = () => menu.open('controls');
$('camera').innerHTML = ICONS.camera;
$('camera').onclick = () => setView(VIEWS[(VIEWS.findIndex(([v]) => v === view) + 1) % VIEWS.length][0]);
setView(view);
// Before connecting, the lobby edits the local table; online, the host decides.
function setting(action, key, value) {
  if (room.connected) { if (!room.action(action, { [key]: value })) notify(loc('Solo el anfitrión lo cambia, antes de la mano.')); }
  else { room.state[key] = value; render(room.state); }
}
const mapPicker = createMapPicker($('map-picker'), mapId => setting('map', 'mapId', mapId), { courts: true });
function changeOptions(patch, resetMap = false) {
  if (room.connected) room.action('options', { options: patch, resetMap });
  else { const next = criollasOptions(room.state, patch); if (next) { Object.assign(room.state, next); if (resetMap) room.state.mapId = 'plaza'; room.state.remaining.fill(room.state.ballsPerPlayer); render(room.state); } }
}
const roomOptions = createRoomOptions($('room-options'), { title: loc('Bolas Criollas'), fields: CRIOLLAS_OPTIONS,
  change: changeOptions, reset: () => changeOptions(optionDefaults(CRIOLLAS_OPTIONS), true) });
$('start').onclick = () => {
  if (!room.connected) {
    if (connecting) return; connecting = true;
    params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
    render(room.state); room.connect();
  } else room.action('start');
};
for (const id of ['practice', 'fallback']) $(id).onclick = () => {
  menu.close(); $('recovery').hidden = true; params.delete('room'); history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
  room.practice();
};
$('next').onclick = () => room.action(room.state.phase === 'finished' ? 'start' : 'next');
for (const button of $('shot-options').children) button.onclick = () => {
  if (!ownTurn() || charge) return; shot.mode = button.dataset.mode; render(room.state);
};
function ownTurn() { return room.connected && !menu.isOpen && room.state.phase === 'aiming' && room.seat === room.state.turn; }
$('loft').oninput = () => { if (!ownTurn() || charge) return; shot.loft = Number($('loft').value); $('loft-value').textContent = `${shot.loft.toFixed(1)} m`; };
// Like Billar: hold the button, Space or Enter and the force rises and falls;
// letting go throws at that force. The rules never accept less than 10%.
function updateCharge(now = performance.now()) {
  if (!charge) return;
  shot.power = Math.max(.1, shotPower(now - charge.started));
  paintCharge($('power'), shot.power, $('power-value'));
}
function chargeValid() { return ownTurn() && charge?.revision === room.state.revision; }
function beginCharge(source) {
  if (!ownTurn() || charge) return;
  sound.unlock(); held = 0; pads.slice(0, 2).forEach(p => p.release());
  charge = { source, started: performance.now(), revision: room.state.revision };
  updateCharge(); render(room.state);
}
function cancelCharge() { if (!charge) return; charge = null; render(room.state); }
function releaseCharge(source) {
  if (charge?.source !== source) return;
  const valid = chargeValid(); updateCharge(); charge = null;
  if (valid) room.action('shoot', shot);
  render(room.state);
}
pads = [-1, 1].map((direction, i) => holdButton($(i ? 'aim-right' : 'aim-left'), { down() { if (ownTurn()) held = direction; }, up() { held = 0; }, paused: () => !ownTurn() || !!charge }));
pads.push(holdButton($('shoot'), {
  down: () => beginCharge('pointer'),
  up: event => { if (event?.type === 'pointerup') releaseCharge('pointer'); else cancelCharge(); },
  paused: () => !ownTurn() || !!charge,
}));
function clearInput() { cancelCharge(); held = 0; pads.forEach(p => p.release()); }
function point(event) {
  if (!ownTurn() || charge) return; const p = world.pick(event.clientX, event.clientY); if (!p) return;
  // Pointing changes direction only: force remains a deliberate separate choice.
  shot.angle = aimAt(p.x, p.z).angle;
}
$('court').addEventListener('pointerdown', event => { if (!ownTurn()) return; event.preventDefault(); $('court').focus({ preventScroll: true }); $('court').setPointerCapture(event.pointerId); point(event); });
$('court').addEventListener('pointermove', event => { if (event.buttons) point(event); });
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
addEventListener('keydown', event => {
  if (menu.isOpen || event.target.closest?.('input, button, a, select, textarea')) return;
  if (event.key.toLowerCase() === 'm') toggleMute();
  if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && room.state.phase !== 'lobby') $('camera').click();
  if (!ownTurn()) return;
  if (['ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(event.key)) event.preventDefault();
  if (event.key === ' ' || event.key === 'Enter') { if (!event.repeat) beginCharge(event.key); return; }
  if (charge) return;
  if (event.key === 'ArrowLeft') shot.angle = clamp(shot.angle - .008, -.65, .65);
  if (event.key === 'ArrowRight') shot.angle = clamp(shot.angle + .008, -.65, .65);
});
addEventListener('keyup', event => { if (charge?.source === event.key) { event.preventDefault(); releaseCharge(event.key); } });
function render(g) {
  if (room.connected) connecting = false;
  const lobby = g.phase === 'lobby', result = ['hand', 'finished'].includes(g.phase), active = ownTurn(), opening = g.phase === 'opening';
  document.body.classList.toggle('in-lobby', lobby); $('welcome').hidden = !lobby; $('scoreboard').hidden = lobby; $('controls').hidden = lobby || result || opening;
  $('room-code').textContent = room.connected && !room.offline ? loc('Sala {code}', { code }) : '';
  $('invite-slot').hidden = !room.connected || room.offline;
  $('start').textContent = connecting ? loc('Conectando…') : !room.connected ? loc('Jugar online') : room.isHost ? loc('¡A jugar!') : loc('El anfitrión empieza');
  $('start').disabled = connecting || room.connected && !room.isHost;
  roomOptions.update(g, lobby && (!room.connected || room.isHost));
  if (!lobby && roomOptions.isOpen) roomOptions.close();
  // The court's surroundings follow the state, not the frame loop (hidden tabs don't draw).
  if (g.mapId && world.venue !== g.mapId) world.setVenue(g.mapId);
  mapPicker.update(g.mapId, lobby && (!room.connected || room.isHost));
  $('guide-note').textContent = g.difficulty === 'normal' ? loc('El blanco indica dónde frena sin choques. Mantén y suelta para ajustar la distancia.') : difficultyInfo(g.difficulty).note;
  $('side-controls').hidden = lobby; $('power-bar').hidden = lobby || !charge;
  $('lobby-roster').hidden = !lobby;
  if (lobby) teamRoster.update(TEAM_NAMES.map((title, team) => ({ id: team, title: loc(title), color: team ? '#299e72' : '#ed5949', seats: g.players.map((player, key) => ({ key, player: { ...player, bot: player.id === null } })).filter(s => s.key % 2 === team) })), { ownId: room.id, hostId: room.hostId, enabled: room.connected, canArrange: room.isHost, members: room.link?.state.players || [...room.members.values()] });
  for (let t = 0; t < 2; t++) { $(`score-${t}`).textContent = g.scores[t]; const left = g.remaining.reduce((sum, n, i) => sum + (i % 2 === t ? n : 0), 0); $(`left-${t}`).textContent = locn(left, '{n} bolas por tirar', '{n} bolas por tirar'); }
  $('hand-number').textContent = loc('MANO {n}', { n: g.hand }); $('target-label').textContent = loc('A {n} tantos', { n: g.target });
  const player = g.players[g.turn];
  $('turn').textContent = opening ? loc('¿Cara o sello? La moneda decide quién lanza el mingo') : g.phase === 'rolling' ? (g.pitch.balls.some(b => b.height > .05) ? loc('La bola va por el aire…') : loc('La bola está rodando…')) : active ? loc('¡Tu turno! · {team}', { team: loc(TEAM_NAMES[g.turn % 2]) }) : loc('Turno de {name} · {team}', { name: player.name, team: loc(TEAM_NAMES[g.turn % 2]) });
  const lead = measure(g.pitch), best = g.pitch.balls.find(b => b.id === lead.ids[0]);
  $('measure').textContent = best ? loc('{team} van más cerca · {d} m del mingo', { team: loc(TEAM_NAMES[lead.team]), d: distance(g.pitch, best).toFixed(2) }) : loc('El mingo está en juego');
  $('shoot').disabled = !active;
  $('loft-control').hidden = shot.mode !== 'aire'; $('loft').disabled = !active || !!charge;
  for (const id of ['aim-left', 'aim-right']) $(id).disabled = !active || !!charge;
  $('shoot').classList.toggle('is-charging', !!charge);
  $('shoot').firstChild.textContent = (charge ? loc('Suelta para lanzar') : loc('Mantén para lanzar')) + ' ';
  for (const button of $('shot-options').children) { button.setAttribute('aria-pressed', String(button.dataset.mode === shot.mode)); button.disabled = !active || !!charge; }
  $('results').hidden = !result;
  if (result) {
    const r = g.result, finished = g.phase === 'finished';
    $('result-ribbon').textContent = finished ? loc('Partida terminada') : loc('Mano {n} terminada', { n: g.hand });
    $('result-title').textContent = finished ? (r.team ? loc('¡Ganaron los verdes!') : loc('¡Ganaron los rojos!')) : r.void ? loc('Mingo fuera') : r.team === null ? loc('¡Empate!') : r.team ? locn(r.points, '¡{n} tanto para los verdes!', '¡{n} tantos para los verdes!') : locn(r.points, '¡{n} tanto para los rojos!', '¡{n} tantos para los rojos!');
    $('result-copy').textContent = r.void ? loc('Mano nula: nadie suma. Vamos con un mingo nuevo.') : r.team === null ? loc('Nadie quedó más cerca: esta mano no suma tantos.') : loc('{red} {a} · {b} {green}. La meta es {target}.', { red: loc(TEAM_NAMES[0]), a: g.scores[0], b: g.scores[1], green: loc(TEAM_NAMES[1]), target: g.target });
    fillRoster($('result-board'), g.players.map((p, i) => ({ name: p.name, detail: loc(TEAM_NAMES[i % 2]), end: g.scores[i % 2], score: true, me: p.id !== null && p.id === room.id })));
    $('next').disabled = !room.isHost || !room.connected;
    $('next').textContent = !room.isHost ? loc('Esperando al anfitrión…') : finished ? loc('La revancha') : loc('Siguiente mano');
  }
  if (g.revision !== lastRevision) {
    if (g.phase === 'rolling' && previousPhase !== 'rolling') sound.tone(240, 0, .08, 'triangle', .1);
    if (g.phase === 'aiming' && previousPhase !== 'aiming') shot.angle = aimAt(g.pitch.balls[0].x, g.pitch.balls[0].z).angle;
    if (result && previousPhase === 'rolling') sound.pickup();
    previousPhase = g.phase; lastRevision = g.revision;
  }
}
let tickTime = performance.now(), frameTime = tickTime;
const timer = setInterval(() => { const now = performance.now(); room.tick((now - tickTime) / 1000, menu.isOpen && room.offline); tickTime = now; }, 1000 / 60);
function frame(now) {
  if (stopped) return; const dt = Math.min(.05, (now - frameTime) / 1000); frameTime = now;
  if (charge) { if (chargeValid()) updateCharge(now); else cancelCharge(); }
  if (ownTurn() && !charge) shot.angle = clamp(shot.angle + held * dt * .35, -.65, .65);
  world.render(room.state, { dt, shot, active: ownTurn() });
  const target = world.guides.target;
  if (target?.visible) $('guide-note').textContent = [loc('{n}% de fuerza', { n: Math.round(shot.power * 100) }), target.out ? loc('Se va fuera: reduce la fuerza o cambia la dirección') : room.state.difficulty === 'normal' ? loc('{n} m de recorrido sin choques', { n: target.range.toFixed(1) }) : loc('{n} m de recorrido previsto', { n: target.range.toFixed(1) }), charge ? loc('Suelta para lanzar') : loc('Mantén para ajustar')].join(' · ');
  requestAnimationFrame(frame);
}
if (roomFromUrl()) connecting = true;
render(room.state); if (roomFromUrl()) room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); notify.dispose(); teamRoster.dispose(); room.dispose(); world.dispose(); }, { once: true });
if (params.has('debug')) window.criollasDebug = { room, world, menu, get shot() { return shot; }, get charge() { return charge; } };

await prepareScene(world);
