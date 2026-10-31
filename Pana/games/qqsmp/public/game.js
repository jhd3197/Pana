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
import { createQuizSounds } from './sounds.js';
import { onSettings } from '/engine/settings.js';
import { LADDER, TOP, SAFE, LETTERS, BETS, BET_LABELS, participants, score, mangos, ranking, resolveAnswer, TITLE_TEXT, lineText } from './rules.js';
import { loc } from '/engine/i18n.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomCode();
const showSounds = createQuizSounds(sound, { audible: () => !document.hidden });
const animationSounds = createQuizSounds(sound, { audible: () => !document.hidden });
const narration = createNarration($('read-question'), { onSpeaking: value => { showSounds.speaking(value); animationSounds.speaking(value); } });
const stopSounds = () => { showSounds.stop(); animationSounds.stop(); };
const unsubscribeSound = onSettings(settings => { if (!settings.sound || settings.volume === 0) stopSounds(); });
const hideSounds = () => { if (document.hidden) stopSounds(); };
document.addEventListener('visibilitychange', hideSounds);
let world = null, copying = false, lastDone = '';
// What you picked on this question. Snapshots hide everyone's answer until the
// reveal, your own included, so the screen remembers it here.
let picked = { key: '', choice: null, copy: null };
const room = new QqsmpRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render,
  onNotice: (text) => { $('event').textContent = text; },
  onStatus(text, failed = false) { $('connection').textContent = text; $('practice').hidden = !failed; render(room.state); },
});
const roomOptions = createRoomOptions($('room-options'), { title: '¿Quién quiere ser mi pana?', fields: ROOM_OPTIONS, // i18n-ignore: game name
  change: options => room.action('options', { options }), reset: () => room.action('options', { options: defaultOptions() }) });
const menu = createGameMenu({ pad: { buttons: true }, title: '¿Quién quiere ser mi pana? · Pana', sound, orientation: 'libre', // i18n-ignore: game name
  note: () => room.members.size > 1 ? loc('El concurso sigue mientras estás en el menú.') : loc('El concurso está en pausa. Los bots te esperan.'),
  controls: [[loc('1 – 4 o A – D'), loc('Marcar una respuesta')], [loc('Ratón / toque'), loc('Respuestas y comodines')], ['M', loc('Activar o silenciar el sonido')]],
  tips: [
    loc('Todos responden a la vez. Nadie ve lo que marcaste hasta la revelación: decir «puse la B» en la llamada puede ser verdad o un farol.'),
    loc('Responder rápido da mangos extra. Esperar a ver qué dicen los demás te cuesta.'),
    loc('Acierta y subes un escalón. Falla y bajas al último escalón seguro (4 y 8).'),
    loc('Comodines, uno de cada uno: Copiarse (marca lo mismo que otro pana sin ver qué puso), Mitad y mitad, Doble o nada y Plantarse.'),
    loc('En la final cada quien apuesta en secreto parte de sus mangos. El total más alto se lleva el Mango de oro.'),
  ],
  invite: () => room.offline ? null : inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
// These hold player names next to text already passed through loc().
for (const id of ['result-roster', 'result-title', 'host-line']) $(id).translate = false;
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
  if (room.state.phase === 'question') showSounds.play('lock');
  render(room.state);
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
    li.append(Object.assign(document.createElement('span'), { textContent: step }), Object.assign(document.createElement('span'), { textContent: step === TOP ? loc('Mango de oro') : mangos(value) }));
    return li;
  });
  $('ladder-steps').replaceChildren(...steps);
}

