// What the panas at the dominó table shout. Pure: turns new history events,
// and the end of a mano, into speech bubbles. Lines are seeded by the event,
// so every client shows the same bark without sending it over the network.
import { pickLine } from '../../../engine/frases.js';
import { groupOf } from './options.js';

const COCHINA = ['¡Salí con la cochina!', '¡Ahí va la cochina!'];
const DOUBLE = ['¡Doble!', '¡Ahí va ese doble!', '¡Pa\' que sepas!'];
const LAST = ['¡Me queda una!', '¡Ojo, que me queda una!'];
const PASS = ['¡Paso!', 'Ando limpio', 'Tú sabes cómo es', 'Llevándola'];
const OUT = ['¡Dominó!', '¡Dominó, mi pana!', '¡Se acabó!'];
const BLOCK = ['¡Se trancó!', '¡Tranque!'];

const time = text => Math.min(3.2, 1.4 + text.length * .04);

// `ended` is true on the render where the mano has just finished.
export function barksFor(state, events, { ended = false } = {}) {
  const out = [];
  const say = (seat, pool, seed) => {
    const text = pickLine(pool, `${state.round}:${seed}`);
    if (text && state.players[seat]) out.push({ seat, text, time: time(text) });
  };
  for (const e of events) {
    const key = `${e.id}:${e.tile?.id || 'pass'}`;
    if (e.kind === 'play') {
      const latest = state.history.findLast(h => h.seat === e.seat) === e, left = state.players[e.seat]?.hand.length;
      if (e.id === 1 && e.tile.id === '6-6') say(e.seat, COCHINA, key);
      else if (latest && left === 1 && state.phase === 'playing') say(e.seat, LAST, key);
      else if (e.tile.a === e.tile.b) say(e.seat, DOUBLE, key);
    } else if (e.kind === 'pass') {
      const passes = state.history.filter(h => h.kind === 'pass' && h.seat === e.seat && h.id <= e.id).length;
      say(e.seat, passes >= 3 ? 'salado' : passes === 2 ? 'aburrido' : PASS, key);
    }
  }
  const r = state.result;
  if (ended && r) {
    const key = `end:${state.history.at(-1)?.id || 0}`, seat = r.seat ?? 0;
    const rival = state.players.find(p => r.winner === null ? p.seat !== seat : groupOf(state, p.seat) !== r.winner)?.seat;
    if (r.reason === 'out') {
      say(seat, r.capicua ? ['¡Capicúa!'] : OUT, key);
      const partner = state.players.find(p => p.seat !== seat && groupOf(state, p.seat) === groupOf(state, seat))?.seat;
      if (partner !== undefined) say(partner, 'aplauso', `${key}:partner`);
    } else say(seat, BLOCK, key);
    if (rival !== undefined) say(rival, r.reason === 'out' ? 'sorpresa' : 'queja', `${key}:rival`);
    if (state.phase === 'finished' && r.matchWinner !== null && r.matchWinner !== undefined) {
      const winner = state.players.find(p => groupOf(state, p.seat) === r.matchWinner)?.seat;
      const loser = state.players.find(p => groupOf(state, p.seat) !== r.matchWinner)?.seat;
      if (winner !== undefined) say(winner, 'cierre', `${key}:match`);
      if (loser !== undefined) say(loser, 'derrota', `${key}:match`);
    }
  }
  // A seat that speaks twice in one batch keeps only its latest line.
  return out.filter((b, i) => !out.slice(i + 1).some(later => later.seat === b.seat));
}
