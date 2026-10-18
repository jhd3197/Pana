import { createMapPicker } from '/engine/map-picker.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton } from '/engine/touch.js';
import { fillRoster } from '/engine/results.js';
import { PoolRoom } from './network.js';
import { groupName, groupOf, canPlace, remaining } from './rules.js';
import { createPoolScene } from './scene.js';

const $ = id => document.getElementById(id), code = roomFromUrl() || newRoomCode();
const params = new URLSearchParams(location.search); params.set('room', code);
history.replaceState(null, '', `${location.pathname}?${params}`);
let angle = 0, placement = null, held = 0, toastTimer, stopped = false, lastRevision = -1, previousPhase = 'lobby';
const world = createPoolScene($('table')), portraitKeys = [], portraitCache = new Map();
let cameraView = 'plaza';
let portraitsModule;
const audio = {
  muted: false, volume: .8, impl: null, unlocked: false,
  unlock() { this.unlocked = true; this.impl?.unlock(); },
  setVolume(value) { this.volume = value; this.impl?.setVolume(value); },
  tone(...args) { if (this.impl) { this.impl.muted = this.muted; this.impl.tone(...args); } },
};
import('/engine/fx.js').then(({ sound }) => { audio.impl = sound; sound.setVolume(audio.volume); if (audio.unlocked) sound.unlock(); }).catch(() => {});
const room = new PoolRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render, onNotice: notify,
  onStatus(message, failed = false) {
    $('connection').textContent = message; $('recovery-copy').textContent = message;
    $('recovery').hidden = !failed || room.state.phase === 'lobby'; render(room.state);
  },
});
const mapPicker = createMapPicker($('map-picker'), mapId => room.action('map', { mapId }), { table: true });
const menu = createGameMenu({
  title: 'Billar · Pana', orientation: 'libre', sound: audio,
  note: () => room.members.size > 1 ? 'La mesa sigue jugando mientras estás en el menú.' : 'La mesa está en pausa.',
  controls: [['Ratón / dedo', 'Toca o arrastra sobre la mesa para apuntar'], ['← →', 'Afina la dirección del taco'], ['↑ ↓', 'Ajusta la fuerza del tiro'], ['Espacio / Enter', 'Tira; con bola en mano, confirma la posición'], ['Flechas con bola en mano', 'Mueve la blanca antes de colocarla'], ['M', 'Sonido'], ['Esc', 'Menú']],
  tips: [
    'Reglas de la casa: dos panas, lisas (1–7) contra rayadas (9–15). La primera bola que metas sin falta elige tu grupo, incluso en el saque.',
    'Toca primero una bola de tu grupo. Después del contacto, mete una bola o haz que cualquiera llegue a una banda. Si metes una de las tuyas sin falta, sigues tirando.',
    'Si cae la blanca, no tocas ninguna bola, tocas primero una rival o no llegas a una banda, tu rival recibe bola en mano: puede colocar la blanca en cualquier lugar libre.',
    'Vacía tu grupo antes de tirar a la ocho. Meterla antes de tiempo, o junto con la blanca, pierde la partida. No hace falta anunciar tronera. En el saque, la ocho se repone.',
    'En práctica juegas todas las bolas y dejas la ocho para el final. Las faltas te dejan colocar la blanca y seguir.',
    'Si alguien sale, su puesto queda libre para otro pana. La mesa conserva las bolas y el turno. El anfitrión empieza la revancha.',
  ],
  invite: () => inviteUrl(code), onOpen() { held = 0; pads.forEach(p => p.release()); render(room.state); },
  options: [{ id: 'view', label: 'Cámara', choices: [['plaza', 'Vista del lugar'], ['mesa', 'Sobre la mesa']], get: () => cameraView, set: value => { cameraView = value; world.setView(value); } }],
  onClose() { if (room.state.phase !== 'finished') render(room.state); },
  canOpen: () => room.state.phase !== 'finished',
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('lobby-invite-slot').append(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));
$('room-code').textContent = `Sala ${code}`;
$('rules').onclick = () => menu.open('controls');
$('start').onclick = () => room.action('start');
$('again').onclick = () => room.action('start');
for (const id of ['practice', 'local-fallback']) $(id).onclick = () => { menu.close(); room.practice(); };

function notify(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200); }
function ownTurn() { return !menu.isOpen && room.connected && room.state.phase === 'aiming' && room.seat === room.state.turn && (room.offline || room.state.players.every(p => p.id !== null)); }
function shoot() {
  if (!ownTurn()) return;
  if (room.state.ballInHand) { place(placement || room.state.balls[0]); return; }
  audio.unlock(); room.action('shoot', { angle, power: Number($('power').value) / 100 });
}
function place(point) {
  if (!canPlace(room.state, point.x, point.y)) { notify('Pon la blanca en un lugar libre, lejos de las troneras.'); return; }
  room.action('place', point); placement = null;
}
$('shoot').onclick = shoot;
$('power').oninput = () => { $('power-value').textContent = `${$('power').value}%`; };
const pads = [-1, 1].map((direction, i) => holdButton($(i ? 'aim-right' : 'aim-left'), {
  down: () => { if (ownTurn()) { held = direction; angle += direction * .006; } }, up: () => { held = 0; }, paused: () => !ownTurn() || room.state.ballInHand,
}));

