// Capis a Pintazos with friends: the room's table (who plays which team, the
// settings, the match) and how a guest keeps its own copy of the match. Pure
// (no DOM, no network): network.js runs it on the room's host, tests in Node.
//
//   const table = new CapisTable();                  // the host's
//   table.addPlayer(id, name, avatar);               // teams fill evenly
//   table.start(); table.update(dt, inputs);         // inputs: Map id → input
//   const snap = table.snapshot();                   // what guests get
//   view = mirror(view, snap).view;                  // a guest's own match
//
// Two teams of three capis. Up to four panas share them: on a team's turn the
// next pana of that team plays its capi (controllerOf); a team with no pana is
// the machine (bot.js), and so is a pana who drops in the middle of a turn. In
// a free-for-all each pana has a capi of its own and the machine plays the rest.
// The ground never travels: snapshots carry the list of edits since the
// map was made from its seed (rules.js applyEdit), and a guest replays them.
import { createMatch, tickMatch, takeEvents, activeCapy, alive, applyEdit, fire, selectWeapon, canUse, TOMB_SHAPES, FFA_CAPIS } from './rules.js';
import { createBot } from './bot.js';
import { smallestTeam } from '../../../engine/play/team-balance.js';
import { defaultOptions, roomOptions } from './options.js';
import { mapSeed, SEED_LIMIT } from './map-rules.js';
import { createSetup, choose, place, unplace, launch, setOwner, dropPlayer, resolveSpawns, seedOf, groundOf } from './setup-rules.js';

export const MAX_PLAYERS = 4, TEAM_MAX = 3;
const STEP = 1 / 60;
// Edits and events a snapshot carries when nobody needs the whole list: more than a tick makes.
const EDIT_TAIL = 6, EVENT_TAIL = 16;
const newSeed = (random = Math.random) => 1 + Math.floor(random() * (SEED_LIMIT - 1));
const num = v => Number.isFinite(v) ? v : 0;
const unit = v => Math.max(-1, Math.min(1, num(v)));

// A guest's held keys, cleaned: walk, aim (held or pointed), face, jump presses.
export function cleanInput(raw) {
  const out = { x: unit(raw?.x), aim: unit(raw?.aim), jump: Number.isSafeInteger(raw?.jump) && raw.jump >= 0 ? raw.jump : 0 };
  if (Number.isFinite(raw?.aimTo)) out.aimTo = Math.max(-2, Math.min(2, raw.aimTo));
  if (raw?.face === 1 || raw?.face === -1) out.face = raw.face;
  return out;
}

// The pana whose capi it is: on a team's k-th turn its panas take turns in the
// order they arrived. null: the machine plays.
export function controllerOf(players, match) {
  const t = match?.turn;
  if (!t || match.phase === 'finished') return null;
  const team = players.filter(p => p.team === t.team);
  return team.length ? team[((t.k || 1) - 1) % team.length].id : null;
}
export const teamOf = (players, id) => players.find(p => p.id === id)?.team ?? null;
// How many sides a match of these options has.
export const sidesOf = options => options?.mode === 'ffa' ? FFA_CAPIS : 2;
// Which of the `sides` the machine plays (no pana in them).
export const botTeams = (players, sides = 2) => Array.from({ length: sides }, (_, team) => team).filter(team => !players.some(p => p.team === team));
const makeBots = (sides, difficulty, seed) => Array.from({ length: sides }, (_, team) => createBot({ team, difficulty, seed: seed + 1 + team }));

export class CapisTable {
  constructor(prev = null, random = Math.random) {
    this.random = random;
    this.phase = 'lobby'; this.revision = 0;
    this.options = { ...defaultOptions(), ...(prev?.options || {}) };
    this.seed = mapSeed(prev?.seed) ?? newSeed(random);
    this.players = []; this.match = null; this.bots = [null, null];
    this.log = []; this.eventN = 0; this.acc = 0;
    this.pending = null; this.jumps = new Map(); this.fullEdits = 0;
    // A free-for-all's setup (setup-rules.js) between start and the first turn; the host's id runs it.
    this.setup = null; this.hostId = null; this.rejects = {}; this.rejectN = 0;
  }
  setHost(id) { this.hostId = id; if (this.setup) this.setup.hostId = id; }

