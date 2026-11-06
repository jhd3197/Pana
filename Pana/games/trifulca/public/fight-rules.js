import { ATTACK_TIMING } from './attack-timing.js';
// Trifulca's fight: two bodies, four buttons, mareo, caídas and the ring.
// Pure data (no DOM, no Three.js) so the host, the screen and Node tests share
// it. rules.js owns the night around it: the queue, bets, dolitas, phases.
import { clamp } from '/engine/random.js';

// Centres closer than BODY_GAP ease apart along the line between them, each at
// most SEPARATE m/s: a deep overlap (a tag-in, a fling) slides out over a few
// ticks, while walking in, even on a trompón's lunge, still stops at the gap.
// It is two helmets side on (fighter-look.js HEAD_REACH) plus a sliver of air.
export const BODY_GAP = 1.4, SEPARATE = 5;

// Seconds and metres. Every attack shows its windup before it can land; reach
// counts from the gap, so a fist always lands on a body it can't walk through.
export const T = {
  kick: { active: [ATTACK_TIMING.kick.impact, ATTACK_TIMING.kick.release], total: ATTACK_TIMING.kick.total, reach: BODY_GAP + 1, mareo: 19, push: 4, stun: .4, cost: 20, whiff: .22 },
  sweep: { active: [ATTACK_TIMING.sweep.impact, ATTACK_TIMING.sweep.release], total: ATTACK_TIMING.sweep.total, reach: BODY_GAP + .6, mareo: 13, push: 2.4, stun: .7, cost: 25, whiff: .22 },
  toss: { active: [ATTACK_TIMING.toss.impact, ATTACK_TIMING.toss.release], total: ATTACK_TIMING.toss.total, reach: BODY_GAP + .25, mareo: 17, push: 3, stun: .9, cost: 30, whiff: .22 },
  hold: .16,            // golpe held longer than this is a trompón
  jab: { active: [ATTACK_TIMING.jab.impact, ATTACK_TIMING.jab.release], total: .36, reach: BODY_GAP + .6, mareo: 8, push: 2, stun: .24, whiff: .12 },
  wind: .43,            // .43 windup + .12 extension preserves the .55 s warning
  trompon: { active: [ATTACK_TIMING.trompon.impact, ATTACK_TIMING.trompon.release], total: .5, reach: BODY_GAP + .7, mareo: 24, push: 7.5, stun: .7, open: .4, whiff: .18 },
  grab: { active: [ATTACK_TIMING.grab.impact, ATTACK_TIMING.grab.release], total: .55, reach: BODY_GAP + .4, mareo: 5, push: 7, stun: .55, whiff: .15 },
  dodge: { total: .42, safe: [.03, .34], speed: 4.6 },
  // A tap is remembered this long; one made from contact on waits for the end
  // of that attack. A clean hit's recovery can be cut short by one timed tap,
  // which earns the next attack extra reach and mareo; the third hit finishes.
  buffer: .3, combo: { window: .4, reach: [0, .2, .35], mareo: [1, 1.15, 1.35], finish: 1.6 },
  taunt: 1, rise: 1, dizzy: 2.1, counter: 6, contra: .8, contraMareo: 14,
  chip: { jab: 1.5, trompon: 6, kick: 3, sweep: 2 }, guard: { jab: 12, trompon: 40, kick: 22, sweep: 18 },
};
// Cue only when a fresh dodge can still cover the heavy punch's impact.
export const dodgeCue = b => {
  if (b?.act === 'wind') return b.at >= T.wind + T.trompon.active[0] - T.dodge.safe[1] + .04;
  if (!['trompon', 'kick', 'sweep', 'toss'].includes(b?.act) || b.landed) return false;
  return b.at < T[b.act].active[0] && b.at >= Math.max(0, T[b.act].active[0] - T.dodge.safe[1] + .04);
};
export const SPEED = { forward: 2.7, back: 2.2, side: 2.4 };
export const MAREO_MAX = 100, MAREO_CALMA = 75, KO_CAIDAS = 3, COUNT_STEP = .85;
// A body flung out of a circle ring stops here: the neighbours stand further out.
export const EDGE_LIMIT = 1;