function aim(event) {
  if (!ownTurn()) return;
  const point = world.point(event.clientX, event.clientY);
  if (!point) return;
  if (room.state.ballInHand) placement = point;
  else { const cue = room.state.balls[0]; if (Math.hypot(point.x - cue.x, point.y - cue.y) > 4) angle = Math.atan2(point.y - cue.y, point.x - cue.x); }
}
$('table').addEventListener('pointerdown', event => {
  if (!ownTurn()) return; event.preventDefault(); $('table').focus({ preventScroll: true }); $('table').setPointerCapture(event.pointerId); aim(event);
});
$('table').addEventListener('pointermove', event => { if (event.buttons || event.pointerType === 'mouse') aim(event); });
$('table').addEventListener('pointerup', event => { if (ownTurn() && room.state.ballInHand) { aim(event); if (placement) place(placement); } });
$('table').addEventListener('pointercancel', () => { placement = null; });
addEventListener('blur', () => { held = 0; pads.forEach(p => p.release()); });
addEventListener('keydown', event => {
  if (menu.isOpen || event.target.closest?.('input, button, a, textarea, select')) return;
  if (event.key.toLowerCase() === 'm') toggleMute();
  if (!ownTurn()) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(event.key)) event.preventDefault();
  if (room.state.ballInHand && event.key.startsWith('Arrow')) {
    const point = placement || { x: room.state.balls[0].x, y: room.state.balls[0].y };
    let x = event.key === 'ArrowLeft' ? -8 : event.key === 'ArrowRight' ? 8 : 0;
    let y = event.key === 'ArrowUp' ? -8 : event.key === 'ArrowDown' ? 8 : 0;
    if (world.rotation) [x, y] = [y, -x];
    placement = { x: point.x + x, y: point.y + y };
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') angle += (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? .002 : .012);
  else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { $('power').value = Number($('power').value) + (event.key === 'ArrowUp' ? 5 : -5); $('power').oninput(); }
  if (!event.repeat && (event.key === ' ' || event.key === 'Enter')) shoot();
});