  // A new host continues from the last snapshot and its own copy of the match.
  static restore(state, view, random) {
    const t = new CapisTable(state, random);
    t.phase = state?.phase === 'play' && view ? 'play' : 'lobby';
    t.revision = state?.revision || 0; t.players = (state?.players || []).map(p => ({ ...p }));
    t.eventN = Math.max(0, ...(state?.events || []).map(e => e.n));
    if (t.phase === 'play') {
      t.match = view;
      t.bots = makeBots(view.teams, view.options.difficulty, view.seed);
    }
    if (state?.phase === 'setup' && state.setup) {
      const s = state.setup;
      t.setup = { ...createSetup({ setupSeed: s.setupSeed, owners: s.owners }), pick: s.pick, rev: s.rev, places: { ...s.places } };
      t.phase = 'setup';
    }
    t.fullEdits = 40;
    return t;
  }

  addPlayer(id, name, avatar = {}) {
    const known = this.players.find(p => p.id === id);
    if (known) { Object.assign(known, { name, avatar }); this.revision++; return known; }
    if (this.players.length >= MAX_PLAYERS) return null;
    const p = { id, name, avatar, team: this.seatFor() };
    this.players.push(p); this.revision++;
    if (this.setup && p.team != null) setOwner(this.setup, p.team, id);
    // A newcomer needs the whole ground: send every edit for a couple of seconds.
    this.fullEdits = 40;
    return p;
  }
  // A newcomer's side: the smaller team, or in a free-for-all the first capi nobody has.
  seatFor() {
    const count = team => this.players.filter(p => p.team === team).length;
    if (this.options.mode === 'ffa') return Array.from({ length: FFA_CAPIS }, (_, team) => team).find(team => !count(team));
    return smallestTeam([count(0), count(1)], 0);
  }
  // The mode changed: everyone sits again, in the order they arrived.
  reseat() {
    const all = this.players; this.players = [];
    for (const p of all) { p.team = this.seatFor(); this.players.push(p); }
  }
  removePlayer(id) {
    const before = this.players.length;
    this.players = this.players.filter(p => p.id !== id); this.jumps.delete(id);
    if (this.setup) dropPlayer(this.setup, id);
    if (this.players.length !== before) this.revision++;
  }
  // A pana changes team in the lobby (the host may move anyone).
  setTeam(id, team) {
    const p = this.players.find(q => q.id === id);
    if (this.phase !== 'lobby' || this.options.mode === 'ffa' || !p || (team !== 0 && team !== 1) || p.team === team) return false;
    if (this.players.filter(q => q.team === team).length >= TEAM_MAX) return false;
    p.team = team; this.revision++; return true;
  }
  // The tombstone a pana chose (tombs.js): shown on its team's capis, first pana's choice first.
  setTomb(id, shape) {
    const p = this.players.find(q => q.id === id);
    if (!p || !TOMB_SHAPES.includes(shape) || p.tomb === shape) return false;
    p.tomb = shape; this.revision++; return true;
  }
  looks() {
    const out = {};
    for (const p of this.players) if (p.tomb && out[p.team] == null) out[p.team] = p.tomb;
    return out;
  }
  configure(patch) {
    if (this.phase !== 'lobby') return false;
    const next = roomOptions(this.options, patch || {});
    if (!next) return false;
    const moved = next.mode !== this.options.mode;
    this.options = next; if (moved) this.reseat();
    this.revision++; return true;
  }
  setSeed(seed) {
    const s = mapSeed(seed);
    if (this.phase !== 'lobby' || s == null) return false;
    this.seed = s; this.revision++; return true;
  }

