import { prepareScene } from '/engine/game-load.js';
import { createMapPicker } from '/engine/play/map-picker.js';
import { createDifficultyPicker } from '/engine/play/difficulty.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { lazySound } from '/engine/lazy-sound.js';
import { holdButton } from '/engine/touch.js';
import { ICONS } from '/engine/icons.js';
import { fillRoster } from '/engine/results.js';
import { PoolRoom } from './network.js';
import { groupName, groupOf, canPlace, remaining, messageText } from './rules.js';
import { createPoolScene, VIEWS } from './scene.js';
import { paintCharge, createShotCharge } from '/engine/play/shot-charge.js';
import { POOL_OPTIONS, teamOf, playingSeats, poolConnected, canStartPool } from './match-rules.js';
import { createRoomOptions } from '/engine/room-options.js';
import { createTableSeating } from '/engine/play/table-seating.js';
import { createToast } from '/engine/hud.js';
import { loc, locn } from '/engine/i18n.js';

const $ = id => document.getElementById(id), code = roomFromUrl() || newRoomCode();
const notify = createToast($('toast'), { ms: 3200 });
const params = new URLSearchParams(location.search); params.set('room', code);
history.replaceState(null, '', `${location.pathname}?${params}`);
let angle = 0, placement = null, held = 0, stopped = false, lastRevision = -1, previousPhase = 'lobby', drag = null;
const spin = { x: 0, y: 0 };
let power = .65;
const world = createPoolScene($('table'), { onStarter: (cacho, power) => { if (!menu.isOpen) { audio.unlock(); room.action('starter', { cacho, power }); } } }), portraitKeys = [], portraitCache = new Map();
// The chosen camera is a personal preference, remembered on this device.
let cameraView = 'taco';
try { const saved = localStorage.getItem('pana:billar:view'); if (VIEWS.some(([v]) => v === saved)) cameraView = saved; } catch { /* storage may be blocked */ }
function setCamera(value) {
  cameraView = value; world.setView(value); $('camera').dataset.view = value; $('camera').setAttribute('aria-label', loc('Cámara: {view}', { view: VIEWS.find(([v]) => v === value)[1] }));
  try { localStorage.setItem('pana:billar:view', value); } catch { /* storage may be blocked */ }
}
let portraitsModule;
const audio = lazySound();
const room = new PoolRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render, onNotice: notify,
  onStatus(message, failed = false) {
    $('connection').textContent = message; $('recovery-copy').textContent = message;
    $('recovery').hidden = !failed || room.state.phase === 'lobby'; render(room.state);
  },
});
const mapPicker = createMapPicker($('map-picker'), mapId => room.action('map', { mapId }), { table: true });
const difficultyPicker = createDifficultyPicker($('difficulty-picker'), difficulty => room.action('difficulty', { difficulty }));
const roomOptions = createRoomOptions($('room-options'), { title: 'Billar', fields: POOL_OPTIONS,
  change: options => { if(options.format === 'duel' && room.state.players.filter(p=>p.id!==null).length>2){notify(loc('Individual es para dos panas. Con más jugadores, elige Por equipos.'));return;} room.action('options', { options }); }, reset: () => room.action('reset-options') });
