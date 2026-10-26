// Curiara race simulation. Pure: the host runs it, guests render snapshots.
// Boats move with paddle thrust relative to the water plus the river's
// current; the river (river.js) owns banks, levels and currents.
import { paddleState, stroke, hold, rudder, sync, step as pull, PADDLE } from '/engine/play/paddle.js';
import { FIELDS, cleanOptions } from './options.js';
import { canMoveSeats } from '../../../engine/play/seat-rules.js';
import { applyRoomOptions } from '../../../engine/room-options-rules.js';
import { configuredRiver, RIVER, TONINA, clamp, angle } from './river.js';

export const FORMATS = { todos: { boats: 8, seats: 1 }, parejas: { boats: 4, seats: 2 }, duos: { boats: 2, seats: 2 }, triples: { boats: 3, seats: 2 } };
export const CAPSIZE = 1.8;
export const PHOTO = Object.freeze({ within: 7, gap: 2.2, real: 1.6, speed: .3 });
export const SALPICON = Object.freeze({ cooldown: 4, reach: 2.5, shove: 2.6, tip: 12, spray: 1.3 });
export const CAIMAN = Object.freeze({ reach: 3, tip: 40, jolt: 2.2 });
// Remo automático: W held strokes steadily for you, a little below a good
// rhythm, so learning the ring still pays.
export const AUTO = Object.freeze({ gap: .42, power: 1.05 });
export const BOAT = Object.freeze({ drag: .6, grip: 5, yawDamp: 2.6, brake: 2.6, reverse: -1.1, half: .62, length: 2.9, rudderSpeed: 3 });
export const COLORS = ['#e2683c', '#2f9e8f', '#e6b33a', '#7a5bc4', '#d64f7a', '#4d8fd6', '#8fb84a', '#c9824a'];
const BOT_NAMES = ['Yanomami', 'Tuki', 'Arekuna', 'Wayuu', 'Chamán', 'Kerepakupai', 'Piaroa', 'Maipure', 'Yekuana', 'Sanema', 'Baré', 'Curripaco']; // i18n-ignore: bot names
const BOT_OUTFITS = ['#d6553d', '#3f8f7a', '#e1a83a', '#6c58b8', '#c94f74', '#4a86c8', '#7fa848', '#b97a46'];
const START = { rows: [26, 18.5, 11, 3.5], offsets: [-2.1, 2.1] };

export function cleanInput(input = {}) {
  const strokes = Array.isArray(input.strokes) ? input.strokes.slice(-8).filter(s => Array.isArray(s) && Number.isFinite(s[0]) && Number.isFinite(s[2])).map(([seq, side, t]) => [seq | 0, side < 0 ? -1 : 1, +t]) : [];
  return { strokes, back: !!input.back, steer: clamp(Math.sign(Number(input.steer) || 0), -1, 1), splash: Number(input.splash) | 0, auto: !!input.auto };
}