  // Start: a free-for-all from the lobby goes to its setup first; from the
  // setup (the host's call, any time) it launches on the chosen map and starts.
  start() {
    if (this.phase === 'play' && this.match?.phase !== 'finished') return false;
    const { seconds, difficulty, size, mode } = this.options;
    let spawnXs = null;
    if (this.phase === 'lobby' && mode === 'ffa') {
      const owners = {}; for (const p of this.players) if (p.team != null) owners[p.team] = p.id;
      this.setup = createSetup({ setupSeed: this.seed, hostId: this.hostId, owners });
      this.phase = 'setup'; this.rejects = {}; this.revision++;
      return true;
    }
    if (this.phase === 'setup') {
      const done = launch(this.setup, this.setup.hostId, groundOf(seedOf(this.setup)), FFA_CAPIS);
      if (!done.ok) return false;
      this.seed = done.seed; spawnXs = done.spawns; this.setup = null;
    }
    this.match = createMatch({ seconds, difficulty, seed: this.seed, size, mode, looks: this.looks(), spawnXs });
    this.bots = makeBots(this.match.teams, difficulty, this.match.seed);
    this.phase = 'play'; this.acc = 0; this.pending = null; this.jumps.clear(); this.fullEdits = 40;
    this.record(takeEvents(this.match)); this.revision++;
    return true;
  }
  // Back to the lobby with a new map (LiveRoom answers the host's 'lobby' action with this).
  toLobby() {
    if (this.phase === 'lobby') return false;
    this.phase = 'lobby'; this.match = null; this.setup = null; this.seed = newSeed(this.random); this.revision++;
    return true;
  }

  // A setup message from pana `id`: the host switches the map, anyone places
  // or lifts its own capis. A turned-down one is remembered for that pana.
  setupAct(id, action, data = {}) {
    const s = this.setup;
    if (this.phase !== 'setup' || !s) return { ok: false, reason: 'locked' };
    const rev = Number.isSafeInteger(data.rev) ? data.rev : -1, capi = Number(data.capi);
    const r = action === 'pick' ? choose(s, id, data.index, rev)
      : action === 'place' ? place(s, id, capi, Number(data.x), groundOf(seedOf(s)), rev)
      : action === 'unplace' ? unplace(s, id, capi, rev) : { ok: false, reason: 'bad-action' };
    if (r.ok) this.revision++; else { this.rejects[id] = { reason: r.reason, n: ++this.rejectN }; }
    return r;
  }

  get controller() { return controllerOf(this.players, this.match); }

  // A shot or a weapon from the pana whose turn it is; the next step applies it.
  act(id, action, data = {}) {
    const m = this.match;
    if (this.phase !== 'play' || !m || m.phase !== 'aim' || id !== this.controller) return false;
    const c = activeCapy(m);
    if (action === 'weapon') return canUse(m, c.team, data.weapon) && selectWeapon(m, data.weapon);
    if (action === 'fire' && Number.isFinite(data.power)) {
      // The aim it fired at: what the shooter saw on its screen, not where its last input left it.
      this.pending = { power: data.power, turn: m.turn.n, aim: Number.isFinite(data.aim) ? data.aim : null, face: data.face === 1 || data.face === -1 ? data.face : null };
      return true;
    }
    return false;
  }

  // Steps the match with the controller's latest input (or the machine's).
  update(dt, inputs = new Map()) {
    const m = this.match;
    if (this.phase !== 'play' || !m || m.phase === 'finished') return;
    this.acc = Math.min(this.acc + dt, .25);
    while (this.acc >= STEP && m.phase !== 'finished') {
      this.acc -= STEP;
      const c = activeCapy(m), who = this.controller;
      let input;
      // Jump presses count per pana, on every turn: a capi only sees a press made on its own.
      const pressed = new Set();
      for (const [id, value] of inputs) {
        const jump = cleanInput(value).jump, before = this.jumps.get(id);
        if (before != null && jump !== before) pressed.add(id);
        this.jumps.set(id, jump);
      }
      if (who == null) input = c && alive(c) ? this.bots[c.team].input(m) : {};
      else {
        // No keys from it (yet, or they expired): its capi stands still.
        const raw = cleanInput(inputs.get(who));
        input = { x: raw.x, aim: raw.aim, aimTo: raw.aimTo, face: raw.face, jump: (c?.jumpPress || 0) + (pressed.has(who) ? 1 : 0) };
        const p = this.pending;
        if (p && p.turn === m.turn.n && m.phase === 'aim') {
          if (p.aim != null) input.aimTo = p.aim;
          if (p.face != null) input.face = p.face;
          input.fire = p.power;
        }
        this.pending = null;
      }
      tickMatch(m, STEP, input);
      this.record(takeEvents(m));
    }
  }

