import { DEFAULT_OPTIONS, validOptions } from './options.js';
import { validTableArena } from '../../../engine/worlds/arena-layouts.js';
import { swapSeats, canMoveSeats } from '../../../engine/play/seat-rules.js';
import { createStarter, starterInput, stepStarter, starterDone, starterResult } from '../../../engine/play/quien-empieza-rules.js';
// Pure deterministic rules. Table variants and sources are documented in caida.md.
// A match opens with ¿Quién empieza? (engine/play/quien-empieza-rules.js): the
// highest cacho deals the first reparto; later repartos pass the deal along.
export const TARGET = 24;
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const SUITS = ['oros', 'copas', 'espadas', 'bastos'];
export const BOT_NAMES = ['Coco', 'Lola', 'Tito', 'Nina', 'Cheo', 'Luz'];
export const MODES = { duel: { count: 2, teams: false, label: 'Dos panas' }, three: { count: 3, teams: false, label: 'Tres panas' }, teams: { count: 4, teams: true, label: 'Dos parejas' }, four: { count: 4, teams: false, label: 'Cuatro individuales' }, six: { count: 6, teams: false, label: 'Seis individuales' }, sixTeams: { count: 6, teams: true, label: 'Dos equipos de tres' } };
export const deck = () => SUITS.flatMap(suit => RANKS.map(rank => ({ id: `${suit}-${rank}`, suit, rank })));
export const cardName = c => `${({ 1: 'As', 10: 'Sota', 11: 'Caballo', 12: 'Rey' })[c.rank] || c.rank} de ${c.suit}`;
export const fallPoints = rank => rank <= 7 ? 1 : rank - 8;
export const teamOf = (state, seat) => MODES[state.options.mode].teams ? seat % 2 : seat;
export const nextDealer = state => state.phase === 'round-over' ? (state.dealer + 1) % state.players.length : 0;
export const cantoDescription = name => ({ Ronda: 'Dos cartas iguales', Rondín: 'Tres cartas iguales', Patrulla: 'Tres cartas seguidas', Patria: 'Tres cartas seguidas', Vigía: 'Dos iguales y una vecina', Registro: 'As, caballo y rey' })[name] || name;
const copy = value => JSON.parse(JSON.stringify(value));

export function canto(hand) {
  if (hand.length !== 3) return null;
  const ranks = hand.map(c => c.rank).sort((a, b) => a - b), [a, b, c] = ranks;
  if (a === 1 && b === 11 && c === 12) return { name: 'Registro', points: 8, ranks };
  const pair = a === b ? a : b === c ? b : null, other = a === b ? c : a;
  if (a === c) return { name: 'Rondín', points: 5, ranks };
  if (pair && Math.abs(RANKS.indexOf(pair) - RANKS.indexOf(other)) === 1) return { name: 'Vigía', points: 7, ranks };
  if (RANKS.indexOf(b) === RANKS.indexOf(a) + 1 && RANKS.indexOf(c) === RANKS.indexOf(b) + 1) return { name: 'Patrulla', points: 6, ranks };
  return pair ? { name: 'Ronda', points: fallPoints(pair), ranks } : null;
}

export function previewPlay(state, card, seat = state.turn) {
  if (!card) return { capture: [], fall: 0, clean: 0, points: 0 };
  const first = state.table.find(c => c.rank === card.rank), capture = [];
  if (first) {
    capture.push(first.id);
    for (let i = RANKS.indexOf(card.rank) + 1; i < RANKS.length; i++) {
      const next = state.table.find(c => c.rank === RANKS[i]);
      if (!next) break;
      capture.push(next.id);
    }
  }
  const fall = first && state.last?.id === first.id && state.last.seat !== seat && teamOf(state, state.last.seat) !== teamOf(state, seat) ? fallPoints(card.rank) : 0;
  const clean = capture.length && capture.length === state.table.length && state.stock.length > 0 ? 4 : 0;
  return { capture, fall, clean, points: fall + clean };
}

