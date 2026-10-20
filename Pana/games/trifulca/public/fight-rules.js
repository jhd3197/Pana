// Trifulca's fight: two bodies, four buttons, mareo, caídas and the ring.
// Pure data (no DOM, no Three.js) so the host, the screen and Node tests share
// it. rules.js owns the night around it: the queue, bets, dolitas, phases.
import { clamp } from '/engine/random.js';

// Seconds and metres. Every attack shows its windup before it can land.
export const T = {
  hold: .16,            // golpe held longer than this is a trompón
  jab: { active: [.1, .18], total: .36, reach: 1.4, mareo: 9, push: 2, stun: .24 },
  wind: .55,            // the trompón's visible windup
  trompon: { active: [0, .12], total: .5, reach: 1.6, mareo: 28, push: 7.5, stun: .7, open: .4 },
  grab: { active: [.14, .24], total: .55, reach: 1.3, mareo: 5, push: 7, stun: .55 },
  dodge: { total: .42, safe: [.03, .34], speed: 4.6 },
  taunt: 1, rise: 1, dizzy: 2.1, counter: 6,
  chip: { jab: 1.5, trompon: 6 }, guard: { jab: 12, trompon: 40 },
};
export const SPEED = { forward: 2.7, back: 2.2, side: 2.4 };
export const MAREO_MAX = 100, MAREO_CALMA = 75, KO_CAIDAS = 3, COUNT_STEP = .85;
export const BODY_GAP = .85;

// The ring is the panas. `circle` arenas have a human ring (shoved back in by
// the crowd); the tent's ring has ropes that bounce.
export const ARENAS = {
  calle: { shape: 'circle', r: 4.3, twist: 'moto' },
  toldo: { shape: 'square', half: 2.9, twist: 'ropes' },
  mercado: { shape: 'circle', r: 4.1, twist: 'cajas' },
  motos: { shape: 'circle', r: 4.5, twist: 'domino' },
};
export const arenaOf = (id) => ARENAS[id] || ARENAS.calle;

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

export function newBody(id, corner, arena) {
  const side = corner === 'red' ? -1 : 1, start = arena.shape === 'square' ? 1.7 : 1.9;
  return { id, corner, x: side * start, z: 0, h: side < 0 ? Math.PI / 2 : -Math.PI / 2, vx: 0, vz: 0,
    act: 'idle', at: 0, landed: false, charge: -1, buffer: 0, dodgeDir: 0,
    mareo: 0, calm: 0, aguante: 100, stun: 0, caidas: 0, inv: 0, outside: 0,
    down: null, moving: 0, blockHit: 0, lastHit: 9,
    score: { jabs: 0, trompones: 0, caidas: 0, forward: 0, blocks: 0 }, thrown: 0 };
}

const BUSY = new Set(['jab', 'wind', 'trompon', 'grab', 'dodge', 'stun', 'dizzy', 'down', 'rise', 'taunt', 'open']);
const canAct = (b) => !BUSY.has(b.act);
const setAct = (b, act) => { b.act = act; b.at = 0; b.landed = false; };
const facing = (b) => ({ fx: Math.sin(b.h), fz: Math.cos(b.h) });
const shake = (b, pushX, pushZ) => { b.vx += pushX; b.vz += pushZ; };

// The button edges a tick brings: counters that changed since last time.
export function presses(last, input) {
  const delta = (k) => ((input[k] | 0) - (last[k] | 0) + 256) % 256;
  const out = { gp: delta('gp'), e: delta('e'), a: delta('a'), t: delta('t') };
  for (const k of ['gp', 'e', 'a', 't']) last[k] = input[k] | 0;
  return out;
}

// One fighter's buttons for this tick: start, hold and release actions.
export function control(b, input, press, emit) {
  if (b.act === 'down') {
    // Mash anything to get up before ten.
    b.down.mash += press.gp + press.e + press.a;
    return;
  }
  if (press.gp) b.buffer = .2;
  const free = canAct(b) || b.act === 'block';
  if (b.charge >= 0) {
    b.charge += .05;
    if (!input.g && b.charge < T.hold + .05) { b.charge = -1; if (free) startJab(b, emit); }
    else if (input.g && b.charge >= T.hold) { b.charge = -1; if (free) { setAct(b, 'wind'); b.thrown++; emit({ type: 'wind', id: b.id }); } }
    else if (!input.g) b.charge = -1;
    return;
  }
  if (!free) return;
  if (press.e) { startDodge(b, input); emit({ type: 'dodge', id: b.id }); return; }
  if (press.a) { setAct(b, 'grab'); emit({ type: 'grab', id: b.id }); return; }
  if (press.t && b.act !== 'block') { setAct(b, 'taunt'); emit({ type: 'taunt', id: b.id, corner: b.corner }); return; }
  if (b.buffer > 0) {
    b.buffer = 0;
    if (input.g && !press.gp) { setAct(b, 'wind'); b.thrown++; emit({ type: 'wind', id: b.id }); }
    else if (input.g) b.charge = 0;
    else startJab(b, emit);
    return;
  }
  if (input.b && b.aguante > 5) { if (b.act !== 'block') setAct(b, 'block'); }
  else if (b.act === 'block') setAct(b, 'idle');
}
function startJab(b, emit) { setAct(b, 'jab'); b.buffer = 0; emit({ type: 'jab', id: b.id }); }
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

