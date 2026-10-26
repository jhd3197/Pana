// The table's HUD around the 3D scene: the board (round, letter, clock and
// every pana's progress or points), the wheel panel, the round tally and the
// big shouts (¡STOP!, ¡Basta!). Text only, never HTML from names.
import { fillRoster } from '/engine/results.js';
import { PERSONALITY, PERSONALITY_TEXT, ranking, seated } from './rules.js';
import { SEAT_COLORS } from './seats.js';
import { loc } from '/engine/i18n.js';

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
export const clockText = (seconds) => { const s = Math.max(0, Math.ceil(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const botDetail = (p) => p.id === null ? [loc('Bot'), loc(PERSONALITY_TEXT[PERSONALITY[p.seat]])].filter(Boolean).join(' · ') : loc('Pana');

export function renderBoard(state, meId) {
  const writing = ['write', 'basta', 'collect'].includes(state.phase), n = state.categories.length;
  $('round-label').textContent = loc('Ronda {round} de {rounds}', { round: state.round, rounds: state.rounds });
  $('board-letter').textContent = state.letter && state.phase !== 'spin' ? state.letter : '?';
  const timed = ['write', 'basta'].includes(state.phase);
  $('clock').textContent = timed ? clockText(state.timeLeft) : '';
  $('clock').classList.toggle('hurry', timed && state.timeLeft <= 10);
  const rows = seated(state).map(p => {
    const li = el('li', p.id !== null && p.id === meId ? 'is-me' : '');
    li.style.setProperty('--seat', SEAT_COLORS[p.seat]);
    const name = el('span', 'board-name', p.name); name.translate = false;
    li.append(el('i', 'seat-dot'), name);
    if (writing) {
      const pips = el('span', 'pips'); pips.setAttribute('aria-label', loc('{n} de {total}', { n: p.filled, total: n }));
      for (let i = 0; i < n; i++) pips.append(el('i', i < p.filled ? 'on' : ''));
      li.append(pips);
      if (p.seat === state.stopper) li.append(el('b', 'board-stop', 'STOP'));
    } else li.append(el('b', 'board-points', String(p.total)));
    return li;
  });
  $('board-rows').replaceChildren(...rows);
}

export function renderWheelPanel(state, mySeat, connected) {
  const spinner = state.players[state.spinner], mine = state.spinner === mySeat;
  const spinning = state.phase === 'spin';
  $('wheel-line').textContent = spinning ? (mine ? loc('¡Te toca! Grítale a la rueda') : loc('{name} está girando la rueda…', { name: spinner.name })) : loc('¡Salió la {letter}!', { letter: state.letter });
  $('para').hidden = !(spinning && mine);
  $('para').disabled = !connected;
}

export function renderTally(state, meId) {
  const best = seated(state).sort((a, b) => b.round - a.round || a.seat - b.seat)[0];
  $('tally-step').textContent = loc('Ronda {round} de {rounds} · letra {letter}', { round: state.round, rounds: state.rounds, letter: state.letter });
  $('tally-title').textContent = state.round >= state.rounds ? loc('¡Última ronda!') : loc('{name} la sacó de jonrón', { name: best.name });
  fillRoster($('tally-roster'), ranking(state).map((p, i) => ({ rank: i + 1, name: p.id !== null && p.id === meId ? loc('{name} · tú', { name: p.name }) : p.name,
    detail: loc('+{points} esta ronda', { points: p.round }), end: p.total, score: true, me: p.id !== null && p.id === meId })));
}

// The big shout in the middle: one at a time, it pops and fades.
let shoutTimer = 0;
export function shout(text, tone = 'red', ms = 1300) {
  const node = $('shout'); node.textContent = text; node.dataset.tone = tone; node.hidden = false;
  node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop');
  clearTimeout(shoutTimer); shoutTimer = setTimeout(() => { node.hidden = true; }, ms);
}
