// ¡Embuste! rules: one night at the expedition camp. Plain data in, plain data
// out: no DOM, no Three.js, no network. The server room runs a Night for online
// play (games/embuste/server/room.js) and the browser runs one for practice.
// view(seat) is everything a screen is allowed to know; roles and anything out
// of sight never leave the Night except through it.

import { SEATS, BELL, VENTS, HIDES, FIXES, distance, moveBody, sightClear, zoneAt, inBounds, stationById, ventById, hideById, near, REACH } from './layout.js';

export const MIN_PLAYERS = 4, MAX_PLAYERS = 8;
export const SPEED = 5, GHOST_SPEED = 6.2, RADIUS = 0.45;
// Lantern radius in metres. Standing in the fogata's light adds `lit`.
export const VISION = { pana: 7.5, momia: 10, lit: 5, dark: 2.8 };
// Seconds. QUICK is for browser suites: a whole night in under a minute.
export const TIMERS = { reveal: 5, task: 1, visual: 4, wrap: 25, firstWrap: 12, afterMeeting: 12, discuss: 30, vote: 30, eject: 6, bell: 15, disguise: 10, hide: 10, hideCooldown: 8, tracks: 6, footprints: 20,
  sabotage: 30, crecida: 45, momia: 15, look: 2, frozen: 3, stuck: 3, fix: 3, fixPair: 1.5 };
export const QUICK = { timers: { reveal: 1.5, task: 0.1, wrap: 3, firstWrap: 1, afterMeeting: 1, discuss: 2, vote: 6, eject: 2, bell: 1, sabotage: 2, crecida: 10, momia: 8, fix: 1, fixPair: 0.5 } };
export const WRAP_RANGE = 2.2, REPORT_RANGE = 4, BELL_RANGE = REACH + 0.5, VENT_RANGE = 1.8, HIDE_RANGE = 1.9;
// What a mummy can turn into (the shared plaza props), a few times a night.
export const DISGUISES = ['barrel', 'crate', 'cooler', 'planter'], DISGUISE_CHARGES = 3;

// The mummies' tricks. One at a time (traps aside), on a shared cooldown.
// fix: how it ends. 'pair' needs two panas holding E together at the spot(s).
export const SABOTAGES = {
  apagar: { name: 'Apagar la reliquia', fix: 'pair', hint: 'Dos panas mantengan E junto a la reliquia de la fogata.' },
  momia: { name: '¡Un, dos, tres, momia!', fix: 'time', hint: 'Cuando el guardián mira, no te muevas.' },
  bejuco: { name: 'Trampa de bejuco', fix: 'trap', hint: 'Una trampa invisible en el camino.' },
  puente: { name: 'Cortar el puente', fix: 'hold', hint: 'Mantén E en una punta del puente.' },
  radio: { name: 'Interferir la radio', fix: 'hold', hint: 'Mantén E en la antena de la carpa de la radio.' },
  crecida: { name: 'Crecida del río', fix: 'both', critical: true, hint: 'Dos panas: uno en cada palanca de la represa, a la vez.' },
};
export const TRAPS = 2, TRAP_RADIUS = 0.9;
// The guardian of ¡Un, dos, tres, momia! looks for `look` seconds out of every five.
export const guardianLooks = (elapsed, look = TIMERS.look) => elapsed % 5 >= 5 - look;

// Quick chat for meetings, always available (free text is a room option).
export const PHRASES = [
  '¡Embuste!', 'Yo estaba en la mina', 'Yo estaba en la cocina', 'Yo estaba en el templo', 'Yo estaba en la cascada',
  'Yo estaba en el muelle', 'Yo estaba en el depósito', 'Yo estaba en la radio', 'Yo hice el malacate, vean',
  'Lo vi saliendo de un tronco', '¿Y tú qué hacías en la cava?', 'No vi nada', 'Saltemos esta vez', 'Yo confío en ti',
];
export const cleanText = t => String(t ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);