// The ring is the panas. `circle` arenas have a human ring (shoved back in by
// the crowd); the tent's ring has ropes that bounce.
export const ARENAS = {
  calle: { shape: 'circle', r: 4.3, twist: 'moto' },
  toldo: { shape: 'square', half: 2.9, twist: 'ropes' },
  mercado: { shape: 'circle', r: 4.1, twist: 'cajas' },
  motos: { shape: 'circle', r: 4.5, twist: 'domino' },
  manga: { shape: 'circle', r: 4.6, twist: 'toro' },
  cebra: { shape: 'circle', r: 4.2, twist: 'pito' },
  colonial: { shape: 'circle', r: 4.3, twist: 'balde' },
};
export const arenaOf = (id) => ARENAS[id] || ARENAS.calle;
// The map a state shows: this fight's, or the host's pinned one; while the night
// rotates there's none yet, so the lobby stays on `shown`.
export const arenaIdOf = (state, shown = 'calle') => state.arenaNow || (ARENAS[state.options?.arena] ? state.options.arena : shown);

// How far outside the ring a point is (negative inside) and the way back in.
export function edge(arena, x, z) {
  if (arena.shape === 'square') {
    const ax = Math.abs(x), az = Math.abs(z), out = Math.max(ax, az) - arena.half;
    return ax > az ? { out, nx: -Math.sign(x) || -1, nz: 0 } : { out, nx: 0, nz: -Math.sign(z) || -1 };
  }
  const d = Math.hypot(x, z) || 1e-6;
  return { out: d - arena.r, nx: -x / d, nz: -z / d };
}
// Where the crowd stands: just outside the ring, at an angle.
export function crowdSpot(arena, angle) {
  const r = arena.shape === 'square' ? arena.half * 1.12 + 1.1 : arena.r + .95;
  return { x: Math.sin(angle) * r, z: Math.cos(angle) * r };
}

// Corners in the order fighters step in: two face off across X; Trifulca
// libre adds two more across Z.
export const CORNERS = ['red', 'blue', 'yellow', 'green'];
const CORNER_ANGLE = { red: -Math.PI / 2, blue: Math.PI / 2, yellow: Math.PI, green: 0 };
export function newBody(id, corner, arena, team = corner) {
  const a = CORNER_ANGLE[corner] ?? 0, start = arena.shape === 'square' ? 1.7 : 1.9;
  const x = Math.round(Math.sin(a) * start * 1000) / 1000, z = Math.round(Math.cos(a) * start * 1000) / 1000;
  return { id, corner, team, x, z, h: Math.atan2(-x, -z), vx: 0, vz: 0,
    act: 'idle', at: 0, motion: 0, landed: false, charge: -1, buffer: 0, queued: null, pressAge: 0, dodgeDir: 0,
    chain: 0, chainLeft: 0, combo: 0, clean: false, tapped: 0, mashed: false,
    mareo: 0, aguante: 100, stun: 0, caidas: 0, inv: 0, outside: 0,
    down: null, moving: 0, blockHit: 0, lastHit: 9, foe: null, prop: null, out: false, bench: false, downBy: null,
    score: { kicks: 0, sweeps: 0, tosses: 0, jabs: 0, trompones: 0, caidas: 0, forward: 0, blocks: 0 }, thrown: 0 };
}
// Who is actually fighting now: not knocked out of a free-for-all, not
// waiting on the apron for a tag.
export const inRing = (b) => !b.out && !b.bench;

