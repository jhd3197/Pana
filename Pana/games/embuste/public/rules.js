// ¡Embuste! rules: one night at the expedition camp. Plain data in, plain data
// out: no DOM, no Three.js, no network. The server room runs a Night for online
// play (games/embuste/server/room.js) and the browser runs one for practice.
// view(seat) is everything a screen is allowed to know; roles and anything out
// of sight never leave the Night except through it.

import { SEATS, distance, moveBody, sightClear, zoneAt, inBounds, stationById, near, REACH } from './layout.js';

export const MIN_PLAYERS = 4, MAX_PLAYERS = 8;
export const SPEED = 5, GHOST_SPEED = 6.2, RADIUS = 0.45;
// Lantern radius in metres. Standing in the fogata's light adds `lit`.
export const VISION = { pana: 7.5, momia: 10, lit: 5 };
// Seconds. QUICK is for browser suites: a whole night in under a minute.
export const TIMERS = { reveal: 5, task: 1, visual: 4 };
export const QUICK = { timers: { reveal: 1.5, task: 0.1 } };
export const TASKS_EACH = 5;

// The camp's chores. `seconds` is the least a task can take (times the task
// timer), so a hacked client can't finish one from across the map. Visual
// tasks show an animation to anyone who can see the station: only a pana's
// count, so seeing one finish proves that pana.
export const TASKS = [
  { id: 'malacate', name: 'Girar el malacate', stations: ['malacate'], seconds: 3, visual: 'winch' },
  { id: 'faroles', name: 'Encender faroles', stations: ['faroles'], seconds: 3, visual: 'lanterns' },
  { id: 'reliquia', name: 'Armar la reliquia', stations: ['reliquia'], seconds: 3 },
  { id: 'tabla', name: 'Arreglar la tabla', stations: ['tabla'], seconds: 3 },
  { id: 'agua', name: 'Llenar agua', stations: ['agua'], seconds: 2 },
  { id: 'arepas', name: 'Hacer arepas', stations: ['arepas'], seconds: 3 },
  { id: 'radio', name: 'Sintonizar la radio', stations: ['radio'], seconds: 2 },
  { id: 'jeroglificos', name: 'Limpiar jeroglíficos', stations: ['jeroglificos'], seconds: 3 },
  { id: 'provisiones', name: 'Subir provisiones', stations: ['prov-muelle', 'prov-cocina'], seconds: 2 },
];
export const taskById = id => TASKS.find(t => t.id === id);
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
    this.world = { winch: 0, lanterns: 0 };
  }

  // ---------- roster ----------
  addPlayer(seat, { name = 'pana', avatar = {}, bot = false } = {}) {
    const known = this.players.get(seat);
    if (known) { Object.assign(known, { name, avatar }); return known; }
    const spot = SEATS[this.players.size % SEATS.length];
    const p = {
      seat, name, avatar, bot, role: 'pana', alive: true, spectator: this.phase !== 'lobby',
      x: spot.x, z: spot.z, h: spot.h, moving: false, tasks: [], task: null,
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
    this.world = { winch: 0, lanterns: 0 };
    shuffle(seats, this.rand).forEach((seat, i) => {
      const p = this.players.get(seat), spot = SEATS[i % SEATS.length];
      Object.assign(p, { role: roles.get(seat), alive: true, spectator: false, x: spot.x, z: spot.z, h: spot.h, moving: false, task: null });
      // Mummies get a list too: something to pretend with.
      p.tasks = shuffle(TASKS, this.rand).slice(0, this.options.tasks ?? TASKS_EACH).map(t => ({ id: t.id, step: 0 }));
    });
    this.phase = 'reveal';
    this.timer = this.timers.reveal;
    this.emit('reveal');
    return true;
  }

  // The dawn bar: every pana's tasks, momiitas included. Mummies' don't count.
  bar() {
    let done = 0, total = 0;
    for (const p of this.active()) if (p.role === 'pana') for (const t of p.tasks) { total++; if (t.step >= taskById(t.id).stations.length) done++; }
    return { done, total };
  }

  // ---------- actions ----------
  // Every client action lands here; anything out of place is ignored.
  act(seat, action, data = {}) {
    const p = this.players.get(seat);
    if (!p || this.phase !== 'playing' || p.spectator) return false;
    const handler = this.actions[action];
    return handler ? !!handler.call(this, p, data) : false;
  }

  // The task whose next step is at this station, if any.
  taskAt(p, station) {
    return p.tasks.find(t => { const def = taskById(t.id); return t.step < def.stations.length && def.stations[t.step] === station; });
  }

  startTask(p, { station }) {
    const s = stationById(station);
    if (!s || p.task || !this.taskAt(p, station) || !near(p, s, REACH + 0.3)) return false;
    p.task = { station, at: this.time };
    p.moving = false;
    return true;
  }

  finishTask(p, { station }) {
    const t = p.task && p.task.station === station && this.taskAt(p, station);
    if (!t) return false;
    const def = taskById(t.id);
    if (this.time - p.task.at < def.seconds * this.timers.task - 1e-6) return false;
    p.task = null;
    if (p.role !== 'pana') { this.emit('task', { task: def.id, fake: true }, [p.seat]); return true; }
    t.step++;
    const complete = t.step >= def.stations.length;
    this.emit('task', { task: def.id, step: t.step, complete }, [p.seat]);
    if (complete && def.visual) {
      if (def.visual === 'winch') this.world.winch = this.timers.visual;
      if (def.visual === 'lanterns') this.world.lanterns = this.timers.visual * 5;
      this.emit('visual', { station, seat: p.seat }, this.viewers(stationById(station)));
    }
    this.checkEnd();
    return true;
  }

  cancelTask(p) { if (!p.task) return false; p.task = null; return true; }

  // Seats whose screen shows this point.
  viewers(point) { return [...this.players.values()].filter(v => this.sees(v, point)).map(v => v.seat); }

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
    this.world.winch = Math.max(0, this.world.winch - dt);
    this.world.lanterns = Math.max(0, this.world.lanterns - dt);
    for (const p of this.players.values()) this.move(p, p.task ? { x: 0, z: 0 } : cleanInput(inputs.get(p.seat)), dt);
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
    } else moveBody(p, dx, dz, this.terrain(), RADIUS);
    p.h = Math.atan2(input.x, input.z);
  }

  terrain() { return { bridgeCut: !!this.bridgeCut }; }

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

  // Visual state of the map, only where this seat can see it.
  worldFor(me) {
    const w = {};
    if (this.world.winch > 0 && this.sees(me, stationById('malacate'))) w.winch = +this.world.winch.toFixed(1);
    if (this.world.lanterns > 0 && this.sees(me, stationById('faroles'))) w.lanterns = Math.min(4, Math.ceil(this.world.lanterns / this.timers.visual));
    return w;
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
        tasks: me.tasks.map(t => { const def = taskById(t.id); return { id: t.id, name: def.name, step: t.step, steps: def.stations.length, station: def.stations[Math.min(t.step, def.stations.length - 1)], done: t.step >= def.stations.length }; }),
        task: me.task && { station: me.task.station, since: +(this.time - me.task.at).toFixed(2) },
      },
      bar: this.bar(),
      world: this.worldFor(me),
      partners: mummy ? this.active().filter(p => p.role === 'momia' && p !== me).map(p => p.seat) : [],
      roster: [...this.players.values()].map(p => ({ seat: p.seat, name: p.name, avatar: p.avatar, bot: p.bot || undefined, role: roleOf(p), spectator: p.spectator || undefined })),
      players: lobby ? [] : [...this.players.values()].filter(p => this.seesPlayer(me, p)).map(pose),
      ending: this.ending,
      options: { reveal: this.options.reveal, chat: this.options.chat },
      events: this.events.filter(e => e.id > since && (!e.to || e.to.includes(seat))).map(({ to, ...e }) => e),
    };
  }
}

Night.prototype.actions = {
  task: Night.prototype.startTask,
  done: Night.prototype.finishTask,
  cancel: Night.prototype.cancelTask,
};