// votes: Map voter → seat | 'skip'. The most votes goes down the river;
// a tie, or skipping on top, sends nobody.
export function tally(votes) {
  const counts = new Map();
  for (const target of votes.values()) counts.set(target, (counts.get(target) || 0) + 1);
  const best = Math.max(0, ...counts.values()), top = [...counts].filter(([, n]) => n === best).map(([t]) => t);
  const ejected = best > 0 && top.length === 1 && top[0] !== 'skip' ? top[0] : null;
  return { counts: Object.fromEntries(counts), ejected, tie: top.length > 1, skipped: top.length === 1 && top[0] === 'skip' };
}
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
    this.world = { winch: 0, lanterns: 0, bell: 0 };
    this.statues = [];
    this.meeting = null;
    this.nextBell = 0;
    this.traps = [];
    this.sabCooldown = 0;
    this.clearSabotage();
  }

  // ---------- roster ----------
  addPlayer(seat, { name = 'pana', avatar = {}, bot = false } = {}) {
    const known = this.players.get(seat);
    if (known) { Object.assign(known, { name, avatar }); return known; }
    const spot = SEATS[this.players.size % SEATS.length];
    const p = {
      seat, name, avatar, bot, role: 'pana', alive: true, spectator: this.phase !== 'lobby',
      x: spot.x, z: spot.z, h: spot.h, moving: false, tasks: [], task: null,
      cooldown: 0, emergencies: 1, known: false, ejected: false, said: -Infinity,
      hidden: null, disguise: null, disguises: DISGUISE_CHARGES, hideCooldown: 0, tracks: 0, print: null, frozen: 0, stuck: 0,
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
    this.events.push({ ...data, id: ++this.eventId, kind, ...(to ? { to } : {}) });
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
    this.world = { winch: 0, lanterns: 0, bell: 0 };
    this.statues = [];
    this.footprints = [];
    this.meeting = null;
    this.nextBell = 0;
    this.clearSabotage();
    this.traps = [];
    this.sabCooldown = this.timers.firstWrap;
    shuffle(seats, this.rand).forEach((seat, i) => {
      const p = this.players.get(seat), spot = SEATS[i % SEATS.length];
      Object.assign(p, {
        role: roles.get(seat), alive: true, spectator: false, x: spot.x, z: spot.z, h: spot.h, moving: false, task: null,
        cooldown: this.timers.firstWrap, emergencies: 1, known: false, ejected: false, said: -Infinity,
        hidden: null, disguise: null, disguises: DISGUISE_CHARGES, hideCooldown: 0, tracks: 0, print: null, frozen: 0, stuck: 0,
      });
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
    const p = this.players.get(seat), [phase, handler] = this.actions[action] || [];
    if (!p || !handler || this.phase !== phase || p.spectator) return false;
    return !!handler.call(this, p, data ?? {});
  }

  // The task whose next step is at this station, if any.
  taskAt(p, station) {
    return p.tasks.find(t => { const def = taskById(t.id); return t.step < def.stations.length && def.stations[t.step] === station; });
  }

  startTask(p, { station }) {
    const s = stationById(station);
    if (!s || p.task || p.hidden || p.disguise || !this.taskAt(p, station) || !near(p, s, REACH + 0.3)) return false;
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

  // ---------- wraps and statues ----------
  // The closest living pana a mummy could wrap right now.
  wrapTarget(m) {
    if (m.role !== 'momia' || this.ghost(m) || m.cooldown > 0 || m.hidden || m.disguise) return null;
    return [...this.players.values()]
      .filter(p => p.role === 'pana' && !this.ghost(p) && distance(m, p) <= WRAP_RANGE && sightClear(m, p) && this.wrappable(p, m))
      .sort((a, b) => distance(m, a) - distance(m, b))[0] || null;
  }
  // Nobody can wrap a pana hidden in a cava, a tent or behind the waterfall.
  wrappable(p) { return !p.hidden; }

  wrap(m) {
    const p = this.wrapTarget(m);
    if (!p) return false;
    p.alive = false; p.task = null; p.moving = false;
    m.cooldown = this.timers.wrap;
    const statue = { seat: p.seat, x: +p.x.toFixed(2), z: +p.z.toFixed(2), h: +p.h.toFixed(2) };
    this.statues.push(statue);
    // Sand on the bandages: footprints for a few seconds.
    m.tracks = this.timers.tracks; m.print = { x: m.x, z: m.z };
    // The victim, the mummies and whoever had both in sight know who did it.
    const witnesses = [...this.players.values()].filter(v => v !== p && v.role !== 'momia' && !this.ghost(v) && this.sees(v, statue) && this.seesPlayer(v, m)).map(v => v.seat);
    const mummies = this.active().filter(v => v.role === 'momia').map(v => v.seat);
    this.emit('wrap', { seat: p.seat, by: m.seat, x: statue.x, z: statue.z }, [p.seat, ...mummies, ...witnesses]);
    this.checkEnd();
    return true;
  }

  // A statue a living pana can see and reach to report.
  statueNear(p) {
    if (this.ghost(p)) return null;
    return this.statues.find(s => distance(p, s) <= REPORT_RANGE && sightClear(p, s)) || null;
  }
  // A jammed radio stops every meeting; any other alarm only stops the bell.
  canCall(p, report) { return !this.jammed && (report || !this.sabotage); }

  report(p) {
    const statue = this.statueNear(p);
    if (!statue || !this.canCall(p, true)) return false;
    this.startMeeting(p, statue.seat);
    return true;
  }

  ring(p) {
    if (this.ghost(p) || p.emergencies < 1 || this.time < this.nextBell || !near(p, BELL, BELL_RANGE) || !this.canCall(p, false)) return false;
    p.emergencies--;
    this.world.bell = 2;
    this.startMeeting(p, null);
    return true;
  }

  // ---------- hiding ----------
  // Mummies only: into a hollow log or temple tunnel, across to its pair, out.
  vent(p, { move = false } = {}) {
    if (p.role !== 'momia' || this.ghost(p) || p.task) return false;
    if (p.hidden?.kind === 'vent') {
      const v = ventById(p.hidden.id);
      if (move) { const to = ventById(v.link); p.hidden.id = to.id; Object.assign(p, { x: to.x, z: to.z }); return true; }
      p.hidden = null;
      this.emit('shake', { spot: v.id }, this.viewers(v));
      return true;
    }
    if (p.hidden || p.disguise) return false;
    const v = VENTS.find(v => near(p, v, VENT_RANGE));
    if (!v) return false;
    p.hidden = { kind: 'vent', id: v.id };
    Object.assign(p, { x: v.x, z: v.z, moving: false });
    this.emit('shake', { spot: v.id }, this.viewers(v));
    return true;
  }

  // Anyone alive: a tent, the cava, behind the waterfall. Safe, but no tasks,
  // and the spot spits you out after a while.
  hide(p) {
    if (this.ghost(p) || p.task || p.disguise) return false;
    if (p.hidden?.kind === 'hide') { this.leaveHide(p); return true; }
    if (p.hidden || p.hideCooldown > 0) return false;
    const h = HIDES.find(h => near(p, h, HIDE_RANGE) && ![...this.players.values()].some(q => q.hidden?.id === h.id));
    if (!h) return false;
    p.hidden = { kind: 'hide', id: h.id, t: this.timers.hide, from: { x: p.x, z: p.z } };
    p.moving = false;
    this.emit('shake', { spot: h.id }, this.viewers(h));
    return true;
  }
  leaveHide(p, kicked = false) {
    const h = hideById(p.hidden.id);
    Object.assign(p, p.hidden.from);
    p.hidden = null;
    p.hideCooldown = this.timers.hideCooldown;
    this.emit('shake', { spot: h.id }, this.viewers(h));
    if (kicked) this.emit('kicked', { spot: h.id }, [p.seat]);
  }

  disguise(p, { prop }) {
    if (p.role !== 'momia' || this.ghost(p) || p.hidden || p.task) return false;
    if (p.disguise) { p.disguise = null; return true; }
    if (p.disguises < 1 || !DISGUISES.includes(prop)) return false;
    p.disguises--;
    p.disguise = { prop, t: this.timers.disguise, key: 1 + Math.floor(this.rand() * 1e6) };
    p.moving = false;
    return true;
  }

  // ---------- sabotage ----------
  sabotageAct(p, { kind }) {
    const def = SABOTAGES[kind];
    if (!def || p.role !== 'momia' || this.sabCooldown > 0) return false;
    if (kind === 'bejuco') {
      if (this.ghost(p) || p.hidden || this.traps.length >= TRAPS) return false;
      this.traps.push({ id: ++this.trapId, x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
    } else {
      if (this.sabotage) return false;
      this.sabotage = { kind, t: kind === 'crecida' ? this.timers.crecida : kind === 'momia' ? this.timers.momia : 0, progress: 0, holders: 0 };
      if (kind === 'apagar') this.lightsOut = true;
      if (kind === 'puente') this.bridgeCut = true;
      if (kind === 'radio') this.jammed = true;
      this.emit('alarm', { sabotage: kind });
    }
    this.sabCooldown = this.timers.sabotage;
    this.emit('sabotaged', { sabotage: kind }, this.active().filter(q => q.role === 'momia').map(q => q.seat));
    return true;
  }

  clearSabotage() {
    this.sabotage = null; this.lightsOut = false; this.bridgeCut = false; this.jammed = false;
    this.trapId ??= 0;
  }

  // Who is holding E at a fix spot right now (living, not hiding).
  holdersAt(spot, inputs) {
    return [...this.players.values()].filter(p => !this.ghost(p) && !p.hidden && inputs.get(p.seat)?.hold && distance(p, spot) <= spot.r).length;
  }

  updateSabotage(dt, inputs) {
    if (this.sabCooldown > 0) this.sabCooldown = Math.max(0, this.sabCooldown - dt);
    // Vine snares catch the first pana who steps on them.
    for (const trap of [...this.traps]) {
      const p = [...this.players.values()].find(q => q.role === 'pana' && !this.ghost(q) && !q.hidden && distance(q, trap) <= TRAP_RADIUS);
      if (!p) continue;
      this.traps.splice(this.traps.indexOf(trap), 1);
      p.stuck = this.timers.stuck; p.task = null;
      this.emit('snared', { seat: p.seat, x: trap.x, z: trap.z }, this.viewers(trap));
    }
    const sab = this.sabotage;
    if (!sab) return;
    const def = SABOTAGES[sab.kind], spots = FIXES[sab.kind] || [];
    if (sab.kind === 'momia') {
      const elapsed = this.timers.momia - sab.t, looking = guardianLooks(elapsed, this.timers.look);
      if (looking && !sab.looking) this.emit('look');
      sab.looking = looking;
      if (looking) for (const p of this.players.values()) if (p.role === 'pana' && !this.ghost(p) && p.moving && !p.frozen) { p.frozen = this.timers.frozen; p.task = null; this.emit('frozen', { seat: p.seat }, [p.seat]); }
    }
    if (sab.t > 0) {
      sab.t -= dt;
      if (sab.t <= 0) {
        if (def.critical) { this.end('momias', 'flood'); return; }
        this.fixed(sab.kind);
        return;
      }
    }
    const counts = spots.map(s => this.holdersAt(s, inputs));
    const working = def.fix === 'pair' ? counts[0] >= 2 : def.fix === 'hold' ? counts.some(n => n > 0) : def.fix === 'both' ? counts.every(n => n > 0) : false;
    sab.holders = counts.reduce((a, b) => a + b, 0);
    if (!working) return;
    sab.progress += dt / (def.fix === 'hold' ? this.timers.fix : this.timers.fixPair);
    if (sab.progress >= 1) this.fixed(sab.kind);
  }

  fixed(kind) {
    this.clearSabotage();
    this.emit('fixed', { sabotage: kind });
  }

  // ---------- meetings ----------
  startMeeting(by, body) {
    this.phase = 'meeting';
    this.clearSabotage();
    this.meeting = { by: by.seat, body, stage: 'discuss', t: this.timers.discuss, votes: new Map(), chat: [], result: null, chatId: 0 };
    let i = 0;
    for (const p of this.players.values()) {
      if (!p.alive) p.known = true;
      p.task = null; p.moving = false; p.disguise = null; p.tracks = 0;
      if (p.hidden?.from) Object.assign(p, p.hidden.from);
      p.hidden = null;
      if (p.spectator) continue;
      const seat = SEATS[i++ % SEATS.length];
      Object.assign(p, { x: seat.x, z: seat.z, h: seat.h });
    }
    this.meetingStarted?.();
    this.emit('meeting', { by: by.seat, body });
  }

  vote(p, { target }) {
    const m = this.meeting;
    if (m.stage !== 'vote' || this.ghost(p) || m.votes.has(p.seat)) return false;
    const t = target === 'skip' ? 'skip' : this.players.get(Number(target));
    if (t !== 'skip' && (!t || this.ghost(t))) return false;
    m.votes.set(p.seat, t === 'skip' ? 'skip' : t.seat);
    this.emit('voted', { seat: p.seat });
    if (this.active().filter(q => !this.ghost(q)).every(q => m.votes.has(q.seat))) m.t = 0;
    return true;
  }

  chat(p, { text, phrase }) {
    const m = this.meeting;
    if (this.ghost(p) || this.time - p.said < 1) return false;
    const line = Number.isInteger(phrase) && PHRASES[phrase] ? PHRASES[phrase] : this.options.chat ? cleanText(text) : '';
    if (!line) return false;
    p.said = this.time;
    const entry = { id: ++m.chatId, seat: p.seat, text: line };
    m.chat.push(entry); if (m.chat.length > 40) m.chat.shift();
    this.emit('chat', { seat: p.seat, text: line });
    return true;
  }

  updateMeeting(dt) {
    const m = this.meeting;
    m.t -= dt;
    if (m.t > 0) return;
    if (m.stage === 'discuss') { m.stage = 'vote'; m.t = this.timers.vote; this.emit('vote'); return; }
    if (m.stage === 'vote') {
      const result = tally(m.votes), out = result.ejected != null ? this.players.get(result.ejected) : null;
      if (out) { out.alive = false; out.ejected = true; out.known = true; }
      m.result = { ...result, role: out && this.options.reveal ? out.role : null };
      m.stage = 'eject'; m.t = this.timers.eject;
      this.emit('eject', { seat: out ? out.seat : null, tie: result.tie, skipped: result.skipped, role: m.result.role });
      return;
    }
    this.endMeeting();
  }

  endMeeting() {
    this.phase = 'playing';
    this.meeting = null;
    this.statues = [];
    this.footprints = [];
    this.nextBell = this.time + this.timers.bell;
    for (const p of this.players.values()) if (p.role === 'momia') p.cooldown = Math.max(p.cooldown, this.timers.afterMeeting);
    this.emit('morning');
    this.checkEnd();
  }

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
    if (this.phase === 'meeting') { this.updateMeeting(dt); return; }
    if (this.phase !== 'playing') return;
    for (const p of this.players.values()) if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
    this.world.bell = Math.max(0, this.world.bell - dt);
    this.world.winch = Math.max(0, this.world.winch - dt);
    this.world.lanterns = Math.max(0, this.world.lanterns - dt);
    this.updateSabotage(dt, new Map([...inputs].map(([k, v]) => [k, cleanInput(v)])));
    if (this.phase !== 'playing') return;
    for (const p of this.players.values()) {
      if (p.frozen > 0) p.frozen = Math.max(0, p.frozen - dt);
      if (p.stuck > 0) p.stuck = Math.max(0, p.stuck - dt);
      if (p.hideCooldown > 0) p.hideCooldown = Math.max(0, p.hideCooldown - dt);
      if (p.hidden?.kind === 'hide' && (p.hidden.t -= dt) <= 0) this.leaveHide(p, true);
      if (p.disguise && (p.disguise.t -= dt) <= 0) p.disguise = null;
      const input = p.task || p.hidden || p.frozen > 0 || p.stuck > 0 ? { x: 0, z: 0 } : cleanInput(inputs.get(p.seat));
      if (p.disguise && Math.hypot(input.x, input.z) > 0.05) p.disguise = null;   // a barrel that walks is no barrel
      this.move(p, input, dt);
      if (p.tracks > 0) {
        p.tracks -= dt;
        if (distance(p, p.print) > 0.8) { this.footprints.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), h: +p.h.toFixed(2), t: this.time }); p.print = { x: p.x, z: p.z }; }
      }
    }
    if (this.footprints.length && this.footprints[0].t < this.time - this.timers.footprints) this.footprints = this.footprints.filter(f => f.t >= this.time - this.timers.footprints);
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
    if (this.lightsOut && p.role === 'pana') return VISION.dark;
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
    if (p.hidden) return this.ghost(viewer);
    if (this.ghost(p)) return this.ghost(viewer);
    return this.sees(viewer, p);
  }

  // Visual state of the map, only where this seat can see it.
  worldFor(me) {
    const w = {};
    if (this.world.bell > 0) w.bell = 1;
    if (this.bridgeCut) w.bridgeCut = true;
    if (this.lightsOut) w.lightsOut = true;
    if (this.jammed) w.jammed = true;
    if (this.sabotage?.kind === 'crecida') w.flood = true;
    if (this.sabotage?.kind === 'momia') w.guardian = this.sabotage.looking ? 'look' : 'away';
    if (this.world.winch > 0 && this.sees(me, stationById('malacate'))) w.winch = +this.world.winch.toFixed(1);
    if (this.world.lanterns > 0 && this.sees(me, stationById('faroles'))) w.lanterns = Math.min(4, Math.ceil(this.world.lanterns / this.timers.visual));
    return w;
  }

  meetingView(me) {
    const m = this.meeting, done = m.stage === 'eject';
    return {
      stage: m.stage, t: +Math.max(0, m.t).toFixed(1), total: this.timers[m.stage === 'eject' ? 'eject' : m.stage], by: m.by, body: m.body,
      voted: [...m.votes.keys()], mine: m.votes.get(me.seat) ?? null,
      votes: done ? [...m.votes].map(([voter, target]) => ({ voter, target })) : undefined,
      result: done ? m.result : undefined,
      chat: m.chat.slice(-30),
    };
  }

  view(seat, since = 0) {
    const me = this.players.get(seat);
    if (!me) return null;
    const ended = this.phase === 'ended', lobby = this.phase === 'lobby';
    const mummy = me.role === 'momia' && !lobby && !me.spectator;
    const roleOf = p => (ended || p === me || (mummy && p.role === 'momia') ? p.role : null);
    const pose = p => {
      const at = { x: +p.x.toFixed(2), z: +p.z.toFixed(2), h: +p.h.toFixed(2) };
      // A disguised mummy is just a barrel to anyone but itself and its partner.
      if (p.disguise) return p === me || (mummy && p.role === 'momia') ? { seat: p.seat, ...at, prop: p.disguise.prop } : { seat: null, key: p.disguise.key, ...at, prop: p.disguise.prop };
      return { seat: p.seat, ...at, moving: p.moving, ghost: this.ghost(p) || undefined, hidden: p.hidden ? true : undefined };
    };
    return {
      phase: this.phase, round: this.round, time: +this.time.toFixed(2), timer: +Math.max(0, this.timer).toFixed(2),
      me: {
        seat, role: lobby ? null : me.role, alive: me.alive, spectator: me.spectator, ghost: this.ghost(me),
        vision: this.vision(me) === Infinity ? 0 : this.vision(me),
        tasks: me.tasks.map(t => { const def = taskById(t.id); return { id: t.id, name: def.name, step: t.step, steps: def.stations.length, station: def.stations[Math.min(t.step, def.stations.length - 1)], done: t.step >= def.stations.length }; }),
        task: me.task && { station: me.task.station, since: +(this.time - me.task.at).toFixed(2) },
        cooldown: mummy ? +me.cooldown.toFixed(1) : undefined,
        emergencies: me.emergencies, bellIn: +Math.max(0, this.nextBell - this.time).toFixed(1),
        hidden: me.hidden && { kind: me.hidden.kind, id: me.hidden.id, t: me.hidden.t != null ? +me.hidden.t.toFixed(1) : undefined },
        disguise: me.disguise && { prop: me.disguise.prop, t: +me.disguise.t.toFixed(1) },
        disguises: mummy ? me.disguises : undefined, hideCooldown: +me.hideCooldown.toFixed(1),
        frozen: me.frozen > 0 ? +me.frozen.toFixed(1) : undefined, stuck: me.stuck > 0 ? +me.stuck.toFixed(1) : undefined,
        sabCooldown: mummy ? +this.sabCooldown.toFixed(1) : undefined,
      },
      sabotage: this.sabotage && {
        kind: this.sabotage.kind, progress: +Math.min(1, this.sabotage.progress).toFixed(2), holders: this.sabotage.holders,
        t: SABOTAGES[this.sabotage.kind].critical || mummy ? +Math.max(0, this.sabotage.t).toFixed(1) : undefined,
        // The saboteur's side knows exactly when the guardian turns.
        next: mummy && this.sabotage.kind === 'momia' ? +(5 - ((this.timers.momia - this.sabotage.t) % 5) - (this.sabotage.looking ? 0 : this.timers.look)).toFixed(1) : undefined,
      },
      traps: mummy ? this.traps.map(({ x, z }) => ({ x, z })) : [],
      footprints: (this.footprints || []).filter(f => this.sees(me, f)).map(f => ({ x: f.x, z: f.z, h: f.h, age: +(this.time - f.t).toFixed(1) })),
      statues: this.statues.filter(s => this.sees(me, s)),
      meeting: this.meeting && this.meetingView(me),
      bar: this.bar(),
      world: this.worldFor(me),
      partners: mummy ? this.active().filter(p => p.role === 'momia' && p !== me).map(p => p.seat) : [],
      roster: [...this.players.values()].map(p => ({
        seat: p.seat, name: p.name, avatar: p.avatar, bot: p.bot || undefined, role: roleOf(p), spectator: p.spectator || undefined,
        out: (ended || p === me ? !p.alive : p.known) || undefined, ejected: p.ejected || undefined,
      })),
      players: lobby ? [] : [...this.players.values()].filter(p => this.seesPlayer(me, p)).map(pose),
      ending: this.ending,
      options: { reveal: this.options.reveal, chat: this.options.chat },
      events: this.events.filter(e => e.id > since && (!e.to || e.to.includes(seat))).map(({ to, ...e }) => e),
    };
  }
}

// action → [the phase it belongs to, handler(player, data)]
Night.prototype.actions = {
  task: ['playing', Night.prototype.startTask],
  done: ['playing', Night.prototype.finishTask],
  cancel: ['playing', Night.prototype.cancelTask],
  wrap: ['playing', Night.prototype.wrap],
  report: ['playing', Night.prototype.report],
  bell: ['playing', Night.prototype.ring],
  vent: ['playing', Night.prototype.vent],
  hide: ['playing', Night.prototype.hide],
  disguise: ['playing', Night.prototype.disguise],
  sabotage: ['playing', Night.prototype.sabotageAct],
  vote: ['meeting', Night.prototype.vote],
  chat: ['meeting', Night.prototype.chat],
};