const BUSY = new Set(['kick', 'sweep', 'toss', 'tumble', 'jab', 'wind', 'trompon', 'grab', 'dodge', 'stun', 'dizzy', 'down', 'rise', 'taunt', 'open', 'throw']);
const canAct = (b) => !BUSY.has(b.act);
const setAct = (b, act) => {
  if (['jab', 'wind', 'kick', 'sweep', 'toss'].includes(act)) b.motion = (b.motion || 0) + 1;
  b.act = act; b.at = 0; b.landed = false;
};
const facing = (b) => ({ fx: Math.sin(b.h), fz: Math.cos(b.h) });
const shake = (b, pushX, pushZ) => { b.vx += pushX; b.vz += pushZ; };

// The button edges a tick brings: counters that changed since last time.
export function presses(last, input) {
  const delta = (k) => ((input[k] | 0) - (last[k] | 0) + 256) % 256;
  const out = { gp: delta('gp'), e: delta('e'), a: delta('a'), t: delta('t'), k: delta('k'), s: delta('s'), v: delta('v') };
  for (const k of ['gp', 'e', 'a', 't', 'k', 's', 'v']) last[k] = input[k] | 0;
  return out;
}

const ATTACK_ACTS = new Set(['jab', 'wind', 'trompon', 'kick', 'sweep', 'toss']);
const QUEUE_KEYS = ['gp', 'a', 'v', 's', 'k', 'e']; // the last wins: a dodge beats an attack pressed on the same tick
const MOVE_KEYS = { k: 'kick', s: 'sweep', v: 'toss' };
const attackKey = (key) => key === 'gp' || key in MOVE_KEYS;
// When the attack in progress ends: a whiff stays exposed for longer.
const attackEnd = (b) => T[b.act].total + (b.landed ? 0 : T[b.act].whiff || 0);

// A press is remembered until the fighter can act, so a tap never needs to hit
// a free tick exactly. Tapping before contact, or more than once per attack, is
// mashing: it still fires after the recovery, but earns no chain.
function remember(b, press) {
  for (const key of QUEUE_KEYS) {
    if (!press[key]) continue;
    let keep = T.buffer;
    if (ATTACK_ACTS.has(b.act) && attackKey(key)) {
      const contact = b.act !== 'wind' && (b.landed || b.at >= T[b.act].active[0]);
      if (!contact || b.tapped > 0 || press[key] > 1) b.mashed = true;
      b.tapped++;
      if (contact) keep = Math.max(keep, attackEnd(b) - b.at + .05);
    }
    b.queued = key; b.buffer = keep; b.pressAge = 0;
  }
}
const forget = (b) => { b.queued = null; b.buffer = 0; };
// A clean hit may skip what is left of its recovery, once its contact is over.
const chainReady = (b) => b.clean && !b.mashed && ATTACK_ACTS.has(b.act) && b.act !== 'wind' && b.at >= T[b.act].active[1];
// An attack starting now continues the chain only if it was timed.
function armCombo(b) {
  b.combo = b.chainLeft > 0 && !b.mashed ? b.chain : 0;
  if (!b.combo) { b.chain = 0; b.chainLeft = 0; }
  b.mashed = false; b.tapped = 0; b.clean = false;
}

