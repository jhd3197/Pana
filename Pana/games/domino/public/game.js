import { createRoomOptions } from '/engine/room-options.js';
import { FIELDS, cleanOptions, maxPip, groupOf, CHAT } from './options.js';
import { prepareScene } from '/engine/game-load.js';
import { createTableSeating } from '/engine/table-seating.js';
import { createMapPicker } from '/engine/map-picker.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { DominoRoom } from './network.js';
import { legalEnds, legalMoves, chooseMove, pips, TARGET } from './rules.js';
import { barksFor } from './barks.js';
import { domino } from './tiles.js';
import { createToast } from '/engine/hud.js';

const $ = id => document.getElementById(id);
const notify = createToast($('toast'), { ms: 3500 });
const params = new URLSearchParams(location.search);
const code = roomFromUrl() || newRoomCode();
params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
const name = loadName(), avatar = loadAvatar();
let chatSeen=0;
let selected = null, shownResult = '', previousEvent = '', previousPhase = 'lobby';
let quiet=false;
let barkRound = -1, barkId = 0, barksPrimed = false, resultTimer;
let world = null, worldReady = false, view = 'plaza', stopped = false;

// Audio is optional; a delayed audio module never prevents the table from loading.
const audio = {
  muted: false, volume: 1, unlocked: false, impl: null,
  unlock() { this.unlocked = true; this.impl?.unlock(); },
  setVolume(value) { this.volume = value; this.impl?.setVolume(value); },
  tone(...args) { if (this.impl) { this.impl.muted = this.muted; this.impl.tone(...args); } },
};
import('/engine/fx.js').then(({ sound }) => { audio.impl = sound; sound.setVolume(audio.volume); if (audio.unlocked) sound.unlock(); }).catch(() => {});


const room = new DominoRoom({ code, name, avatar, onState: render,
  onStatus(message, failed = false) {
    $('connection').textContent = message; $('practice').hidden = !failed;
    $('invite').disabled = $('lobby-invite').disabled = !room.connected || room.offline;
    render(room.state);
  }, onNotice: notify,
});

