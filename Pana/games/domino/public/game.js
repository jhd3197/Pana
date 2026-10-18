import { prepareScene } from '/engine/game-load.js';
import { createTableSeating } from '/engine/table-seating.js';
import { createMapPicker } from '/engine/map-picker.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { DominoRoom } from './network.js';
import { legalEnds, legalMoves, chooseMove, pips, TARGET } from './rules.js';
import { domino } from './tiles.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const code = roomFromUrl() || newRoomCode();
params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
const name = loadName(), avatar = loadAvatar();
let selected = null, shownResult = '', toastTimer, previousEvent = '', previousPhase = 'lobby';
let world = null, worldReady = false, view = 'plaza', stopped = false;

// Audio is optional; a delayed audio module never prevents the table from loading.
const audio = {
  muted: false, volume: 1, unlocked: false, impl: null,
  unlock() { this.unlocked = true; this.impl?.unlock(); },
  setVolume(value) { this.volume = value; this.impl?.setVolume(value); },
  tone(...args) { if (this.impl) { this.impl.muted = this.muted; this.impl.tone(...args); } },
};
import('/engine/fx.js').then(({ sound }) => { audio.impl = sound; sound.setVolume(audio.volume); if (audio.unlocked) sound.unlock(); }).catch(() => {});

function notify(message) {
  $('toast').textContent = message; $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500);
}

const room = new DominoRoom({ code, name, avatar, onState: render,
  onStatus(message, failed = false) {
    $('connection').textContent = message; $('practice').hidden = !failed;
    $('invite').disabled = $('lobby-invite').disabled = !room.connected || room.offline;
    render(room.state);
  }, onNotice: notify,
});