// One fighter's buttons for this tick: start, hold and release actions.
export function control(b, input, press, emit) {
  if (b.act === 'down') {
    // Mash anything to get up before ten.
    b.down.mash += (press.gp || 0) + (press.e || 0) + (press.a || 0) + (press.k || 0) + (press.s || 0) + (press.v || 0);
    forget(b);
    return;
  }
  remember(b, press);
  const free = canAct(b) || b.act === 'block', wants = b.buffer > 0 ? b.queued : null;
  const go = free || (chainReady(b) && attackKey(wants));
  if (wants === 'e' && free) { b.charge = -1; forget(b); startDodge(b, input); emit({ type: 'dodge', id: b.id }); return; }
  if (wants in MOVE_KEYS && go) {
    const act = MOVE_KEYS[wants];
    forget(b);
    if (!b.prop && b.aguante >= T[act].cost) {
      b.charge = -1; b.aguante -= T[act].cost;
      armCombo(b); setAct(b, act); emit({ type: 'move', id: b.id, move: act }); return;
    }
  }
  if (b.charge >= 0) {
    b.charge += .05;
    const can = free || chainReady(b);
    if (!input.g && b.charge < T.hold + .05) {
      b.charge = -1;
      if (can) startJab(b, emit);
      else { b.queued = 'gp'; b.buffer = T.buffer; b.pressAge = T.hold; } // hit while deciding: the tap still counts
    } else if (input.g && b.charge >= T.hold) { b.charge = -1; if (can) startWind(b, emit); }
    else if (!input.g) b.charge = -1;
    return;
  }
  if (wants === 'gp' && go) {
    // Only as held as the press is old: a tap at the very end of a recovery,
    // its key still down on the next tick, is not a trompón.
    const age = b.pressAge;
    forget(b);
    if (!input.g) startJab(b, emit);
    else if (age >= T.hold) startWind(b, emit);
    else b.charge = age;
    return;
  }
  if (!free) return;
  if (wants === 'a') { forget(b); setAct(b, 'grab'); emit({ type: 'grab', id: b.id }); return; }
  if (press.t && b.act !== 'block') { setAct(b, 'taunt'); emit({ type: 'taunt', id: b.id, corner: b.corner }); return; }
  if (input.b && b.aguante > 5) { if (b.act !== 'block') setAct(b, 'block'); }
  else if (b.act === 'block') setAct(b, 'idle');
}
function startWind(b, emit) { armCombo(b); setAct(b, 'wind'); b.thrown++; emit({ type: 'wind', id: b.id }); }
function startJab(b, emit) { armCombo(b); setAct(b, 'jab'); forget(b); emit({ type: 'jab', id: b.id }); }
function startDodge(b, input) {
  const rx = Math.cos(b.h), rz = -Math.sin(b.h);
  const side = (input.x || 0) * rx + (input.z || 0) * rz;
  b.dodgeDir = Math.abs(side) > .3 ? Math.sign(side) : 0;
  setAct(b, 'dodge');
}

const inWindow = (b, [from, to]) => b.at >= from && b.at - .05 < to;
const invulnerable = (b) => b.inv > 0 || b.act === 'down' || b.act === 'rise'
  || (b.act === 'dodge' && b.at >= T.dodge.safe[0] && b.at <= T.dodge.safe[1]);

// Whether `a`'s glove reaches `b`: distance and a generous arc in front.
function reaches(a, b, reach) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  if (d > reach) return false;
  const { fx, fz } = facing(a);
  return (dx * fx + dz * fz) / (d || 1) > .45;
}
const blocksFrom = (b, a) => {
  if (b.act !== 'block') return false;
  const { fx, fz } = facing(b), dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz) || 1;
  return (dx * fx + dz * fz) / d > .3;
};

