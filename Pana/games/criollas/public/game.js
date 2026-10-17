import { loadName, loadAvatar } from '/engine/avatar.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton } from '/engine/touch.js';
import { fillRoster } from '/engine/results.js';
import { sound } from '/engine/fx.js';
import { aimAt, clamp, measure, distance } from '/engine/bolas-criollas.js';
import { CriollasRoom } from './network.js';
import { TEAM_NAMES } from './rules.js';
import { createScene } from './scene.js';

await Promise.race([document.fonts.load('64px "Luckiest Guy"'), new Promise(resolve => setTimeout(resolve, 1500))]);
const $ = id => document.getElementById(id), code = roomFromUrl() || newRoomCode();
const params = new URLSearchParams(location.search), world = createScene($('court'));
let shot = { angle: 0, power: .62, mode: 'arrime' }, held = 0, toastTimer, stopped = false, connecting = false, view = 'cancha', lastRevision = -1, previousPhase = 'lobby';
let pads = [];
const room = new CriollasRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render, onNotice: notify,
  onStatus(message, failed = false) {
    if (failed) connecting = false;
    $('connection').textContent = message; $('recovery-copy').textContent = message;
    $('recovery').hidden = !failed || room.state.phase === 'lobby'; render(room.state);
  },
});
room.state.players[0] = { id: null, name: loadName(), avatar: loadAvatar() };
const menu = createGameMenu({ title: 'Bolas Criollas', orientation: 'libre', sound,
  note: () => room.offline ? 'La partida está en pausa.' : 'La sala sigue jugando mientras estás en el menú.',
  controls: [['Ratón / dedo', 'Toca la cancha para dirigir la bola'], ['← →', 'Afina la dirección'], ['↑ ↓', 'Ajusta la fuerza'], ['Espacio / Enter', 'Lanza tu bola'], ['M', 'Sonido'], ['Esc', 'Menú']],
  tips: [
    'Reglas de la casa: dos equipos, rojos y verdes, con ocho bolas cada uno. Cada pana lanza cuatro; los bots cubren los puestos libres. Los jugadores del mismo equipo se alternan.',
    'El mingo se coloca automáticamente al comenzar la mano. Arrima tu bola lo más cerca posible o usa un boche rastrero para desplazar las otras bolas. El mingo también se mueve con los golpes.',
    'Juega el equipo que está más lejos del mingo. Si ya no le quedan bolas, juega el otro. Un empate de distancia alterna el equipo que lanza.',
    'Al gastar las dieciséis bolas, el equipo más cercano suma un tanto por cada bola más cerca del mingo que la mejor del rival. A igual distancia, la mano no da tantos.',
    'Las bolas que cruzan la línea quedan fuera. Si sale el mingo, la mano es nula: nadie suma. El anfitrión abre la siguiente mano o la revancha.',
    'Gana quien llegue a la meta elegida, 12 o 24 tantos. Esta versión casual usa una cancha compacta, mingo automático y boches por el suelo.',
    'La línea de tiro indica dónde frenaría la bola si no chocara. Cambiar a boche aumenta la velocidad: baja la fuerza si quieres mantener la misma distancia.',
  ],
  invite: () => inviteUrl(code),
  options: [{ id: 'view', label: 'Cámara', choices: [['cancha', 'Vista de la cancha'], ['arriba', 'Desde arriba']], get: () => view, set(value) { view = value; world.setView(value); } }],
  onOpen() { held = 0; pads.forEach(p => p.release()); render(room.state); }, onClose() { render(room.state); },
});
$('menu-slot').append(menu.createButton({ id: 'menu', className: 'pk-btn' }));
const inviteButton = menu.createInviteButton({ id: 'invite', className: 'pk-btn pk-btn--block' });
$('invite-slot').append(inviteButton); $('invite-slot').hidden = true;
$('rules').onclick = () => menu.open('controls');
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
for (const button of $('target-options').children) button.onclick = () => {
  if (room.connected) room.action('target', { target: Number(button.dataset.target) });
  else { room.state.target = Number(button.dataset.target); render(room.state); }
};
for (const button of $('shot-options').children) button.onclick = () => {
  if (!ownTurn()) return; shot.mode = button.dataset.mode; render(room.state);
};
$('power').oninput = () => { shot.power = Number($('power').value) / 100; $('power-value').textContent = `${$('power').value}%`; };
function notify(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500); }
function ownTurn() { return room.connected && !menu.isOpen && room.state.phase === 'aiming' && room.seat === room.state.turn; }
function shoot() { if (ownTurn()) { sound.unlock(); room.action('shoot', shot); } }
$('shoot').onclick = shoot;
pads = [-1, 1].map((direction, i) => holdButton($(i ? 'aim-right' : 'aim-left'), { down() { if (ownTurn()) held = direction; }, up() { held = 0; }, paused: () => !ownTurn() }));
function point(event) {
  if (!ownTurn()) return; const p = world.pick(event.clientX, event.clientY); if (!p) return;
  // Pointing changes direction only: force remains a deliberate separate choice.
  shot.angle = aimAt(p.x, p.z).angle;
}
$('court').addEventListener('pointerdown', event => { if (!ownTurn()) return; event.preventDefault(); $('court').focus({ preventScroll: true }); $('court').setPointerCapture(event.pointerId); point(event); });
$('court').addEventListener('pointermove', event => { if (event.buttons) point(event); });
addEventListener('blur', () => { held = 0; pads.forEach(p => p.release()); });
addEventListener('keydown', event => {
  if (menu.isOpen || event.target.closest?.('input, button, a, select, textarea')) return;
  if (event.key.toLowerCase() === 'm') toggleMute();
  if (!ownTurn()) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(event.key)) event.preventDefault();
  if (event.key === 'ArrowLeft') shot.angle = clamp(shot.angle - .008, -.65, .65);
  if (event.key === 'ArrowRight') shot.angle = clamp(shot.angle + .008, -.65, .65);
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { shot.power = clamp(shot.power + (event.key === 'ArrowUp' ? .01 : -.01), .1, 1); render(room.state); }
  if (!event.repeat && [' ', 'Enter'].includes(event.key)) shoot();
});
function render(g) {
  if (room.connected) connecting = false;
  const lobby = g.phase === 'lobby', result = ['hand', 'finished'].includes(g.phase), active = ownTurn();
  document.body.classList.toggle('in-lobby', lobby); $('welcome').hidden = !lobby; $('scoreboard').hidden = lobby; $('controls').hidden = lobby || result;
  $('room-code').textContent = room.connected && !room.offline ? `Sala ${code}` : '';
  $('invite-slot').hidden = !room.connected || room.offline;
  $('start').textContent = connecting ? 'Conectando…' : !room.connected ? 'Jugar online' : room.isHost ? '¡A jugar!' : 'El anfitrión empieza';
  $('start').disabled = connecting || room.connected && !room.isHost;
  for (const button of $('target-options').children) { button.setAttribute('aria-pressed', String(Number(button.dataset.target) === g.target)); button.disabled = room.connected && !room.isHost; }
  if (lobby) fillRoster($('lobby-roster'), g.players.map((p, i) => ({ name: p.name, detail: `${TEAM_NAMES[i % 2]}${p.id === null && (room.connected || i > 0) ? ' · bot' : ''}`, me: p.id !== null && p.id === room.id || !room.connected && i === 0 })));
  for (let t = 0; t < 2; t++) { $(`score-${t}`).textContent = g.scores[t]; $(`left-${t}`).textContent = `${g.remaining.reduce((sum, n, i) => sum + (i % 2 === t ? n : 0), 0)} bolas por tirar`; }
  $('hand-number').textContent = `MANO ${g.hand}`; $('target-label').textContent = `A ${g.target} tantos`;
  const player = g.players[g.turn];
  $('turn').textContent = g.phase === 'rolling' ? 'La bola está rodando…' : active ? `¡Tu turno! · ${TEAM_NAMES[g.turn % 2]}` : `Turno de ${player.name} · ${TEAM_NAMES[g.turn % 2]}`;
  const lead = measure(g.pitch), best = g.pitch.balls.find(b => b.id === lead.ids[0]);
  $('measure').textContent = best ? `${TEAM_NAMES[lead.team]} ganan · ${distance(g.pitch, best).toFixed(2)} m del mingo` : 'El mingo está en juego';
  for (const id of ['shoot', 'power', 'aim-left', 'aim-right']) $(id).disabled = !active;
  $('power').value = Math.round(shot.power * 100); $('power-value').textContent = `${$('power').value}%`;
  for (const button of $('shot-options').children) { button.setAttribute('aria-pressed', String(button.dataset.mode === shot.mode)); button.disabled = !active; }
  $('results').hidden = !result;
  if (result) {
    const r = g.result, finished = g.phase === 'finished';
    $('result-ribbon').textContent = finished ? 'Partida terminada' : `Mano ${g.hand} terminada`;
    $('result-title').textContent = finished ? `¡Ganaron los ${TEAM_NAMES[r.team].toLowerCase()}!` : r.void ? 'Mingo fuera' : r.team === null ? '¡Empate!' : `¡${r.points} tanto${r.points === 1 ? '' : 's'} para los ${TEAM_NAMES[r.team].toLowerCase()}!`;
    $('result-copy').textContent = r.void ? 'Mano nula: nadie suma. Vamos con un mingo nuevo.' : r.team === null ? 'Nadie quedó más cerca: esta mano no suma tantos.' : `${TEAM_NAMES[0]} ${g.scores[0]} · ${g.scores[1]} ${TEAM_NAMES[1]}. La meta es ${g.target}.`;
    fillRoster($('result-board'), g.players.map((p, i) => ({ name: p.name, detail: TEAM_NAMES[i % 2], end: g.scores[i % 2], score: true, me: p.id !== null && p.id === room.id })));
    $('next').disabled = !room.isHost || !room.connected;
    $('next').textContent = !room.isHost ? 'Esperando al anfitrión…' : finished ? 'La revancha' : 'Siguiente mano';
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
  if (ownTurn()) shot.angle = clamp(shot.angle + held * dt * .35, -.65, .65);
  world.render(room.state, { dt, shot, active: ownTurn() }); requestAnimationFrame(frame);
}
if (roomFromUrl()) connecting = true;
render(room.state); if (roomFromUrl()) room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); clearTimeout(toastTimer); room.dispose(); world.dispose(); }, { once: true });
if (params.has('debug')) window.criollasDebug = { room, world, menu, get shot() { return shot; } };
