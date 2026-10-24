// Wiring only: input → rules (through the room) → scene and HUD.
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl } from '/engine/invite.js';
import { sound } from '/engine/fx.js';
import { roomCode, bootGame } from '/engine/game-shell.js';
import { QqsmpRoom } from './network.js';
import { createRoomOptions } from '/engine/room-options.js';
import { ROOM_OPTIONS, defaultOptions } from './options.js';
import { createNarration } from './narration.js';
import { LADDER, TOP, SAFE, LETTERS, BETS, BET_LABELS, score, mangos, ranking, resolveAnswer, TITLE_TEXT } from './rules.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomCode();
const narration = createNarration($('read-question'));
let world = null, copying = false, lastDone = '', lastPhase = '', lastClock = 0;
// What you picked on this question. Snapshots hide everyone's answer until the
// reveal, your own included, so the screen remembers it here.
let picked = { key: '', choice: null, copy: null };
const room = new QqsmpRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render,
  onNotice: (text) => { $('event').textContent = text; },
  onStatus(text, failed = false) { $('connection').textContent = text; $('practice').hidden = !failed; render(room.state); },
});
const roomOptions = createRoomOptions($('room-options'), { title: '¿Quién quiere ser mi pana?', fields: ROOM_OPTIONS,
  change: options => room.action('options', { options }), reset: () => room.action('options', { options: defaultOptions() }) });