// One body's attack lands (or not) on the nearest foe it reaches.
function strike(a, foes, emit) {
  if (a.landed) return;
  const kind = a.act === 'jab' ? 'jab' : a.act === 'trompon' ? 'trompon' : a.act === 'grab' ? 'grab' : ['kick', 'sweep', 'toss'].includes(a.act) ? a.act : null;
  if (!kind) return;
  const spec = T[kind], armed = !!a.prop && kind !== 'grab', reach = spec.reach + (armed ? .35 : 0) + (kind === 'grab' ? 0 : T.combo.reach[a.combo || 0]);
  if (!inWindow(a, spec.active)) return;
  const b = foes.filter(f => reaches(a, f, reach)).sort((x, y) => Math.hypot(x.x - a.x, x.z - a.z) - Math.hypot(y.x - a.x, y.z - a.z))[0];
  if (!b) return;
  a.landed = true;
  const { fx, fz } = facing(a), combo = kind === 'grab' ? 0 : a.combo || 0;
  if (kind !== 'grab') { a.chain = 0; a.chainLeft = 0; a.clean = false; }
  if (b.act === 'dodge' && invulnerable(b)) {
    // Dodging a trompón opens a counter window: the next punch can't be blocked.
    if (['trompon', 'kick', 'sweep', 'toss'].includes(kind)) { setAct(a, 'open'); b.contra = T.contra; emit({ type: 'dodged', id: b.id, by: a.id }); }
    return;
  }
  const contra = a.contra > 0 && kind !== 'grab' && kind !== 'toss';
  if (contra) a.contra = 0;
  if (invulnerable(b)) return;
  if (kind === 'grab') {
    // A grab beats blocking: the other pana goes flying toward the crowd.
    const wasBlocking = b.act === 'block';
    setAct(b, 'stun'); b.stun = spec.stun; addMareo(b, spec.mareo, emit);
    shake(b, fx * spec.push, fz * spec.push);
    emit({ type: 'shove', id: b.id, by: a.id, broke: wasBlocking });
    return;
  }
  if (blocksFrom(b, a) && kind !== 'toss' && !armed && !contra) {
    addMareo(b, T.chip[kind], emit); b.aguante = Math.max(0, b.aguante - T.guard[kind]); b.score.blocks++;
    shake(b, fx * (kind === 'trompon' ? 4 : 1.2), fz * (kind === 'trompon' ? 4 : 1.2));
    b.blockHit = .25;
    if (b.aguante <= 0) { setAct(b, 'stun'); b.stun = .7; emit({ type: 'guardbreak', id: b.id }); }
    else emit({ type: 'block', id: b.id, by: a.id, kind });
    return;
  }
  // A clean hit. A jab into a trompón still winding up is a counter; a chair
  // or a crate in the hand goes through the guard and hits harder.
  const counter = kind === 'jab' && b.act === 'wind';
  const scoreKey = { jab: 'jabs', trompon: 'trompones', kick: 'kicks', sweep: 'sweeps', toss: 'tosses' }[kind];
  a.score[scoreKey] = (a.score[scoreKey] || 0) + 1;
  const wasDizzy = b.act === 'dizzy';
  b.lastHit = 0; b.chain = 0; b.chainLeft = 0; b.clean = false;
  // A chain counts clean hits: the third is the last and shoves the foe away.
  if (combo < T.combo.reach.length - 1) { a.chain = combo + 1; a.chainLeft = T.combo.window; a.clean = true; }
  const push = spec.push * (armed ? 1.3 : 1) * (a.chain ? 1 : T.combo.finish);
  shake(b, fx * push, fz * push);
  emit({ type: kind === 'trompon' ? 'trompon' : 'hit', move: kind, id: b.id, by: a.id, counter, contra, armed, chain: combo, x: b.x, z: b.z });
  if (wasDizzy) { knockDown(b, a, emit); return; }
  addMareo(b, (spec.mareo + (counter ? T.counter : 0) + (contra ? T.contraMareo : 0)) * (armed ? 1.4 : 1) * T.combo.mareo[combo], emit);
  if (b.act !== 'dizzy') { setAct(b, kind === 'sweep' || kind === 'toss' ? 'tumble' : 'stun'); b.tumbleKind = kind; b.stun = spec.stun + (counter ? .15 : 0); }
}

function addMareo(b, amount, emit) {
  b.mareo = clamp(b.mareo + amount, 0, MAREO_MAX); b.lastHit = 0;
  if (b.mareo >= MAREO_MAX && b.act !== 'dizzy' && b.act !== 'down') {
    setAct(b, 'dizzy'); emit({ type: 'dizzy', id: b.id });
  }
}

function knockDown(b, by, emit) {
  b.caidas++; by.score.caidas++; b.downBy = by.id;
  setAct(b, 'down'); b.charge = -1;
  b.down = { count: 0, clock: 0, mash: 0, need: 7 + 6 * (b.caidas - 1) };
  emit({ type: 'caida', id: b.id, by: by.id, caidas: b.caidas });
}

