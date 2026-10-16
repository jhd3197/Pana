// ¡Embuste! rules: one night at the expedition camp. Plain data in, plain data
// out: no DOM, no Three.js, no network. The server room runs a Night for online
// play (games/embuste/server/room.js) and the browser runs one for practice.
// view(seat) is everything a screen is allowed to know; roles and anything out
// of sight never leave the Night except through it.

import { SEATS, distance, moveBody, sightClear, zoneAt, inBounds } from './layout.js';

export const MIN_PLAYERS = 4, MAX_PLAYERS = 8;
export const SPEED = 5, GHOST_SPEED = 6.2, RADIUS = 0.45;
// Lantern radius in metres. Standing in the fogata's light adds `lit`.
export const VISION = { pana: 7.5, momia: 10, lit: 5 };
// Seconds. QUICK is for browser suites: a whole night in under a minute.
export const TIMERS = { reveal: 5 };
export const QUICK = { timers: { reveal: 1.5 } };
export const mummyCount = n => (n >= 7 ? 2 : 1);

// Small seeded generator, so a night replays the same from its seed.
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {   // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Roles for a round: seat → 'momia' | 'pana'.
export function dealRoles(seats, rand) {
  const mummies = new Set(shuffle(seats, rand).slice(0, mummyCount(seats.length)));
  return new Map(seats.map(s => [s, mummies.has(s) ? 'momia' : 'pana']));
}

// players: [{ role, alive }] still in the round. bar: { done, total }.
export function checkWin(players, bar = { done: 0, total: 0 }) {
  const mummies = players.filter(p => p.role === 'momia' && p.alive).length;
  const panas = players.filter(p => p.role === 'pana' && p.alive).length;
  if (!mummies) return { winner: 'panas', reason: 'votes' };
  if (bar.total > 0 && bar.done >= bar.total) return { winner: 'panas', reason: 'tasks' };
  if (mummies >= panas) return { winner: 'momias', reason: 'numbers' };
  return null;
}

const clampInput = v => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
export const cleanInput = i => ({ x: clampInput(i?.x), z: clampInput(i?.z), hold: !!i?.hold });

export class Night {
  constructor(options = {}) {
    this.options = { reveal: true, chat: true, ...options };
    this.timers = { ...TIMERS, ...options.timers };
    this.players = new Map();     // seat → player
    this.phase = 'lobby';         // lobby | reveal | playing | meeting | ended
    this.time = 0;
    this.timer = 0;
    this.round = 0;
    this.events = [];
    this.eventId = 0;
    this.ending = null;
    this.rand = seeded(1);
  }

  // ---------- roster ----------
  addPlayer(seat, { name = 'pana', avatar = {}, bot = false } = {}) {
    const known = this.players.get(seat);
    if (known) { Object.assign(known, { name, avatar }); return known; }
    const spot = SEATS[this.players.size % SEATS.length];
    const p = {
      seat, name, avatar, bot, role: 'pana', alive: true, spectator: this.phase !== 'lobby',
      x: spot.x, z: spot.z, h: spot.h, moving: false,
    };
    this.players.set(seat, p);
    return p;
  }

  // Someone left the room. A mummy who leaves counts as voted out.
  removePlayer(seat) {
    const p = this.players.get(seat);
    if (!p) return;
    this.players.delete(seat);
    if (this.inRound() && !p.spectator) {
      this.emit('left', { seat, name: p.name, role: p.role === 'momia' ? 'momia' : null });
      this.checkEnd();
    }
  }

  inRound() { return ['reveal', 'playing', 'meeting'].includes(this.phase); }
  active() { return [...this.players.values()].filter(p => !p.spectator); }

  emit(kind, data = {}, to = null) {
    this.events.push({ id: ++this.eventId, kind, ...data, ...(to ? { to } : {}) });
    if (this.events.length > 120) this.events.splice(0, this.events.length - 120);
  }

  // ---------- round ----------
  start(seed = Date.now()) {
    const seats = [...this.players.keys()];
    if (seats.length < 1) return false;
    this.rand = seeded(seed);
    this.round++;
    this.time = 0;
    this.ending = null;
    this.events = [];
    const roles = dealRoles(seats, this.rand);
    shuffle(seats, this.rand).forEach((seat, i) => {
      const p = this.players.get(seat), spot = SEATS[i % SEATS.length];
      Object.assign(p, { role: roles.get(seat), alive: true, spectator: false, x: spot.x, z: spot.z, h: spot.h, moving: false });
    });
    this.phase = 'reveal';
    this.timer = this.timers.reveal;
    this.emit('reveal');
    return true;
  }

  bar() { return { done: 0, total: 0 }; }

  checkEnd() {
    if (!this.inRound()) return null;
    const result = checkWin(this.active(), this.bar());
    if (result) this.end(result.winner, result.reason);
    return result;
  }

  end(winner, reason) {
    this.phase = 'ended';
    this.ending = { winner, reason };
    this.emit('end', { winner, reason });
  }

  toLobby() {
    this.phase = 'lobby';
    this.ending = null;
    for (const p of this.players.values()) Object.assign(p, { spectator: false, alive: true, role: 'pana' });
  }

  update(dt, inputs = new Map()) {
    this.time += dt;
    if (this.phase === 'reveal') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'playing'; this.emit('night'); }
      return;
    }
    if (this.phase !== 'playing') return;
    for (const p of this.players.values()) this.move(p, cleanInput(inputs.get(p.seat)), dt);
  }

  ghost(p) { return !p.alive || p.spectator; }

  move(p, input, dt) {
    const length = Math.hypot(input.x, input.z);
    p.moving = length > 0.05;
    if (!p.moving) return;
    const k = 1 / Math.max(1, length), speed = this.ghost(p) ? GHOST_SPEED : SPEED;
    const dx = input.x * k * speed * dt, dz = input.z * k * speed * dt;
    if (this.ghost(p)) {
      if (inBounds(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; }
    } else moveBody(p, dx, dz, this.world(), RADIUS);
    p.h = Math.atan2(input.x, input.z);
  }

  world() { return {}; }

  // ---------- what a seat may know ----------
  vision(p) {
    if (this.ghost(p)) return Infinity;
    return (p.role === 'momia' ? VISION.momia : VISION.pana) + (zoneAt(p).lit ? VISION.lit : 0);
  }

  // Can `viewer` see the point? Ghosts see everything; the living need their
  // lantern's reach and a clear line between the walls.
  sees(viewer, point) {
    if (this.ghost(viewer)) return true;
    return distance(viewer, point) <= this.vision(viewer) && sightClear(viewer, point);
  }

  // Can `viewer` see player `p` on the map right now?
  seesPlayer(viewer, p) {
    if (viewer === p) return true;
    if (this.ghost(p)) return this.ghost(viewer);
    return this.sees(viewer, p);
  }

  view(seat, since = 0) {
    const me = this.players.get(seat);
    if (!me) return null;
    const ended = this.phase === 'ended', lobby = this.phase === 'lobby';
    const mummy = me.role === 'momia' && !lobby && !me.spectator;
    const roleOf = p => (ended || p === me || (mummy && p.role === 'momia') ? p.role : null);
    const pose = p => ({ seat: p.seat, x: +p.x.toFixed(2), z: +p.z.toFixed(2), h: +p.h.toFixed(2), moving: p.moving, ghost: this.ghost(p) || undefined });
    return {
      phase: this.phase, round: this.round, time: +this.time.toFixed(2), timer: +Math.max(0, this.timer).toFixed(2),
      me: {
        seat, role: lobby ? null : me.role, alive: me.alive, spectator: me.spectator, ghost: this.ghost(me),
        vision: this.vision(me) === Infinity ? 0 : this.vision(me),
      },
      partners: mummy ? this.active().filter(p => p.role === 'momia' && p !== me).map(p => p.seat) : [],
      roster: [...this.players.values()].map(p => ({ seat: p.seat, name: p.name, avatar: p.avatar, bot: p.bot || undefined, role: roleOf(p), spectator: p.spectator || undefined })),
      players: lobby ? [] : [...this.players.values()].filter(p => this.seesPlayer(me, p)).map(pose),
      ending: this.ending,
      options: { reveal: this.options.reveal, chat: this.options.chat },
      events: this.events.filter(e => e.id > since && (!e.to || e.to.includes(seat))).map(({ to, ...e }) => e),
    };
  }
}