// Bot decisions depend only on the acting hand and public information.
export function chooseMove(state, seat = state.turn) {
  const hand = state.players[seat]?.hand || [];
  if (state.phase !== 'playing' || !hand.length) return null;
  const next = (seat + 1) % state.players.length;
  const known = state.players[next].announced?.ranks || [];
  const difficulty = state.options.difficulty;
  const scored = hand.map((card, index) => {
    const p = previewPlay(state, card, seat);
    const remaining = state.table.filter(c => !p.capture.includes(c.id));
    const risk = state.stock.length && p.capture.length && remaining.length === 1 ? 4 : 0;
    const playedOfRank = state.players.flatMap(p => p.captured).filter(c => c.rank === card.rank).length;
    const knownRisk = known.includes(card.rank) && !p.capture.length ? fallPoints(card.rank) * 2 : 0;
    const score = difficulty === 'easy' ? p.capture.length * .5 + ((state.rng + index * 13) % 7) :
      p.points * 8 + p.capture.length * .6 - risk * 2 - fallPoints(card.rank) * .15 - knownRisk + (difficulty === 'hard' ? playedOfRank * .3 : 0);
    return { card: card.id, score };
  });
  return scored.sort((a, b) => b.score - a.score)[0];
}

export class CaidaGame {
  constructor(seed = 1) {
    this.rng = seed >>> 0 || 1; this.options = { ...DEFAULT_OPTIONS, mode: 'duel', call: 'down' };
    this.mapId = 'plaza'; this.phase = 'lobby'; this.round = 0; this.handNumber = 0; this.dealer = 1; this.turn = 0;
    this.players = []; this.scores = []; this.stock = []; this.table = []; this.last = null;
    this.lastCapture = null; this.history = []; this.eventId = 0; this.result = null;
    this.cutAt = null; this.dealCall = null; this.previousRound = null; this.starter = null; this.lastPlace = null;
    this.revision = 0; this.ledger = {}; this.resetSeats();
  }
  resetSeats() {
    const old = [...this.players], count = MODES[this.options.mode].count;
    // Keep every human when a smaller format compacts previously spaced seats.
    for (const player of old.slice(count).filter(p => p.id !== null)) {
      const sameTeam = MODES[this.options.mode].teams ? old.findIndex((p, i) => i < count && p.id === null && i % 2 === player.seat % 2) : -1;
      const free = sameTeam >= 0 ? sameTeam : old.findIndex((p, i) => i < count && p.id === null);
      if (free >= 0) old[free] = player;
    }
    this.players = Array.from({ length: MODES[this.options.mode].count }, (_, seat) => ({ id: old[seat]?.id ?? null, name: old[seat]?.name || BOT_NAMES[seat], avatar: old[seat]?.avatar || {}, seat, hand: [], captured: [], announced: null }));
    this.scores = Array(MODES[this.options.mode].teams ? 2 : this.players.length).fill(0);
    this.dealer = this.players.length - 1;
  }
  configure(options) {
    if (this.phase !== 'lobby' || !options || typeof options !== 'object' || Array.isArray(options)) return false;
    const { mapId, mode, ...patch } = options;
    if (mode !== undefined && !Object.hasOwn(MODES, mode)) return false;
    if (mode !== undefined && MODES[mode].count < this.players.filter(p => p.id !== null).length) return false;
    if ((!Object.keys(patch).length && mapId === undefined && mode === undefined) || (Object.keys(patch).length && !validOptions(patch))) return false;
    if ('mapId' in options) { if (!validTableArena(options.mapId)) return false; this.mapId = options.mapId; }
    if (mode !== undefined) {
      this.options.mode = mode; this.options.format = MODES[mode].teams ? 'teams' : 'individual'; this.resetSeats();
    }
    if (options.format !== undefined) { this.options.format = options.format; this.resizeForHumans(this.players.filter(p => p.id !== null).length); }
    if (typeof options.cantos === 'boolean') this.options.cantos = options.cantos;
    if (['easy', 'normal', 'hard'].includes(options.difficulty)) this.options.difficulty = options.difficulty;
    if (options.starter !== undefined) this.options.starter = options.starter;
    this.revision++; return true;
  }
  resizeForHumans(count) {
    if (this.phase !== 'lobby') return false;
    const mode = this.options.format === 'teams' ? count > 4 ? 'sixTeams' : 'teams' : count > 4 ? 'six' : count === 4 ? 'four' : count === 3 ? 'three' : 'duel';
    if (mode === this.options.mode) return false;
    this.options.mode = mode; this.resetSeats(); this.revision++; return true;
  }
  syncMembers(members) {
    if (this.phase === 'lobby') {
      const ids = new Set(members.map(m => m.id));
      for (const p of this.players) if (p.id !== null && !ids.has(p.id)) this.removePlayer(p.id);
      this.resizeForHumans(members.length);
    }
    for (const m of members) this.addPlayer(m.id, m.name, m.avatar || this.players.find(p => p.id === m.id)?.avatar || {});
  }
  random() { let x = this.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rng = x >>> 0; return this.rng / 4294967296; }
  reseat(from, to) {
    if (this.phase !== 'lobby' || !swapSeats(this.players, from, to)) return false;
    this.revision++; return true;
  }
  setup() {
    if (!['round-over', 'finished'].includes(this.phase)) return false;
    const fresh = new CaidaGame(this.rng);
    fresh.options = { ...this.options }; fresh.players = this.players; fresh.resetSeats();
    Object.assign(this, fresh, { mapId: this.mapId, revision: this.revision + 1, ledger: this.ledger, lastPlace: this.lastPlace });
    return true;
  }
  addPlayer(id, name, avatar = {}) {
    const p = this.players.find(p => p.id === id) || this.players.find(p => p.id === null);
    if (!p) return false;
    const value = { id, name: String(name || 'Pana').slice(0, 16), avatar };
    if (p.id !== value.id || p.name !== value.name || JSON.stringify(p.avatar) !== JSON.stringify(avatar)) { Object.assign(p, value); this.revision++; }
    return true;
  }
  removePlayer(id) { const p = this.players.find(p => p.id === id); if (p) { Object.assign(p, { id: null, name: BOT_NAMES[p.seat], avatar: {} }); this.revision++; } }
  log(kind, seat, text, extra = {}) { this.history.push({ id: ++this.eventId, kind, seat, name: this.players[seat]?.name || 'La mesa', text, ...extra }); this.history = this.history.slice(-60); }
  award(seat, points, reason) {
    if (!points || this.phase === 'finished') return;
    const team = teamOf(this, seat); this.scores[team] += points;
    this.log('score', seat, `${reason} · +${points}`, { points, reason });
    if (this.scores[team] >= TARGET) {
      this.phase = 'finished'; this.result = { winner: team, reason, counts: this.counts(), bonuses: [], points };
      // For a rematch with the "Revancha" option: the lowest score deals first.
      const low = Math.min(...this.scores); this.lastPlace = this.players.find(p => this.scores[teamOf(this, p.seat)] === low)?.seat ?? null;
    }
  }
  start() {
    if (!['lobby', 'round-over', 'finished'].includes(this.phase)) return false;
    this.previousRound = this.result ? copy({ round: this.round, result: this.result, scores: this.scores,
      names: this.scores.map((_, team) => this.players.filter(p => teamOf(this, p.seat) === team).map(p => p.name).join(' + ')) }) : null;
    if (this.phase !== 'round-over') return this.openMatch();
    return this.beginRound(nextDealer(this));
  }
  // A new match: the cachos pick the first dealer before any card moves.
  openMatch() {
    if (this.phase === 'finished') { this.round = 0; this.scores.fill(0); }
    this.table = []; this.stock = []; this.history = []; this.result = null; this.last = null; this.lastCapture = null; this.cutAt = null; this.dealCall = null;
    this.players.forEach(p => { p.hand = []; p.captured = []; p.announced = null; });
    this.phase = 'starter'; this.revision++;
    // Its own seed, so the deck's shuffle is the same with or without the cachos.
    this.starter = createStarter({ seats: this.players.map(p => p.seat), need: 'first', seed: (this.rng ^ Math.imul(this.round + 1, 0x9e3779b1)) >>> 0, option: this.options.starter, last: this.lastPlace });
    if (starterDone(this.starter)) this.beginRound(starterResult(this.starter).order[0]);
    return true;
  }
  // Host only: the cachos on a timer; seats without a pana shake on their own.
  stepStarter(dt) {
    if (this.phase !== 'starter') return false;
    const changed = stepStarter(this.starter, dt, { bots: this.players.filter(p => p.id === null).map(p => p.seat) });
    if (starterDone(this.starter)) { this.beginRound(starterResult(this.starter).order[0]); return true; }
    if (changed) this.revision++;
    return changed;
  }
  beginRound(dealer) {
    this.dealer = dealer;
    this.round++; this.handNumber = 0; this.table = []; this.history = []; this.result = null; this.last = null; this.lastCapture = null;
    this.cutAt = null; this.dealCall = null; this.turn = (this.dealer + 1) % this.players.length;
    this.stock = deck();
    for (let i = this.stock.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [this.stock[i], this.stock[j]] = [this.stock[j], this.stock[i]]; }
    this.players.forEach(p => { p.hand = []; p.captured = []; p.announced = null; }); this.phase = 'dealing';
    this.log('dealer', this.dealer, 'Prepara el reparto');
    this.revision++; return true;
  }
  setCall(seat, call) {
    if (this.phase !== 'dealing' || seat !== this.dealer || !['up', 'down'].includes(call) || call === this.dealCall) return false;
    this.dealCall = call; this.options.call = call; this.revision++; return true;
  }
  cutDeck(seat, at) {
    if (this.phase !== 'dealing' || seat !== this.dealer || this.cutAt !== null || !Number.isInteger(at) || at < 1 || at >= this.stock.length) return false;
    this.stock.push(...this.stock.splice(0, at)); this.cutAt = at;
    this.log('cut', seat, 'Cortó la baraja'); this.revision++; return true;
  }
  dealOpening(seat) {
    if (this.phase !== 'dealing' || seat !== this.dealer || !['up', 'down'].includes(this.dealCall)) return false;
    this.phase = 'playing'; this.deal();
    const calls = this.dealCall === 'up' ? [1, 2, 3, 4] : [4, 3, 2, 1]; let points = 0;
    for (const call of calls) {
      let card = this.stock.shift();
      while (this.table.some(c => c.rank === card.rank)) { this.stock.push(card); card = this.stock.shift(); }
      this.table.push(card); if (card.rank === call) points += call;
    }
    this.log('opening', this.dealer, `${calls.join(' · ')}${points ? ` · ${points} puntos al repartir` : ' · mal echada'}`, { cards: copy(this.table) });
    this.award(points ? this.dealer : this.turn, points || 1, points ? 'Buena echada' : 'Mal echada');
    this.revision++; return true;
  }
  deal() {
    this.handNumber++; this.turn = (this.dealer + 1) % this.players.length;
    this.players.forEach(p => { p.announced = null; });
    for (let n = 0; n < 3; n++) for (let i = 0; i < this.players.length; i++) this.players[(this.turn + i) % this.players.length].hand.push(this.stock.shift());
    this.log('deal', this.turn, this.stock.length === 0 ? '¡Últimas! Sin cuatro de mesa.' : `Mano ${this.handNumber} · tres cartas por pana`);
  }
  chant(seat) {
    const p = this.players[seat];
    if (this.phase !== 'playing' || seat !== this.turn || !this.options.cantos || !p || p.announced || p.hand.length !== 3) return false;
    const value = canto(p.hand); if (!value) return false;
    p.announced = value; this.award(seat, value.points, value.name); this.revision++; return true;
  }
  play(seat, id) {
    if (this.phase !== 'playing' || seat !== this.turn) return false;
    const player = this.players[seat], index = player.hand.findIndex(c => c.id === id);
    if (index < 0) return false;
    const card = player.hand[index], move = previewPlay(this, card, seat);
    const victim = move.fall ? this.last?.seat ?? null : null;   // who dropped the card that fell
    player.hand.splice(index, 1);
    if (player.announced) { const i = player.announced.ranks.indexOf(card.rank); if (i >= 0) player.announced.ranks.splice(i, 1); }
    if (move.capture.length) {
      player.captured.push(card, ...this.table.filter(c => move.capture.includes(c.id)));
      this.table = this.table.filter(c => !move.capture.includes(c.id)); this.lastCapture = seat; this.last = null;
    } else { this.table.push(card); this.last = { id, seat }; }
    this.log('play', seat, `${cardName(card)}${move.capture.length ? ` · recoge ${move.capture.length + 1}` : ' · a la mesa'}`, { card, captured: move.capture, fall: move.fall, clean: move.clean, victim });
    if (move.points) this.award(seat, move.points, [move.fall ? `Caída de ${card.rank === 10 ? 'sota' : card.rank === 11 ? 'caballo' : card.rank === 12 ? 'rey' : card.rank}` : '', move.clean ? 'Mesa limpia' : ''].filter(Boolean).join(' + '));
    if (this.phase !== 'finished') {
      this.turn = (seat + 1) % this.players.length;
      if (this.players.every(p => p.hand.length === 0)) { if (this.stock.length) this.deal(); else this.finishRound(); }
    }
    this.revision++; return true;
  }
  counts() { return this.scores.map((_, team) => this.players.filter(p => teamOf(this, p.seat) === team).reduce((n, p) => n + p.captured.length, 0)); }
  finishRound() {
    const recipient = this.lastCapture ?? this.dealer;
    if (this.table.length) { this.players[recipient].captured.push(...this.table); this.log('leftovers', recipient, `Recoge las ${this.table.length} cartas restantes`); }
    this.table = []; this.last = null;
    const counts = this.counts(), baseline = Math.floor(40 / this.scores.length), bonuses = counts.map(n => Math.max(0, n - baseline));
    // Award in play order so a tied crossing of 24 has a documented precedence.
    for (let i = 0; i < this.players.length; i++) {
      const seat = (this.dealer + 1 + i) % this.players.length, team = teamOf(this, seat);
      if (MODES[this.options.mode].teams && i >= 2) continue;
      this.award(seat, bonuses[team], `${counts[team]} cartas · ${baseline} de base`);
    }
    const winner = this.phase === 'finished' ? this.result.winner : null;
    if (this.phase !== 'finished') this.phase = 'round-over';
    this.result = { winner, reason: 'Conteo de cartas', counts, bonuses, baseline };
  }
  accept(id, data, hostId) {
    if (!Number.isSafeInteger(data.seq) || data.seq <= (this.ledger[id] || 0)) return false;
    const seat = this.players.findIndex(p => p.id === id); let ok = false;
    // Every pana shakes at once, so a cacho never waits for the latest revision.
    if (data.action === 'starter') {
      ok = seat >= 0 && this.phase === 'starter' && starterInput(this.starter, seat, data.cacho, data.power);
      if (ok) { this.ledger[id] = data.seq; this.revision++; }
      return ok;
    }
    if (data.revision !== this.revision) return false;
    if (data.action === 'start' && (id === hostId || (this.phase === 'round-over' && seat === nextDealer(this)))) ok = this.start();
    else if (data.action === 'configure' && id === hostId) ok = this.configure(data.options || {});
    else if (data.action === 'seat' && canMoveSeats(this.players, data.from, data.to, id, hostId)) ok = this.reseat(data.from, data.to);
    else if (data.action === 'setup' && id === hostId) ok = this.setup();
    else if (seat >= 0 && data.action === 'play') ok = this.play(seat, data.card);
    else if (seat >= 0 && data.action === 'chant') ok = this.chant(seat);
    else if (seat >= 0 && data.action === 'call') ok = this.setCall(seat, data.call);
    else if (seat >= 0 && data.action === 'cut') ok = this.cutDeck(seat, data.at);
    else if (seat >= 0 && data.action === 'deal') ok = this.dealOpening(seat);
    if (ok) this.ledger[id] = data.seq; return ok;
  }
  snapshot() { return copy({ ...this }); }
  static restore(snapshot, members) {
    const game = Object.assign(new CaidaGame(), copy(snapshot));
    for (const p of game.players) if (p.id !== null && !members.has(p.id)) game.removePlayer(p.id);
    for (const m of members.values()) game.addPlayer(m.id, m.name, m.avatar || game.players.find(p => p.id === m.id)?.avatar || {});
    return game;
  }
}