function render(state) {
  mapPicker.update(state.mapId, room.connected && room.isHost && state.phase === 'lobby');
  const lobby = state.phase === 'lobby', ended = state.phase === 'finished';
  document.body.classList.toggle('in-lobby', lobby); $('welcome').hidden = !lobby; $('play-controls').hidden = lobby || ended;
  const ready = room.connected && (state.practice || state.players.every(p => p.id !== null));
  $('start').disabled = !ready || !room.isHost;
  $('start').textContent = !room.connected ? 'Conectando…' : !ready ? 'Esperando a tu pana' : !room.isHost ? 'El anfitrión abre la mesa' : '¡A romper!';
  for (const id of ['invite', 'lobby-invite']) $(id).disabled = !room.connected || room.offline;
  if (room.offline || room.connected) $('recovery').hidden = true;
  for (let seat = 0; seat < 2; seat++) {
    const player = state.players[seat]; $(`player-${seat}`).hidden = state.practice && seat === 1;
    $(`player-${seat}`).classList.toggle('is-turn', !lobby && !ended && seat === state.turn);
    $(`name-${seat}`).textContent = `${player.name}${player.id === room.id ? ' · tú' : ''}`;
    $(`group-${seat}`).textContent = state.practice ? `${remaining(state, 0).length} antes de la ocho` : remaining(state, seat).length === 0 && state.groups[seat] ? 'A por la ocho' : groupName(state.groups[seat]);
    const track = $(`balls-${seat}`); track.replaceChildren();
    const balls = state.balls.filter(b => b.id && (state.practice ? b.id < 8 : state.groups[seat] && groupOf(b.id) === state.groups[seat]));
    for (const ball of balls) { const node = document.createElement('i'); node.textContent = ball.id; node.classList.toggle('potted', ball.pocketed); track.append(node); }
    updatePortrait(player, seat);
  }
  const active = ownTurn();
  $('turn-status').textContent = !room.connected ? 'Reconectando…' : !ready ? 'Esperando a tu pana' : state.phase === 'rolling' ? 'Rodando…'
    : active ? state.ballInHand ? 'Coloca la blanca' : '¡Tu turno!' : `Turno de ${state.players[state.turn].name}`;
  $('message').textContent = state.ballInHand && active ? 'Toca un lugar libre de la mesa. Después apunta y tira.' : state.message;
  $('shoot').disabled = !active; $('power').disabled = !active || state.ballInHand;
  for (const id of ['aim-left', 'aim-right']) $(id).disabled = !active || state.ballInHand;
  $('shoot').firstChild.textContent = state.ballInHand ? 'Colocar ' : 'Tirar ';
  if (state.revision !== lastRevision) {
    if (state.phase === 'rolling' && previousPhase !== 'rolling') audio.tone(360, 0, .06, 'triangle', .12);
    if (previousPhase === 'rolling' && state.phase !== 'rolling') { placement = null; audio.tone(600, 0, .08, 'sine', .08); }
    lastRevision = state.revision;
  }
  $('results').hidden = !ended;
  if (ended) {
    menu.close();
    $('result-title').textContent = state.practice ? state.result.winner === null ? '¡Otra mesa!' : '¡Mesa limpia!' : `¡Ganó ${state.players[state.result.winner].name}!`;
    $('result-copy').textContent = `${state.result.reason} ${state.shots} tiros en la mesa.`;
    fillRoster($('result-board'), state.players.filter(p => p.id !== null).map(p => ({ name: p.name, detail: state.practice ? 'Práctica' : groupName(state.groups[state.players.indexOf(p)]), me: p.id === room.id,
      end: state.players.indexOf(p) === state.result.winner ? 'Ganador' : '' })));
    $('again').disabled = !room.isHost || !ready; $('again').textContent = !ready ? 'Esperando a tu pana' : room.isHost ? 'La revancha' : 'El anfitrión prepara la revancha';
    if (previousPhase !== 'finished') $('again').focus();
  }
  previousPhase = state.phase;
}
async function updatePortrait(player, seat) {
  if (player.id === null) { $(`portrait-${seat}`).hidden = true; portraitKeys[seat] = null; return; }
  const key = JSON.stringify(player.avatar);
  if (portraitKeys[seat] === key) return; portraitKeys[seat] = key;
  try {
    portraitsModule ||= import('./portraits.js'); const { portrait } = await portraitsModule;
    if (stopped || portraitKeys[seat] !== key) return;
    if (!portraitCache.has(key)) portraitCache.set(key, portrait(player.avatar));
    if (portraitCache.size > 8) portraitCache.delete(portraitCache.keys().next().value);
    const img = $(`portrait-${seat}`); img.src = portraitCache.get(key); img.hidden = false;
  } catch { /* The in-world pana remains visible if its optional HUD portrait fails. */ }
}

let previous = performance.now();
const timer = setInterval(() => {
  const now = performance.now(); room.tick((now - previous) / 1000, menu.isOpen && room.members.size <= 1); previous = now;
}, 1000 / 60);
let frameTime = performance.now();
function frame(now) {
  if (stopped) return;
  const dt = Math.min(.05, (now - frameTime) / 1000); frameTime = now;
  if (ownTurn()) angle += held * dt * .45;
  world.draw(room.state, { angle, power: Number($('power').value) / 100, active: ownTurn(), placement, dt }); requestAnimationFrame(frame);
}
render(room.state); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); clearTimeout(toastTimer); room.dispose(); world.dispose(); }, { once: true });
if (params.has('debug')) window.billarDebug = { room, world, menu, get angle() { return angle; } };