function renderQuestion(state, p) {
  const q = state.question, phase = state.phase, own = mine(), reveal = phase === 'reveal' ? state.reveal : null;
  const betting = phase === 'bet', settled = reveal?.done;
  $('category').textContent = betting ? loc('Pregunta final · la apuesta') : state.final ? loc('Pregunta final · {category}', { category: loc(q.category) }) : loc('{category} · {n} de {total}', { category: loc(q.category), n: state.index + 1, total: state.total });
  $('question').textContent = betting ? loc('¿Cuántos de tus {mangos} mangos te juegas?', { mangos: mangos(score(p || { step: 0, bonus: 0, finalDelta: 0 })) }) : q.text;
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
    button.firstChild.textContent = loc(BET_LABELS[i]); button.lastChild.textContent = loc('{mangos} mangos', { mangos: mangos(stake) });
    button.disabled = !p || p.betLocked; button.classList.toggle('picked', picked.key === `bet:${state.round}` && picked.choice === i);
  });
  // Comodines: one use each; the copy list names every other podium.
  document.querySelectorAll('[data-comodin]').forEach(button => {
    const kind = button.dataset.comodin, used = !p || p.used[kind];
    button.hidden = state.final && ['doble', 'plant'].includes(kind) || betting;
    button.disabled = used || !canAnswer() || p.locked || (kind === 'copy' && participants(state).length < 2) || (kind === 'plant' && p.doble) || (kind === 'doble' && p.planted);
    button.classList.toggle('on', kind === 'copy' ? copying : kind === 'doble' ? !!p?.doble : kind === 'plant' ? !!p?.planted : kind === 'half' && !!p?.half);
  });
  $('copy-list').hidden = !copying || !canAnswer();
  if (copying) $('copy-list').replaceChildren(...participants(state).filter(o => o.seat !== room.seat).map(o => {
    const button = Object.assign(document.createElement('button'), { className: 'pk-btn pk-btn--sm', textContent: loc('Lo mismo que {name}', { name: o.name }) });
    button.onclick = () => copyFrom(o.seat); return button;
  }));
  let line = lineText(state.hostLine);
  if (p && phase === 'question' && p.locked) line = own.copy !== null ? loc('Te copiaste de {name}. ¡Ojalá no sea embuste! Puedes cambiarla o cancelarla mientras falte alguien por responder.', { name: state.players[own.copy].name })
    : own.choice !== null ? loc('Marcaste la {letter}. Nadie más lo sabe… todavía. Puedes cambiarla o cancelarla mientras falte alguien por responder.', { letter: LETTERS[own.choice] })
    : loc('Respuesta marcada. Puedes cambiarla o cancelarla mientras falte alguien por responder.');
  $('host-line').textContent = line;
  if (settled && p?.outcome) {
    const o = p.outcome;
    $('event').textContent = state.final ? (o.right ? loc('¡Le pegaste! {delta} mangos.', { delta: `${o.delta >= 0 ? '+' : ''}${mangos(o.delta)}` }) : loc('Fallaste. {delta} mangos.', { delta: `${o.delta >= 0 ? '+' : ''}${mangos(o.delta)}` }))
      : p.planted ? loc('Estás plantado con {mangos} mangos.', { mangos: mangos(score(p)) })
      : o.right ? (o.bonus ? loc('¡Subiste al escalón {step}! +{bonus} mangos por rapidez.', { step: o.to, bonus: o.bonus }) : loc('¡Subiste al escalón {step}!', { step: o.to }))
      : o.to < o.from ? loc('Bajaste al escalón {step}.', { step: o.to }) : loc('Fallaste, pero no bajas.');
  } else if (betting) $('event').textContent = p?.betLocked ? loc('Apuesta trancada. Nadie sabe cuánto te jugaste.') : loc('Apuesta en secreto: si aciertas la final la sumas, si fallas la pierdes.');
  else if (phase === 'question') $('event').textContent = p?.doble ? loc('Doble o nada: esta vale dos escalones.') : p?.half ? loc('Mitad y mitad: solo tú ves las dos que quedan.') : '';
}

function render(state) {
  showSounds.update(state, room.seat, menu.isOpen && room.members.size <= 1);
  narration.update(state, menu.isOpen && room.members.size <= 1);
  const lobby = state.phase === 'lobby', ended = state.phase === 'finished', p = state.players[room.seat];
  roomOptions.update(state.options, lobby && room.isHost);
  if (!lobby && roomOptions.isOpen) roomOptions.close();
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('hud').hidden = lobby || ended;
  $('start').disabled = !world || !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? loc('Conectando…') : room.isHost ? loc('¡Que empiece el show!') : loc('Espera al anfitrión');
  fillRoster($('roster'), participants(state).map((o, i) => ({ rank: i + 1, name: o.id === room.id ? loc('{name} · tú', { name: o.name }) : o.name, detail: o.id === null ? loc('Bot') : loc('Pana'), me: o.id === room.id })));
  if (!lobby && state.question) { renderQuestion(state, p); renderLadder(p); }
  if (state.phase !== 'question') copying = false;
  // The host's call-outs pop over the podiums once the answer lights up.
  const done = state.phase === 'reveal' && state.reveal?.done ? `${state.round}:${state.index}:${state.final}` : '';
  if (done && done !== lastDone && world) state.callouts.forEach((c, i) => setTimeout(() => world?.say(c.seat, lineText(c), 3), 500 + i * 700));
  lastDone = done || lastDone;
  $('results').hidden = !ended; $('again').disabled = !room.connected || !room.isHost;
  if (ended) {
    const winner = state.players[state.winner];
    $('result-title').textContent = state.gold !== null ? loc('¡{name} se lleva el Mango de oro!', { name: winner.name }) : loc('¡{name} es el cuarto bate!', { name: winner.name });
    fillRoster($('result-roster'), ranking(state).map((o, i) => ({ rank: i + 1, name: o.id === room.id ? loc('{name} · tú', { name: o.name }) : o.name,
      detail: (state.titles?.[o.seat] || []).map(t => loc('{title}: {meaning}', { title: loc(t), meaning: loc(TITLE_TEXT[t]) })).join(' · ') || loc('{right} buenas, {wrong} malas', { right: o.stats.right, wrong: o.stats.wrong }),
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
  load: async () => (await import('./scene.js')).createQqsmpScene($('world'), { onAnimationCue: cue => {
    if (['pop', 'boing', 'bonk', 'land', 'poof', 'ring', 'hangup', 'fall'].includes(cue)) animationSounds.play(cue);
  } }),
  ready: (created) => { world = created; render(room.state); },
  tick: (dt) => room.tick(dt, menu.isOpen && room.members.size <= 1),
  frame: (dt, scene) => { const paused = menu.isOpen && room.members.size <= 1; if (paused) animationSounds.stop(); showSounds.update(room.state, room.seat, paused); narration.update(room.state, paused); scene.frame(dt, paused); },
  dispose: () => { narration.dispose(); showSounds.dispose(); animationSounds.dispose(); unsubscribeSound(); document.removeEventListener('visibilitychange', hideSounds); room.dispose(); },
});
if (params.has('debug')) window.qqsmpDebug = { room, menu, get world() { return world; } };
