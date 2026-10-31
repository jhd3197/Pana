import { VARIANTS } from './animation-catalog.js';

const activePlayers = state => state.players.filter(p => state.options.mode !== 'panas' || p.id !== null);
export const animationRound = state => `${state.round}:${state.index}:${state.final}`;
export const animationPhase = state => `${animationRound(state)}:${state.phase}:${!!state.reveal?.done}`;

// Round/seat rotation is reproducible on every client and never repeats a take
// on consecutive questions. No private answer is read before settlement.
export function animationVariant(state, seat, action) {
  const list = VARIANTS[action];
  const question = Math.max(0, (state.round || 1) - 1) * ((state.total || 12) + 1) + state.index;
  return list ? list[(question + seat) % list.length][0] : 'classic';
}

export function quizAnimation(state, elapsed) {
  const players = activePlayers(state);
  if (!players.length || state.phase === 'lobby') return null;
  const take = (action, seat, age, duration = 4, key = action) => ({ action, seat, age, duration,
    variant: animationVariant(state, seat, action), key: `${animationPhase(state)}:${key}:${seat}` });
  if (state.phase === 'finished') {
    const actions = ['win', 'mangos', 'hug', 'group', 'faint'];
    const i = Math.floor(elapsed / 5) % actions.length;
    return take(actions[i], state.winner, elapsed % 5, 5);
  }
  if (state.phase === 'reveal' && state.reveal?.done) {
    const order = state.reveal.order.filter(seat => players.some(p => p.seat === seat));
    if (!order.length) return null;
    // Fit every contestant's reaction within the existing eight-second result.
    const slot = Math.min(2.4, 7.2 / order.length), i = Math.min(order.length - 1, Math.floor(elapsed / slot));
    const seat = order[i], p = state.players[seat];
    if (elapsed >= slot * order.length) {
      const copier = players.find(p => p.copy !== null);
      if (copier) return take(state.index % 2 ? 'phone' : 'cheat', copier.seat, elapsed - slot * order.length, 3);
      return null;
    }
    let action = p.outcome?.right ? 'right' : 'wrong';
    if (state.gold === seat) action = 'win';
    else if (state.index % 7 === 6) action = p.outcome?.right ? 'faint' : 'trap';
    // Workbench results include a suspense lead-in; skip it because the actual
    // answer is already public, without delaying the rules or narration.
    const start = ['right', 'wrong', 'win', 'faint'].includes(action) ? .48 : 0;
    const duration = slot / (1 - start);
    return take(action, seat, duration * start + elapsed % slot, duration);
  }
  if (state.phase === 'reveal' || state.phase === 'pause') {
    const seat = state.reveal?.order[Math.max(0, state.reveal.shown - 1)] ?? players[0].seat;
    return take('suspense', seat, elapsed % 3, 3);
  }
  if (state.phase === 'bet') return take('audience', players[0].seat, elapsed % 4, 4);
  if (state.phase !== 'question') return null;
  if (state.index === 0 && elapsed < 3) return take('welcome', players[0].seat, elapsed, 3);
  if (state.index > 0 && state.index % 5 === 0 && elapsed < 2.5) return take('feedback', players[0].seat, elapsed, 2.5);
  const undecided = players.filter(p => !p.locked);
  if (!undecided.length) return null;
  const i = Math.floor(elapsed / 4) % undecided.length, p = undecided[i];
  return take(state.timeLeft <= 5 ? 'blank' : 'think', p.seat, elapsed % 4, 4);
}