// Step every body in the ring: buttons were already applied by control().
// Returns the knockouts this tick: [{ ko, by, how }].
export function stepBodies(bodies, arena, dt, moves, emit) {
  const ring = bodies.filter(inRing), kos = [];
  const foesOf = (self) => ring.filter(o => o !== self && o.team !== self.team);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  for (const self of ring) {
    self.at += dt; self.inv = Math.max(0, self.inv - dt); self.buffer = Math.max(0, self.buffer - dt); self.pressAge = (self.pressAge || 0) + dt;
    self.chainLeft = Math.max(0, (self.chainLeft || 0) - dt); if (!self.buffer) self.queued = null;
    self.blockHit = Math.max(0, self.blockHit - dt); self.lastHit += dt; self.contra = Math.max(0, (self.contra || 0) - dt);
    if (self.act !== 'block') self.aguante = Math.min(100, self.aguante + 22 * dt);
    else self.aguante = Math.max(0, self.aguante - 11 * dt);
    if (self.act === 'block' && self.aguante <= 0) { setAct(self, 'stun'); self.stun = .6; emit({ type: 'guardbreak', id: self.id }); }
    if (self.lastHit > 1.5 && self.act !== 'dizzy' && self.act !== 'down') self.mareo = Math.max(0, self.mareo - 7 * dt);
    // Face the nearest foe still standing, unless spinning from a trompón.
    const foes = foesOf(self), standing = foes.filter(o => o.act !== 'down');
    const foe = (standing.length ? standing : foes).sort((x, y) => dist(x, self) - dist(y, self))[0];
    self.foe = foe?.id ?? null;
    if (foe && self.act !== 'down') {
      const want = Math.atan2(foe.x - self.x, foe.z - self.z);
      let diff = want - self.h; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      self.h += diff * Math.min(1, dt * (self.act === 'stun' ? 3 : 14));
    }
    // Timed acts end on their own.
    const ends = { throw: .4, dodge: T.dodge.total, taunt: T.taunt, open: T.trompon.open, rise: T.rise };
    if (T[self.act]?.whiff) ends[self.act] = attackEnd(self);
    if (self.act === 'wind' && self.at >= T.wind) {
      const overshoot = self.at - T.wind;
      setAct(self, 'trompon'); self.at = overshoot;
      emit({ type: 'swing', id: self.id });
    }
    else if ((self.act === 'stun' || self.act === 'tumble') && self.at >= self.stun) setAct(self, 'idle');
    else if (self.act === 'dizzy' && self.at >= T.dizzy) { setAct(self, 'idle'); self.mareo = 55; emit({ type: 'clear', id: self.id }); }
    else if (ends[self.act] && self.at >= ends[self.act]) setAct(self, 'idle');
    const by = self.downBy ?? foe?.id ?? null;
    if (self.act === 'down') {
      const d = self.down; d.clock += dt;
      if (d.mash >= d.need) {
        setAct(self, 'rise'); self.inv = T.rise; self.mareo = 45; self.down = null;
        emit({ type: 'rise', id: self.id });
      } else if (d.clock >= COUNT_STEP) {
        d.clock -= COUNT_STEP; d.count++; emit({ type: 'count', id: self.id, n: d.count });
        if (d.count >= 10) kos.push({ ko: self.id, by, how: 'cuenta' });
      }
    }
    if (self.caidas >= KO_CAIDAS && !kos.some(k => k.ko === self.id)) kos.push({ ko: self.id, by, how: 'ko' });
  }
  // Movement: the stick is a world direction, read against the foe.
  for (const self of ring) {
    const move = moves.get(self.id) || { x: 0, z: 0 };
    const { fx, fz } = facing(self), rx = Math.cos(self.h), rz = -Math.sin(self.h);
    let f = move.x * fx + move.z * fz, s = move.x * rx + move.z * rz;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const scale = { idle: 1, block: .4, wind: .3, taunt: 0, dizzy: .45, jab: .35, grab: .3, rise: .6, throw: .3 }[self.act] ?? 0;
    let mx = (fx * f * (f > 0 ? SPEED.forward : SPEED.back) + rx * s * SPEED.side) * scale;
    let mz = (fz * f * (f > 0 ? SPEED.forward : SPEED.back) + rz * s * SPEED.side) * scale;
    if (self.act === 'dizzy') { mx += Math.sin(self.at * 7 + self.x) * .9; mz += Math.cos(self.at * 6) * .9; }
    if (self.act === 'trompon' && self.at < .14) { mx += fx * 3.2; mz += fz * 3.2; }
    if (self.act === 'jab' && self.at < .16) { mx += fx * 1.4; mz += fz * 1.4; }
    if ((self.act === 'kick' || self.act === 'sweep') && self.at < T[self.act].active[0]) { mx += fx * 1.1; mz += fz * 1.1; }
    if (self.act === 'dodge' && self.at < .26) { mx += rx * self.dodgeDir * T.dodge.speed; mz += rz * self.dodgeDir * T.dodge.speed; }
    self.moving = Math.hypot(mx, mz);
    if (f > .3 && scale > 0) self.score.forward += dt;
    self.x += (mx + self.vx) * dt; self.z += (mz + self.vz) * dt;
    const drag = Math.exp(-dt * 5); self.vx *= drag; self.vz *= drag;
    if (Math.hypot(self.vx, self.vz) < .05) self.vx = self.vz = 0;
  }
  // Hits.
  for (const self of ring) strike(self, foesOf(self), emit);
  // Bodies keep their space: everyone in the ring, even down, dodging or
  // invulnerable (that only stops hits). Only positions move, so knockback
  // velocity carries on. Two on the same spot split along X, the first body
  // (the red corner) to the left.
  const cap = SEPARATE * dt;
  // What can't give way (a partner on the apron, a pana knocked out on the floor,
  // a body on the ropes): the free one moves alone.
  const moveOff = (free, wall) => {
    const dx = free.x - wall.x, dz = free.z - wall.z, d = Math.hypot(dx, dz);
    if (d >= BODY_GAP) return;
    const push = Math.min(BODY_GAP - d, cap * 2), nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
    free.x += nx * push; free.z += nz * push;
  };
  for (const wall of bodies.filter(o => !inRing(o))) for (const self of ring) moveOff(self, wall);
  const separate = () => {
    for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) {
      const a = ring[i], b = ring[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d >= BODY_GAP) continue;
      const push = Math.min((BODY_GAP - d) / 2, cap), nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    }
  };
  separate();
  // Three or more: moving out of one body can press into another.
  if (ring.length > 2) separate();
  // Ropes bounce in the tent; elsewhere the crowd handles the edge (rules.js).
  const pinned = new Set();
  for (const self of ring) {
    const e = edge(arena, self.x, self.z);
    if (arena.shape === 'square' && e.out > 0) {
      self.x += e.nx * e.out; self.z += e.nz * e.out; pinned.add(self);
      const into = self.vx * -e.nx + self.vz * -e.nz;
      if (into > .5) { self.vx += e.nx * into * 1.8; self.vz += e.nz * into * 1.8; emit({ type: 'ropes', id: self.id }); }
    } else if (e.out > EDGE_LIMIT) { self.x += e.nx * (e.out - EDGE_LIMIT); self.z += e.nz * (e.out - EDGE_LIMIT); pinned.add(self); }
  }
  for (const wall of pinned) for (const self of ring) if (self !== wall && !pinned.has(self)) moveOff(self, wall);
  if (ring.length > 2) {
    separate();
    for (const self of pinned) { const e = edge(arena, self.x, self.z); if (arena.shape === 'square' && e.out > 0) { self.x += e.nx * e.out; self.z += e.nz * e.out; } }
  }
  return kos;
}

// The judges' card when the bell rings: clean hits, caídas and pressure.
export function scorecard(body) {
  const s = body.score;
  return Math.round((s.jabs + s.trompones * 3 + (s.kicks || 0) * 2 + (s.sweeps || 0) * 2 + (s.tosses || 0) * 2 + s.caidas * 6 + s.forward * .35 + s.blocks * .25) * 10) / 10;
}

export { setAct, knockDown, addMareo, canAct, facing };