  record(events) {
    for (const e of events) {
      this.log.push({ ...e, n: ++this.eventN });
      if (e.type === 'finished') this.revision++;
    }
    if (this.log.length > EVENT_TAIL * 2) this.log.splice(0, this.log.length - EVENT_TAIL);
  }

  snapshot() {
    const full = this.fullEdits > 0;
    if (full) this.fullEdits--;
    return { phase: this.phase, revision: this.revision, options: { ...this.options }, seed: this.seed,
      players: this.players.map(p => ({ ...p })), controller: this.controller,
      match: this.match ? matchView(this.match, full) : null, events: this.log.slice(-EVENT_TAIL),
      setup: this.setup && setupView(this.setup, this.rejects) };
  }
}

// What every client draws of the setup: the maps, the picks, every capi's start.
export function setupView(s, rejects = {}) {
  return { setupSeed: s.setupSeed, seeds: [...s.seeds], pick: s.pick, rev: s.rev, owners: { ...s.owners }, places: { ...s.places },
    spawns: resolveSpawns(s, groundOf(seedOf(s)), FFA_CAPIS), rejects: { ...rejects } };
}

// What changes during a match, without the map, the ground or the event queue.
export function matchView(m, full = true) {
  const base = full ? 0 : Math.max(0, m.edits.length - EDIT_TAIL);
  return { mapSeed: m.map.seed, size: m.map.size, seed: m.seed, phase: m.phase, winner: m.winner, endedBy: m.endedBy ?? null,
    wind: m.wind, turn: m.turn && { ...m.turn }, clock: m.clock, shots: m.shots, options: { ...m.options },
    last: [...m.last], teamTurns: [...m.teamTurns], ammo: m.ammo.map(a => ({ ...a })), used: { ...m.used },
    crates: m.crates.map(k => ({ ...k })), crateN: m.crateN, tombs: m.tombs.map(t => ({ ...t })),
    capys: m.capys.map(c => ({ ...c })), shells: m.shells.map(s => ({ ...s })),
    editCount: m.edits.length, editBase: base, edits: m.edits.slice(base) };
}

// A guest's (or a new host's) own match, kept level with the host's: the same
// map from the seed, the host's edits replayed onto its ground, the rest copied.
// `gap`: edits were missed (ask the host for all of them).
export function mirror(view, snap) {
  const s = snap?.match;
  if (!s) return { view: null, gap: false };
  if (!view || view.map.seed !== s.mapSeed || view.map.size !== s.size || view.mode !== (s.options?.mode || 'teams') || view.edits.length > s.editCount || (s.turn?.n ?? 0) < (view.turn?.n ?? 0)) {
    view = createMatch({ seed: s.mapSeed, size: s.size, seconds: s.options?.seconds, difficulty: s.options?.difficulty, mode: s.options?.mode });
    view.events.length = 0;
  }
  if (view.edits.length < s.editBase) return { view, gap: true };
  for (const e of s.edits.slice(view.edits.length - s.editBase)) { view.edits.push(e); applyEdit(view.mask, e); }
  for (const k of ['seed', 'phase', 'winner', 'endedBy', 'wind', 'turn', 'clock', 'shots', 'options', 'last', 'teamTurns', 'ammo', 'used', 'shells', 'crates', 'crateN', 'tombs']) view[k] = s[k];
  view.shot = view.shells[0] || null;
  for (const c of s.capys) { const mine = view.capys.find(k => k.id === c.id); if (mine) Object.assign(mine, c); }
  return { view, gap: false };
}

// The events a client has not handled yet (n above `seen`), in order.
export const freshEvents = (snap, seen) => (snap?.events || []).filter(e => e.n > seen);