const roomOptions=createRoomOptions($('room-options'),{title:'Dominó',fields:FIELDS,change:patch=>{if(!room.action('options',{patch})&&patch.seats)notify('Hay panas en esos puestos. Libéralos antes de reducir la mesa.');},reset:()=>{const patch=cleanOptions();if(room.state.players.slice(4).some(p=>p.id!==null))patch.seats=6;room.action('options',{patch,resetMap:true});}});
for(const [message,text]of CHAT.entries()){const button=document.createElement('button');button.type='button';button.className='pk-btn pk-btn--sm';button.textContent=text;button.onclick=()=>room.action('chat',{message});$('chat-buttons').append(button);}
const seating = createTableSeating($('table-seating'), (from, to) => room.action('seat', { from, to }));
$('organize-table').onclick = () => room.action('setup');
const mapPicker = createMapPicker($('map-picker'), mapId => room.action('map', { mapId }), { table: true, landmarks: true });
const menu = createGameMenu({
  title: 'Dominó · Pana', sound: audio,
  note: () => room.members.size > 1 ? 'La mesa sigue jugando mientras estás en el menú.' : 'La partida está en pausa. Los bots te esperan.',
  controls: [['1 2 3 4 5 6 7 8 9 0', 'Elegir una ficha de tu mano'], ['A B', 'Elegir una punta si la ficha cabe en ambas'], ['P', 'Pasar, solo si no tienes jugada'], ['H', 'Pedir una pista'], ['M', 'Activar o silenciar el sonido'], ['Esc', 'Abrir o cerrar el menú']],
  tips: [
    'Mesa clásica de cuatro o ampliada de seis. Los puestos alternos forman dos equipos; Individual reparte puntos a cada pana.',
    'Siete o diez fichas por pana. La mesa amplía el juego a doble nueve o doble doce cuando hace falta; las sobrantes se apartan, no hay robo.',
    'La salida puede ser doble seis, ganador anterior (primera mano: doble seis), o un pana al azar.',
    'Juega una ficha que coincida con una punta. Si sirve en ambas, elige A o B. No puedes pasar si tienes jugada.',
    'Gana quien se queda sin fichas y suma los puntos que quedaron a sus rivales. Una capicúa es la última ficha que podía jugarse en ambas puntas.',
    'Con Pase anotado, cada paso da diez puntos al equipo o pana anterior. El anfitrión elige si una tranca puntúa o se reparte sin puntuar.',
    'Con reloj, al agotarse el turno se juega una ficha legal automáticamente. Los ajustes muestran el tiempo y la meta de la partida.',
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
  roomOptions.update(state.options,room.isHost&&room.connected&&state.phase==='lobby');
  $('deck-copy').textContent=`Doble ${maxPip(state.options)} · ${state.options.handSize} fichas por pana · ${state.players.length} puestos · sin robo`;
  $('quick-chat').hidden=!state.options.quickChat||room.seat<0;
  const chat=state.chat?.at(-1);if(chat&&chat.id!==chatSeen){chatSeen=chat.id;notify(`${chat.name}: ${CHAT[chat.message]}`);world?.say(chat.seat,CHAT[chat.message],2);}
  seating.update(state.players, { teams: state.options.mode==='teams', enabled: room.connected && state.phase === 'lobby', canArrange: room.isHost, members: room.link?.state.players || [], ownId: room.id, hostId: room.hostId });
  $('organize-table').disabled = !room.connected || !room.isHost;
  mapPicker.update(state.mapId, room.connected && room.isHost && state.phase === 'lobby');
  const seat = room.seat, base = seat < 0 ? 0 : seat, team = groupOf(state,base), rival=state.scores.map((score,i)=>({score,i})).filter(x=>x.i!==team).sort((a,b)=>b.score-a.score)[0]?.i??0;
  const last = state.history.at(-1), eventKey = `${state.round}:${state.history.length}:${state.chain.length}`;
  if (previousEvent && previousEvent !== eventKey && last?.kind === 'play') audio.tone(430, 0, .07, 'triangle', .09);
  previousEvent = eventKey;
  document.body.classList.toggle('in-lobby', state.phase === 'lobby');
  $('your-name').textContent = seat >= 0 ? `${state.players[seat].name} · tú` : 'Espectador';
  $('our-label').textContent = state.options.mode==='individual'?'Tú':seat >= 0 ? 'Nosotros' : 'Equipo A';
  $('their-label').textContent = state.options.mode==='individual'?'Rival líder':seat >= 0 ? 'Ellos' : 'Equipo B';
  $('our-score').textContent = state.scores[team]; $('their-score').textContent = state.scores[rival];
  $('our-progress').style.width = `${Math.min(100, state.scores[team] / state.options.target * 100)}%`;
  $('their-progress').style.width = `${Math.min(100, state.scores[rival] / state.options.target * 100)}%`;
  $('our-names').textContent = state.players.filter(p => groupOf(state,p.seat) === team).map(p => p.id === room.id ? 'Tú' : p.name).join(' + ');
  $('their-names').textContent = state.players.filter(p => groupOf(state,p.seat) !== team).map(p => p.name).join(' + ');
  document.querySelector('.score-target').textContent=`a ${state.options.target}`;
  $('round-label').textContent = state.phase === 'lobby' ? 'Mesa abierta' : `Mano ${state.round}`;
  $('lobby-roster').textContent = seat >= 0 ? state.options.mode==='individual'?'Cada pana juega por su cuenta':`Tu equipo: ${state.players.filter(p=>p.seat!==seat&&groupOf(state,p.seat)===team).map(p=>p.name).join(' y ')}` : 'La mesa está llena';
  renderSeats(state, base);
  $('welcome').hidden = state.phase !== 'lobby';
  $('start').disabled = !worldReady || !room.connected || !room.isHost;
  $('start').replaceChildren(document.createTextNode(!worldReady ? 'Preparando la mesa…' : !room.connected ? 'Conectando…' : room.isHost ? '¡Repartir!' : 'El anfitrión reparte'));
  $('ends-label').textContent = state.chain.length ? `Puntas: A · ${state.chain[0].a}  /  B · ${state.chain.at(-1).b}` : `${state.options.handSize*state.players.length} fichas en juego · ${state.players.length} panas · sin robo`;
  renderHand(state); renderHistory(state, team);
  const ended = ['round-over', 'finished'].includes(state.phase);
  const resultId = `${state.round}:${state.phase}`;
  if (ended) {
    renderResult(state, team);
    // A mano that just ended waits a beat so its barks are seen before the results cover the table.
    if (shownResult !== resultId) { shownResult = resultId; clearTimeout(resultTimer); resultTimer = setTimeout(showResult, previousPhase === 'playing' ? 1600 : 0); }
  } else { clearTimeout(resultTimer); if ($('result').open) closeResult(); if (state.phase === 'playing' && previousPhase !== 'playing') shownResult = ''; }
  // Arriving mid-game replays the whole history: only bark at what happens live.
  const fresh = state.round === barkRound ? state.history.filter(e => e.id > barkId) : state.history;
  if (barksPrimed) for (const bark of barksFor(state, fresh, { ended: ended && previousPhase === 'playing' })) world.say(bark.seat, bark.text, bark.time);
  barkRound = state.round; barkId = state.history.at(-1)?.id || 0; if (world) barksPrimed = true;
  previousPhase = state.phase;
}

function renderHand(state) {
  const myTurn = ownTurn(), seat = room.seat, ended = ['round-over', 'finished'].includes(state.phase);
  const hand = seat >= 0 ? state.players[seat].hand : [], activeTile = document.activeElement?.dataset?.tile;
  if (!myTurn || !hand.some(t => t.id === selected)) selected = null;
  $('hand').classList.toggle('large-hand',state.options.handSize===10);
  $('hand').replaceChildren();
  if (state.phase === 'lobby') for (let i = 0; i < state.options.handSize; i++) $('hand').append(domino(null, { back: true }));
  else if (seat >= 0) hand.forEach((tile, index) => {
    const button = domino(tile, { button: true }), canPlay = myTurn && legalEnds(state, tile).length > 0;
    button.disabled = !canPlay; button.classList.toggle('playable', !!canPlay); button.classList.toggle('selected', tile.id === selected);
    button.setAttribute('aria-pressed', String(tile.id === selected));
    button.title = `${tile.a}–${tile.b}${canPlay ? ` · tecla ${(index + 1)%10}` : myTurn ? ' · no coincide con las puntas' : ''}`;
    button.onclick = () => selectTile(tile.id); $('hand').append(button);
  });
  if (activeTile) $('hand').querySelector(`[data-tile="${activeTile}"]:not(:disabled)`)?.focus({ preventScroll: true });
  $('hand-count').textContent = seat < 0 ? 'Mesa llena · estás mirando' : state.phase === 'lobby' ? 'Tu puesto está listo' : `${hand.length} ${hand.length === 1 ? 'ficha' : 'fichas'} · ${pips(hand)} puntos`;
  const moves = myTurn ? legalMoves(state, seat) : [];
  const tips = state.chain.length ? [...new Set([state.chain[0].a, state.chain.at(-1).b])].join(' o al ') : '';
  $('turn-status').classList.toggle('your-turn', myTurn);
  $('turn-status').textContent = !room.connected ? 'Esperando conexión…' : ended ? 'Mano terminada' : state.phase === 'lobby' ? 'La mesa te espera.'
    : myTurn ? `¡Tu turno! · ${selected ? 'elige la punta' : !state.chain.length ? 'abre la mano' : moves.length ? `juega al ${tips}` : 'canta paso'}` : `Turno de ${state.players[state.turn].name}`;
  if(state.phase==='playing'&&state.options.turnSeconds)$('turn-status').textContent+=` · ${Math.ceil(state.turnRemaining)} s`;
  $('hint').disabled = !myTurn;
  $('pass').hidden = !myTurn || moves.length > 0;
  $('round-result').hidden = !ended;
  $('end-actions').hidden = !selected;
  $('instruction').textContent = seat < 0 && state.phase !== 'lobby' ? 'Entras cuando se libere un puesto.' : ended ? 'Una mano más, un cuento más.' : state.phase === 'lobby' ? 'Reparte las fichas para empezar.' : selected ? 'Elige dónde colocar tu ficha.' : myTurn ? !state.chain.length && state.openingTile ? 'Abre la partida con el doble seis.' : moves.length ? 'Toca una ficha marcada para jugarla.' : 'No tienes jugada. Canta paso.' : 'Ve pensando tu próxima jugada.';
  if (selected) {
    const ends = legalEnds(state, hand.find(t => t.id === selected));
    $('play-left').textContent = `Punta A · ${state.chain[0]?.a}`; $('play-left').disabled = !ends.includes('left');
    $('play-right').textContent = `Punta B · ${state.chain.at(-1)?.b}`; $('play-right').disabled = !ends.includes('right');
  }
  world?.update(state, room.seat, selected);
}

// Partner chip top-center, rivals' cards on the side they sit in the 3D view.
function renderSeats(state, base) {
  const extended=state.players.length>4||state.options.mode==='individual';
  $('extended-roster').hidden=!extended||state.phase==='lobby';
  $('extended-roster').replaceChildren(...state.players.map(p=>{const line=document.createElement('span');line.textContent=`${p.name}: ${p.hand.length} fichas${state.options.mode==='individual'?` · ${state.scores[p.seat]} pt`:''}`;line.classList.toggle('is-turn',p.seat===state.turn&&state.phase==='playing');return line;}));
  const playing = !extended&&state.phase !== 'lobby' && room.seat >= 0;
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
    marker.className = `activity-marker${groupOf(state,event.seat) !== team ? ' rival' : ''}`; title.textContent = event.name;
    note.textContent = event.kind === 'play' ? `Jugó ${event.tile.a}–${event.tile.b}` : 'Cantó paso'; copy.append(title, note); li.append(marker, copy);
    const tile = document.createElement('span');
    if (event.kind === 'play') {
      tile.className = 'mini-domino'; for (const value of [event.tile.a, event.tile.b]) { const half = document.createElement('span'); half.textContent = value; tile.append(half); }
    } else { tile.className = 'pass-label'; tile.textContent = 'PASO'; }
    li.append(tile); $('activity').append(li);
  }
}

function renderResult(state, team) {
  const rival=state.scores.map((score,i)=>({score,i})).filter(x=>x.i!==team).sort((a,b)=>b.score-a.score)[0]?.i??0;
  const result = state.result, outcome=state.phase==='finished'?result.matchWinner:result.winner, won = outcome === team;
  $('result-eyebrow').textContent = state.phase === 'finished' ? 'PARTIDA TERMINADA' : `MANO ${state.round} · ${['blocked','redeal'].includes(result.reason) ? 'MESA TRANCADA' : 'DOMINÓ'}`;
  $('result-title').textContent = outcome === null ? '¡Quedaron tablas!' : won ? state.phase === 'finished' ? '¡La partida es suya!' : '¡Esa mano es de ustedes!' : state.phase === 'finished' ? 'La revancha los espera.' : 'Esta fue de los rivales.';
  $('result-description').textContent = result.winner === null ? result.reason==='redeal'?'Mesa trancada: se reparte otra mano sin puntuar.':'Empate: nadie suma esta mano.' : `${result.reason === 'out' ? `${state.players[result.seat].name} se quedó sin fichas.` : 'Ganó quien tenía menos puntos en mano.'} ${result.winner===team ? 'Sumas' : 'El ganador suma'} ${result.points} puntos.${result.capicua?' ¡Capicúa!':''}`;
  $('result-score').replaceChildren();
  for (const [text, tag] of [[state.options.mode==='individual'?'Tú':'Ustedes', 'span'], [state.scores[team], 'b'], ['—', 'span'], [state.scores[rival], 'b'], [state.options.mode==='individual'?'Mejor rival':'Rivales', 'span']]) {
    const node = document.createElement(tag); node.textContent = text; $('result-score').append(node);
  }
  fillRoster($('result-hands'), state.players.map(player => ({
    name: player.name, detail:state.options.mode==='individual'?`${state.scores[player.seat]} puntos en la partida`:'', end: `${player.hand.length} fichas · ${pips(player.hand)} puntos`, me: player.seat === room.seat })));
  $('next-round').textContent = !room.isHost ? 'El anfitrión reparte la siguiente' : state.phase === 'finished' ? 'Jugar la revancha →' : 'Siguiente mano →';
  $('next-round').disabled = !room.isHost || !room.connected;
}
function showResult() {
  if (!['round-over', 'finished'].includes(room.state.phase)) return;
  menu.close(); $('result').hidden = false;
  if (!$('result').open) $('result').showModal();
}
function closeResult() { $('result').close(); $('result').hidden = true; }

addEventListener('keydown', event => {
  if (roomOptions.isOpen || menu.isOpen || $('result').open || event.repeat || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (key === 'm') toggleMute();
  if (key === 'h') hint();
  if (!ownTurn()) return;
  if (/^[0-9]$/.test(key)) { event.preventDefault(); const tile = room.state.players[room.seat].hand[(Number(key)||10) - 1]; if (tile) selectTile(tile.id); }
  if (key === 'a' && selected) playSelected('left');
  if (key === 'b' && selected) playSelected('right');
  if (key === 'p' && !legalMoves(room.state, room.seat).length) room.action('pass');
});
let previous = performance.now();
const timer = setInterval(() => {
  const now = performance.now(), dt = Math.min(1, (now - previous) / 1000); previous = now;
  room.tick(dt, menu.isOpen && room.members.size <= 1);
}, 100);
let frameTime = performance.now();
function frame(now) { if (stopped) return; const dt = Math.min(.05, (now - frameTime) / 1000); frameTime = now; if(!quiet)world?.frame(dt); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); notify.dispose(); clearTimeout(resultTimer); roomOptions.dispose();room.dispose(); world?.dispose(); }, { once: true });
render(room.state); room.connect();
export const sceneReady = import('./scene.js').then(module => module.createDominoScene($('world'), { onTile: selectTile, onEnd: playSelected, onLoading: message => { $('loading-copy').textContent = message; } })).then(async scene => {
  if (stopped) { scene.dispose(); return; }
  world = scene; await prepareScene(world); worldReady = true; world.update(room.state, room.seat); if (view !== 'plaza') world.setView(view); render(room.state); $('loading').hidden = true;
}).catch(error => {
  console.error(error); $('loading-copy').textContent = 'No pudimos cargar la plaza. Comprueba tu conexión y WebGL.';
  const reload = document.createElement('button'); reload.className = 'pk-btn pk-btn--primary'; reload.textContent = 'Volver a intentar'; reload.onclick = () => location.reload(); $('loading').append(reload); throw error;
});
// Opt-in diagnostics for repeatable browser regression tests.
if (params.has('debug')) window.dominoDebug = { room, legalMoves, chooseMove, menu, render, quiet(value){quiet=!!value;}, get world() { return world; } };
