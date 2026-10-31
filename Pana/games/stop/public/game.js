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
import { ranking, seated, rememberWords, TITLE_TEXT, lineText } from './rules.js';
import { createSheet } from './sheet.js';
import { createReview } from './review.js';
import { createPackPicker, createCategoriesDialog, renderRecap, summaryText } from './libreta.js';
import { renderBoard, renderWheelPanel, renderTally, shout, botDetail, clockText } from './hud.js';
import { loc, locn } from '/engine/i18n.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomCode();
let world = null, lastPhase = '', lastClock = 0, lastSent = 0, lastStage = '', lastLine = '', failed = false, lastSala = '';
const room = new StopRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render,
  onNotice: (text) => { $('event').textContent = text; },
  onStatus(text, down = false) { failed = down; $('connection').textContent = text; $('practice').hidden = !down; render(room.state); },
});
// The pack has its own picker, so the shared panel leaves it out.
const roomOptions = createRoomOptions($('room-options'), { title: '¡Stop!', fields: ROOM_OPTIONS.filter(f => f.id !== 'set'), // i18n-ignore: game name
  change: options => room.action('options', { options }), reset: () => { room.action('options', { options: defaultOptions() }); room.action('custom', { list: [] }); } });
const packs = createPackPicker($('pack-pick'), { change: set => room.action('options', { options: { set } }) });
const categories = createCategoriesDialog($('libreta'), { save: list => room.action('custom', { list }) });
const connection = () => room.offline ? 'local' : room.connected ? 'online' : failed ? 'offline' : 'connecting';
// The shared sala (engine/sala.js): summary, connection and the Categorías button.
$('lobby').panaSala = { kitLabel: loc('Categorías'), openKit: () => categories.open(), image: null, startLabel: loc('¡Saca la libreta!'),
  read: () => ({ connection: connection(), players: [], local: null, summary: summaryText(room.state) }) };