const menu = createGameMenu({ pad: { buttons: true }, title: '¿Quién quiere ser mi pana? · Pana', sound, orientation: 'libre',
  note: () => room.members.size > 1 ? 'El concurso sigue mientras estás en el menú.' : 'El concurso está en pausa. Los bots te esperan.',
  controls: [['1 – 4 o A – D', 'Marcar una respuesta'], ['Ratón / toque', 'Respuestas y comodines'], ['M', 'Activar o silenciar el sonido']],
  tips: [
    'Todos responden a la vez. Nadie ve lo que marcaste hasta la revelación: decir «puse la B» en la llamada puede ser verdad o un farol.',
    'Responder rápido da mangos extra. Esperar a ver qué dicen los demás te cuesta.',
    'Acierta y subes un escalón. Falla y bajas al último escalón seguro (4 y 8).',
    'Comodines, uno de cada uno: Copiarse (marca lo mismo que otro pana sin ver qué puso), Mitad y mitad, Doble o nada y Plantarse.',
    'En la final cada quien apuesta en secreto parte de sus mangos. El total más alto se lleva el Mango de oro.',
  ],
  invite: () => room.offline ? null : inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('rules').onclick = () => menu.open('controls');
$('start').onclick = $('again').onclick = () => { sound.unlock(); room.action('start'); };
$('practice').onclick = () => room.practice();
const answerButtons = [...document.querySelectorAll('#answers .answer')];
answerButtons.forEach(button => { button.onclick = () => answer(Number(button.dataset.choice)); });
document.querySelectorAll('[data-comodin]').forEach(button => { button.onclick = () => comodin(button.dataset.comodin); });
const betButtons = BETS.map((_, i) => {
  const button = document.createElement('button'); button.className = 'answer'; button.dataset.bet = i;
  button.append(document.createElement('b'), document.createElement('span'));
  button.onclick = () => bet(i); $('bets').append(button); return button;
});

const me = () => room.state.players[room.seat];
const questionKey = (s = room.state) => `${s.round}:${s.index}:${s.final}`;
const mine = () => picked.key === questionKey() ? picked : { choice: null, copy: null };
const canAnswer = () => room.connected && room.state.phase === 'question' && room.state.timeLeft > 0 && me() && !menu.isOpen;

$('cancel-answer').onclick = () => {
  if (!canAnswer() || !me().locked) return;
  if (room.action('cancel', { q: room.state.index })) picked = { key: questionKey(), choice: null, copy: null };
  copying = false; render(room.state);
};
function answer(choice) {
  if (!canAnswer() || me().half?.includes(choice)) return;
  sound.unlock(); copying = false;
  if (room.action('answer', { choice, q: room.state.index })) picked = { key: questionKey(), choice, copy: null };
  sound.clickDown(); render(room.state);
}
function comodin(kind) {
  if (!canAnswer() || me().locked || me().used[kind]) return;
  sound.unlock();
  if (kind === 'copy') { copying = !copying; return render(room.state); }
  room.action(kind, { q: room.state.index });
}
function copyFrom(target) {
  if (!canAnswer() || me().locked) return;
  if (room.action('copy', { target, q: room.state.index })) picked = { key: questionKey(), choice: null, copy: target };
  copying = false; render(room.state);
}
function bet(choice) {
  if (!room.connected || room.state.phase !== 'bet' || !me() || me().betLocked) return;
  sound.unlock(); if (room.action('bet', { choice })) picked = { key: `bet:${room.state.round}`, choice, copy: null };
}

function renderLadder(p) {
  const steps = LADDER.slice(1).map((value, i) => {
    const step = i + 1, li = document.createElement('li');
    li.className = [SAFE.includes(step) && 'safe', p?.step === step && 'here', step === TOP && 'top'].filter(Boolean).join(' ');
    li.append(Object.assign(document.createElement('span'), { textContent: step }), Object.assign(document.createElement('span'), { textContent: step === TOP ? 'Mango de oro' : mangos(value) }));
    return li;
  });
  $('ladder-steps').replaceChildren(...steps);
}

function renderQuestion(state, p) {
  const q = state.question, phase = state.phase, own = mine(), reveal = phase === 'reveal' ? state.reveal : null;
  const betting = phase === 'bet', settled = reveal?.done;
  $('category').textContent = betting ? 'Pregunta final · la apuesta' : state.final ? `Pregunta final · ${q.category}` : `${q.category} · ${state.index + 1} de ${state.total}`;
  $('question').textContent = betting ? `¿Cuántos de tus ${mangos(score(p || { step: 0, bonus: 0, finalDelta: 0 }))} mangos te juegas?` : q.text;
  $('clock').textContent = ['question', 'bet'].includes(phase) ? Math.ceil(state.timeLeft) : '';
  $('clock').classList.toggle('hurry', phase === 'question' && state.timeLeft <= 4);
  const limit = betting ? 14 : state.options.seconds;
  $('timer').style.setProperty('--pk-value', ['question', 'bet'].includes(phase) ? String(state.timeLeft / limit) : '0');
  $('answers').hidden = betting; $('bets').hidden = !betting;
  // Answers travel in snapshots from the reveal on; before that only your own memory has yours.
  const mineResolved = reveal && p ? resolveAnswer(state.players, p.seat) : own.choice;
  answerButtons.forEach((button, i) => {
    button.querySelector('span').textContent = q.answers[i];
    button.classList.toggle('gone', !!p?.half?.includes(i) && !settled);
    button.classList.toggle('picked', mineResolved === i);
    button.classList.toggle('right', !!settled && i === q.correct);
    button.classList.toggle('wrong', !!settled && mineResolved === i && i !== q.correct);
    button.disabled = !canAnswer();
  });
  $('cancel-answer').hidden = phase !== 'question' || !p?.locked;
  $('cancel-answer').disabled = !canAnswer();
  betButtons.forEach((button, i) => {
    const stake = Math.round(score(p || { step: 0, bonus: 0, finalDelta: 0 }) * BETS[i]);
    button.firstChild.textContent = BET_LABELS[i]; button.lastChild.textContent = `${mangos(stake)} mangos`;
    button.disabled = !p || p.betLocked; button.classList.toggle('picked', picked.key === `bet:${state.round}` && picked.choice === i);
  });
  // Comodines: one use each; the copy list names every other podium.
  document.querySelectorAll('[data-comodin]').forEach(button => {
    const kind = button.dataset.comodin, used = !p || p.used[kind];
    button.hidden = state.final && ['doble', 'plant'].includes(kind) || betting;
    button.disabled = used || !canAnswer() || p.locked || (kind === 'plant' && p.doble) || (kind === 'doble' && p.planted);
    button.classList.toggle('on', kind === 'copy' ? copying : kind === 'doble' ? !!p?.doble : kind === 'plant' ? !!p?.planted : kind === 'half' && !!p?.half);
  });
  $('copy-list').hidden = !copying || !canAnswer();
  if (copying) $('copy-list').replaceChildren(...state.players.filter(o => o.seat !== room.seat).map(o => {
    const button = Object.assign(document.createElement('button'), { className: 'pk-btn pk-btn--sm', textContent: `Lo mismo que ${o.name}` });
    button.onclick = () => copyFrom(o.seat); return button;
  }));
  let line = state.hostLine;
  if (p && phase === 'question' && p.locked) line = own.copy !== null ? `Te copiaste de ${state.players[own.copy].name}. ¡Ojalá no sea embuste!` : own.choice !== null ? `Marcaste la ${LETTERS[own.choice]}. Nadie más lo sabe… todavía.` : 'Respuesta marcada.';
  if (p?.locked && phase === 'question') line += ' Puedes cambiarla o cancelarla mientras quede tiempo.';
  $('host-line').textContent = line;
  if (settled && p?.outcome) {
    const o = p.outcome;
    $('event').textContent = state.final ? `${o.right ? '¡Le pegaste!' : 'Fallaste.'} ${o.delta >= 0 ? '+' : ''}${mangos(o.delta)} mangos.`
      : p.planted ? `Estás plantado con ${mangos(score(p))} mangos.`
      : o.right ? `¡Subiste al escalón ${o.to}!${o.bonus ? ` +${o.bonus} mangos por rapidez.` : ''}` : o.to < o.from ? `Bajaste al escalón ${o.to}.` : 'Fallaste, pero no bajas.';
  } else if (betting) $('event').textContent = p?.betLocked ? 'Apuesta trancada. Nadie sabe cuánto te jugaste.' : 'Apuesta en secreto: si aciertas la final la sumas, si fallas la pierdes.';
  else if (phase === 'question') $('event').textContent = p?.doble ? 'Doble o nada: esta vale dos escalones.' : p?.half ? 'Mitad y mitad: solo tú ves las dos que quedan.' : '';
}

function render(state) {
  narration.update(state, menu.isOpen && room.members.size <= 1);
  const lobby = state.phase === 'lobby', ended = state.phase === 'finished', p = state.players[room.seat];
  roomOptions.update(state.options, lobby && room.isHost);
  if (!lobby && roomOptions.isOpen) roomOptions.close();
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('hud').hidden = lobby || ended;
  $('start').disabled = !world || !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? 'Conectando…' : room.isHost ? '¡Que empiece el show!' : 'Espera al anfitrión';
  fillRoster($('roster'), state.players.map((o, i) => ({ rank: i + 1, name: o.id === room.id ? `${o.name} · tú` : o.name, detail: o.id === null ? 'Bot' : 'Pana', me: o.id === room.id })));
  if (!lobby && state.question) { renderQuestion(state, p); renderLadder(p); }
  if (state.phase !== 'question') copying = false;
  // The host's call-outs pop over the podiums once the answer lights up.
  const done = state.phase === 'reveal' && state.reveal?.done ? `${state.round}:${state.index}:${state.final}` : '';
  if (done && done !== lastDone && world) state.callouts.forEach((c, i) => setTimeout(() => world?.say(c.seat, c.text, 3), 500 + i * 700));
  if (done && done !== lastDone && p?.outcome) p.outcome.right ? sound.pickup(2) : sound.bonk(.6);
  lastDone = done || lastDone;
  // The studio's sounds: the clock in its last seconds and the dramatic pause.
  const clock = Math.ceil(state.timeLeft);
  if (state.phase === 'question' && clock !== lastClock && clock <= 4 && clock > 0) sound.tick(4 - clock);
  if (state.phase === 'pause' && lastPhase !== 'pause') sound.whoosh();
  lastClock = clock; lastPhase = state.phase;
  $('results').hidden = !ended; $('again').disabled = !room.connected || !room.isHost;
  if (ended) {
    const winner = state.players[state.winner];
    $('result-title').textContent = state.gold !== null ? `¡${winner.name} se lleva el Mango de oro!` : `¡${winner.name} es el cuarto bate!`;
    fillRoster($('result-roster'), ranking(state).map((o, i) => ({ rank: i + 1, name: o.id === room.id ? `${o.name} · tú` : o.name,
      detail: (state.titles?.[o.seat] || []).map(t => `${t}: ${TITLE_TEXT[t]}`).join(' · ') || `${o.stats.right} buenas, ${o.stats.wrong} malas`,
      end: mangos(score(o)), score: true, me: o.id === room.id })));
  }
  world?.update(state);
}

addEventListener('keydown', (event) => {
  if (menu.isOpen || event.repeat || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (key === 'm') toggleMute();
  const index = ['1', '2', '3', '4'].indexOf(key) >= 0 ? ['1', '2', '3', '4'].indexOf(key) : ['a', 'b', 'c', 'd'].indexOf(key);
  if (index >= 0) { if (room.state.phase === 'bet') bet(index); else answer(index); }
});

render(room.state); room.connect();
export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createQqsmpScene($('world')),
  ready: (created) => { world = created; render(room.state); },
  tick: (dt) => room.tick(dt, menu.isOpen && room.members.size <= 1),
  frame: (dt, scene) => { narration.update(room.state, menu.isOpen && room.members.size <= 1); scene.frame(dt); },
  dispose: () => { narration.dispose(); room.dispose(); },
});
if (params.has('debug')) window.qqsmpDebug = { room, menu, get world() { return world; } };
