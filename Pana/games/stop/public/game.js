// Wiring only: input → rules (through the room) → scene and HUD.
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl } from '/engine/invite.js';
import { sound } from '/engine/fx.js';
import { roomCode, bootGame } from '/engine/game-shell.js';
import { createRoomOptions } from '/engine/room-options.js';
import { StopRoom } from './network.js';
import { ROOM_OPTIONS, defaultOptions } from './options.js';
import { ranking, seated, TITLE_TEXT } from './rules.js';
import { createSheet } from './sheet.js';
import { createReview } from './review.js';
import { renderBoard, renderWheelPanel, renderTally, shout, botDetail, clockText } from './hud.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomCode();
let world = null, lastPhase = '', lastClock = 0, lastSent = 0, lastStage = '', lastLine = '';
const room = new StopRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render,
  onNotice: (text) => { $('event').textContent = text; },
  onStatus(text, failed = false) { $('connection').textContent = text; $('practice').hidden = !failed; render(room.state); },
});
const roomOptions = createRoomOptions($('room-options'), { title: '¡Stop!', fields: ROOM_OPTIONS,
  change: options => room.action('options', { options }), reset: () => room.action('options', { options: defaultOptions() }) });
const menu = createGameMenu({ pad: { buttons: true, keys: { x: ['Space', '¡Para! la rueda'] } }, title: '¡Stop! · Pana', sound, orientation: 'libre',
  note: () => room.members.size > 1 ? 'La ronda sigue mientras estás en el menú.' : 'La partida está en pausa. Los bots te esperan.',
  controls: [['Tab / Enter', 'Pasar a la siguiente casilla'], ['Espacio', '¡Para! cuando te toca la rueda'], ['Ratón / toque', '¡STOP! y los votos'], ['M', 'Activar o silenciar el sonido']],
  tips: [
    'Sale una letra y escribes una palabra por categoría que empiece con ella. Nadie ve tu hoja hasta la revisión.',
    'El primero que llena todo grita ¡STOP! y los demás tienen 5 segundos. Si nadie termina, se acaba el tiempo.',
    'Lo que el juego conoce cuenta solo (verde). Lo que no empieza con la letra, no (rojo). Lo dudoso se vota: «¿Eso cuenta?».',
    '100 puntos si nadie más la puso, 50 si alguien la repitió. Una dudosa que la mesa acepta con dos tercios suma +50 de Creatividad.',
    'Con «Más criollo» las groserías van a votación; sin eso, la libreta las tacha sola.',
  ],
  invite: () => room.offline ? null : inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('rules').onclick = () => menu.open('controls');
$('start').onclick = $('again').onclick = () => { sound.unlock(); room.action('start'); };
$('practice').onclick = () => room.practice();
$('para').onclick = () => para();

const me = () => room.state.players[room.seat];
// One sheet per round of each game; a reload is a new pana, so memory is enough.
const roundKey = (s = room.state) => `${s.games}:${s.round}`;
const sheet = createSheet($('sheet'), {
  onProgress(filled) {
    const s = room.state, p = me();
    // Deferred: sync() runs inside render, and a host's action re-renders at once.
    if (p && ['write', 'basta'].includes(s.phase) && !p.submitted && filled !== p.filled) queueMicrotask(() => room.action('progress', { round: s.round, filled }));
  },
  onStop(answers) {
    const s = room.state; if (s.phase !== 'write' || !me() || menu.isOpen) return;
    sound.unlock(); if (room.action('stop', { round: s.round, sheet: answers })) sound.bonk(1);
  },
});
const review = createReview($('review'), {
  onVote(group, yes, index) {
    const s = room.state; if (!me() || menu.isOpen) return;
    sound.unlock(); if (room.action('vote', { round: s.round, index, group, yes })) sound.clickDown();
  },
});

function para() {
  const s = room.state; if (menu.isOpen || s.phase !== 'spin' || s.spinner !== room.seat) return;
  sound.unlock(); if (room.action('para', { round: s.round })) sound.clickDown();
}

// Pencils down: hand the sheet in until the host has it (a new host asks again).
function handIn() {
  const s = room.state, p = me();
  if (!room.connected || s.phase !== 'collect' || !p || p.submitted) return;
  const now = performance.now(); if (now - lastSent < 900) return; lastSent = now;
  room.action('sheet', { round: s.round, sheet: sheet.key === roundKey(s) ? sheet.values() : [] });
}

function renderSheet(state, p) {
  const phase = state.phase, stopped = state.stopper === room.seat;
  const canWrite = !!p && room.connected && !p.submitted && !menu.isOpen && (phase === 'write' || (phase === 'basta' && !stopped));
  sheet.sync(state, { roundKey: roundKey(state), canWrite, focus: phase === 'write' && !matchMedia('(pointer: coarse)').matches });
  $('sheet-meta').textContent = `Ronda ${state.round} de ${state.rounds}`;
  const timed = phase === 'write' || phase === 'basta';
  $('sheet-clock').textContent = timed ? (phase === 'basta' ? `${Math.ceil(state.timeLeft)}…` : clockText(state.timeLeft)) : '';
  $('sheet-clock').classList.toggle('hurry', phase === 'basta' || (timed && state.timeLeft <= 10));
  const n = state.categories.length, mine = sheet.filled();
  $('sheet-note').textContent = !p ? 'Estás mirando: la mesa está llena.'
    : phase === 'collect' ? 'Lápices abajo. Entregando las hojas…'
    : phase === 'basta' ? (stopped ? '¡Gritaste STOP! Los demás tienen 5 segundos.' : `¡${state.players[state.stopper].name} gritó STOP! ¡Apúrate!`)
    : mine === n ? (sheet.full() ? '¡Todo lleno! Grita ¡STOP!' : 'Una sola letra no vale: escribe la palabra.') : `${mine} de ${n} casillas. Nadie ve tu hoja.`;
}

function sounds(state, p) {
  const phase = state.phase, clock = Math.ceil(state.timeLeft);
  if (phase !== lastPhase) {
    if (phase === 'spin') sound.whoosh();
    if (phase === 'letter') { shout(`¡Salió la ${state.letter}!`, 'yellow', 1700); sound.pickup(1); }
    if (phase === 'write' && lastPhase === 'letter') shout('¡A escribir!', 'teal', 900);
    if (phase === 'basta') { shout('¡Basta! 3…', 'red', 950); sound.bonk(.9); if (p && state.stopper !== p.seat && sheet.filled() < state.categories.length) $('event').textContent = '¡Me agarró fuera de base!'; }
    if (phase === 'collect') { shout('¡Lápices abajo!', 'red', 1100); sheet.blur(); }
    if (phase === 'review') shout('¡A revisar!', 'yellow', 1000);
    if (phase !== 'basta' && phase !== 'write') $('event').textContent = '';
  } else if (phase === 'basta' && clock !== lastClock && clock > 0) { shout(`${clock}…`, 'red', 900); sound.tick(3 - clock); }
  else if (phase === 'write' && clock !== lastClock && clock <= 5 && clock > 0) sound.tick(5 - clock);
  const r = state.review, stage = r ? `${state.round}:${r.index}:${r.stage}` : '';
  if (phase === 'review' && stage !== lastStage && r.stage !== 'vote' && p) {
    const item = r.items.find(i => i.seat === p.seat);
    if (item?.creative) sound.pickup(3); else if (item?.points) sound.pickup(0); else if (item?.status === 'yellow') sound.bonk(.5);
  }
  if (state.hostLine !== lastLine && /Ni lo sueñes/.test(state.hostLine)) sound.boing();
  lastStage = stage; lastClock = clock; lastLine = state.hostLine;
}

// One title explains itself; several are listed by name.
const titleLine = (list) => list.length === 1 ? `${list[0]}: ${TITLE_TEXT[list[0]]}` : list.join(' · ');

function render(state) {
  const phase = state.phase, lobby = phase === 'lobby', ended = phase === 'finished', p = state.players[room.seat];
  roomOptions.update(state.options, lobby && room.isHost);
  if (!lobby && roomOptions.isOpen) roomOptions.close();
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('hud').hidden = lobby || ended;
  $('start').disabled = !world || !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? 'Conectando…' : room.isHost ? '¡Saca la libreta!' : 'Espera al anfitrión';
  fillRoster($('roster'), seated(state).map((o, i) => ({ rank: i + 1, name: o.id === room.id ? `${o.name} · tú` : o.name, detail: botDetail(o), me: o.id === room.id })));
  if (!lobby && !ended) {
    renderBoard(state, room.id);
    $('host-line').textContent = state.hostLine;
    $('wheel-panel').hidden = !['spin', 'letter'].includes(phase);
    $('sheet').hidden = !['write', 'basta', 'collect'].includes(phase);
    $('review').hidden = phase !== 'review';
    $('tally').hidden = phase !== 'tally';
    document.body.dataset.phase = phase;
    if (!$('wheel-panel').hidden) renderWheelPanel(state, room.seat, room.connected);
    if (!$('sheet').hidden) renderSheet(state, p);
    if (phase === 'review') review.render(state, room.seat);
    if (phase === 'tally') renderTally(state, room.id);
    sounds(state, p);
  }
  lastPhase = phase;
  $('results').hidden = !ended; $('again').disabled = !room.connected || !room.isHost;
  if (ended && state.winner !== null) {
    const winner = state.players[state.winner];
    $('result-title').textContent = `¡${winner.name} es el cuarto bate!`;
    fillRoster($('result-roster'), ranking(state).map((o, i) => ({ rank: i + 1, name: o.id === room.id ? `${o.name} · tú` : o.name,
      detail: titleLine(state.titles?.[o.seat] || []) || `${o.stats.stops} ¡STOP! · ${o.stats.creative} ${o.stats.creative === 1 ? "creativa" : "creativas"}`,
      end: o.total, score: true, me: o.id === room.id })));
  }
  world?.update(state, room.id);
}

addEventListener('keydown', (event) => {
  if (menu.isOpen || event.repeat || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (event.key.toLowerCase() === 'm') toggleMute();
  if (event.code === 'Space' && !event.target.closest?.('button, a') && room.state.phase === 'spin') { event.preventDefault(); para(); }
});

render(room.state); room.connect();
export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createStopScene($('world')),
  ready: (created) => { world = created; render(room.state); },
  tick: (dt) => { room.tick(dt, menu.isOpen && room.members.size <= 1); handIn(); },
  frame: (dt, scene) => scene.frame(dt),
  dispose: () => room.dispose(),
});
if (params.has('debug')) window.stopDebug = { room, menu, sheet, get world() { return world; } };
