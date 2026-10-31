// i18n-ignore-file: table barks and canto shouts are Venezuelan banter and stay Spanish.
// What the panas at the table shout. Pure: turns new history events into
// speech bubbles. Lines are seeded by the event, so every client shows the
// same bark without sending it over the network.
import { pickLine } from '../../../engine/play/frases.js';
import { teamOf } from './rules.js';

const CANTOS = ['Ronda', 'Rondín', 'Patrulla', 'Patria', 'Vigía', 'Registro'];
const DEAL = ['¡Vacílate esto!', '¡A repartir, pues!', '¡Vamos a ver!'];
const FALL = ['¡Caída!', '¡CAÍDA!', '¡Caída, mi pana!', '¡Te caí!'];
const CLEAN = ['¡Mesa limpia!', '¡Limpiecita!', '¡Barrí la mesa!'];

const time = text => Math.min(3.2, 1.4 + text.length * .04);

export function barksFor(state, events) {
  const out = [], n = state.players.length;
  const say = (seat, pool, seed) => {
    const text = pickLine(pool, `${state.round}:${seed}`);
    if (text && state.players[seat]) out.push({ seat, text, time: time(text) });
  };
  for (const e of events) {
    const key = `${e.id}:${e.card?.id || ''}`;
    if (e.kind === 'dealer') say(e.seat, DEAL, key);
    else if (e.kind === 'opening') say(e.seat, e.text.includes('mal echada') ? 'queja' : 'presume', key);
    else if (e.kind === 'leftovers') say(e.seat, 'ñapa', key);
    else if (e.kind === 'score' && CANTOS.includes(e.reason)) say(e.seat, [`¡${e.reason}!`], key);
    else if (e.kind === 'play' && e.fall) {
      say(e.seat, e.clean ? ['¡Caída y mesa limpia!'] : FALL, key);
      if (Number.isInteger(e.victim) && e.victim !== e.seat) {
        const falls = state.history.filter(h => h.kind === 'play' && h.fall && h.victim === e.victim).length;
        say(e.victim, falls >= 2 ? 'salado' : 'sorpresa', `${key}:victim`);
      }
    } else if (e.kind === 'play' && e.clean) {
      say(e.seat, CLEAN, key);
      if (n > 1) say((e.seat + 1) % n, 'aplauso', `${key}:next`);
    }
  }
  if (state.phase === 'finished' && events.length && state.result) {
    // The pana whose points crossed 24 closes the table; a rival takes it badly.
    const last = events.findLast(e => e.kind === 'score'), key = `end:${events.at(-1).id}`;
    const winner = last && teamOf(state, last.seat) === state.result.winner ? last.seat : state.players.find(p => teamOf(state, p.seat) === state.result.winner)?.seat;
    const loser = state.players.find(p => teamOf(state, p.seat) !== state.result.winner)?.seat;
    if (winner !== undefined) say(winner, 'cierre', key);
    if (loser !== undefined) say(loser, 'derrota', key);
  }
  // A seat that speaks twice in one batch keeps only its latest line.
  return out.filter((b, i) => !out.slice(i + 1).some(later => later.seat === b.seat));
}

