// Curiara race simulation. Pure: the host runs it, guests render snapshots.
// Boats move with paddle thrust relative to the water plus the river's
// current; the river (river.js) owns banks, levels and currents.
import { paddleState, stroke, hold, rudder, sync, step as pull, PADDLE } from './paddle.js';
import { RIVER, clamp, angle } from './river.js';

export const FORMATS = { todos: { boats: 8, seats: 1 }, parejas: { boats: 4, seats: 2 } };
export const BOAT = Object.freeze({ drag: .6, grip: 5, yawDamp: 2.6, brake: 2.6, reverse: -1.1, half: .62, length: 2.9, rudderSpeed: 3 });
export const COLORS = ['#e2683c', '#2f9e8f', '#e6b33a', '#7a5bc4', '#d64f7a', '#4d8fd6', '#8fb84a', '#c9824a'];
const BOT_NAMES = ['Yanomami', 'Tuki', 'Arekuna', 'Wayuu', 'Chamán', 'Kerepakupai', 'Piaroa', 'Maipure', 'Yekuana', 'Sanema', 'Baré', 'Curripaco'];
const BOT_OUTFITS = ['#d6553d', '#3f8f7a', '#e1a83a', '#6c58b8', '#c94f74', '#4a86c8', '#7fa848', '#b97a46'];
const START = { rows: [26, 18.5, 11, 3.5], offsets: [-2.1, 2.1] };

export function cleanInput(input = {}) {
  const strokes = Array.isArray(input.strokes) ? input.strokes.slice(-8).filter(s => Array.isArray(s) && Number.isFinite(s[0]) && Number.isFinite(s[2])).map(([seq, side, t]) => [seq | 0, side < 0 ? -1 : 1, +t]) : [];
  return { strokes, back: !!input.back, steer: clamp(Math.sign(Number(input.steer) || 0), -1, 1), splash: Number(input.splash) | 0 };
}