const seating = createTableSeating($('seating'), (from, to) => room.action('swap', { from, to }));
const menu = createGameMenu({
  pad: { move: 'arrows', moveLabel: loc('Afinar el taco; con bola en mano, mover la blanca'), cursor: loc('Apuntar en la mesa'), keys: { a: ['Space', loc('Fuerza: mantén y suelta para tirar')], x: ['Enter', loc('Confirmar la bola en mano')], lb: ['ShiftLeft', loc('Afinar más fino')], y: ['KeyC', loc('Cámara')] } },
  title: 'Billar · Pana', orientation: 'libre', sound: audio, // i18n-ignore: game name
  note: () => room.members.size > 1 ? loc('La mesa sigue jugando mientras estás en el menú.') : loc('La mesa está en pausa.'),
  controls: [[loc('Ratón / dedo'), loc('Toca la mesa para apuntar; detrás de la bola, arrastra a los lados para girar')], ['← →', loc('Afina la dirección del taco')], [loc('Mantener Tirar / Espacio / Enter'), loc('La fuerza sube y baja: suelta para tirar. Rojo es más fuerte')], [loc('Enter con bola en mano'), loc('Confirma la posición')], [loc('Flechas con bola en mano'), loc('Mueve la blanca antes de colocarla')], [loc('Efecto'), loc('Toca la bola blanca del panel para darle efecto')], ['C', loc('Cambia la cámara')], ['M', loc('Sonido')], ['Esc', loc('Menú')]],
  tips: [
    loc('¿Quién rompe? Al empezar la partida todos sacuden el cacho a la vez y lo tapan: rompe el dado más alto; si empatan arriba, solo ellos sacuden otra vez. El anfitrión puede cambiarlo en Más ajustes.'),
    loc('Elige Individual para jugar uno contra uno, o Por equipos para dos grupos de uno, dos o tres panas. Los compañeros rotan después de cada tiro, incluso cuando el equipo sigue jugando. El anfitrión organiza los puestos antes de empezar.'),
    loc('Toca primero una bola de tu grupo. Después del contacto, mete una bola o haz que cualquiera llegue a una banda. Si metes una de las tuyas sin falta, sigues tirando.'),
    loc('Bola 8: la primera bola legal asigna lisas o rayadas. Vacía tu grupo antes de la ocho; meterla antes de tiempo o con falta pierde la mesa. En el saque, la ocho se repone.'),
    loc('Bola 9: toca primero la bola de menor número. Una combinación legal que meta la nueve gana la mesa. Si entra con falta, la nueve vuelve a la mesa.'),
    loc('Las faltas dan bola en mano. Con Cocina, coloca dentro de la zona amarilla y cruza su borde antes del primer contacto.'),
    loc('Si activas Cantar tronera, elige el número que ves junto al agujero. Solo conserva turno una bola que entre en esa tronera; la ocho en otra tronera pierde la mesa.'),
    loc('En práctica juegas todas las bolas y dejas la ocho para el final. Las faltas te dejan colocar la blanca y seguir.'),
    loc('La dificultad cambia la guía: en Fácil ves adónde van las dos bolas y los rebotes; en Experto solo la dirección del taco. Pana Bot también afina la puntería.'),
    loc('Efecto: arriba la blanca sigue después del choque, abajo regresa y a los lados cambia el rebote en las bandas.'),
    loc('Si alguien sale, su puesto queda libre para otro pana. La mesa conserva las bolas y el turno. El anfitrión empieza la revancha, o desde el menú vuelve a la sala si nadie llega.'),
  ],
  invite: () => inviteUrl(code), onOpen() { clearInput(); render(room.state); },
  actions: [{ id: 'back-to-lobby', label: loc('Volver a la sala'), run: () => room.action('setup'),
    visible: () => room.isHost && !['lobby', 'finished'].includes(room.state.phase) && !poolConnected(room.state) }],
  options: [{ id: 'view', label: loc('Cámara'), choices: VIEWS, get: () => cameraView, set: setCamera }],
  onClose() { if (room.state.phase !== 'finished') render(room.state); },
  canOpen: () => room.state.phase !== 'finished',
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('lobby-invite-slot').append(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));
$('room-code').textContent = loc('Sala {code}', { code });
$('rules').onclick = () => menu.open('controls');
$('start').onclick = () => room.action('start');
$('again').onclick = () => room.action('start');
$('organize-table').onclick = () => room.action('setup');
for (const id of ['practice', 'local-fallback']) $(id).onclick = () => { menu.close(); room.practice(); };
$('versus').onclick = () => { menu.close(); room.versusBot(); };
$('camera').innerHTML = ICONS.camera;
$('camera').onclick = () => setCamera(VIEWS[(VIEWS.findIndex(([v]) => v === cameraView) + 1) % VIEWS.length][0]);
setCamera(cameraView);
// The english pad: a cue ball with a red dot where the tip will strike.
const SPIN_TEXT = { '0,0': loc('al centro'), '1,0': loc('arriba'), '-1,0': loc('abajo'), '0,1': loc('derecha'), '0,-1': loc('izquierda'),
  '1,1': loc('arriba derecha'), '1,-1': loc('arriba izquierda'), '-1,1': loc('abajo derecha'), '-1,-1': loc('abajo izquierda') };
function setSpin(x, y) {
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  spin.x = Math.round(x * 20) / 20; spin.y = Math.round(y * 20) / 20;
  $('spin-dot').style.transform = `translate(${spin.x * 34}px, ${-spin.y * 34}px)`;
  $('spin').setAttribute('aria-valuetext', SPIN_TEXT[`${Math.sign(spin.y)},${Math.sign(spin.x)}`]);
}
function spinAt(event) { const r = $('spin').getBoundingClientRect(); setSpin((event.clientX - r.left - r.width / 2) / (r.width * .4), -(event.clientY - r.top - r.height / 2) / (r.height * .4)); }
$('spin').addEventListener('pointerdown', event => { if ($('spin').disabled) return; event.preventDefault(); $('spin').setPointerCapture(event.pointerId); spinAt(event); });
$('spin').addEventListener('pointermove', event => { if (event.buttons && !$('spin').disabled) spinAt(event); });
$('spin').addEventListener('dblclick', () => setSpin(0, 0));
$('spin').addEventListener('keydown', event => {
  const step = { ArrowLeft: [-.25, 0], ArrowRight: [.25, 0], ArrowUp: [0, .25], ArrowDown: [0, -.25] }[event.key];
  if (step) { event.preventDefault(); event.stopPropagation(); setSpin(spin.x + step[0], spin.y + step[1]); }
  if (event.key === 'Home' || event.key === '0') setSpin(0, 0);
});

function ownTurn() { return !menu.isOpen && !roomOptions.isOpen && room.connected && room.state.phase === 'aiming' && room.seat === room.state.turn && poolConnected(room.state); }
// Ending a charge (released or cancelled) puts the controls back.
function chargeEnded() {
  power = .65;
  $('power-bar').hidden = true; $('shoot').classList.remove('is-charging');
  $('shoot').firstChild.textContent = room.state.ballInHand ? `${loc('Colocar')} ` : `${loc('Tirar')} `;
  for (const id of ['aim-left', 'aim-right', 'spin']) $(id).disabled = !ownTurn() || room.state.ballInHand;
  $('pocket').disabled = !ownTurn() || room.state.ballInHand;
}
const charge = createShotCharge({ ready: () => ownTurn() && !room.state.ballInHand, revision: () => room.state.revision,
  change: value => { if (value === null) chargeEnded(); else { power = value; paintCharge($('power'), power, $('power-value')); } },
  shoot: (value, { pocket }) => room.action('shoot', { angle, power: value, spin: { ...spin }, pocket }) });
function beginCharge(source) {
  if (!ownTurn() || charge.active) return;
  if (room.state.ballInHand) { place(placement || room.state.balls[0]); return; }
  if (room.state.options.calledPocket && $('pocket').value === '') { notify(loc('Elige la tronera donde quieres meter la bola.')); return; }
  audio.unlock(); held = 0; drag = null;
  $('power-bar').hidden = false; $('shoot').classList.add('is-charging');
  $('shoot').firstChild.textContent = `${loc('Soltar')} `;
  for (const id of ['aim-left', 'aim-right', 'spin']) $(id).disabled = true;
  $('pocket').disabled = true;
  charge.begin(source, { pocket: $('pocket').value === '' ? null : Number($('pocket').value) });
}
function place(point) {
  if (!canPlace(room.state, point.x, point.y)) { notify(loc('Pon la blanca en un lugar libre, lejos de las troneras.')); return; }
  room.action('place', point); placement = null;
}
const pads = [-1, 1].map((direction, i) => holdButton($(i ? 'aim-right' : 'aim-left'), {
  down: () => { if (ownTurn()) { held = direction; angle += direction * .006; } }, up: () => { held = 0; }, paused: () => !ownTurn() || room.state.ballInHand || charge.active,
}));
pads.push(holdButton($('shoot'), {
  down: () => beginCharge('pointer'),
  up: event => { if (event?.type === 'pointerup') charge.release('pointer'); else charge.cancel(); },
  paused: () => !ownTurn() || charge.active,
}));
function clearInput() { charge.cancel(); held = 0; drag = null; pads.forEach(p => p.release()); }

function aim(event) {
  if (!ownTurn() || charge.active) return;
  const point = world.point(event.clientX, event.clientY);
  if (!point) return;
  if (room.state.ballInHand) placement = point;
  else { const cue = room.state.balls[0]; if (Math.hypot(point.x - cue.x, point.y - cue.y) > 4) angle = Math.atan2(point.y - cue.y, point.x - cue.x); }
}
// Behind the ball the camera turns with the cue, so pointing at a moving view
// would chase itself: a drag turns the cue, a tap aims at the spot.
const chasing = () => world.view === 'taco' && !room.state.ballInHand;
$('table').addEventListener('pointerdown', event => {
  if (!ownTurn() || charge.active) return; event.preventDefault(); $('table').focus({ preventScroll: true }); $('table').setPointerCapture(event.pointerId);
  if (chasing()) drag = { x: event.clientX, angle, moved: false }; else aim(event);
});
$('table').addEventListener('pointermove', event => {
  if (drag && event.buttons) {
    const dx = event.clientX - drag.x; if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved && ownTurn()) angle = drag.angle + dx * (event.shiftKey ? .0008 : .004);
  } else if (!chasing() && (event.buttons || event.pointerType === 'mouse')) aim(event);
});
$('table').addEventListener('pointerup', event => {
  if (drag) { const tap = !drag.moved; drag = null; if (tap) aim(event); return; }
  if (ownTurn() && room.state.ballInHand) { aim(event); if (placement) place(placement); }
});
$('table').addEventListener('pointercancel', () => { placement = null; drag = null; });
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
addEventListener('keydown', event => {
  if (menu.isOpen || (event.target.id !== 'shoot' && event.target.closest?.('input, button, a, textarea, select'))) return;
  if (event.key.toLowerCase() === 'm') toggleMute();
  if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && room.state.phase !== 'lobby') $('camera').click();
  if (!ownTurn()) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(event.key)) event.preventDefault();
  if (event.key === ' ' || event.key === 'Enter') { if (!event.repeat) beginCharge(event.key); return; }
  if (charge.active) return;
  if (room.state.ballInHand && event.key.startsWith('Arrow')) {
    const point = placement || { x: room.state.balls[0].x, y: room.state.balls[0].y };
    let x = event.key === 'ArrowLeft' ? -8 : event.key === 'ArrowRight' ? 8 : 0;
    let y = event.key === 'ArrowUp' ? -8 : event.key === 'ArrowDown' ? 8 : 0;
    if (world.rotation) [x, y] = [y, -x];
    placement = { x: point.x + x, y: point.y + y };
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') angle += (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? .002 : .012);
});
addEventListener('keyup', event => {
  if (charge.source === event.key) { event.preventDefault(); charge.release(event.key); }
});

