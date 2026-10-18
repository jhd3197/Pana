import { validTableArena } from '../../../engine/arena-layouts.js';
import { swapSeats } from '../../../engine/seat-rules.js';
// Pure no-limit Hold'em. Cards are integers: suit * 13 + rank (deuce = 0).
export const SMALL = 10, BIG = 20, STACK = 1000;
export const HANDS = ['Carta alta', 'Pareja', 'Doble pareja', 'Trío', 'Escalera', 'Color', 'Full', 'Póquer', 'Escalera de color'];
export const rank = card => card % 13 + 2;
export const suit = card => Math.floor(card / 13);
export const face = card => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[rank(card)] || String(rank(card)));
export const suitName = card => ['Tréboles', 'Diamantes', 'Corazones', 'Picas'][suit(card)];
// A mid-hand arrival watches until the next deal. Disconnected all-ins keep
// their chair, but a departed folded player cannot occupy a replacement seat.
export function tablePlayers(state) {
  const playing = !['lobby', 'finished'].includes(state.phase);
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
export function shuffle(random = Math.random) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
// Layered pots include folded contributions, but only live hands can win them.
// Odd chips go clockwise from the dealer, conserving every chip.
export function settle(players, board, dealer) {
  const levels = [...new Set(players.map(p => p.total).filter(Boolean))].sort((a, b) => a - b);
  const payouts = Object.fromEntries(players.map(p => [p.id, 0])), pots = []; let previous = 0;
  for (const level of levels) {
    const contributors = players.filter(p => p.total >= level), amount = (level - previous) * contributors.length; previous = level;
    let eligible = contributors.filter(p => !p.folded);
    if (contributors.length === 1) eligible = contributors; // uncalled excess is returned
    if (!eligible.length) eligible = players.filter(p => !p.folded);
    const scores = eligible.map(p => ({ id: p.id, score: evaluate([...p.hole, ...board]) }));
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
  constructor() { this.mapId = 'plaza'; this.players = []; this.phase = 'lobby'; this.hand = 0; this.revision = 0; this.dealer = -1; this.board = []; this.turn = null; this.message = 'Invita a tus panas o juega con bots.'; this.result = null; }
  setMap(id) { if (this.phase !== 'lobby' || !validTableArena(id)) return false; this.mapId = id; this.revision++; return true; }
  reseat(from, to) {
    if (this.phase !== 'lobby' || !this.players[from]?.connected || !this.players[to]?.connected) return false;
    const dealerId = this.players[this.dealer]?.id;
    if (!swapSeats(this.players, from, to)) return false;
    this.dealer = this.players.findIndex(p => p.id === dealerId);
    this.revision++; return true;
  }
  setup() {
    if (this.phase !== 'finished') return false;
    this.phase = 'lobby'; this.board = []; this.deck = []; this.result = null; this.turn = null;
    this.pending = new Set(); this.currentBet = 0; this.message = 'Organiza los puestos antes de repartir. Cada pana conserva sus fichas.';
    for (const p of this.players) Object.assign(p, { hole: [], bet: 0, total: 0, folded: true, allin: false, actedAt: null, action: '' });
    this.revision++; return true;
  }
  add(id, info) {
    this.revision++;
    let p = this.players.find(p => p.id === id);
    if (p) { Object.assign(p, info, { connected: true }); return p; }
    p = { id, ...info, connected: true, chips: STACK, hole: [], bet: 0, total: 0, folded: true, allin: false, actedAt: null };
    this.players.push(p); return p;
  }
  get live() { return this.players.filter(p => !p.folded); }
  get active() { return this.live.filter(p => !p.allin); }
  next(index, predicate) { for (let n = 1; n <= this.players.length; n++) { const i = (index + n) % this.players.length; if (predicate(this.players[i])) return i; } return -1; }
  pay(p, amount) { const paid = Math.min(p.chips, amount); p.chips -= paid; p.bet += paid; p.total += paid; p.allin = p.chips === 0; }
  start(random = Math.random) {
    if (!['lobby', 'finished'].includes(this.phase) || this.players.filter(p => p.connected).length < 2) return false;
    const nextDealer = this.players[this.next(this.dealer, p => p.connected)]?.id;
    this.players = this.players.filter(p => p.connected);
    this.dealer = this.players.findIndex(p => p.id === nextDealer);
    this.deck = shuffle(random); this.board = []; this.hand++; this.revision++; this.result = null; this.phase = 'preflop'; this.currentBet = BIG; this.minRaise = BIG;
    this.players.forEach(p => { if (p.chips === 0) p.chips = STACK; Object.assign(p, { hole: [this.deck.pop(), this.deck.pop()], folded: false, bet: 0, total: 0, allin: false, actedAt: null, action: '' }); });
    const sb = this.players.length === 2 ? this.dealer : this.next(this.dealer, () => true), bb = this.next(sb, () => true);
    this.pay(this.players[sb], SMALL); this.pay(this.players[bb], BIG);
    this.pending = new Set(this.active.map(p => p.id)); this.turn = this.players[this.next(bb, p => this.pending.has(p.id))]?.id ?? null;
    this.message = 'Ciegas 10 / 20. Arma la mejor mano de cinco cartas.'; this.advance(bb); return true;
  }
  legal(id) {
    const p = this.players.find(p => p.id === id);
    if (!p || this.turn !== id || p.folded || p.allin || ['lobby', 'finished'].includes(this.phase)) return null;
    const call = Math.min(p.chips, Math.max(0, this.currentBet - p.bet));
    return { call, min: this.currentBet + this.minRaise, max: p.bet + p.chips,
      raise: this.active.length > 1 && (p.actedAt === null || this.currentBet - p.actedAt >= this.minRaise) && p.bet + p.chips > this.currentBet };
  }
  act(id, action, amount, revision = this.revision) {
    const legal = this.legal(id); if (!legal || revision !== this.revision) return false;
    const p = this.players.find(p => p.id === id), index = this.players.indexOf(p);
    if (action === 'fold') { p.folded = true; p.action = 'Se retiró'; }
    else if (action === 'call') { this.pay(p, legal.call); p.action = legal.call ? `Igualó ${legal.call}` : 'Pasó'; }
    else if (action === 'raise') {
      if (!legal.raise || !Number.isInteger(amount) || amount <= this.currentBet || amount > legal.max || (amount < legal.min && amount !== legal.max)) return false;
      const increase = amount - this.currentBet;
      this.pay(p, amount - p.bet); if (increase >= this.minRaise) this.minRaise = increase; this.currentBet = amount;
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
    this.currentBet = 0; this.minRaise = BIG;
    this.players.forEach(p => { p.bet = 0; p.actedAt = null; p.action = p.folded ? p.action : p.allin ? 'Va con todo' : ''; });
    this.pending = new Set(this.active.map(p => p.id)); this.advance(this.dealer);
  }
  finish(showdown) {
    const total = this.players.reduce((sum, p) => sum + p.total, 0);
    const result = showdown ? settle(this.players, this.board, this.dealer) : { payouts: Object.fromEntries(this.players.map(p => [p.id, p.id === this.live[0]?.id ? total : 0])), pots: [{ amount: total, winners: this.live.map(p => p.id) }] };
    for (const p of this.players) p.chips += result.payouts[p.id] || 0;
    this.result = { ...result, showdown, total }; this.phase = 'finished'; this.turn = null;
    this.message = showdown ? 'Cartas sobre la mesa.' : `${this.live[0]?.name || 'La mesa'} se lleva el pozo.`;
  }
  botAction() {
    const p = this.players.find(p => p.id === this.turn), legal = this.legal(this.turn); if (!p || !legal) return;
    const strength = this.board.length >= 3 ? evaluate([...p.hole, ...this.board])[0] : rank(p.hole[0]) === rank(p.hole[1]) ? 2 : Math.max(...p.hole.map(rank)) >= 12 ? 1 : 0;
    if (legal.call > p.chips * .4 && strength === 0) return this.act(p.id, 'fold');
    if (legal.raise && strength >= 2 && p.actedAt === null && legal.min <= legal.max && Math.random() < .4) return this.act(p.id, 'raise', legal.min);
    return this.act(p.id, 'call');
  }
  view(id) {
    return { mapId: this.mapId, phase: this.phase, hand: this.hand, revision: this.revision, dealer: this.players[this.dealer]?.id, board: [...this.board], turn: this.turn,
      currentBet: this.currentBet || 0, pot: this.players.reduce((sum, p) => sum + p.total, 0), message: this.message, result: this.result, legal: this.legal(id),
      players: this.players.map(({ hole, actedAt, ...p }) => ({ ...p, hole: p.id === id || (this.result?.showdown && !p.folded) ? [...hole] : hole.map(() => null),
        handName: this.result?.showdown && !p.folded ? HANDS[evaluate([...hole, ...this.board])[0]] : '' })) };
  }
}