const seating = createTableSeating($('table-seating'), (from, to) => room.action('seat', { from, to }));
$('organize-table').onclick = () => room.action('setup');
const mapPicker = createMapPicker($('map-picker'), mapId => room.action('map', { mapId }), { table: true, landmarks: true });
const menu = createGameMenu({
  title: 'Dominó · Pana', sound: audio,
  note: () => room.members.size > 1 ? 'La mesa sigue jugando mientras estás en el menú.' : 'La partida está en pausa. Los bots te esperan.',
  controls: [['1 2 3 4 5 6 7', 'Elegir una ficha de tu mano'], ['A B', 'Elegir una punta si la ficha cabe en ambas'], ['P', 'Pasar, solo si no tienes jugada'], ['H', 'Pedir una pista'], ['M', 'Activar o silenciar el sonido'], ['Esc', 'Abrir o cerrar el menú']],
  tips: [
    'Dos parejas: tu compañero se sienta enfrente. Se reparten las 28 fichas, siete por persona. No hay pozo.',
    'La primera mano abre obligatoriamente con el doble seis. En las siguientes abre quien salió; después de una tranca, el jugador con menos puntos de la pareja ganadora. Tras un empate, la salida rota un puesto.',
    'Juega una ficha que coincida con una punta. Si sirve en ambas, elige A o B. No puedes pasar si tienes una ficha válida.',
    'Gana la mano quien se queda sin fichas. Su pareja suma los puntos que le quedaron a la pareja rival.',
    'Cuatro pases seguidos trancan la mesa: gana la pareja con menos puntos entre sus dos manos y suma los puntos de los rivales. Un empate no suma.',
    'La primera pareja en llegar a 100 gana la partida. El anfitrión reparte cada nueva mano.',
    'Los panas que llegan toman un puesto de bot con sus fichas actuales. Si se van, un bot sigue. Con cuatro puestos ocupados, los demás observan.',
  ],
  invite: () => inviteUrl(code),
  canOpen: () => !$('result').open,
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('lobby-invite-slot').replaceWith(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));
$('lobby-room').textContent = `Sala ${code}`;
$('rules').onclick = () => menu.open('controls');
$('practice').onclick = () => room.practice();
$('start').onclick = () => room.action('start');
$('next-round').onclick = () => room.action('start');
$('review-table').onclick = closeResult;
$('result').addEventListener('cancel', event => { event.preventDefault(); closeResult(); });
$('round-result').onclick = showResult;
$('hint').onclick = hint;
$('pass').onclick = () => room.action('pass');
$('cancel-selection').onclick = () => { selected = null; renderHand(room.state); };
for (const end of ['left', 'right']) $(`play-${end}`).onclick = () => playSelected(end);
function setView(next) {
  view = next; world?.setView(view);
  $('camera-view').textContent = view === 'plaza' ? '◈ Vista de mesa' : '◈ Vista de plaza';
  $('camera-view').setAttribute('aria-pressed', String(view === 'mesa'));
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
}
$('camera-view').onclick = () => setView(view === 'plaza' ? 'mesa' : 'plaza');
for (const button of document.querySelectorAll('[data-view]')) button.onclick = () => setView(button.dataset.view);

function ownTurn() { return worldReady && room.connected && room.state.phase === 'playing' && room.seat >= 0 && room.state.turn === room.seat; }
function selectTile(id) {
  if (!ownTurn()) return;
  const tile = room.state.players[room.seat].hand.find(t => t.id === id), ends = legalEnds(room.state, tile);
  if (!ends.length) return;
  if (ends.length === 1 || room.state.chain[0]?.a === room.state.chain.at(-1)?.b) {
    selected = null; room.action('play', { tile: id, end: ends[0] });
  } else { selected = selected === id ? null : id; renderHand(room.state); }
}
function playSelected(end) {
  if (!selected || !ownTurn()) return;
  const tile = selected; selected = null; room.action('play', { tile, end });
}
function hint() {
  if (!ownTurn()) return;
  const move = chooseMove(room.state, room.seat);
  if (!move) { notify('No tienes una ficha válida. Te toca pasar.'); return; }
  const tile = room.state.players[room.seat].hand.find(t => t.id === move.tile);
  $('hand').querySelectorAll('.hinted').forEach(n => n.classList.remove('hinted'));
  $('hand').querySelector(`[data-tile="${move.tile}"]`)?.classList.add('hinted');
  notify(`Prueba el ${tile.a}–${tile.b}${room.state.chain.length ? ` en la punta ${move.end === 'left' ? 'A' : 'B'}` : ' para abrir'}.`);
}

function render(state) {
  seating.update(state.players, { teams: true, enabled: room.connected && room.isHost && state.phase === 'lobby', ownId: room.id });
  $('organize-table').disabled = !room.connected || !room.isHost;
  mapPicker.update(state.mapId, room.connected && room.isHost && state.phase === 'lobby');
  const seat = room.seat, base = seat < 0 ? 0 : seat, team = base % 2;
  const last = state.history.at(-1), eventKey = `${state.round}:${state.history.length}:${state.chain.length}`;
  if (previousEvent && previousEvent !== eventKey && last?.kind === 'play') audio.tone(430, 0, .07, 'triangle', .09);
  previousEvent = eventKey;
  document.body.classList.toggle('in-lobby', state.phase === 'lobby');
  $('your-name').textContent = seat >= 0 ? `${state.players[seat].name} · tú` : 'Espectador';
  $('our-label').textContent = seat >= 0 ? 'Nosotros' : 'Pareja A';
  $('their-label').textContent = seat >= 0 ? 'Ellos' : 'Pareja B';
  $('our-score').textContent = state.scores[team]; $('their-score').textContent = state.scores[1 - team];
  $('our-progress').style.width = `${Math.min(100, state.scores[team] / TARGET * 100)}%`;
  $('their-progress').style.width = `${Math.min(100, state.scores[1 - team] / TARGET * 100)}%`;
  $('our-names').textContent = state.players.filter(p => p.seat % 2 === team).map(p => p.id === room.id ? 'Tú' : p.name).join(' + ');
  $('their-names').textContent = state.players.filter(p => p.seat % 2 !== team).map(p => p.name).join(' + ');
  $('round-label').textContent = state.phase === 'lobby' ? 'Mesa abierta' : `Mano ${state.round}`;
  $('lobby-roster').textContent = seat >= 0 ? `${state.players[(seat + 2) % 4].name} es tu pareja` : 'La mesa está llena';
  renderSeats(state, base);
  $('welcome').hidden = state.phase !== 'lobby';
  $('start').disabled = !worldReady || !room.connected || !room.isHost;
  $('start').replaceChildren(document.createTextNode(!worldReady ? 'Preparando la mesa…' : !room.connected ? 'Conectando…' : room.isHost ? '¡Repartir!' : 'El anfitrión reparte'));
  $('ends-label').textContent = state.chain.length ? `Puntas: A · ${state.chain[0].a}  /  B · ${state.chain.at(-1).b}` : '28 fichas · 4 panas · sin pozo';
  renderHand(state); renderHistory(state, team);
  const ended = ['round-over', 'finished'].includes(state.phase);
  const resultId = `${state.round}:${state.phase}`;
  if (ended) {
    renderResult(state, team);
    if (shownResult !== resultId) { shownResult = resultId; showResult(); }
  } else { if ($('result').open) closeResult(); if (state.phase === 'playing' && previousPhase !== 'playing') shownResult = ''; }
  previousPhase = state.phase;
}

function renderHand(state) {
  const myTurn = ownTurn(), seat = room.seat, ended = ['round-over', 'finished'].includes(state.phase);
  const hand = seat >= 0 ? state.players[seat].hand : [], activeTile = document.activeElement?.dataset?.tile;
  if (!myTurn || !hand.some(t => t.id === selected)) selected = null;
  $('hand').replaceChildren();
  if (state.phase === 'lobby') for (let i = 0; i < 7; i++) $('hand').append(domino(null, { back: true }));
  else if (seat >= 0) hand.forEach((tile, index) => {
    const button = domino(tile, { button: true }), canPlay = myTurn && legalEnds(state, tile).length > 0;
    button.disabled = !canPlay; button.classList.toggle('playable', !!canPlay); button.classList.toggle('selected', tile.id === selected);
    button.setAttribute('aria-pressed', String(tile.id === selected));
    button.title = `${tile.a}–${tile.b}${canPlay ? ` · tecla ${index + 1}` : myTurn ? ' · no coincide con las puntas' : ''}`;
    button.onclick = () => selectTile(tile.id); $('hand').append(button);
  });
  if (activeTile) $('hand').querySelector(`[data-tile="${activeTile}"]:not(:disabled)`)?.focus({ preventScroll: true });
  $('hand-count').textContent = seat < 0 ? 'Mesa llena · estás mirando' : state.phase === 'lobby' ? 'Tu puesto está listo' : `${hand.length} ${hand.length === 1 ? 'ficha' : 'fichas'} · ${pips(hand)} puntos`;
  const moves = myTurn ? legalMoves(state, seat) : [];
  const tips = state.chain.length ? [...new Set([state.chain[0].a, state.chain.at(-1).b])].join(' o al ') : '';
  $('turn-status').classList.toggle('your-turn', myTurn);
  $('turn-status').textContent = !room.connected ? 'Esperando conexión…' : ended ? 'Mano terminada' : state.phase === 'lobby' ? 'La mesa te espera.'
    : myTurn ? `¡Tu turno! · ${selected ? 'elige la punta' : !state.chain.length ? 'abre la mano' : moves.length ? `juega al ${tips}` : 'canta paso'}` : `Turno de ${state.players[state.turn].name}`;
  $('hint').disabled = !myTurn;
  $('pass').hidden = !myTurn || moves.length > 0;
  $('round-result').hidden = !ended;
  $('end-actions').hidden = !selected;
  $('instruction').textContent = seat < 0 && state.phase !== 'lobby' ? 'Entras cuando se libere un puesto.' : ended ? 'Una mano más, un cuento más.' : state.phase === 'lobby' ? 'Reparte las fichas para empezar.' : selected ? 'Elige dónde colocar tu ficha.' : myTurn ? !state.chain.length && state.round === 1 ? 'Abre la partida con el doble seis.' : moves.length ? 'Toca una ficha marcada para jugarla.' : 'No tienes jugada. Canta paso.' : 'Ve pensando tu próxima jugada.';
  if (selected) {
    const ends = legalEnds(state, hand.find(t => t.id === selected));
    $('play-left').textContent = `Punta A · ${state.chain[0]?.a}`; $('play-left').disabled = !ends.includes('left');
    $('play-right').textContent = `Punta B · ${state.chain.at(-1)?.b}`; $('play-right').disabled = !ends.includes('right');
  }
  world?.update(state, room.seat, selected);
}

// Partner chip top-center, rivals' cards on the side they sit in the 3D view.
function renderSeats(state, base) {
  const playing = state.phase !== 'lobby' && room.seat >= 0;
  for (const [id, offset] of [['partner-card', 2], ['rival-right', 1], ['rival-left', 3]]) {
    const node = $(id), player = state.players[(base + offset) % 4]; node.hidden = !playing;
    if (!playing) continue;
    const last = [...state.history].reverse().find(e => e.seat === player.seat), count = player.hand.length;
    const badge = document.createElement('span'), name = document.createElement('b'), note = document.createElement('span');
    badge.className = 'seat-badge'; badge.textContent = player.id === null ? 'BOT' : player.name.slice(0, 1).toUpperCase();
    name.textContent = player.name; note.className = 'seat-note';
    note.textContent = `${offset === 2 ? 'TU PAREJA · ' : ''}${count} ${count === 1 ? 'ficha' : 'fichas'}`;
    node.classList.toggle('is-turn', state.phase === 'playing' && state.turn === player.seat);
    if (offset === 2) { const copy = document.createElement('div'); copy.append(name, note); node.replaceChildren(badge, copy); }
    else node.replaceChildren(badge, name, note);
    if (last?.kind === 'pass') { const passed = document.createElement('span'); passed.className = 'seat-passed'; passed.textContent = 'PASÓ'; (offset === 2 ? node.lastChild : node).append(passed); }
  }
}

function renderHistory(state, team) {
  $('move-count').textContent = `${state.history.length} JUGADAS`;
  $('activity').replaceChildren();
  if (!state.history.length) {
    const li = document.createElement('li'); li.className = 'activity-empty';
    li.textContent = state.phase === 'lobby' ? 'Aquí va el cuento de la partida.' : 'El primer golpe está por caer.'; $('activity').append(li);
  }
  for (const event of state.history.slice(-3).reverse()) {
    const li = document.createElement('li'), marker = document.createElement('i'), copy = document.createElement('div'), title = document.createElement('strong'), note = document.createElement('small');
    marker.className = `activity-marker${event.seat % 2 !== team ? ' rival' : ''}`; title.textContent = event.name;
    note.textContent = event.kind === 'play' ? `Jugó ${event.tile.a}–${event.tile.b}` : 'Cantó paso'; copy.append(title, note); li.append(marker, copy);
    const tile = document.createElement('span');
    if (event.kind === 'play') {
      tile.className = 'mini-domino'; for (const value of [event.tile.a, event.tile.b]) { const half = document.createElement('span'); half.textContent = value; tile.append(half); }
    } else { tile.className = 'pass-label'; tile.textContent = 'PASO'; }
    li.append(tile); $('activity').append(li);
  }
}

function renderResult(state, team) {
  const result = state.result, won = result.winner === team;
  $('result-eyebrow').textContent = state.phase === 'finished' ? 'PARTIDA TERMINADA' : `MANO ${state.round} · ${result.reason === 'blocked' ? 'MESA TRANCADA' : 'DOMINÓ'}`;
  $('result-title').textContent = result.winner === null ? '¡Quedaron tablas!' : won ? state.phase === 'finished' ? '¡La partida es suya!' : '¡Esa mano es de ustedes!' : state.phase === 'finished' ? 'La revancha los espera.' : 'Esta fue de los rivales.';
  $('result-description').textContent = result.winner === null ? 'Las dos parejas tienen los mismos puntos. Nadie suma esta mano.' : `${result.reason === 'out' ? `${state.players[result.seat].name} se quedó sin fichas.` : 'Ganó la pareja con menos puntos en mano.'} ${won ? 'Tu pareja suma' : 'Los rivales suman'} ${result.points} puntos.`;
  $('result-score').replaceChildren();
  for (const [text, tag] of [['Ustedes', 'span'], [state.scores[team], 'b'], ['—', 'span'], [state.scores[1 - team], 'b'], ['Rivales', 'span']]) {
    const node = document.createElement(tag); node.textContent = text; $('result-score').append(node);
  }
  fillRoster($('result-hands'), state.players.map(player => ({
    name: player.name, end: `${player.hand.length} fichas · ${pips(player.hand)} puntos`, me: player.seat === room.seat })));
  $('next-round').textContent = !room.isHost ? 'El anfitrión reparte la siguiente' : state.phase === 'finished' ? 'Jugar la revancha →' : 'Siguiente mano →';
  $('next-round').disabled = !room.isHost || !room.connected;
}
function showResult() {
  menu.close(); $('result').hidden = false;
  if (!$('result').open) $('result').showModal();
}
function closeResult() { $('result').close(); $('result').hidden = true; }

addEventListener('keydown', event => {
  if (menu.isOpen || $('result').open || event.repeat || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (key === 'm') toggleMute();
  if (key === 'h') hint();
  if (!ownTurn()) return;
  if (/^[1-7]$/.test(key)) { event.preventDefault(); const tile = room.state.players[room.seat].hand[Number(key) - 1]; if (tile) selectTile(tile.id); }
  if (key === 'a' && selected) playSelected('left');
  if (key === 'b' && selected) playSelected('right');
  if (key === 'p' && !legalMoves(room.state, room.seat).length) room.action('pass');
});
let previous = performance.now();
const timer = setInterval(() => {
  const now = performance.now(), dt = Math.min(.2, (now - previous) / 1000); previous = now;
  room.tick(dt, menu.isOpen && room.members.size <= 1);
}, 100);
let frameTime = performance.now();
function frame(now) { if (stopped) return; const dt = Math.min(.05, (now - frameTime) / 1000); frameTime = now; world?.frame(dt); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); clearTimeout(toastTimer); room.dispose(); world?.dispose(); }, { once: true });
render(room.state); room.connect();
export const sceneReady = import('./scene.js').then(module => module.createDominoScene($('world'), { onTile: selectTile, onEnd: playSelected, onLoading: message => { $('loading-copy').textContent = message; } })).then(async scene => {
  if (stopped) { scene.dispose(); return; }
  world = scene; await prepareScene(world); worldReady = true; world.update(room.state, room.seat); if (view !== 'plaza') world.setView(view); render(room.state); $('loading').hidden = true;
}).catch(error => {
  console.error(error); $('loading-copy').textContent = 'No pudimos cargar la plaza. Comprueba tu conexión y WebGL.';
  const reload = document.createElement('button'); reload.className = 'pk-btn pk-btn--primary'; reload.textContent = 'Volver a intentar'; reload.onclick = () => location.reload(); $('loading').append(reload); throw error;
});
// Opt-in diagnostics for repeatable browser regression tests.
if (params.has('debug')) window.dominoDebug = { room, legalMoves, chooseMove, menu, render, get world() { return world; } };