// Empty seats hold the synced Spanish placeholder name.
const nameOf = player => player.id === null ? loc(player.name) : player.name;
function render(state) {
  seating.update(state.options.format === 'duel' ? state.players.slice(0,2) : state.players, { teams: state.options.format !== 'duel', enabled: room.connected && state.phase === 'lobby', canArrange: room.isHost, members: room.link?.state.players || [], ownId: room.id, hostId: room.hostId, emptyLabel: loc('libre') });
  roomOptions.update(state.options, room.connected && room.isHost && ['lobby', 'finished'].includes(state.phase));
  if (state.phase !== 'lobby' && roomOptions.isOpen) roomOptions.close();
  mapPicker.update(state.mapId, room.connected && room.isHost && state.phase === 'lobby');
  difficultyPicker.update(state.difficulty, room.connected && room.isHost && state.phase === 'lobby');
  const lobby = state.phase === 'lobby', ended = state.phase === 'finished';
  document.body.classList.toggle('in-lobby', lobby); $('welcome').hidden = !lobby; $('play-controls').hidden = lobby || ended;
  const ready = room.connected && (lobby || ended ? canStartPool(state) : poolConnected(state));
  $('start').disabled = !ready || !room.isHost;
  $('start').textContent = !room.connected ? loc('Conectando…') : !ready ? state.options.format === 'duel' ? loc('Espera a tu rival · 1 contra 1') : loc('Completa dos equipos iguales') : !room.isHost ? loc('El anfitrión abre la mesa') : loc('¡A romper!');
  for (const id of ['invite', 'lobby-invite']) $(id).disabled = !room.connected || room.offline;
  if (room.offline || room.connected) $('recovery').hidden = true;
  for (let seat = 0; seat < 2; seat++) {
    const members = playingSeats(state).filter(i => teamOf(i) === seat).map(i => state.players[i]);
    const player = teamOf(state.turn) === seat ? state.players[state.turn] : members[0] || state.players[seat];
    $(`player-${seat}`).hidden = state.practice && seat === 1;
    $(`player-${seat}`).classList.toggle('is-turn', !lobby && !ended && seat === teamOf(state.turn));
    $(`name-${seat}`).textContent = members.length > 1 ? loc('Equipo {n} · {names}', { n: seat + 1, names: members.map(p => p.name).join(', ') }) : player.id === room.id ? loc('{name} · tú', { name: player.name }) : nameOf(player);
    $(`name-${seat}`).title = $(`name-${seat}`).textContent;
    $(`group-${seat}`).textContent = state.options.variant === 'nine' ? locn(state.scores[seat], 'Bola {ball} primero · {n} mesa', 'Bola {ball} primero · {n} mesas', { ball: Math.min(...remaining(state, seat).map(b => b.id)) }) : state.practice ? loc('{n} antes de la ocho', { n: remaining(state, 0).length }) : remaining(state, seat).length === 0 && state.groups[seat] ? loc('A por la ocho') : groupName(state.groups[seat]);
    const track = $(`balls-${seat}`); track.replaceChildren();
    const balls = state.balls.filter(b => b.id && (state.options.variant === 'nine' ? b.id <= 9 : state.practice ? b.id < 8 : state.groups[seat] && groupOf(b.id) === state.groups[seat]));
    for (const ball of balls) { const node = document.createElement('i'); node.textContent = ball.id; node.classList.toggle('potted', ball.pocketed); track.append(node); }
    updatePortrait(player, seat);
  }
  const active = ownTurn();
  if (charge.active && !charge.valid()) clearInput();
  $('turn-status').textContent = !room.connected ? loc('Reconectando…') : !ready ? loc('Esperando a tu pana') : !lobby && !playingSeats(state).includes(room.seat) ? loc('Entras en la próxima mesa') : state.phase === 'starter' ? loc('¿Quién rompe?') : state.phase === 'rolling' ? loc('Rodando…')
    : active ? state.ballInHand ? loc('Coloca la blanca') : loc('¡Tu turno!') : loc('Turno de {name}', { name: nameOf(state.players[state.turn]) });
  $('message').textContent = state.ballInHand && active ? state.options.foulPlacement === 'kitchen' ? loc('Coloca en la zona amarilla. La blanca debe salir de cocina antes de tocar otra bola.') : loc('Toca un lugar libre de la mesa. Después apunta y tira.') : messageText(state.message);
  document.querySelector('.versus').textContent = state.options.variant === 'nine' ? '9' : '8';
  document.querySelector('.table-caption span').textContent = state.options.variant === 'nine' ? loc('BOLA NUEVE') : loc('BOLA OCHO');
  $('shoot').disabled = !active;
  $('called-pocket').hidden = !state.options.calledPocket || lobby || ended;
  $('pocket').disabled = !active || charge.active || state.ballInHand;
  $('shot-clock').hidden = !state.options.shotSeconds || state.phase !== 'aiming';
  $('shot-clock').textContent = loc('Tiempo: {n} s', { n: Math.max(0, Math.ceil(state.options.shotSeconds - state.turnElapsed)) });
  $('charge-tip').hidden = !active || state.ballInHand;
  for (const id of ['aim-left', 'aim-right', 'spin']) $(id).disabled = !active || state.ballInHand || charge.active;
  $('side-controls').hidden = lobby || ended; $('power-bar').hidden = !charge.active;
  $('shoot').firstChild.textContent = `${state.ballInHand ? loc('Colocar') : charge.active ? loc('Soltar') : loc('Tirar')} `;
  if (state.revision !== lastRevision) {
    if (state.phase === 'rolling' && previousPhase !== 'rolling') audio.tone(360, 0, .06, 'triangle', .12);
    if (previousPhase === 'rolling' && state.phase !== 'rolling') { placement = null; $('pocket').value = ''; setSpin(0, 0); audio.tone(600, 0, .08, 'sine', .08); }
    lastRevision = state.revision;
  }
  $('results').hidden = !ended;
  if (ended) {
    menu.close();
    $('organize-table').disabled = !room.isHost;
    $('result-title').textContent = state.practice ? state.result.winner === null ? loc('¡Otra mesa!') : loc('¡Mesa limpia!') : state.options.format === 'duel' ? loc('¡Ganó {name}!', { name: state.players[state.result.winner]?.name }) : loc('¡Ganó el equipo {n}!', { n: state.result.team + 1 });
    $('result-copy').textContent = [loc(state.result.reason), locn(state.shots, '{score} · {n} tiro en la mesa.', '{score} · {n} tiros en la mesa.', { score: state.scores.join(' – ') })].join(' ');
    fillRoster($('result-board'), state.players.filter(p => p.id !== null).map(p => ({ name: p.name, detail: state.practice ? loc('Práctica') : groupName(state.groups[teamOf(state.players.indexOf(p))]), me: p.id === room.id,
      end: teamOf(state.players.indexOf(p)) === state.result.team ? loc('Ganador') : '' })));
    $('again').disabled = !room.isHost || !ready; $('again').textContent = !ready ? loc('Esperando a tu pana') : room.isHost ? loc('La revancha') : loc('El anfitrión prepara la revancha');
    if (room.isHost && ready && !state.result.matchFinished) $('again').textContent = loc('Siguiente mesa');
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
  if (charge.active) { if (charge.valid()) charge.update(now); else clearInput(); }
  if (ownTurn() && !charge.active) angle += held * dt * .45;
  world.draw(room.state, { angle, power, spin, active: ownTurn(), placement, calledPocket: $('pocket').value === '' ? -1 : Number($('pocket').value), dt, seat: room.connected ? room.seat : -1 }); requestAnimationFrame(frame);
}
render(room.state); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); notify.dispose(); room.dispose(); world.dispose(); }, { once: true });
if (params.has('debug')) window.billarDebug = { room, world, menu, get angle() { return angle; } };

await prepareScene(world);