// Seeded so a race replays the same way on any host.
export function seeded(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Race {
  constructor(river = RIVER) {
    this.river = river;
    Object.assign(this, { phase: 'lobby', format: 'todos', time: 0, countdown: 3, players: [], boats: [], finishGrace: null, raceId: 0, seed: 1 });
  }
  addPlayer(id, name, avatar = {}, seat = null) {
    let p = this.players.find(p => p.id === id);
    if (p) { p.avatar = avatar; if (seat !== undefined) this.chooseSeat(id, seat); return p; }
    // Late arrivals watch until the next start so no one gets a shortened race.
    p = { id, name: String(name || 'pana').slice(0, 16), avatar, bot: false, seat: null, spectator: this.phase !== 'lobby' && this.phase !== 'finished' };
    this.players.push(p);
    if (seat) this.chooseSeat(id, seat);
    return p;
  }
  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
    // A boat that loses its pana mid-race keeps going with a bot in that seat.
    for (const b of this.boats) for (const c of b.crew) if (c.id === id) this.takeSeat(b, c);
  }
  takeSeat(b, c) {
    Object.assign(c, { bot: true, id: `bot-${b.id}-${c.seat}`, brain: this.brain(c.seat + Number(b.id.slice(1)) * 2) });
    c.brain.seq = b.seen[c.seat] ?? 0;
  }
  setFormat(format) { if (FORMATS[format] && (this.phase === 'lobby' || this.phase === 'finished')) { this.format = format; for (const p of this.players) p.seat = null; } }
  // Parejas seat picker: {boat: 0–3, pos: 0 proa | 1 popa}, or null for any seat.
  chooseSeat(id, seat) {
    const p = this.players.find(p => p.id === id); if (!p) return false;
    if (!seat) { p.seat = null; return true; }
    const boat = seat.boat | 0, pos = seat.pos ? 1 : 0;
    if (boat < 0 || boat >= FORMATS.parejas.boats) return false;
    if (this.players.some(o => o !== p && o.seat && o.seat.boat === boat && o.seat.pos === pos)) return false;
    p.seat = { boat, pos }; return true;
  }
  brain(i) {
    const r = seeded(this.seed * 977 + i * 131);
    // Skill sets rhythm accuracy and line error; igapó takers gamble on the cut.
    return { skill: .62 + .33 * r(), phase: r() * 6.28, next: .2 + r() * .5, igapo: r() < .35, lane: r(), seq: 0, r: Math.floor(r() * 1e9) };
  }
  // Which pana sits where. Chosen seats first, then join order, then bots.
  crews() {
    const { boats, seats } = FORMATS[this.format], humans = this.players.filter(p => !p.bot);
    const grid = Array.from({ length: boats }, () => Array(seats).fill(null));
    if (seats === 2) for (const p of humans) if (p.seat && !grid[p.seat.boat][p.seat.pos]) grid[p.seat.boat][p.seat.pos] = p;
    const free = humans.filter(p => !grid.flat().includes(p));
    // Fill canoe by canoe so two friends without a pick share one.
    for (let b = 0; b < boats && free.length; b++) for (let s = 0; s < seats && free.length; s++) if (!grid[b][s]) grid[b][s] = free.shift();
    return grid;
  }
  start(bots = true, seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed;
    const grid = this.crews(), seats = FORMATS[this.format].seats;
    let botIndex = 0;
    this.boats = [];
    grid.forEach((crew, i) => {
      if (!bots && crew.every(c => !c)) return;
      const members = crew.map((p, seat) => p
        ? { id: p.id, name: p.name, avatar: p.avatar, bot: false, seat }
        : { id: `bot-c${i}-${seat}`, name: BOT_NAMES[(botIndex + this.seed) % BOT_NAMES.length], avatar: { outfitColor: BOT_OUTFITS[botIndex++ % 8], hat: botIndex % 3 ? 'none' : 'cap' }, bot: true, seat, brain: this.brain(i * 2 + seat) });
      // Without bots an empty back seat stays empty; the front pana steers.
      if (!bots && seats === 2) for (const c of members) if (c.bot) c.empty = true;
      this.boats.push(this.newBoat(`c${i}`, members, this.boats.length));
    });
    for (const p of this.players) p.spectator = false;
    Object.assign(this, { phase: 'countdown', countdown: 3, time: 0, finishGrace: null });
    this.raceId++;
  }
  newBoat(id, crew, slot) {
    const row = Math.floor(slot / 2), q = this.river.at(START.rows[row % 4] - Math.floor(row / 4) * 30, START.offsets[slot % 2]);
    const level = this.river.levelAt(q.s, START.offsets[slot % 2]);
    return { id, crew, color: COLORS[Number(id.slice(1)) % 8], x: q.x, z: q.z, h: q.h, v: 0, lat: 0, w: 0, y: level, vy: 0, air: 0,
      s: q.s, progress: q.s, u: 0, channel: 'main', checkpoint: 0, finish: null, tip: 0, capsized: 0, capsizes: 0, hits: 0, remazos: 0, strokes: 0,
      splashCd: 0, splashes: 0, sprayed: 0, jolt: 0, gx: 0, gz: 0, eddy: 0, seen: {}, paddle: paddleState(), place: slot + 1 };
  }
  // A bot's strokes for this tick, as the same input a pana would send.
  botFront(b, c, dt) {
    const k = c.brain, look = 12 + b.v * 1.3;
    const target = this.lineTarget(b, c, look), err = angle(Math.atan2(target.x - b.x, target.z - b.z) - b.h);
    k.next -= dt;
    const input = { strokes: [], back: false, steer: 0 };
    // Badly off line and nearly stopped: back-paddle to pivot round.
    if (Math.abs(err) > 1.2 && b.v < 2.5) { input.back = true; input.steer = err > 0 ? -1 : 1; k.next = .3; return input; }
    if (k.next <= 0) {
      // Everyone wobbles a little; now and then a bot loses the rhythm.
      const roll = seeded(k.r++), gap = PADDLE.sweet[0] + .005 + (1 - k.skill) * .2, noise = (roll() - .5) * (.08 + (1 - k.skill) * .3);
      k.next = roll() < .035 + (1 - k.skill) * .04 ? .75 + roll() * .5 : Math.max(.27, gap + noise);
      // Turn strokes repeat the side that pushes the bow toward the line.
      const want = err > 0 ? 1 : -1, need = Math.abs(err) > .3 - k.skill * .06;
      const side = need ? want : -(b.paddle.side || want);
      input.strokes.push([++k.seq, side, this.time]);
    }
    return input;
  }
  lineTarget(b, c, look) {
    const river = this.river, k = c.brain;
    if (river.branch && k.igapo && b.channel !== 'main' || (river.branch && k.igapo && b.s > river.branch.from - 25 && b.s < river.branch.from + 2)) {
      const u = b.channel === 'branch' ? b.u : 0;
      return river.branch.path.at(Math.min(river.branch.length, u + look));
    }
    const s = Math.min(river.LENGTH, b.s + look);
    return river.at(s, this.racingLine(s, k));
  }
  racingLine(s, k) {
    const river = this.river, half = river.halfWidth(s) - 1.6;
    let line = river.def.chorro(s) + Math.sin(s * .05 + k.phase) * (1 - k.skill) * Math.min(3, half);
    for (const d of river.drops) if (s > d.s - d.span - 30 && s < d.s + d.span + 4) {
      const lanes = d.lanes, pick = k.skill > .82 ? lanes.find(l => l.fast) || lanes[0] : lanes[Math.floor(k.lane * lanes.length)];
      line = (pick.from + pick.to) / 2;
    }
    return clamp(line, -half, half);
  }
  update(dt, inputs = new Map()) {
    dt = clamp(dt, 0, .05);
    if (this.phase === 'countdown') {
      // Strokes before the start don't bank up for the first tick.
      for (const b of this.boats) for (const c of b.crew) if (!c.bot) for (const [seq] of cleanInput(inputs.get(c.id)).strokes) b.seen[c.seat] = Math.max(b.seen[c.seat] ?? -1, seq);
      this.countdown -= dt; if (this.countdown <= 0) { this.phase = 'racing'; this.countdown = 0; } return;
    }
    if (this.phase !== 'racing') return;
    this.time += dt;
    for (const b of this.boats) this.steer(b, dt, inputs);
    for (const b of this.boats) this.move(b, dt);
    this.order();
    const humans = this.boats.filter(b => b.crew.some(c => !c.bot));
    if (this.boats.some(b => b.finish !== null) && this.finishGrace === null) this.finishGrace = this.time + 30;
    if ((humans.length && humans.every(b => b.finish !== null)) || this.boats.every(b => b.finish !== null) || (this.finishGrace !== null && this.time >= this.finishGrace) || this.time >= 240) this.phase = 'finished';
  }
  // Inputs → paddle. Todos: one pana does everything. Parejas: proa strokes,
  // popa steers, brakes, calls ¡Ahora! and throws the salpicón.
  steer(b, dt, inputs) {
    const P = b.paddle, two = b.crew.length === 2;
    const read = c => c.empty ? { strokes: [], back: false, steer: 0, splash: 0 } : c.bot ? (two && c.seat === 1 ? this.botBack(b, c, dt) : this.botFront(b, c, dt)) : cleanInput(inputs.get(c.id));
    const fresh = (c, list) => { const last = b.seen[c.seat] ?? -1, out = list.filter(s => s[0] > last); if (list.length) b.seen[c.seat] = Math.max(last, ...list.map(s => s[0])); return out.sort((x, y) => x[2] - y[2]); };
    const front = b.crew[0], back = two ? b.crew[1] : front, fi = read(front), bi = two ? read(back) : fi;
    if (b.finish !== null || b.capsized > 0) { b.seen[0] = Math.max(b.seen[0] ?? -1, ...fi.strokes.map(s => s[0])); if (two) b.seen[1] = Math.max(b.seen[1] ?? -1, ...bi.strokes.map(s => s[0])); hold(P, false); rudder(P, 0); return; }
    const pivot = two && back.empty ? fi.steer : bi.steer;
    hold(P, bi.back || (two && back.empty && fi.back), pivot);
    rudder(P, two && !back.empty && !bi.back ? bi.steer : 0);
    for (const [, side, t] of fresh(front, fi.strokes)) {
      const q = stroke(P, side, Math.min(t, this.time));
      if (q !== 'ciar') b.strokes++;
      if (q === 'remazo') b.remazos++;
    }
    if (two) for (const [, , t] of fresh(back, bi.strokes)) sync(P, Math.min(t, this.time));
    b.splashWant = (two ? bi.splash : fi.splash) > (b.seen.splash ?? 0);
    b.seen.splash = Math.max(b.seen.splash ?? 0, two ? bi.splash : fi.splash);
  }
  botBack(b, c, dt) {
    const k = c.brain, target = this.lineTarget(b, c, 9 + b.v), err = angle(Math.atan2(target.x - b.x, target.z - b.z) - b.h);
    const input = { strokes: [], back: false, steer: Math.abs(err) > .08 ? (err > 0 ? -1 : 1) : 0 };
    // Calls ¡Ahora! on the proa's stroke, as often as its skill allows.
    if (b.paddle.last != null && b.paddle.last > (k.called ?? -1) && this.time - b.paddle.last < .06 && seeded(k.r++)() < k.skill * .8) { k.called = b.paddle.last; input.strokes.push([++k.seq, 1, b.paddle.last + .03]); }
    return input;
  }
  move(b, dt) {
    const river = this.river, out = pull(b.paddle, dt);
    b.splashCd = Math.max(0, b.splashCd - dt); b.sprayed = Math.max(0, b.sprayed - dt); b.jolt = Math.max(0, b.jolt - dt);
    if (b.finish !== null) { b.v *= Math.exp(-1.5 * dt); }
    else {
      b.v += out.thrust;
      if (out.brake) b.v += clamp(BOAT.reverse - b.v, -BOAT.brake * dt, BOAT.brake * dt);
      b.w += out.yaw;
    }
    b.v -= BOAT.drag * b.v * dt;
    b.w *= Math.exp(-BOAT.yawDamp * dt);
    b.lat *= Math.exp(-BOAT.grip * dt);
    const where = river.locate(b.x, b.z, b), flow = river.currentAt(b.x, b.z, where);
    const turn = out.turn - out.rudder * PADDLE.rudder * clamp(Math.abs(b.v) / BOAT.rudderSpeed, .3, 1.2);
    b.h = angle(b.h + (b.w + turn + flow.swirl) * dt);
    const fx = Math.sin(b.h), fz = Math.cos(b.h);
    b.gx = fx * b.v - fz * b.lat + flow.x; b.gz = fz * b.v + fx * b.lat + flow.z; b.eddy = flow.eddy;
    b.x += b.gx * dt; b.z += b.gz * dt;
    this.banks(b, dt);
    this.water(b, dt);
    this.advance(b);
  }
  // Soft banks: push back in and lose the speed into them.
  banks(b) {
    const w = this.river.locate(b.x, b.z, b);
    const limit = w.half - BOAT.half;
    if (w.distance > limit) {
      const nx = (b.x - w.x) / (w.distance || 1), nz = (b.z - w.z) / (w.distance || 1), push = w.distance - limit;
      b.x -= nx * push; b.z -= nz * push;
      const fx = Math.sin(b.h), fz = Math.cos(b.h), into = fx * nx + fz * nz;
      // Glance off: lose the speed into the bank and swing along it.
      if (into > 0) {
        b.v *= 1 - .5 * into;
        const along = Math.abs(angle(w.h - b.h)) < Math.PI / 2 ? w.h : w.h + Math.PI;
        b.h = angle(b.h + angle(along - b.h) * Math.min(1, .25 * into));
      }
      b.lat *= .5;
    }
  }
  water(b, dt) {
    const w = this.river.locate(b.x, b.z, b), level = this.river.levelAt(w.s, w.offset);
    if (b.y > level + .02 || b.vy > 0) { b.vy -= 9.8 * dt; b.y += b.vy * dt; b.air += dt; }
    if (b.y <= level) { b.landing = b.air > .12 ? -b.vy : 0; b.y = level; b.vy = 0; b.air = 0; }
  }
  advance(b) {
    const river = this.river, w = river.locate(b.x, b.z, b), delta = w.s - b.s;
    Object.assign(b, { s: w.s, u: w.u, channel: w.channel, offset: w.offset });
    if (Math.abs(delta) < 8) b.progress = Math.max(b.progress, b.progress + delta);
    if (b.checkpoint < river.gates.length && b.progress >= river.gates[b.checkpoint]) b.checkpoint++;
    if (b.finish === null && b.checkpoint >= river.gates.length && b.progress >= river.LENGTH - 4) b.finish = this.time;
  }
  order() {
    standings(this).forEach((b, i) => { b.place = i + 1; });
  }
  boatOf(id) { return this.boats.find(b => b.crew.some(c => c.id === id)); }
  snapshot() {
    return JSON.parse(JSON.stringify({ phase: this.phase, format: this.format, time: this.time, countdown: this.countdown, players: this.players, boats: this.boats, finishGrace: this.finishGrace, raceId: this.raceId, seed: this.seed }));
  }
  static restore(snapshot, members, river = RIVER) {
    const race = new Race(river);
    Object.assign(race, JSON.parse(JSON.stringify(snapshot)));
    race.players = race.players.filter(p => p.bot || members.has(p.id));
    for (const b of race.boats) for (const c of b.crew) if (!c.bot && !members.has(c.id)) race.takeSeat(b, c);
    return race;
  }
}

export function standings(state) {
  return state.boats.slice().sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.progress - a.progress);
}
