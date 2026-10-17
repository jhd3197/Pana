import { validTableArena } from '../../../engine/arena-layouts.js';
// House rules are explicit in the UI: team block dominoes, opponents' pips score.
// Pure data and deterministic shuffling keep host migration lossless.
export const TARGET = 100;
export const BOT_NAMES = ['Coco', 'Lola', 'Tito', 'Nina'];
export const deck = () => Array.from({ length: 7 }, (_, a) =>
  Array.from({ length: 7 - a }, (_, b) => ({ id: `${a}-${a + b}`, a, b: a + b }))).flat();
export const pips = hand => hand.reduce((sum, t) => sum + t.a + t.b, 0);
const copy = value => JSON.parse(JSON.stringify(value));

export function legalEnds(state, tile) {
  if (!tile || state.phase !== 'playing') return [];
  if (!state.chain.length) return state.round !== 1 || tile.id === '6-6' ? ['right'] : [];
  const left = state.chain[0].a, right = state.chain.at(-1).b;
  return [tile.a === left || tile.b === left ? 'left' : null,
    tile.a === right || tile.b === right ? 'right' : null].filter(Boolean);
}

export function legalMoves(state, seat = state.turn) {
  if (state.phase !== 'playing' || !state.players[seat]) return [];
  return state.players[seat].hand.flatMap(t => legalEnds(state, t).map(end => ({ tile: t.id, end })));
}

// Only this seat's hand and the public chain affect the bot's choice.
export function chooseMove(state, seat = state.turn) {
  const hand = state.players[seat].hand;
  const frequency = Array(7).fill(0);
  hand.forEach(t => { frequency[t.a]++; frequency[t.b]++; });
  const score = move => {
    const tile = hand.find(t => t.id === move.tile);
    const end = state.chain.length ? (move.end === 'left' ? state.chain[0].a : state.chain.at(-1).b) : tile.a;
    const exposed = tile.a === end ? tile.b : tile.a;
    return tile.a + tile.b + (tile.a === tile.b ? 3 : 0) + frequency[exposed] * 1.6;
  };
  return legalMoves(state, seat).sort((a, b) => score(b) - score(a))[0] || null;
}

export class DominoGame {
  constructor(seed = 1) {
    this.rng = seed >>> 0 || 1;
    this.mapId = 'plaza'; this.phase = 'lobby'; this.round = 0; this.scores = [0, 0];
    this.players = BOT_NAMES.map((name, seat) => ({ id: null, name, avatar: {}, seat, hand: [] }));
    this.chain = []; this.turn = 0; this.starter = 0; this.passes = 0;
    this.revision = 0; this.ledger = {}; this.history = []; this.result = null;
  }

  random() {
    let n = this.rng; n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.rng = n >>> 0; return this.rng / 4294967296;
  }

  addPlayer(id, name, avatar = {}) {
    const player = this.players.find(p => p.id === id) || this.players.find(p => p.id === null);
    if (!player) return false; // Fifth and later arrivals watch, never reset the round.
    const changed = player.id !== id || player.name !== name || JSON.stringify(player.avatar) !== JSON.stringify(avatar);
    Object.assign(player, { id, name: String(name).slice(0, 16), avatar });
    if (changed) this.revision++;
    return true;
  }

  removePlayer(id) {
    const player = this.players.find(p => p.id === id);
    if (!player) return;
    Object.assign(player, { id: null, name: BOT_NAMES[player.seat], avatar: {} });
    this.revision++;
  }

  start() {
    if (this.phase === 'playing') return false;
    if (this.phase === 'finished') { this.round = 0; this.scores = [0, 0]; this.starter = 0; }
    this.round++; this.chain = []; this.passes = 0; this.result = null; this.history = [];
    const tiles = deck();
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    this.players.forEach((p, i) => { p.hand = tiles.slice(i * 7, i * 7 + 7).sort((a, b) => a.a - b.a || a.b - b.b); });
    if (this.round === 1) this.starter = this.players.findIndex(p => p.hand.some(t => t.id === '6-6'));
    this.turn = this.starter; this.phase = 'playing'; this.revision++;
    return true;
  }

  play(seat, tileId, end) {
    if (this.phase !== 'playing' || seat !== this.turn || !this.players[seat]) return false;
    const hand = this.players[seat].hand, index = hand.findIndex(t => t.id === tileId), tile = hand[index];
    if (!legalEnds(this, tile).includes(end)) return false;
    const placed = { ...tile, seat };
    if (this.chain.length) {
      if (end === 'left' && placed.b !== this.chain[0].a || end === 'right' && placed.a !== this.chain.at(-1).b)
        [placed.a, placed.b] = [placed.b, placed.a];
    }
    end === 'left' ? this.chain.unshift(placed) : this.chain.push(placed);
    hand.splice(index, 1); this.passes = 0;
    this.record({ kind: 'play', seat, name: this.players[seat].name, tile: { ...tile }, end });
    this.revision++;
    if (!hand.length) this.finish(seat % 2, 'out', seat);
    else this.turn = (seat + 1) % 4;
    return true;
  }

  pass(seat) {
    if (this.phase !== 'playing' || seat !== this.turn || legalMoves(this, seat).length) return false;
    this.passes++; this.revision++;
    this.record({ kind: 'pass', seat, name: this.players[seat].name });
    if (this.passes === 4) {
      const sums = this.teamPips();
      const winner = sums[0] === sums[1] ? null : sums[0] < sums[1] ? 0 : 1;
      const opener = winner === null ? (this.starter + 1) % 4 :
        this.players.filter(p => p.seat % 2 === winner).sort((a, b) => pips(a.hand) - pips(b.hand))[0].seat;
      this.finish(winner, 'blocked', opener);
    } else this.turn = (seat + 1) % 4;
    return true;
  }

  teamPips() { return [0, 1].map(team => this.players.filter(p => p.seat % 2 === team).reduce((sum, p) => sum + pips(p.hand), 0)); }

  finish(winner, reason, starter) {
    const remaining = this.teamPips(), points = winner === null ? 0 : remaining[1 - winner];
    if (winner !== null) this.scores[winner] += points;
    this.result = { winner, reason, points, remaining, seat: starter };
    this.starter = starter; this.phase = this.scores.some(s => s >= TARGET) ? 'finished' : 'round-over';
  }

  record(event) { this.history.push(event); if (this.history.length > 32) this.history.shift(); }

  accept(id, data, hostId) {
    if (!Number.isSafeInteger(data.seq) || data.seq <= (this.ledger[id] || 0) || data.revision !== this.revision) return false;
    const seat = this.players.findIndex(p => p.id === id);
    let accepted = false;
    if (data.action === 'start' && id === hostId) accepted = this.start();
    else if (data.action === 'map' && id === hostId && this.phase === 'lobby' && validTableArena(data.mapId)) {
      this.mapId = data.mapId; this.revision++; accepted = true;
    }
    else if (seat >= 0 && data.action === 'play') accepted = this.play(seat, data.tile, data.end);
    else if (seat >= 0 && data.action === 'pass') accepted = this.pass(seat);
    if (accepted) this.ledger[id] = data.seq;
    return accepted;
  }

  snapshot() { return copy({ ...this }); }

  static restore(snapshot, members) {
    const game = Object.assign(new DominoGame(), copy(snapshot));
    for (const p of game.players) if (p.id !== null && !members.has(p.id)) game.removePlayer(p.id);
    for (const m of members.values()) game.addPlayer(m.id, m.name, m.avatar || game.players.find(p => p.id === m.id)?.avatar || {});
    return game;
  }
}
