// Progress is relative to each seat: -1 yard, 0–50 ring, 51–55 lane, 56 home.
// A match opens with the 'order' phase: everyone throws once, the highest starts.
export const HOME = 56;
export const COLORS = ['#ff4b4b', '#2ad1b2', '#ffc629', '#3d7bf2'];
export const COLOR_NAMES = ['Rojo', 'Verde', 'Amarillo', 'Azul'];
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
export const RING = [
  [6,13],[6,12],[6,11],[6,10],[6,9],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],
  [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],
];
export function rotateCell([x, z], seat) {
  for (let i = 0; i < seat; i++) [x, z] = [14 - z, x];
  return [x, z];
}
export const ringIndex = (seat, progress) => (seat * 13 + progress) % 52;
export function cellFor(seat, progress, piece = 0) {
  if (progress < 0) return rotateCell([2 + piece % 2 * 2, 10 + Math.floor(piece / 2) * 2], seat);
  if (progress <= 50) return RING[ringIndex(seat, progress)];
  return rotateCell([7, 64 - progress], seat);
}
export function legalMoves(state, seat = state.turn) {
  if (state.phase !== 'playing' || state.turn !== seat || !state.die) return [];
  return state.players[seat].pieces.flatMap((p, i) =>
    p < 0 ? state.die === 6 || state.die === 1 && state.options?.entry === 'one-six' ? [i] : [] : p < HOME && p + state.die <= HOME ? [i] : []);
}
export function chooseMove(state) {
  let best = null, score = -Infinity;
  for (const piece of legalMoves(state)) {
    const p = state.players[state.turn].pieces[piece], next = p < 0 ? 0 : p + state.die;
    const index = ringIndex(state.turn, next);
    const capture = next <= 50 && !SAFE.includes(index) && state.players.some((r, s) => s !== state.turn && r.pieces.some(v => v >= 0 && v <= 50 && ringIndex(s, v) === index));
    const value = (next === HOME ? 1000 : 0) + (capture ? 200 : 0) + (p < 0 ? 80 : next) + (SAFE.includes(index) ? 12 : 0);
    if (value > score) { score = value; best = piece; }
  }
  return best;
}
export class LudoGame {
  constructor(seed = Date.now()) {
    this.rng = (seed >>> 0) || 1;
    this.options = defaultLudoOptions();
    this.players = ['Tito', 'Lola', 'Nina', 'Beto'].map((name, seat) => ({ seat, id: null, name, avatar: {}, pieces: [-1,-1,-1,-1] }));
    this.phase = 'lobby'; this.turn = 0; this.die = 0; this.lastDie = 0;
    this.sixes = 0; this.winner = null; this.revision = 0; this.round = 0;
    this.order = null; this.toss = { seat: 0, power: .5 };
    this.ledger = {}; this.event = 'Invita a tus panas o juega con bots.';
  }
  snapshot() { return JSON.parse(JSON.stringify(this)); }
  static restore(state, members) {
    const game = Object.assign(new LudoGame(), JSON.parse(JSON.stringify(state)));
    for (const p of game.players) if (p.id !== null && !members.has(p.id)) game.removePlayer(p.id);
    for (const m of members.values()) game.addPlayer(m.id, m.name, m.avatar);
    return game;
  }
  addPlayer(id, name, avatar = {}) {
    const p = this.players.find(p => p.id === id) || this.players.find(p => p.id === null);
    if (!p) return;
    if (p.id === id && p.name === name && JSON.stringify(p.avatar) === JSON.stringify(avatar)) return;
    Object.assign(p, { id, name, avatar }); this.revision++;
  }
  removePlayer(id) {
    const p = this.players.find(p => p.id === id);
    if (p) { p.id = null; p.name = ['Tito', 'Lola', 'Nina', 'Beto'][p.seat]; p.avatar = {}; this.revision++; }
  }
  start() {
    if (!['lobby', 'finished'].includes(this.phase)) return false;
    for (const p of this.players) p.pieces.fill(-1);
    this.phase = 'order'; this.turn = 0; this.die = 0; this.lastDie = 0;
    this.sixes = 0; this.winner = null; this.round++; this.revision++;
    this.order = { rolls: [0, 0, 0, 0], contenders: [0, 1, 2, 3] };
    this.event = '¿Quién empieza? Cada pana tira el dado: el más alto sale primero.'; return true;
  }
  // One throw of the roll-off. A tie at the top throws again, only among the tied.
  orderRoll(value) {
    const { rolls, contenders } = this.order, p = this.players[this.turn];
    rolls[this.turn] = value; this.event = `${p.name} sacó ${value}.`;
    const next = contenders.find(seat => !rolls[seat]);
    if (next !== undefined) { this.turn = next; return; }
    const [top] = rollOffGroups(contenders.map(seat => ({ id: seat, value: rolls[seat] })));
    if (top.length > 1) {
      this.event += ` Empate a ${rolls[top[0]]} entre ${namesList(top.map(seat => this.players[seat].name))}: tiran otra vez.`;
      for (const seat of top) rolls[seat] = 0;
      this.order.contenders = top; this.turn = top[0];
      return;
    }
    this.phase = 'playing'; this.turn = top[0]; this.sixes = 0;
    this.event += ` ¡Empieza ${this.players[top[0]].name} con ${rolls[top[0]]}! ${this.options.entry === 'six' ? 'Saca un seis para salir.' : 'Con uno o seis puedes salir.'}`;
  }
  nextTurn() { this.turn = (this.turn + 1) % 4; this.die = 0; this.sixes = 0; }
  // power only changes how the die flies on screen; bots throw with a varied arm.
  roll(power) {
    if (!['playing', 'order'].includes(this.phase) || this.die) return false;
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    const value = 1 + Math.floor(this.rng / 4294967296 * 6);
    this.toss = { seat: this.turn, power: cleanPower(power, .35 + (this.rng & 255) / 255 * .6) };
    if (this.phase === 'order') { this.lastDie = value; this.orderRoll(value); this.revision++; return true; }
    this.die = value; this.lastDie = this.die;
    this.sixes = this.die === 6 ? this.sixes + 1 : 0;
    this.event = `${this.players[this.turn].name} sacó ${this.die}.`;
    if (this.sixes === 3 && this.options.threeSixes) { this.event += ' Tres seis seguidos: pierde el turno.'; this.nextTurn(); }
    else if (!legalMoves(this).length) {
      this.event += ' Sin movimientos.';
      if (this.die === 6) this.die = 0; else this.nextTurn();
    }
    this.revision++; return true;
  }
  move(piece) {
    if (!Number.isInteger(piece) || !legalMoves(this).includes(piece)) return false;
    const p = this.players[this.turn], from = p.pieces[piece];
    const next = from < 0 ? 0 : from + this.die; p.pieces[piece] = next;
    let captured = 0;
    if (next <= 50 && !SAFE.includes(ringIndex(this.turn, next))) {
      for (const rival of this.players) if (rival !== p) rival.pieces = rival.pieces.map(v => {
        if (v >= 0 && v <= 50 && ringIndex(rival.seat, v) === ringIndex(this.turn, next)) { captured++; return -1; }
        return v;
      });
    }
    this.event = `${p.name} ${next === HOME ? 'llevó una ficha a casa' : from < 0 ? 'sacó una ficha' : `movió la ficha ${piece + 1}`}.${captured ? ` Capturó ${captured}.` : ''}`;
    if (p.pieces.every(v => v === HOME)) { this.phase = 'finished'; this.winner = this.turn; this.die = 0; }
    else if (this.die === 6 || captured && this.options.captureBonus) { this.die = 0; this.event += ' Vuelve a tirar.'; }
    else this.nextTurn();
    this.revision++; return true;
  }
  accept(id, data, hostId) {
    if (!data || !Number.isSafeInteger(data.seq) || data.seq <= (this.ledger[id] || 0) || data.revision !== this.revision) return false;
    const seat = this.players.findIndex(p => p.id === id);
    if (seat < 0) return false;
    let ok = false;
    if (data.action === 'options' && id === hostId && this.phase === 'lobby') {
      const next = ludoOptions(this.options, data.options);
      if (next) { this.options = next; this.revision++; ok = true; }
    }
    else if (data.action === 'start' && id === hostId) ok = this.start();
    else if (data.action === 'roll' && seat === this.turn) ok = this.roll(data.power);
    else if (data.action === 'move' && seat === this.turn) ok = this.move(data.piece);
    if (ok) this.ledger[id] = data.seq;
    return ok;
  }
}
import { defaultLudoOptions, ludoOptions } from './options.js';
import { rollOffGroups, namesList } from '../../../engine/play/roll-off.js';
import { cleanPower } from '../../../engine/play/dice-throw.js';