// One body's attack lands (or not) on the other.
function strike(a, b, emit) {
  if (a.landed) return;
  const kind = a.act === 'jab' ? 'jab' : a.act === 'trompon' ? 'trompon' : a.act === 'grab' ? 'grab' : null;
  if (!kind) return;
  const spec = T[kind];
  if (!inWindow(a, spec.active) || !reaches(a, b, spec.reach)) return;
  a.landed = true;
  const { fx, fz } = facing(a);
  if (b.act === 'dodge' && invulnerable(b)) {
    if (kind === 'trompon') { setAct(a, 'open'); emit({ type: 'dodged', id: b.id, by: a.id }); }
    return;
  }
  if (invulnerable(b)) return;
  if (kind === 'grab') {
    // A grab beats blocking: the other pana goes flying toward the crowd.
    const wasBlocking = b.act === 'block';
    setAct(b, 'stun'); b.stun = spec.stun; addMareo(b, spec.mareo, emit);
    shake(b, fx * spec.push, fz * spec.push);
    emit({ type: 'shove', id: b.id, by: a.id, broke: wasBlocking });
    return;
  }
  if (blocksFrom(b, a)) {
    addMareo(b, T.chip[kind], emit); b.aguante = Math.max(0, b.aguante - T.guard[kind]); b.score.blocks++;
    shake(b, fx * (kind === 'trompon' ? 4 : 1.2), fz * (kind === 'trompon' ? 4 : 1.2));
    b.blockHit = .25;
    if (b.aguante <= 0) { setAct(b, 'stun'); b.stun = .7; emit({ type: 'guardbreak', id: b.id }); }
    else emit({ type: 'block', id: b.id, by: a.id, kind });
    return;
  }
  // A clean hit. A jab into a trompón still winding up is a counter.
  const counter = kind === 'jab' && b.act === 'wind';
  if (kind === 'jab') a.score.jabs++; else a.score.trompones++;
  const wasDizzy = b.act === 'dizzy';
  b.lastHit = 0;
  shake(b, fx * spec.push, fz * spec.push);
  emit({ type: kind === 'jab' ? 'hit' : 'trompon', id: b.id, by: a.id, counter, x: b.x, z: b.z });
  if (wasDizzy) { knockDown(b, a, emit); return; }
  addMareo(b, spec.mareo + (counter ? T.counter : 0), emit);
  if (b.act !== 'dizzy') { setAct(b, 'stun'); b.stun = spec.stun + (counter ? .15 : 0); }
}

function addMareo(b, amount, emit) {
  b.mareo = clamp(b.mareo + amount, 0, MAREO_MAX); b.lastHit = 0;
  if (b.mareo >= MAREO_MAX && b.act !== 'dizzy' && b.act !== 'down') {
    setAct(b, 'dizzy'); emit({ type: 'dizzy', id: b.id });
  }
}

function knockDown(b, by, emit) {
  b.caidas++; by.score.caidas++;
  setAct(b, 'down'); b.charge = -1;
  b.down = { count: 0, clock: 0, mash: 0, need: 7 + 6 * (b.caidas - 1) };
  emit({ type: 'caida', id: b.id, by: by.id, caidas: b.caidas });
}