const menu = createGameMenu({ pad: { buttons: true, keys: { x: ['Space', loc('¡Para! la rueda')] } }, title: '¡Stop! · Pana', sound, orientation: 'libre', // i18n-ignore: game name
  note: () => room.members.size > 1 ? loc('La ronda sigue mientras estás en el menú.') : loc('La partida está en pausa. Los bots te esperan.'),
  controls: [['Tab / Enter', loc('Pasar a la siguiente casilla')], [loc('Espacio'), loc('¡Para! cuando te toca la rueda')], [loc('Ratón / toque'), loc('¡STOP! y los votos')], ['M', loc('Activar o silenciar el sonido')]],
  tips: [
    loc('Sale una letra y escribes una palabra por categoría que empiece con ella. Nadie ve tu hoja hasta la revisión.'),
    loc('El primero que llena todo grita ¡STOP! y los demás tienen 5 segundos. Si nadie termina, se acaba el tiempo.'),
    loc('Lo que el juego conoce cuenta solo (verde). Lo que no empieza con la letra, no (rojo). Lo dudoso se vota: «¿Eso cuenta?».'),
    loc('100 puntos si nadie más la puso, 50 si alguien la repitió. Una dudosa que la mesa acepta con dos tercios suma +50 de Creatividad.'),
    loc('Lo que la mesa acepta se queda: en la próxima partida cuenta solo.'),
    loc('Con «Más criollo» las groserías van a votación; sin eso, la libreta las tacha sola.'),
    loc("En «Pa' reírse», «Confiesa» e «Inventa» no hay respuesta correcta: la mesa vota todo y gana el más ocurrido."),
    loc('El anfitrión puede poner hasta tres categorías propias en «Categorías». Siempre se votan.'),
  ],
  invite: () => room.offline ? null : inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
// These hold player names next to text already passed through loc().
for (const id of ['result-roster', 'result-title', 'host-line', 'tally-title']) $(id).translate = false;
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
  $('sheet-meta').textContent = loc('Ronda {round} de {rounds}', { round: state.round, rounds: state.rounds });
  const timed = phase === 'write' || phase === 'basta';
  $('sheet-clock').textContent = timed ? (phase === 'basta' ? `${Math.ceil(state.timeLeft)}…` : clockText(state.timeLeft)) : '';
  $('sheet-clock').classList.toggle('hurry', phase === 'basta' || (timed && state.timeLeft <= 10));
  const n = state.categories.length, mine = sheet.filled();
  $('sheet-note').textContent = !p ? loc('Estás mirando: la mesa está llena.')
    : phase === 'collect' ? loc('Lápices abajo. Entregando las hojas…')
    : phase === 'basta' ? (stopped ? loc('¡Gritaste STOP! Los demás tienen 5 segundos.') : loc('¡{name} gritó STOP! ¡Apúrate!', { name: state.players[state.stopper].name }))
    : mine === n ? (sheet.full() ? loc('¡Todo lleno! Grita ¡STOP!') : loc('Una sola letra no vale: escribe la palabra.')) : loc('{mine} de {n} casillas. Nadie ve tu hoja.', { mine, n });
}

function sounds(state, p) {
  const phase = state.phase, clock = Math.ceil(state.timeLeft);
  if (phase !== lastPhase) {
    if (phase === 'spin') sound.whoosh();
    if (phase === 'letter') { shout(loc('¡Salió la {letter}!', { letter: state.letter }), 'yellow', 1700); sound.pickup(1); }
    if (phase === 'write' && lastPhase === 'letter') shout(loc('¡A escribir!'), 'teal', 900);
    if (phase === 'basta') { shout(loc('¡Basta!'), 'red', 950); sound.bonk(.9); if (p && state.stopper !== p.seat && sheet.filled() < state.categories.length) $('event').textContent = loc('¡Me agarró fuera de base!'); }
    if (phase === 'collect') { shout(loc('¡Lápices abajo!'), 'red', 1100); sheet.blur(); }
    if (phase === 'review') shout(loc('¡A revisar!'), 'yellow', 1000);
    if (phase !== 'basta' && phase !== 'write') $('event').textContent = '';
  } else if (phase === 'basta' && clock !== lastClock && clock > 0) { shout(`${clock}…`, 'red', 900); sound.tick(5 - clock); }
  else if (phase === 'write' && clock !== lastClock && clock <= 5 && clock > 0) sound.tick(5 - clock);
  const r = state.review, stage = r ? `${state.round}:${r.index}:${r.stage}` : '';
  if (phase === 'review' && stage !== lastStage && r.stage !== 'vote' && p) {
    const item = r.items.find(i => i.seat === p.seat);
    if (item?.creative) sound.pickup(3); else if (item?.points) sound.pickup(0); else if (item?.status === 'yellow') sound.bonk(.5);
  }
  const said = lineText(state.hostLine);
  if (said !== lastLine && /Ni lo sueñes/.test(state.hostLine?.text)) sound.boing();
  lastStage = stage; lastClock = clock; lastLine = said;
}

// Words the table voted in outlive the room: every pana's browser keeps them,
// and whoever hosts brings theirs to the next table.
const MESA_KEY = 'pana.stop.mesa';
let mesaSeeded = false, mesaSaved = -1;
function keepMesa(state) {
  try {
    const saved = () => JSON.parse(localStorage.getItem(MESA_KEY) || '[]');
    if (room.isHost && room.game && !mesaSeeded) { mesaSeeded = true; room.game.dictionary = rememberWords(room.game.dictionary, saved()); queueMicrotask(() => room.publish()); }
    const n = state.dictionary?.length || 0;
    if (n && n !== mesaSaved) { mesaSaved = n; localStorage.setItem(MESA_KEY, JSON.stringify(rememberWords(saved(), state.dictionary))); }
  } catch { /* storage may be blocked: the words last this room only */ }
}

// One title explains itself; several are listed by name.
const titleLine = (list) => list.length === 1 ? loc('{title}: {meaning}', { title: loc(list[0]), meaning: loc(TITLE_TEXT[list[0]]) }) : list.map(t => loc(t)).join(' · ');

function render(state) {
  const phase = state.phase, lobby = phase === 'lobby', ended = phase === 'finished', p = state.players[room.seat];
  keepMesa(state);
  roomOptions.update(state.options, lobby && room.isHost);
  packs.update(state.options, lobby && room.isHost);
  categories.update(state, lobby && room.isHost);
  if (!lobby && roomOptions.isOpen) roomOptions.close();
  if (!lobby && categories.isOpen) $('libreta').close();
  const sala = connection() + summaryText(state);
  if (sala !== lastSala) { lastSala = sala; document.dispatchEvent(new Event('pana:sala-update')); }
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('hud').hidden = lobby || ended;
  $('start').disabled = !world || !room.connected || !room.isHost;
  // Local and offline labels belong to the sala ("… en local").
  if (!room.offline && !failed) $('start').textContent = !room.connected ? loc('Conectando…') : room.isHost ? loc('¡Saca la libreta!') : loc('Espera al anfitrión');
  fillRoster($('roster'), seated(state).map((o, i) => ({ rank: i + 1, name: o.id === room.id ? loc('{name} · tú', { name: o.name }) : o.name, detail: botDetail(o), me: o.id === room.id })));
  if (!lobby && !ended) {
    renderBoard(state, room.id);
    $('host-line').textContent = lineText(state.hostLine);
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
    $('result-title').textContent = loc('¡{name} es el cuarto bate!', { name: winner.name });
    fillRoster($('result-roster'), ranking(state).map((o, i) => ({ rank: i + 1, name: o.id === room.id ? loc('{name} · tú', { name: o.name }) : o.name,
      detail: titleLine(state.titles?.[o.seat] || []) || locn(o.stats.creative, '{stops} ¡STOP! · {n} creativa', '{stops} ¡STOP! · {n} creativas', { stops: o.stats.stops }),
      end: o.total, score: true, me: o.id === room.id })));
    renderRecap($('recap'), state);
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
