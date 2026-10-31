// Progress is relative to each seat: -1 yard, 0…lap ring, the next five the
// private lane, home after it. Four seats: lap 50, home 56 (ludoTrack(n)).
// A match opens with the 'starter' phase: ¿Quién empieza? (engine/play/quien-empieza-rules.js)
// picks who starts; play then goes clockwise.
export const SEAT_CHOICES = [4, 5, 6];
export const HOME = 56;
export const COLORS = ['#ff4b4b', '#2ad1b2', '#ffc629', '#3d7bf2', '#a46bff', '#ff8a3d'];
// Source text: each client shows it with loc().
export const COLOR_NAMES = [locKey('Rojo'), locKey('Verde'), locKey('Amarillo'), locKey('Azul'), locKey('Morado'), locKey('Naranja')];
export const BOT_NAMES = ['Tito', 'Lola', 'Nina', 'Beto', 'Yoli', 'Cheo'];
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
// extraRolls counts the re-rolls a seat has earned this turn (6s, 1s and
// captures alike) and resets when the turn passes. A 1 only earns another roll
// while the streak is under EXTRA_ONE_CAP, so 1s (or 1s mixed with 6s) cannot
// chain forever. 6s never read it: their limit stays the threeSixes option.
export const EXTRA_ONE_CAP = 3;
export const extraOnOne = options => options?.extraOnOne !== false;
export const seatCount =seats => SEAT_CHOICES.includes(seats) ? seats : 4;
export const seatsOf = state => state.players.length;
// Every seat owns 13 ring cells; its start and start + 8 are safe.
const tracks = new Map();
export function ludoTrack(seats = 4) {
  if (!tracks.has(seats)) {
    const ring = 13 * seats, lap = ring - 2;
    const safe = Array.from({ length: seats }, (_, s) => [13 * s, 13 * s + 8]).flat();
    tracks.set(seats, { seats, ring, lap, home: lap + 6, safe, cells: seats === 4 ? RING : Array.from({ length: ring }, (_, i) => starRingCell(seats, i)) });
  }
  return tracks.get(seats);
}
export const trackOf = state => ludoTrack(seatsOf(state));
export function rotateCell([x, z], seat) {
  for (let i = 0; i < seat; i++) [x, z] = [14 - z, x];
  return [x, z];
}
export const ringIndex = (seat, progress, seats = 4) => (seat * 13 + progress) % (13 * seats);
export function cellFor(seat, progress, piece = 0, seats = 4) {
  if (seats !== 4) return starCell(seats, seat, progress, piece);
  if (progress < 0) return rotateCell([1.5 + piece % 2 * 2, 10.5 + Math.floor(piece / 2) * 2], seat);
  if (progress <= 50) return RING[ringIndex(seat, progress)];
  return rotateCell([7, 64 - progress], seat);
}
// Five and six seats: a star. Each seat owns a three-cell-wide arm around a
// polygon centre and a round yard between its arm and the next. Units are
// cells, centred on 7 like the classic grid; arm 0 points at +z.
export const STAR_YARD = 2.17, STAR_YARD_GAP = .94;
const stars = new Map();
export function starMetrics(seats) {
  if (!stars.has(seats)) {
    const half = Math.PI / seats, apothem = 1.5 / Math.tan(half);
    const yard = Math.max(apothem + 4, (1.5 + STAR_YARD + .17) / Math.sin(half));
    stars.set(seats, { apothem, yard, corner: apothem / Math.cos(half), radius: Math.max(Math.hypot(apothem + 6, 1.5), yard + STAR_YARD) + .56 });
  }
  return stars.get(seats);
}
export const armAngle = (seats, arm) => Math.PI * 2 * arm / seats;
const outward = angle => [-Math.sin(angle), Math.cos(angle)];
const across = angle => [-Math.cos(angle), -Math.sin(angle)];
// lateral -1/0/+1 across the arm, depth 1 (inner) to 6 (tip).
function armCell(seats, arm, lateral, depth) {
  const angle = armAngle(seats, arm), [ox, oz] = outward(angle), [ax, az] = across(angle), u = starMetrics(seats).apothem + depth - .5;
  return [7 + ox * u + ax * lateral, 7 + oz * u + az * lateral];
}
// Ring index 13·seat is a seat's start: two cells in from its arm's tip on the
// way back towards the centre.
function starRingCell(seats, index) {
  const cell = (index + 8) % (13 * seats), arm = Math.floor(cell / 13), step = cell % 13;
  return step < 6 ? armCell(seats, arm, -1, step + 1) : step === 6 ? armCell(seats, arm, 0, 6) : armCell(seats, arm, 1, 13 - step);
}
function starCell(seats, seat, progress, piece) {
  const { lap, home, cells } = ludoTrack(seats), { apothem, yard } = starMetrics(seats);
  if (progress < 0) {
    const angle = armAngle(seats, seat) + Math.PI / seats, [ox, oz] = outward(angle), [ax, az] = across(angle);
    const [h, v] = [[0, -1], [-1, 0], [1, 0], [0, 1]][piece % 4], u = yard + v * STAR_YARD_GAP;
    return [7 + ox * u + ax * h * STAR_YARD_GAP, 7 + oz * u + az * h * STAR_YARD_GAP];
  }
  if (progress <= lap) return cells[ringIndex(seat, progress, seats)];
  if (progress < home) return armCell(seats, seat, 0, home - progress);
  const [ox, oz] = outward(armAngle(seats, seat));
  return [7 + ox * apothem * .58, 7 + oz * apothem * .58];
}
export function legalMoves(state, seat = state.turn) {
  if (state.phase !== 'playing' || state.turn !== seat || !state.die) return [];
  const { home } = trackOf(state);
  return state.players[seat].pieces.flatMap((p, i) =>
    p < 0 ? state.die === 6 || state.die === 1 && state.options?.entry === 'one-six' ? [i] : [] : p < home && p + state.die <= home ? [i] : []);
}
export function chooseMove(state) {
  const { seats, lap, home, safe } = trackOf(state);
  let best = null, score = -Infinity;
  for (const piece of legalMoves(state)) {
    const p = state.players[state.turn].pieces[piece], next = p < 0 ? 0 : p + state.die;
    const index = ringIndex(state.turn, next, seats);
    const capture = next <= lap && !safe.includes(index) && state.players.some((r, s) => s !== state.turn && r.pieces.some(v => v >= 0 && v <= lap && ringIndex(s, v, seats) === index));
    const value = (next === home ? 1000 : 0) + (capture ? 200 : 0) + (p < 0 ? 80 : next) + (safe.includes(index) ? 12 : 0);
    if (value > score) { score = value; best = piece; }
  }
  return best;
}
// Most fichas home first, then the furthest along: the results screen's order.
export function ranking(players) {
  const { home } = ludoTrack(players.length), done = p => p.pieces.filter(v => v === home).length;
  return [...players].sort((a, b) => done(b) - done(a) || b.pieces.reduce((s, v) => s + v, 0) - a.pieces.reduce((s, v) => s + v, 0));
}
export class LudoGame {
  constructor(seed = Date.now(), seats = 4) {
    seats = seatCount(seats);
    this.rng = (seed >>> 0) || 1;
    this.options = { ...defaultLudoOptions(), seats };
    this.players = Array.from({ length: seats }, (_, seat) => botSeat(seat));
    this.phase = 'lobby'; this.turn = 0; this.die = 0; this.lastDie = 0;
    this.sixes = 0; this.extraRolls = 0; this.winner = null; this.revision = 0; this.round = 0;
    this.starter = null; this.lastPlace = null; this.toss = { seat: 0, power: .5 };
    this.resetCounters(); this.autoMove = null;
    this.turnPause = null;
    this.ledger = {}; this.event = [line(locKey('Invita a tus panas o juega con bots.'))];
  }
  snapshot() { return JSON.parse(JSON.stringify(this)); }
  static restore(state, members) {
    const game = Object.assign(new LudoGame(), JSON.parse(JSON.stringify(state)));
    game.options = { ...defaultLudoOptions(), ...game.options, seats: game.players.length };
    for (const p of game.players) if (p.id !== null && !members.has(p.id)) game.removePlayer(p.id);
    for (const m of members.values()) game.addPlayer(m.id, m.name, m.avatar);
    return game;
  }
  addPlayer(id, name, avatar = {}) {
    // A pana arriving at a full lobby pulls up another chair, up to six.
    if (this.phase === 'lobby' && !this.players.some(p => p.id === id || p.id === null)) this.seat(this.players.length + 1);
    const p = this.players.find(p => p.id === id) || this.players.find(p => p.id === null);
    if (!p) return;
    if (p.id === id && p.name === name && JSON.stringify(p.avatar) === JSON.stringify(avatar)) return;
    Object.assign(p, { id, name, avatar }); this.revision++;
  }
  removePlayer(id) {
    const p = this.players.find(p => p.id === id);
    if (p) { p.id = null; p.name = BOT_NAMES[p.seat]; p.avatar = {}; this.revision++; }
  }
  // Lobby only: change the number of seats. Panas keep their seats while they
  // exist; one beyond the new count takes the first bot's seat.
  seat(seats) {
    const humans = this.players.filter(p => p.id !== null);
    if (!SEAT_CHOICES.includes(seats) || humans.length > seats) return false;
    if (seats !== this.players.length) {
      const players = Array.from({ length: seats }, (_, seat) => this.players[seat]?.id != null ? this.players[seat] : botSeat(seat));
      for (const p of humans) if (p.seat >= seats) Object.assign(players.find(q => q.id === null), { id: p.id, name: p.name, avatar: p.avatar });
      this.players = players; this.resetCounters(); this.revision++;
    }
    this.options = { ...this.options, seats };
    return true;
  }
  resetCounters() {
    const zeros = () => this.players.map(() => 0);
    this.entryMisses = zeros(); this.entryLimits = zeros(); this.captures = zeros();
  }
  start() {
    if (!['lobby', 'finished'].includes(this.phase)) return false;
    for (const p of this.players) p.pieces.fill(-1);
    this.turnPause = null;
    this.phase = 'starter'; this.turn = 0; this.die = 0; this.lastDie = 0;
    this.resetCounters(); this.autoMove = null;
    this.sixes = 0; this.extraRolls = 0; this.winner = null; this.round++; this.revision++;
    // Its own seed, so the match's dice stream is the same with or without the cachos.
    this.starter = createStarter({ seats: this.players.map(p => p.seat), need: 'first', seed: (this.rng ^ Math.imul(this.round, 0x9e3779b1)) >>> 0, option: this.options.starter, last: this.lastPlace });
    this.event = [line(locKey('¿Quién empieza? Sacude el cacho: el dado más alto sale primero.'))];
    if (starterDone(this.starter)) this.begin();
    return true;
  }
  // Host only: the cachos on a timer; seats without a pana shake on their own.
  stepStarter(dt) {
    if (this.phase !== 'starter') return false;
    const changed = stepStarter(this.starter, dt, { bots: this.players.filter(p => p.id === null).map(p => p.seat) });
    if (starterDone(this.starter)) this.begin();
    if (changed) this.revision++;
    return changed;
  }
  begin() {
    const { order, rolls } = starterResult(this.starter), first = order[0], p = this.players[first];
    this.phase = 'playing'; this.turn = first; this.sixes = 0; this.extraRolls = 0;
    const how = this.starter.note, roll = rolls[first], vars = { how, name: p.name, roll };
    const opening = how ? roll ? locKey('{how}: ¡Empieza {name} con {roll}!') : locKey('{how}: ¡Empieza {name}!') : roll ? locKey('¡Empieza {name} con {roll}!') : locKey('¡Empieza {name}!');
    this.event = [line(opening, vars), line(this.options.entry === 'six' ? locKey('Saca un seis para salir.') : locKey('Con uno o seis puedes salir.'))];
  }
  nextTurn() { this.turn = (this.turn + 1) % this.players.length; this.die = 0; this.sixes = 0; this.extraRolls = 0; }
  // Same turn, a fresh roll; old snapshots carry no streak, so it counts from 0.
  rollAgain() { this.die = 0; this.extraRolls = (this.extraRolls ?? 0) + 1; }
  // power only changes how the die flies on screen; bots throw with a varied arm.
  roll(power) {
    if (this.phase !== 'playing' || this.die) return false;
    this.turnPause = null;
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    const pieces = this.players[this.turn].pieces, { home } = trackOf(this);
    const stranded = pieces.some(p => p < 0) && pieces.every(p => p < 0 || p === home);
    // Pick a seeded threshold per drought, never by identity or score.
    if (stranded && !this.entryLimits[this.turn]) this.entryLimits[this.turn] = 3 + ((this.rng >>> 8) % 3);
    const assisted = this.options.assistedEntry && stranded && this.entryMisses[this.turn] >= this.entryLimits[this.turn];
    const value = assisted ? 6 : 1 + Math.floor(this.rng / 4294967296 * 6);
    const exits = value === 6 || value === 1 && this.options.entry === 'one-six';
    this.entryMisses[this.turn] = stranded && !exits ? this.entryMisses[this.turn] + 1 : 0;
    if (!stranded || exits) this.entryLimits[this.turn] = 0;
    this.toss = { seat: this.turn, power: cleanPower(power, .35 + (this.rng & 255) / 255 * .6) };
    this.die = value; this.lastDie = this.die;
    this.sixes = this.die === 6 ? this.sixes + 1 : 0;
    this.event = [line(locKey('{name} sacó {n}.'), { name: this.players[this.turn].name, n: this.die })];
    if (assisted) this.event.push(line(locKey('Salida asistida tras varios intentos sin salir.')));
    if (this.sixes === 3 && this.options.threeSixes) { this.event.push(line(locKey('Tres seis seguidos: pierde el turno.'))); this.nextTurn(); }
    else if (!legalMoves(this).length) {
      this.event.push(line(locKey('Sin movimientos.')));
      if (this.die === 6) this.rollAgain(); else this.nextTurn();
    }
    if (!this.die) this.turnPause = {seat:this.toss.seat, kind:'roll', remaining:automaticMoveDelay(this.toss.power)};
    const moves = legalMoves(this);
    // Choosing between identical yard pieces does not change the outcome.
    if (moves.length === 1 || moves.length && moves.every(i => pieces[i] < 0)) {
      this.autoMove = { seat: this.turn, piece: moves[0], remaining: automaticMoveDelay(this.toss.power) };
      this.event.push(line(locKey('Movimiento automático después de ver el dado.')));
    }
    this.revision++; return true;
  }
  // Host only: a pana who leaves their turn waiting past turnSeconds gets the
  // bot's roll or move, so one idle tab never freezes the table. Any change
  // to the game restarts the count.
  stepIdle(dt) {
    const limit = this.options.turnSeconds;
    if (!limit || this.phase !== 'playing' || this.turnPause || this.autoMove || this.players[this.turn].id === null) { this.idle = 0; return false; }
    if (this.idleRevision !== this.revision) { this.idleRevision = this.revision; this.idle = 0; }
    this.idle = (this.idle || 0) + Math.max(0, dt);
    if (this.idle < limit) return false;
    this.idle = 0;
    return this.die ? this.move(chooseMove(this)) : this.roll();
  }
  stepPause(dt) {
    if (!this.turnPause) return false;
    this.turnPause.remaining -= Math.max(0, dt);
    if (this.turnPause.remaining > 0) return false;
    this.turnPause = null; this.revision++; return true;
  }
  stepAutomatic(dt) {
    if (!this.autoMove || this.phase !== 'playing') return false;
    this.autoMove.remaining -= Math.max(0, dt);
    if (this.autoMove.remaining > 0) return false;
    const { seat, piece } = this.autoMove; this.autoMove = null;
    return seat === this.turn && this.move(piece);
  }
  move(piece) {
    if (!Number.isInteger(piece) || !legalMoves(this).includes(piece)) return false;
    this.autoMove = null;
    const p = this.players[this.turn], from = p.pieces[piece], { seats, lap, home, safe } = trackOf(this);
    const next = from < 0 ? 0 : from + this.die, index = ringIndex(this.turn, next, seats); p.pieces[piece] = next;
    let captured = 0;
    if (next <= lap && !safe.includes(index)) {
      for (const rival of this.players) if (rival !== p) rival.pieces = rival.pieces.map(v => {
        if (v >= 0 && v <= lap && ringIndex(rival.seat, v, seats) === index) { captured++; return -1; }
        return v;
      });
    }
    this.turnPause = {seat:p.seat, kind:'move', remaining:movePause(from < 0 ? 1 : next-from, captured)};
    this.captures[this.turn] += captured;
    this.event = [line(next === home ? locKey('{name} llevó una ficha a casa.') : from < 0 ? locKey('{name} sacó una ficha.') : locKey('{name} movió la ficha {n}.'), { name: p.name, n: piece + 1 })];
    if (captured) this.event.push(line(locKey('Capturó {n}.'), { n: captured }));
    if (p.pieces.every(v => v === home)) { this.phase = 'finished'; this.winner = this.turn; this.die = 0; this.lastPlace = ranking(this.players).at(-1).seat; }
    else if (this.die === 6 || captured && this.options.captureBonus || this.die === 1 && extraOnOne(this.options) && (this.extraRolls ?? 0) < EXTRA_ONE_CAP) { this.rollAgain(); this.event.push(line(locKey('Vuelve a tirar.'))); }
    else this.nextTurn();
    this.revision++; return true;
  }
  accept(id, data, hostId) {
    if (!data || !Number.isSafeInteger(data.seq) || data.seq <= (this.ledger[id] || 0)) return false;
    const seat = this.players.findIndex(p => p.id === id);
    if (seat < 0) return false;
    // Every pana shakes at once, so a cacho never waits for the latest revision.
    if (data.action === 'starter') {
      const ok = this.phase === 'starter' && starterInput(this.starter, seat, data.cacho, data.power);
      if (ok) { this.ledger[id] = data.seq; this.revision++; }
      return ok;
    }
    if (data.revision !== this.revision) return false;
    if (this.turnPause && ['roll', 'move'].includes(data.action)) return false;
    let ok = false;
    if (data.action === 'options' && id === hostId && this.phase === 'lobby') {
      const next = ludoOptions(this.options, data.options);
      // Fewer seats than panas already sitting is refused whole.
      if (next && this.seat(next.seats)) { this.options = next; this.revision++; ok = true; }
    }
    else if (data.action === 'start' && id === hostId) ok = this.start();
    else if (data.action === 'roll' && seat === this.turn) ok = this.roll(data.power);
    else if (data.action === 'move' && seat === this.turn) ok = this.move(data.piece);
    if (ok) this.ledger[id] = data.seq;
    return ok;
  }
}
import { defaultLudoOptions, ludoOptions } from './options.js';
import { loc, locKey } from '../../../engine/i18n.js';

// The event line travels as Spanish source sentences plus their values; each
// client joins them in its own language. `how` is the cachos' own source note.
const line = (text, vars) => vars ? { text, vars } : { text };
const botSeat = seat => ({ seat, id: null, name: BOT_NAMES[seat], avatar: {}, pieces: [-1, -1, -1, -1] });
export function eventText(event) {
  const parts = Array.isArray(event) ? event : event ? [{ text: event }] : [];
  return parts.map(({ text, vars }) => loc(text, vars?.how ? { ...vars, how: loc(vars.how) } : vars)).join(' ');
}
import { createStarter, starterInput, stepStarter, starterDone, starterResult } from '../../../engine/play/quien-empieza-rules.js';
import { cleanPower } from '../../../engine/play/dice-throw.js';

import { automaticMoveDelay, movePause } from './dice-timing.js';
