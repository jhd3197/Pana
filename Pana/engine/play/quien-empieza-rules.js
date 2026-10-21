// ¿Quién empieza?: the mini game every turn-based game plays before its first
// turn. Every pana shakes a cacho, slams it on the table, all cachos lift at
// once and the highest die starts. Pure, no Three.js and no DOM: the host (or a
// server room) keeps this object inside the game's snapshot and steps it;
// guests only send 'shake' and 'slam'. engine/play/quien-empieza.js draws it.
//
//   game.starter = createStarter({ seats: [0, 1, 2, 3], need: 'first', seed, option: options.starter });
//   // accept(): starterInput(game.starter, seat, data.cacho, data.power)
//   // host step(dt): stepStarter(game.starter, dt, { bots: seatsWithoutAPana })
//   if (starterDone(game.starter)) begin(starterResult(game.starter).order[0]);
//
// need: 'first' only breaks a tie at the top; 'order' also throws lower ties
// again, so the whole turn order comes out of the cachos.
// option (the room's "¿Quién empieza?" choice): 'cacho' (the show), 'azar'
// (a random order, no show), 'anfitrion' (seat order), 'revancha' (`last`, the
// pana who came last in the previous match, starts; the rest by the cacho).
// flavour: 'cacho', or 'moneda' for two sides: one coin flip, no inputs.
import { rollOffGroups } from './roll-off.js';
import { rng } from '../random.js';

export const STARTER_FIELD = {
  id: 'starter', label: '¿Quién empieza?', default: 'cacho', advanced: true,
  choices: [['cacho', 'Cacho'], ['azar', 'Al azar'], ['anfitrion', 'El anfitrión'], ['revancha', 'Revancha: el que perdió']],
};
// Seconds. Nobody waits for a slow pana: the cacho slams on its own.
export const SHAKE_LIMIT = 8, LIFT = 2.6, ORDER_HOLD = 3, FLIP = 2.8;
// A tie this many times in a row is settled by the seed instead.
const MAX_ROUNDS = 6;

const clean01 = v => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : .5;
const random = (s, salt) => rng((s.seed + Math.imul(salt + 1, 0x9e3779b1)) >>> 0)();
const die = (s, seat) => 1 + Math.floor(random(s, s.round * 97 + seat * 13 + 5) * 6);