// Seeded so a race replays the same way on any host.
export function seeded(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Race {
  constructor(river = RIVER) {
    this.river = river; this.options = cleanOptions();
    Object.assign(this, { phase: 'lobby', format: 'todos', time: 0, countdown: 3, players: [], boats: [], finishGrace: null, raceId: 0, seed: 1, snaps: {} });
  }
  configure(patch = {}) {
    if (!['lobby','finished'].includes(this.phase)) return false;
    const next = applyRoomOptions(FIELDS,this.options,patch); if (!next) return false;
    const changed = next.river !== this.options.river || next.falls !== this.options.falls || next.items !== this.options.items;
    this.options = next; this.setFormat(next.crew);
    if (changed) { this.river = configuredRiver(next); }
    this.boats = []; return true;
  }
  canStart() { const f = FORMATS[this.format]; return this.players.filter(p => !p.bot).length <= f.boats * f.seats; }
  addPlayer(id, name, avatar = {}, seat = null) {
    let p = this.players.find(p => p.id === id);
    if (p) { p.avatar = avatar; p.name = String(name || p.name).slice(0, 16); return p; }
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
  setFormat(format) { if (FORMATS[format] && (this.phase === 'lobby' || this.phase === 'finished')) { const changed = this.format !== format; this.format = format; this.options.crew = format; if(changed) for (const p of this.players) p.seat = null; } }
  // Parejas seat picker: {boat: 0–3, pos: 0 proa | 1 popa}, or null for any seat.
  chooseSeat(id, seat) {
    const p = this.players.find(p => p.id === id); if (!p || !['lobby','finished'].includes(this.phase)) return false;
    if (!seat) { p.seat = null; return true; }
    if(!Number.isInteger(seat.boat)||![0,1].includes(seat.pos))return false;
    const boat = seat.boat, pos = seat.pos;
    if (boat < 0 || boat >= FORMATS[this.format].boats) return false;
    if (this.players.some(o => o !== p && o.seat && o.seat.boat === boat && o.seat.pos === pos)) return false;
    p.seat = { boat, pos }; return true;
  }
  brain(i) {
    const r = seeded(this.seed * 977 + i * 131);
    // Skill sets rhythm accuracy and line error; igapó takers gamble on the cut.
    return { skill: .66 + .29 * r(), phase: r() * 6.28, next: .2 + r() * .5, igapo: r() < .35, lane: r(), seq: 0, r: Math.floor(r() * 1e9) };
  }
  // Which pana sits where. Chosen seats first, then join order, then bots.
  crews() { return crewGrid(this.players, this.format); }
  moveSeat(actorId, from, to, hostId) {
    if (!['lobby', 'finished'].includes(this.phase) || FORMATS[this.format].seats !== 2) return false;
    const grid = this.crews(), flat = grid.flat();
    if (!canMoveSeats(flat, from, to, actorId, hostId) || !this.players.some(p => p.id === actorId)) return false;
    [flat[from], flat[to]] = [flat[to], flat[from]];
    flat.forEach((p, index) => { if (p) p.seat = { boat: Math.floor(index / 2), pos: index % 2 }; });
    return true;
  }
  start(bots = this.options.bots, seed = Math.floor(Math.random() * 1e9)) {
    if(!this.canStart())return false;
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
    Object.assign(this, { phase: 'countdown', countdown: 3, time: 0, finishGrace: null, snaps: {}, photo: null, slowmo: 0 });
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
    const input = { strokes: [], back: false, steer: 0, splash: k.splash || 0 };
    // A canoe right alongside? Sometimes it gets a ¡Salpicón!.
    if (b.splashCd <= 0 && this.boats.some(o => o !== b && Math.hypot(o.x - b.x, o.z - b.z) < 2.6) && seeded(k.r++)() < .04) input.splash = k.splash = (k.splash || 0) + 1;
    // Badly off line and nearly stopped: back-paddle to pivot round.
    if (Math.abs(err) > 1.2 && b.v < 2.5 && !(b.crew.length === 2 && !b.crew[1].bot && !b.crew[1].empty)) { input.back = true; input.steer = err > 0 ? -1 : 1; k.next = .3; return input; }
    if (k.next <= 0) {
      // Everyone wobbles a little; now and then a bot loses the rhythm.
      const roll = seeded(k.r++), gap = PADDLE.sweet[0] + .005 + (1 - k.skill) * .2, noise = (roll() - .5) * (.08 + (1 - k.skill) * .3);
      k.next = roll() < .035 + (1 - k.skill) * .04 ? .75 + roll() * .5 : Math.max(.27, gap + noise);
      // Turn strokes repeat the side that pushes the bow toward the line.
      // With a pana on the helm behind, a bot in the proa just paddles.
      const helm = b.crew.length === 2 && !b.crew[1].bot && !b.crew[1].empty;
      const want = err > 0 ? 1 : -1, need = !helm && Math.abs(err) > .3 - k.skill * .06;
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
    // Good bots skim the remolino's edge with the current; others keep clear.
    const w = river.whirl;
    if (w && s > w.s - 28 && s < w.s + 10) line = Math.min(line, w.offset - w.r - (k.skill > .86 ? .2 : 2.8));
    // And they give the caimanes a wide berth (the clumsy ones forget).
    if (k.skill > .75) for (const log of river.logs) if (log.caiman && log.s > s - 6 && log.s < s + 14 && Math.sign(line) === log.side) line = -log.side * 1.2;
    if (k.skill > .72 && this.options.items) for (const c of river.caimanesAt(this.time)) if (c.s > s - 6 && c.s < s + 20 && Math.abs(line - c.offset) < 4) line = c.offset - c.dir * 4.5;
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
    // A photo finish: the two leaders reach the line together, so the race
    // runs slowly for a moment on every screen (the host owns the clock).
    if (!this.photo && this.boats.length > 1 && this.boats.every(b => b.finish === null)) {
      const [a, b] = standings(this);
      if (this.river.LENGTH - a.progress < PHOTO.within && a.progress - b.progress < PHOTO.gap) { this.photo = { at: this.time, ids: [a.id, b.id] }; this.slowmo = PHOTO.real; }
    }
    if (this.slowmo > 0) { this.slowmo = Math.max(0, this.slowmo - dt); dt *= PHOTO.speed; }
    this.time += dt;
    for (const b of this.boats) this.steer(b, dt, inputs);
    for (const b of this.boats) this.splash(b);
    for (const b of this.boats) this.move(b, dt);
    this.collide();
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
    const pivot = two && back.empty ? fi.steer : bi.steer, auto = fi.auto && !front.bot && !fi.back;
    hold(P, bi.back || (two && back.empty && fi.back), pivot);
    // With the remo automático, the front pana's A/D are a rudder.
    rudder(P, two && !back.empty && !bi.back ? bi.steer : auto ? fi.steer : 0);
    for (const [, side, t] of fresh(front, fi.strokes)) {
      const at = Math.min(t, this.time);
      if(this.options.paddling === 'tap' && P.last != null && at-P.last < .25)continue;
      const q = stroke(P, side, at);
      if(this.options.paddling === 'tap' && q !== 'ciar'){P.pulls.at(-1)[0]=PADDLE.impulse;P.quality='bueno';P.power=1;}
      if (q !== 'ciar') b.strokes++;
      if (q === 'remazo' && this.options.paddling === 'rhythm') b.remazos++;
    }
    if (auto && !P.back && (P.last == null || this.time - P.last >= AUTO.gap)) {
      const q = stroke(P, -(P.side || 1), this.time);
      if (q !== 'ciar') { P.pulls.at(-1)[0] = PADDLE.impulse * AUTO.power; Object.assign(P, { quality: 'bueno', power: AUTO.power, streak: 0 }); b.strokes++; }
    }
    if (two) for (const [, , t] of fresh(back, bi.strokes)) sync(P, Math.min(t, this.time));
    b.splashWant = (two ? bi.splash : fi.splash) > (b.seen.splash ?? 0);
    b.seen.splash = Math.max(b.seen.splash ?? 0, two ? bi.splash : fi.splash);
  }
  botBack(b, c, dt) {
    const k = c.brain, target = this.lineTarget(b, c, 9 + b.v), err = angle(Math.atan2(target.x - b.x, target.z - b.z) - b.h);
    const input = { strokes: [], back: false, steer: Math.abs(err) > .08 ? (err > 0 ? -1 : 1) : 0, splash: k.splash || 0 };
    if (b.splashCd <= 0 && this.boats.some(o => o !== b && Math.hypot(o.x - b.x, o.z - b.z) < 2.6) && seeded(k.r++)() < .04) input.splash = k.splash = (k.splash || 0) + 1;
    // Calls ¡Ahora! on the proa's stroke, as often as its skill allows.
    if (b.paddle.last != null && b.paddle.last > (k.called ?? -1) && this.time - b.paddle.last < .06 && seeded(k.r++)() < k.skill * .8) { k.called = b.paddle.last; input.strokes.push([++k.seq, 1, b.paddle.last + .03]); }
    return input;
  }
  move(b, dt) {
    const river = this.river, out = pull(b.paddle, dt);
    b.splashCd = Math.max(0, b.splashCd - dt); b.sprayed = Math.max(0, b.sprayed - dt); b.jolt = Math.max(0, b.jolt - dt); b.grace = Math.max(0, (b.grace || 0) - dt);
    if (b.capsized > 0) {
      // Upside down: the panas swim it back; the river keeps carrying it.
      b.capsized = Math.max(0, b.capsized - dt);
      b.v *= Math.exp(-3 * dt); b.lat *= Math.exp(-3 * dt); b.w *= Math.exp(-3 * dt);
      // Righted and pointing downstream again.
      if (b.capsized === 0) { b.tip = 0; b.grace = 1; b.paddle.pulls = []; b.h = river.locate(b.x, b.z, b).h; }
    } else if (b.finish !== null) b.v *= Math.exp(-1.5 * dt);
    else {
      b.v += out.thrust;
      if (out.brake) b.v += clamp(BOAT.reverse - b.v, -BOAT.brake * dt, BOAT.brake * dt);
      b.w += out.yaw;
    }
    b.v -= BOAT.drag * b.v * dt;
    b.w *= Math.exp(-BOAT.yawDamp * dt);
    b.lat *= Math.exp(-BOAT.grip * dt);
    const where = river.locate(b.x, b.z, b), flow = river.currentAt(b.x, b.z, where), drift = b.capsized > 0 ? .7 : 1;
    const currentScale = {normal:1,slow:.6,hard:1.45}[this.options.current];
    flow.x*=currentScale;flow.z*=currentScale;flow.swirl*=this.options.rapids==='easy'?.45:1;
    if(this.options.steeringHelp && !b.capsized && !b.paddle.back && !b.paddle.rudder && Math.abs(angle(where.h-b.h))<1.4)b.h=angle(b.h+clamp(angle(where.h-b.h),-dt*.7,dt*.7));
    const turn = b.capsized > 0 ? 0 : out.turn - out.rudder * PADDLE.rudder * clamp(Math.abs(b.v) / BOAT.rudderSpeed, .3, 1.2);
    b.h = angle(b.h + (b.w + turn + flow.swirl) * dt);
    const fx = Math.sin(b.h), fz = Math.cos(b.h);
    // Toninas' wake: a two-second strip of fast water.
    let boost = 0;
    if (this.options.items && where.channel === 'main') for (const pod of river.toninasAt(this.time)) if (pod.wake && where.s > pod.s - 2 && where.s < pod.s + TONINA.length && Math.abs(where.offset - pod.offset) < TONINA.width) boost = TONINA.push;
    if (boost && !b.boost) b.toninas = (b.toninas || 0) + 1;
    b.boost = boost;
    const ux = Math.sin(where.h), uz = Math.cos(where.h);
    b.gx = fx * b.v - fz * b.lat + (flow.x + ux * boost) * drift; b.gz = fz * b.v + fx * b.lat + (flow.z + uz * boost) * drift; b.eddy = flow.eddy;
    b.x += b.gx * dt; b.z += b.gz * dt;
    b.whirl = river.whirl ? Math.max(0, 1 - Math.hypot(b.x - river.whirl.x, b.z - river.whirl.z) / river.whirl.r) : 0;
    this.banks(b, dt);
    this.water(b, dt);
    this.hazards(b, dt, where);
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
    b.landing = 0;
    if (b.y > level + .02 || b.vy > 0) { b.vy -= 9.8 * dt; b.y += b.vy * dt; b.air += dt; }
    if (b.y <= level) {
      if (b.air > .12) {
        // A raudal landing: hard and crooked drops rock the canoe.
        const impact = -b.vy, crooked = Math.abs(Math.sin(angle(b.h - w.h)));
        b.landing = impact; b.drops = (b.drops || 0) + 1;
        this.tip(b, Math.max(0, impact - 2.6) * 13 + crooked * impact * 14, 'raudal');
      }
      b.y = level; b.vy = 0; b.air = 0;
    }
  }
  tip(b, amount, cause) {
    if (b.capsized > 0 || b.grace > 0 || b.finish !== null || !(amount > 0)) return;
    if(['raudal','remolino'].includes(cause)&&this.options.rapids==='easy')amount*=.35;
    if(['choque','roca'].includes(cause)&&this.options.collisions==='soft')amount*=.3;
    b.tip = Math.min(100, b.tip + amount); b.tipCause = cause;
    if (b.tip >= 100) {
      Object.assign(b, { capsized: CAPSIZE, capsizes: b.capsizes + 1, v: 0, w: 0, tip: 100 });
      b.paddle.pulls = []; b.rollSide = b.lastHitSide || 1;
    }
  }
  // Circles along the hull: stern, middle and bow.
  hull(b) { const fx = Math.sin(b.h), fz = Math.cos(b.h); return [-1.9, 0, 1.9].map(d => ({ x: b.x + fx * d, z: b.z + fz * d, d })); }
  // Push the hull out of a fixed circle; return how hard it hit.
  bump(b, cx, cz, r) {
    let worst = 0;
    for (const c of this.hull(b)) {
      const dx = c.x - cx, dz = c.z - cz, dist = Math.hypot(dx, dz) || 1e-3, gap = r + BOAT.half - dist;
      if (gap <= 0) continue;
      const nx = dx / dist, nz = dz / dist;
      b.x += nx * gap; b.z += nz * gap;
      const into = -(b.gx * nx + b.gz * nz);
      if (into <= 0) continue;
      // Take the speed into the rock out of the hull's own frame, and spin it.
      const fx = Math.sin(b.h), fz = Math.cos(b.h), dvx = nx * into * 1.25, dvz = nz * into * 1.25, side = -nx * fz + nz * fx;
      b.v += dvx * fx + dvz * fz; b.lat += -dvx * fz + dvz * fx; b.w += c.d * (-dvx * fz + dvz * fx) * .22;
      b.gx += dvx; b.gz += dvz;
      b.lastHitSide = -Math.sign(side) || 1;
      worst = Math.max(worst, into * (.35 + Math.abs(side)));
    }
    return worst;
  }
  hazards(b, dt, where) {
    const river = this.river;
    let contact = false;
    if (b.finish === null) {
      // Rocks and the igapó trunks.
      for (const list of this.options.items ? [river.rocks, river.snags] : []) for (const r of list) if (Math.abs(r.x - b.x) < 5 && Math.abs(r.z - b.z) < 5) {
        const hit = this.bump(b, r.x, r.z, r.r);
        if (hit > 0) contact = true;
        // Only a fresh knock rocks the canoe; leaning on a rock does not.
        if (hit > .6 && this.time - (b.lastHit ?? -9) > .5) { this.tip(b, hit * 15, 'roca'); b.hits++; b.lastHit = this.time; }
      }
      // Pinned against rocks, the current swings the canoe round to slip past.
      b.pinned = contact ? (b.pinned || 0) + dt : 0;
      if (b.pinned > .5) { const along = Math.abs(angle(where.h - b.h)) < Math.PI / 2 ? where.h : where.h + Math.PI; b.h = angle(b.h + clamp(angle(along - b.h), -1.6 * dt, 1.6 * dt)); }
      // The remolino's eye spins hard enough to roll you.
      if (b.whirl > .7) this.tip(b, 18 * dt, 'remolino');
      // Caimanes snap at canoes passing close, on the banks and swimming
      // across the open river; the logs just lie there.
      if (this.options.items && where.channel === 'main') {
        for (const log of river.logs) if (log.caiman && Math.abs(log.s - where.s) < 6) this.bite(b, log, -log.side);
        for (const c of river.caimanesAt(this.time)) if (Math.abs(c.s - where.s) < 8) this.bite(b, c, Math.sign(where.offset - c.offset) || 1);
      }
      // Channel buoys only nudge the hull aside.
      for (const r of river.buoys) if (Math.abs(r.x - b.x) < 4 && Math.abs(r.z - b.z) < 4) this.bump(b, r.x, r.z, r.r);
    }
    // Straight, steady paddling settles the canoe.
    const steady = b.paddle.last != null && this.time - b.paddle.last < .9 && !['giro', 'chapoteo'].includes(b.paddle.quality) && Math.abs(b.w) < .3;
    if (b.capsized === 0 && b.tip < 100) b.tip = Math.max(0, b.tip - (steady ? 14 : 4) * dt);
  }
  bite(b, c, away) {
    if (this.time - (this.snaps[c.id] ?? -99) < 4 || !this.hull(b).some(p => Math.hypot(p.x - c.x, p.z - c.z) < CAIMAN.reach)) return;
    this.snaps[c.id] = this.time;
    b.lat += away * CAIMAN.jolt; b.v *= .6; b.jolt = .6; b.lastHitSide = -away; b.bitten = (b.bitten || 0) + 1; b.caimanAt = this.time;
    this.tip(b, CAIMAN.tip, 'caimán'); // i18n-ignore: tip cause id
  }
  // Canoe against canoe: circles with mass. Bumping someone is fair play.
  collide() {
    const boats = this.boats.filter(b => b.capsized === 0);
    for (let i = 0; i < boats.length; i++) for (let j = i + 1; j < boats.length; j++) {
      const A = boats[i], B = boats[j];
      if (Math.abs(A.x - B.x) > 7 || Math.abs(A.z - B.z) > 7) continue;
      const ma = A.crew.filter(c => !c.empty).length, mb = B.crew.filter(c => !c.empty).length;
      for (const a of this.hull(A)) for (const c of this.hull(B)) {
        const dx = c.x - a.x, dz = c.z - a.z, dist = Math.hypot(dx, dz) || 1e-3, gap = BOAT.half * 2 - dist;
        if (gap <= 0) continue;
        const nx = dx / dist, nz = dz / dist, wa = mb / (ma + mb), wb = ma / (ma + mb);
        A.x -= nx * gap * wa; A.z -= nz * gap * wa; B.x += nx * gap * wb; B.z += nz * gap * wb;
        const closing = (A.gx - B.gx) * nx + (A.gz - B.gz) * nz;
        if (closing <= 0) continue;
        const impulse = closing * (this.options.collisions==='soft'?.45:1.3);
        for (const [boat, sign, share] of [[A, -1, wa], [B, 1, wb]]) {
          const fx = Math.sin(boat.h), fz = Math.cos(boat.h), dvx = sign * nx * impulse * share, dvz = sign * nz * impulse * share;
          boat.v += dvx * fx + dvz * fz; boat.lat += -dvx * fz + dvz * fx; boat.gx += dvx; boat.gz += dvz;
          boat.lastHitSide = Math.sign(-dvx * fz + dvz * fx) || 1;
        }
        if (closing > 1 && this.time - Math.max(A.lastBump ?? -9, B.lastBump ?? -9) > .5) {
          this.tip(A, closing * 11 * wa, 'choque'); this.tip(B, closing * 11 * wb, 'choque');
          A.bumps = (A.bumps || 0) + 1; B.bumps = (B.bumps || 0) + 1; A.lastBump = B.lastBump = this.time;
        }
      }
    }
  }
  // ¡Salpicón!: a sideways paddle slap at the nearest canoe within reach.
  splash(b) {
    if (!this.options.items || !b.splashWant || b.splashCd > 0 || b.capsized > 0 || b.finish !== null) return;
    b.splashWant = false; b.splashCd = SALPICON.cooldown; b.splashes++; b.splashAt = this.time;
    let target = null, best = Infinity;
    for (const o of this.boats) {
      if (o === b || o.capsized > 0 || o.finish !== null) continue;
      for (const a of this.hull(b)) for (const c of this.hull(o)) { const d = Math.hypot(a.x - c.x, a.z - c.z) - BOAT.half * 2; if (d < best) { best = d; target = o; } }
    }
    const fx = Math.sin(b.h), fz = Math.cos(b.h);
    if (!target || best > SALPICON.reach) { b.splashSide = 1; b.splashHit = null; return; }
    const dx = target.x - b.x, dz = target.z - b.z, d = Math.hypot(dx, dz) || 1, side = Math.sign(-dx * fz + dz * fx) || 1;
    b.splashSide = side; b.splashHit = target.id; b.soaked = (b.soaked || 0) + 1;
    const tx = Math.sin(target.h), tz = Math.cos(target.h), px = dx / d * SALPICON.shove, pz = dz / d * SALPICON.shove;
    target.lat += -px * tz + pz * tx; target.v += px * tx + pz * tz;
    target.sprayed = SALPICON.spray; target.lastHitSide = -side; target.splashedBy = b.id; target.splashedAt = this.time;
    this.tip(target, SALPICON.tip, 'salpicón'); // i18n-ignore: tip cause id
  }
  advance(b) {
    const river = this.river, w = river.locate(b.x, b.z, b), delta = w.s - b.s;
    Object.assign(b, { s: w.s, u: w.u, channel: w.channel, offset: w.offset });
    // Point to point: progress is the furthest s reached, never double counted.
    if (Math.abs(delta) < 8) b.progress = Math.max(b.progress, w.s);
    if (b.checkpoint < river.gates.length && b.progress >= river.gates[b.checkpoint]) b.checkpoint++;
    if (b.finish === null && b.checkpoint >= river.gates.length && b.progress >= river.LENGTH - 4) b.finish = this.time;
  }
  order() {
    standings(this).forEach((b, i) => { b.place = i + 1; });
  }
  boatOf(id) { return this.boats.find(b => b.crew.some(c => c.id === id)); }
  snapshot() {
    return JSON.parse(JSON.stringify({ options: this.options, phase: this.phase, format: this.format, time: this.time, countdown: this.countdown, players: this.players, boats: this.boats, finishGrace: this.finishGrace, raceId: this.raceId, seed: this.seed, snaps: this.snaps, photo: this.photo ?? null, slowmo: this.slowmo ?? 0 }));
  }
  static restore(snapshot, members, river = RIVER) {
    const race = new Race(river);
    Object.assign(race, JSON.parse(JSON.stringify(snapshot)));
    race.options=cleanOptions({...race.options,crew:race.format});
    if(river===RIVER)race.river=configuredRiver(race.options);
    race.players = race.players.filter(p => p.bot || members.has(p.id));
    for (const b of race.boats) for (const c of b.crew) if (!c.bot && !members.has(c.id)) race.takeSeat(b, c);
    return race;
  }
}

export function standings(state) {
  return state.boats.slice().sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.progress - a.progress);
}

// The lobby and start use exactly the same effective assignments, including automatic seats.
export function crewGrid(players, format) {
  const { boats, seats } = FORMATS[format], humans = players.filter(p => !p.bot);
  const grid = Array.from({ length: boats }, () => Array(seats).fill(null));
  if (seats === 2) for (const p of humans) if (p.seat && grid[p.seat.boat] && !grid[p.seat.boat][p.seat.pos]) grid[p.seat.boat][p.seat.pos] = p;
  const free = humans.filter(p => !grid.flat().includes(p));
  for (let b = 0; b < boats && free.length; b++) for (let pos = 0; pos < seats && free.length; pos++) if (!grid[b][pos]) grid[b][pos] = free.shift();
  return grid;
}