// Step both bodies: buttons were already applied by control().
// Returns 'ko' with the loser's id when a fight is over.
export function stepBodies(bodies, arena, dt, moves, emit) {
  const [a, b] = bodies;
  for (const [self, other] of [[a, b], [b, a]]) {
    self.at += dt; self.inv = Math.max(0, self.inv - dt); self.buffer = Math.max(0, self.buffer - dt);
    self.blockHit = Math.max(0, self.blockHit - dt); self.lastHit += dt;
    if (self.act !== 'block') self.aguante = Math.min(100, self.aguante + 22 * dt);
    else self.aguante = Math.max(0, self.aguante - 11 * dt);
    if (self.act === 'block' && self.aguante <= 0) { setAct(self, 'stun'); self.stun = .6; emit({ type: 'guardbreak', id: self.id }); }
    if (self.lastHit > 1.5 && self.act !== 'dizzy' && self.act !== 'down') self.mareo = Math.max(0, self.mareo - 7 * dt);
    // Face the other pana unless spinning from a trompón.
    if (self.act !== 'down') {
      const want = Math.atan2(other.x - self.x, other.z - self.z);
      let diff = want - self.h; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      self.h += diff * Math.min(1, dt * (self.act === 'stun' ? 3 : 14));
    }
    // Timed acts end on their own.
    const ends = { jab: T.jab.total, trompon: T.trompon.total, grab: T.grab.total, dodge: T.dodge.total, taunt: T.taunt, open: T.trompon.open, rise: T.rise };
    if (self.act === 'wind' && self.at >= T.wind) { setAct(self, 'trompon'); emit({ type: 'swing', id: self.id }); }
    else if (self.act === 'stun' && self.at >= self.stun) setAct(self, 'idle');
    else if (self.act === 'dizzy' && self.at >= T.dizzy) { setAct(self, 'idle'); self.mareo = 55; emit({ type: 'clear', id: self.id }); }
    else if (ends[self.act] && self.at >= ends[self.act]) setAct(self, 'idle');
    if (self.act === 'down') {
      const d = self.down; d.clock += dt;
      if (d.mash >= d.need) {
        setAct(self, 'rise'); self.inv = T.rise; self.mareo = 45; self.down = null;
        emit({ type: 'rise', id: self.id });
      } else if (d.clock >= COUNT_STEP) {
        d.clock -= COUNT_STEP; d.count++; emit({ type: 'count', id: self.id, n: d.count });
        if (d.count >= 10) return { ko: self.id, by: other.id, how: 'cuenta' };
      }
    }
    if (self.caidas >= KO_CAIDAS) return { ko: self.id, by: other.id, how: 'ko' };
  }
  // Movement: the stick is a world direction, read against the opponent.
  for (const [self, other] of [[a, b], [b, a]]) {
    const move = moves.get(self.id) || { x: 0, z: 0 };
    const { fx, fz } = facing(self), rx = Math.cos(self.h), rz = -Math.sin(self.h);
    let f = move.x * fx + move.z * fz, s = move.x * rx + move.z * rz;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const scale = { idle: 1, block: .4, wind: .3, taunt: 0, dizzy: .45, jab: .35, grab: .3, rise: .6 }[self.act] ?? 0;
    let mx = (fx * f * (f > 0 ? SPEED.forward : SPEED.back) + rx * s * SPEED.side) * scale;
    let mz = (fz * f * (f > 0 ? SPEED.forward : SPEED.back) + rz * s * SPEED.side) * scale;
    if (self.act === 'dizzy') { mx += Math.sin(self.at * 7 + self.x) * .9; mz += Math.cos(self.at * 6) * .9; }
    if (self.act === 'trompon' && self.at < .14) { mx += fx * 3.2; mz += fz * 3.2; }
    if (self.act === 'jab' && self.at < .16) { mx += fx * .8; mz += fz * .8; }
    if (self.act === 'dodge' && self.at < .26) { mx += rx * self.dodgeDir * T.dodge.speed; mz += rz * self.dodgeDir * T.dodge.speed; }
    self.moving = Math.hypot(mx, mz);
    if (f > .3 && scale > 0) self.score.forward += dt;
    self.x += (mx + self.vx) * dt; self.z += (mz + self.vz) * dt;
    const drag = Math.exp(-dt * 5); self.vx *= drag; self.vz *= drag;
    if (Math.hypot(self.vx, self.vz) < .05) self.vx = self.vz = 0;
    void other;
  }
  // Hits.
  strike(a, b, emit); strike(b, a, emit);
  // Bodies never overlap.
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  if (d < BODY_GAP) {
    const push = (BODY_GAP - d) / 2, nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
    a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
  }
  // Ropes bounce in the tent; elsewhere the crowd handles the edge (rules.js).
  for (const self of bodies) {
    const e = edge(arena, self.x, self.z);
    if (arena.shape === 'square' && e.out > 0) {
      self.x += e.nx * e.out; self.z += e.nz * e.out;
      const into = self.vx * -e.nx + self.vz * -e.nz;
      if (into > .5) { self.vx += e.nx * into * 1.8; self.vz += e.nz * into * 1.8; emit({ type: 'ropes', id: self.id }); }
    } else if (e.out > 1.4) { self.x += e.nx * (e.out - 1.4); self.z += e.nz * (e.out - 1.4); }
  }
  return null;
}

// The judges' card when the bell rings: clean hits, caídas and pressure.
export function scorecard(body) {
  const s = body.score;
  return Math.round((s.jabs + s.trompones * 3 + s.caidas * 6 + s.forward * .35 + s.blocks * .25) * 10) / 10;
}

export { setAct, knockDown, addMareo, canAct };