function shuffle(s, seats, salt) {
  const list = [...seats];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random(s, salt + i) * (i + 1)); [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// When each bot slams in this round: a random moment between 1.2 and 4.4 s.
function plan(s) {
  s.botAt = Object.fromEntries(s.contenders.map(seat => [seat, 1.2 + random(s, s.round * 31 + seat * 7) * 3.2]));
}

function finish(s, order) {
  s.order = [...order, ...s.late]; s.phase = 'order'; s.t = 0; s.contenders = []; s.shaking = [];
}

export function createStarter({ seats, need = 'first', seed = 1, option = 'cacho', flavour = 'cacho', last = null }) {
  const s = {
    seats: [...seats], need: need === 'order' ? 'order' : 'first', seed: seed >>> 0 || 1,
    option: STARTER_FIELD.choices.some(([v]) => v === option) ? option : 'cacho',
    flavour: flavour === 'moneda' && seats.length === 2 ? 'moneda' : 'cacho',
    phase: 'shake', t: 0, round: 1, lead: [], late: [], groups: [], contenders: [],
    shaking: [], slammed: {}, rolls: {}, history: [], botAt: {}, coin: null, order: null, note: '',
  };
  if (s.option === 'azar' || s.option === 'anfitrion' || s.seats.length < 2) {
    finish(s, s.option === 'azar' ? shuffle(s, s.seats, 404) : s.seats); s.phase = 'done';
    s.note = s.option === 'azar' ? 'Orden al azar' : s.option === 'anfitrion' ? 'Orden de la mesa' : '';
    return s;
  }
  if (s.option === 'revancha' && s.seats.includes(last)) s.lead = [last];
  s.groups = [s.seats.filter(seat => !s.lead.includes(seat))];
  if (s.groups[0].length < 2) { finish(s, [...s.lead, ...s.groups[0]]); s.phase = 'done'; return s; }
  s.contenders = [...s.groups[0]];
  if (s.flavour === 'moneda') {
    // Cara for the first side, sello for the second; everybody watches it spin.
    s.coin = random(s, 77) < .5 ? 'cara' : 'sello';
    const [a, b] = s.contenders, won = s.coin === 'cara' ? a : b;
    s.rolls = { [a]: won === a ? 2 : 1, [b]: won === b ? 2 : 1 };
    s.history.push({ round: 1, rolls: { ...s.rolls } }); s.phase = 'lift';
    return s;
  }
  plan(s);
  return s;
}

// A pana shaking ('shake') or slamming ('slam', with the throw's power). Only a
// contender who has not slammed yet in this round counts.
export function starterInput(s, seat, kind, power) {
  if (!s || s.phase !== 'shake' || !s.contenders.includes(seat) || seat in s.slammed) return false;
  if (kind === 'shake') {
    if (s.shaking.includes(seat)) return false;
    s.shaking.push(seat); return true;
  }
  if (kind !== 'slam') return false;
  slam(s, seat, clean01(power));
  return true;
}

function slam(s, seat, power) {
  s.shaking = s.shaking.filter(x => x !== seat); s.slammed[seat] = power;
  if (!s.contenders.every(c => c in s.slammed)) return;
  // Everyone is down: the rules pick the numbers now, under the cups.
  for (const c of s.contenders) s.rolls[c] = die(s, c);
  s.history.push({ round: s.round, rolls: Object.fromEntries(s.contenders.map(c => [c, s.rolls[c]])) });
  s.phase = 'lift'; s.t = 0;
}

// The throwing groups: 'first' only breaks the top, 'order' every tie.
const open = s => s.need === 'order' ? s.groups.filter(g => g.length > 1) : s.groups[0].length > 1 ? [s.groups[0]] : [];

function settle(s) {
  const thrown = new Set(s.contenders);
  s.groups = s.groups.flatMap(g => g.some(seat => thrown.has(seat)) ? rollOffGroups(g.map(id => ({ id, value: s.rolls[id] }))) : [g]);
  let ties = open(s);
  if (ties.length && s.round >= MAX_ROUNDS) {
    s.groups = s.groups.map(g => g.length > 1 ? shuffle(s, g, 900 + s.round) : g).flatMap(g => g.map(seat => [seat]));
    ties = [];
  }
  if (!ties.length) { finish(s, [...s.lead, ...s.groups.flat()]); return; }
  // Only the tied panas shake again; the rest watch and heckle.
  s.round++; s.phase = 'shake'; s.t = 0; s.contenders = ties.flat(); s.shaking = []; s.slammed = {};
  plan(s);
}

// Host only, on a timer. bots: seats with nobody at them (a pana who left
// counts as one), which shake for a moment and slam on their own. Returns true
// when something players can see changed, so the host publishes then and not
// on every tick.
export function stepStarter(s, dt, { bots = [] } = {}) {
  if (!s || s.phase === 'done') return false;
  s.t += Math.max(0, dt) || 0;
  let changed = false;
  if (s.phase === 'shake') {
    for (const seat of s.contenders) {
      if (seat in s.slammed || s.phase !== 'shake') continue;
      const bot = bots.includes(seat);
      if (bot && !s.shaking.includes(seat) && s.t >= s.botAt[seat] * .4) { s.shaking.push(seat); changed = true; }
      if (bot ? s.t >= s.botAt[seat] : s.t >= SHAKE_LIMIT) {
        slam(s, seat, bot ? .35 + random(s, s.round * 53 + seat) * .6 : .5); changed = true;
      }
    }
  } else if (s.phase === 'lift' && s.t >= (s.flavour === 'moneda' ? FLIP : LIFT)) { settle(s); changed = true; }
  else if (s.phase === 'order' && s.t >= ORDER_HOLD) { s.phase = 'done'; changed = true; }
  return changed;
}

// A pana who sits down after the cachos started goes at the end of the order.
export function joinStarter(s, seat) {
  if (!s || s.seats.includes(seat) || s.late.includes(seat)) return false;
  s.late.push(seat); if (s.order) s.order.push(seat);
  return true;
}

export const starterDone = s => !!s && s.phase === 'done';
export const starterShowing = s => !!s && s.phase !== 'done';

// { order: [seat, …], rolls: { seat: last value } }; order[0] starts. Null until done.
export function starterResult(s) {
  return starterDone(s) ? { order: [...s.order], rolls: { ...s.rolls }, coin: s.coin } : null;
}

// What each pana says when the cachos lift: a six, a one, a tie, the winner
// and a sore loser. Pure, so every screen shows the same lines.
export function starterBarks(s) {
  if (!s || s.phase !== 'lift' || s.flavour === 'moneda') return [];
  const thrown = s.history.at(-1)?.rolls || {}, seats = Object.keys(thrown).map(Number);
  const top = Math.max(...seats.map(seat => thrown[seat])), best = seats.filter(seat => thrown[seat] === top);
  const lines = new Map();
  for (const seat of seats) {
    if (thrown[seat] === 6) lines.set(seat, '¡Seis! ¿Quién te para?');
    else if (thrown[seat] === 1) lines.set(seat, 'Uno… qué pava.');
  }
  if (best.length > 1) lines.set(best[0], '¡Empate! Otra vez, pues.');
  else if (!s.lead.length && s.groups[0].includes(best[0])) {
    if (!lines.has(best[0])) lines.set(best[0], '¡Sale primero!');
    const low = Math.min(...seats.map(seat => thrown[seat])), loser = seats.find(seat => thrown[seat] === low && seat !== best[0]);
    if (loser !== undefined && !lines.has(loser)) lines.set(loser, 'Eso fue trampa.');
  }
  return [...lines].map(([seat, text]) => ({ seat, text }));
}
