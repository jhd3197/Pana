import { validTableArena } from '../../../engine/worlds/arena-layouts.js';
import { swapSeats, canMoveSeats } from '../../../engine/play/seat-rules.js';
import { DEFAULT_OPTIONS, changeOptions } from './options.js';
import { createStarter, starterInput, stepStarter, starterDone, starterResult, joinStarter } from '../../../engine/play/quien-empieza-rules.js';
// Pure Texas Hold'em and Omaha with selectable betting limits. Cards are integers: suit * 13 + rank (deuce = 0).
export const SMALL = 10, BIG = 20, STACK = 1000;
export const HANDS = ['Carta alta', 'Pareja', 'Doble pareja', 'Trío', 'Escalera', 'Color', 'Full', 'Póquer', 'Escalera de color'];
export const rank = card => card % 13 + 2;
export const suit = card => Math.floor(card / 13);
export const face = card => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[rank(card)] || String(rank(card)));
export const suitName = card => ['Tréboles', 'Diamantes', 'Corazones', 'Picas'][suit(card)];
// A mid-hand arrival watches until the next deal. Disconnected all-ins keep
// their chair, but a departed folded player cannot occupy a replacement seat.
export function tablePlayers(state) {
  const playing = !['lobby', 'finished', 'starter'].includes(state.phase);
  return state.players.filter(p => playing ? p.hole.length > 0 && (p.connected || !p.folded) : p.connected).slice(0, 6);
}
export function compare(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return Math.sign(d); } return 0; }
export function five(cards) {
  const ranks = cards.map(rank).sort((a, b) => b - a), unique = [...new Set(ranks)];
  const flush = cards.every(c => suit(c) === suit(cards[0]));
  const straight = unique.length === 5 && (unique[0] - unique[4] === 4 ? unique[0] : unique.join() === '14,5,4,3,2' ? 5 : 0);
  const counts = [...new Set(ranks)].map(r => [ranks.filter(n => n === r).length, r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  if (straight && flush) return [8, straight];
  if (counts[0][0] === 4) return [7, counts[0][1], counts[1][1]];
  if (counts[0][0] === 3 && counts[1][0] === 2) return [6, counts[0][1], counts[1][1]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  if (counts[0][0] === 3) return [3, counts[0][1], ...counts.slice(1).map(c => c[1])];
  if (counts[0][0] === 2 && counts[1][0] === 2) return [2, ...counts.slice(0, 2).map(c => c[1]).sort((a, b) => b - a), counts[2][1]];
  if (counts[0][0] === 2) return [1, counts[0][1], ...counts.slice(1).map(c => c[1])];
  return [0, ...ranks];
}
export function evaluate(cards) {
  let best = [-1];
  for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++)
    for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++) for (let e = d + 1; e < cards.length; e++) {
      const score = five([cards[a], cards[b], cards[c], cards[d], cards[e]]); if (compare(score, best) > 0) best = score;
    }
  return best;
}
// Omaha must use exactly two private cards and exactly three board cards.
export function evaluateHand(hole, board, variant = 'texas') {
  if (variant !== 'omaha') return evaluate([...hole, ...board]);
  let best = [-1];
  for (let a = 0; a < hole.length - 1; a++) for (let b = a + 1; b < hole.length; b++)
    for (let c = 0; c < board.length - 2; c++) for (let d = c + 1; d < board.length - 1; d++) for (let e = d + 1; e < board.length; e++) {
      const score = five([hole[a], hole[b], board[c], board[d], board[e]]);
      if (compare(score, best) > 0) best = score;
    }
  return best;
}
export function shuffle(random = Math.random) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
// Layered pots include folded contributions, but only live hands can win them.
// Odd chips go clockwise from the dealer, conserving every chip.
export function settle(players, board, dealer, variant = 'texas') {
  const levels = [...new Set(players.map(p => p.total).filter(Boolean))].sort((a, b) => a - b);
  const payouts = Object.fromEntries(players.map(p => [p.id, 0])), pots = []; let previous = 0;
  for (const level of levels) {
    const contributors = players.filter(p => p.total >= level), amount = (level - previous) * contributors.length; previous = level;
    let eligible = contributors.filter(p => !p.folded);
    if (contributors.length === 1) eligible = contributors; // uncalled excess is returned
    if (!eligible.length) eligible = players.filter(p => !p.folded);
    const scores = eligible.map(p => ({ id: p.id, score: evaluateHand(p.hole, board, variant) }));
    const best = scores.reduce((a, p) => compare(p.score, a) > 0 ? p.score : a, [-1]);
    const winners = scores.filter(p => compare(p.score, best) === 0).map(p => p.id);
    winners.sort((a, b) => ((players.findIndex(p => p.id === a) - dealer - 1 + players.length) % players.length) - ((players.findIndex(p => p.id === b) - dealer - 1 + players.length) % players.length));
    if (!winners.length) continue;
    winners.forEach((id, i) => { payouts[id] += Math.floor(amount / winners.length) + (i < amount % winners.length ? 1 : 0); });
    pots.push({ amount, winners, refund: contributors.length === 1 });
  }
  return { payouts, pots };
}

export class Poker {
  constructor() { this.options = { ...DEFAULT_OPTIONS }; this.blindStartedAt = null; this.smallBlind = SMALL; this.bigBlind = BIG; this.streetBets = 0; this.mapId = 'plaza'; this.players = []; this.phase = 'lobby'; this.hand = 0; this.revision = 0; this.dealer = -1; this.board = []; this.turn = null; this.message = 'Invita a tus panas o juega con bots.'; this.result = null; this.starter = null; this.busted = []; this.lastPlace = null; }
  configure(patch, mapId) {
    if (this.phase !== 'lobby' || (mapId !== undefined && !validTableArena(mapId))) return false;
    const next = changeOptions(this.options, patch); if (!next) return false;
    if (next.stack !== this.options.stack) for (const p of this.players) p.chips = next.stack;
    if (next.blinds !== this.options.blinds || next.blindMinutes !== this.options.blindMinutes) {
      this.blindStartedAt = null; this.smallBlind = next.blinds / 2; this.bigBlind = next.blinds;
    }
    this.options = next; if (mapId !== undefined) this.mapId = mapId; this.revision++; return true;
  }
  get funded() { return this.players.filter(p => p.connected && (p.chips > 0 || this.options.rebuy)); }
  get fixedBet() { return this.bigBlind * (['turn', 'river'].includes(this.phase) ? 2 : 1); }
  setMap(id) { if (this.phase !== 'lobby' || !validTableArena(id)) return false; this.mapId = id; this.revision++; return true; }
  reseat(from, to, actorId = null, hostId = null) {
    if (actorId !== null && !canMoveSeats(this.players, from, to, actorId, hostId)) return false;
    if (this.phase !== 'lobby' || !this.players[from]?.connected || !this.players[to]?.connected) return false;
    const dealerId = this.players[this.dealer]?.id;
    if (!swapSeats(this.players, from, to)) return false;
    this.dealer = this.players.findIndex(p => p.id === dealerId);
    this.revision++; return true;
  }
  setup() {
    if (this.phase !== 'finished') return false;
    // Revancha: whoever busted first, else the shortest stack, opens the next match.
    this.lastPlace = this.busted[0] ?? [...this.players].filter(p => p.connected).sort((a, b) => a.chips - b.chips)[0]?.id ?? null;
    this.phase = 'lobby'; this.board = []; this.deck = []; this.result = null; this.turn = null;
    this.pending = new Set(); this.currentBet = 0; this.message = 'Organiza los puestos antes de repartir. Cada pana conserva sus fichas.';
    for (const p of this.players) Object.assign(p, { hole: [], bet: 0, total: 0, folded: true, allin: false, actedAt: null, action: '' });
    this.revision++; return true;
  }
  add(id, info) {
    this.revision++;
    let p = this.players.find(p => p.id === id);
    if (p) { Object.assign(p, info, { connected: true }); return p; }
    p = { id, ...info, connected: true, chips: this.options.stack, hole: [], bet: 0, total: 0, folded: true, allin: false, actedAt: null };
    this.players.push(p); if (this.phase === 'starter') joinStarter(this.starter, this.players.length - 1);
    return p;
  }
  get live() { return this.players.filter(p => !p.folded); }
  get active() { return this.live.filter(p => !p.allin); }
  next(index, predicate) { for (let n = 1; n <= this.players.length; n++) { const i = (index + n) % this.players.length; if (predicate(this.players[i])) return i; } return -1; }
  pay(p, amount) { const paid = Math.min(p.chips, amount); p.chips -= paid; p.bet += paid; p.total += paid; p.allin = p.chips === 0; }
  // A match's first hand opens with ¿Quién empieza? (engine/play/quien-empieza-rules.js):
  // the highest cacho takes the dealer button. Later hands deal at once.
  start(random = Math.random, now = Date.now()) {
    if (!['lobby', 'finished'].includes(this.phase) || this.funded.length < 2) return false;
    if (this.phase === 'finished') return this.deal(random, now);
    this.players = this.players.filter(p => p.connected); this.busted = [];
    const last = this.players.findIndex(p => p.id === this.lastPlace);
    this.starter = createStarter({ seats: this.players.map((p, i) => i), need: 'first', seed: Math.floor(random() * 2 ** 32), option: this.options.starter, last: last < 0 ? null : last });
    this.phase = 'starter'; this.revision++; this.message = '¿Quién empieza? El dado más alto reparte primero.';
    if (starterDone(this.starter)) this.openHand(random, now);
    return true;
  }
  // Host only, on its timer: bots and departed panas slam on their own.
  stepStarter(dt, random = Math.random, now = Date.now()) {
    if (this.phase !== 'starter') return false;
    const changed = stepStarter(this.starter, dt, { bots: this.players.flatMap((p, i) => p.bot || !p.connected ? [i] : []) });
    if (starterDone(this.starter)) { this.openHand(random, now); return true; }
    if (changed) this.revision++;
    return changed;
  }
  // A pana shaking ('shake') or slamming ('slam') the cacho; no revision check, everyone throws at once.
  cacho(id, input, power) {
    const seat = this.players.findIndex(p => p.id === id);
    if (this.phase !== 'starter' || seat < 0 || !starterInput(this.starter, seat, input, power)) return false;
    this.revision++; return true;
  }
  openHand(random, now) {
    const { order, rolls } = starterResult(this.starter), first = this.players[order[0]], how = this.starter.note;
    this.deal(random, now, first?.id);
    this.message = `${how ? `${how}: ` : ''}${first?.name || 'La mesa'} reparte${rolls[order[0]] ? ` con un ${rolls[order[0]]}` : ''}. ${this.message}`;
  }
  deal(random = Math.random, now = Date.now(), dealerId = null) {
    const firstDealer = this.players.find(p => p.id === dealerId && p.connected && (p.chips > 0 || this.options.rebuy));
    const nextDealer = firstDealer?.id ?? this.players[this.next(this.dealer, p => p.connected && (p.chips > 0 || this.options.rebuy))]?.id;
    this.players = this.players.filter(p => p.connected);
    this.dealer = this.players.findIndex(p => p.id === nextDealer);
    this.blindStartedAt ??= now;
    const level = this.options.blindMinutes ? Math.min(20, Math.max(0, Math.floor((now - this.blindStartedAt) / (this.options.blindMinutes * 60000)))) : 0;
    this.bigBlind = this.options.blinds * 2 ** level; this.smallBlind = this.bigBlind / 2;
    this.deck = shuffle(random); this.board = []; this.hand++; this.revision++; this.result = null; this.phase = 'preflop'; this.currentBet = this.bigBlind; this.minRaise = this.bigBlind; this.streetBets = 1;
    this.players.forEach(p => {
      if (p.chips === 0 && this.options.rebuy) p.chips = this.options.stack;
      Object.assign(p, { hole: p.chips > 0 ? Array.from({ length: this.options.variant === 'omaha' ? 4 : 2 }, () => this.deck.pop()) : [], folded: p.chips === 0, bet: 0, total: 0, allin: false, actedAt: null, action: p.chips === 0 ? 'Sin fichas' : '' });
    });
    const sb = this.live.length === 2 ? this.dealer : this.next(this.dealer, p => !p.folded), bb = this.next(sb, p => !p.folded);
    this.pay(this.players[sb], this.smallBlind); this.pay(this.players[bb], this.bigBlind);
    this.pending = new Set(this.active.map(p => p.id)); this.turn = this.players[this.next(bb, p => this.pending.has(p.id))]?.id ?? null;
    this.message = `Ciegas ${this.smallBlind} / ${this.bigBlind}. ${this.options.variant === 'omaha' ? 'Usa dos cartas de tu mano y tres de la mesa.' : 'Arma la mejor mano de cinco cartas.'}`; this.advance(bb); return true;
  }
  legal(id) {
    const p = this.players.find(p => p.id === id);
    if (!p || this.turn !== id || p.folded || p.allin || ['lobby', 'finished'].includes(this.phase)) return null;
    const call = Math.min(p.chips, Math.max(0, this.currentBet - p.bet));
    const fixed = this.options.limit === 'fixed', step = fixed ? this.fixedBet : this.minRaise;
    let max = p.bet + p.chips;
    if (this.options.limit === 'pot') max = Math.min(max, this.currentBet + this.players.reduce((sum, q) => sum + q.total, 0) + call);
    if (fixed) max = Math.min(max, this.currentBet + step);
    return { call, min: this.currentBet + step, max,
      raise: this.active.length > 1 && (!fixed || this.streetBets < 4) && (p.actedAt === null || this.currentBet - p.actedAt >= step) && max > this.currentBet };
  }
  act(id, action, amount, revision = this.revision) {
    const legal = this.legal(id); if (!legal || revision !== this.revision) return false;
    const p = this.players.find(p => p.id === id), index = this.players.indexOf(p);
    if (action === 'fold') { p.folded = true; p.action = 'Se retiró'; }
    else if (action === 'call') { this.pay(p, legal.call); p.action = legal.call ? `Igualó ${legal.call}` : 'Pasó'; }
    else if (action === 'raise') {
      if (!legal.raise || !Number.isInteger(amount) || amount <= this.currentBet || amount > legal.max || (amount < legal.min && amount !== p.bet + p.chips)) return false;
      const increase = amount - this.currentBet;
      this.pay(p, amount - p.bet); if (increase >= this.minRaise) { this.minRaise = increase; this.streetBets++; } this.currentBet = amount;
      for (const other of this.active) if (other.id !== id && other.bet < amount) this.pending.add(other.id);
      p.action = p.allin ? 'Va con todo' : `Subió a ${amount}`;
    } else return false;
    p.actedAt = this.currentBet; this.pending.delete(id); this.message = `${p.name}: ${p.action.toLowerCase()}.`; this.revision++; this.advance(index); return true;
  }
  drop(id) {
    const p = this.players.find(p => p.id === id); if (!p) return;
    p.connected = false;
    // An all-in hand remains eligible; a reconnect cannot resurrect a folded hand.
    if (!p.folded && !p.allin && !['lobby', 'finished'].includes(this.phase)) {
      p.folded = true; p.action = 'Sin conexión'; this.pending.delete(id); this.revision++;
      this.advance(this.players.findIndex(p => p.id === this.turn) - (this.turn === id ? 0 : 1));
    }
  }
  advance(after) {
    if (this.live.length <= 1) { this.finish(false); return; }
    for (const id of this.pending) if (!this.active.some(p => p.id === id)) this.pending.delete(id);
    if (this.active.length <= 1 && this.active.every(p => p.bet >= Math.max(0, ...this.live.filter(q => q.id !== p.id).map(q => q.bet)))) this.pending.clear();
    if (this.pending.size) { const index = this.next((after + this.players.length) % this.players.length, p => this.pending.has(p.id)); this.turn = this.players[index].id; return; }
    if (this.phase === 'river') { this.finish(true); return; }
    this.deck.pop(); // burn
    const count = this.phase === 'preflop' ? 3 : 1;
    for (let n = 0; n < count; n++) this.board.push(this.deck.pop());
    this.phase = { preflop: 'flop', flop: 'turn', turn: 'river' }[this.phase];
    this.currentBet = 0; this.minRaise = this.options.limit === 'fixed' ? this.fixedBet : this.bigBlind; this.streetBets = 0;
    this.players.forEach(p => { p.bet = 0; p.actedAt = null; p.action = p.folded ? p.action : p.allin ? 'Va con todo' : ''; });
    this.pending = new Set(this.active.map(p => p.id)); this.advance(this.dealer);
  }
  finish(showdown) {
    const total = this.players.reduce((sum, p) => sum + p.total, 0);
    const result = showdown ? settle(this.players, this.board, this.dealer, this.options.variant) : { payouts: Object.fromEntries(this.players.map(p => [p.id, p.id === this.live[0]?.id ? total : 0])), pots: [{ amount: total, winners: this.live.map(p => p.id) }] };
    for (const p of this.players) { p.chips += result.payouts[p.id] || 0; if (!p.chips && !this.busted.includes(p.id)) this.busted.push(p.id); }
    this.result = { ...result, showdown, total }; this.phase = 'finished'; this.turn = null;
    this.message = showdown ? 'Cartas sobre la mesa.' : `${this.live[0]?.name || 'La mesa'} se lleva el pozo.`;
  }
  botAction() {
    const p = this.players.find(p => p.id === this.turn), legal = this.legal(this.turn); if (!p || !legal) return;
    const strength = this.board.length >= 3 ? evaluateHand(p.hole, this.board, this.options.variant)[0] : rank(p.hole[0]) === rank(p.hole[1]) ? 2 : Math.max(...p.hole.map(rank)) >= 12 ? 1 : 0;
    if (legal.call > p.chips * .4 && strength === 0) return this.act(p.id, 'fold');
    if (legal.raise && strength >= 2 && p.actedAt === null && legal.min <= legal.max && Math.random() < .4) return this.act(p.id, 'raise', legal.min);
    return this.act(p.id, 'call');
  }
  view(id) {
    return { mapId: this.mapId, options: { ...this.options }, starter: this.phase === 'starter' ? JSON.parse(JSON.stringify(this.starter)) : null, smallBlind: this.smallBlind, bigBlind: this.bigBlind, canStart: this.funded.length >= 2, phase: this.phase, hand: this.hand, revision: this.revision, dealer: this.players[this.dealer]?.id, board: [...this.board], turn: this.turn,
      currentBet: this.currentBet || 0, pot: this.players.reduce((sum, p) => sum + p.total, 0), message: this.message, result: this.result, legal: this.legal(id),
      players: this.players.map(({ hole, actedAt, ...p }) => ({ ...p, hole: p.id === id || (this.options.showCards && this.result?.showdown && !p.folded) ? [...hole] : hole.map(() => null),
        handName: this.result?.showdown && !p.folded && (p.id === id || this.options.showCards) ? HANDS[evaluateHand(hole, this.board, this.options.variant)[0]] : '' })) };
  }
}
