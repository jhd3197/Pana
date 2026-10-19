// Lancha race simulation. Pure: the host runs it, guests render snapshots.
// A lancha is driven, not paddled: hold the throttle and steer the outboard.
// Holding is always fastest, so there is nothing to mash. The river
// (course.js on /engine/river/river.js) owns banks, levels and currents.
import { FIELDS, cleanOptions } from './options.js';
import { applyRoomOptions } from '../../../engine/room-options-rules.js';
import { courseRiver, RIVER } from './course.js';
import { TONINA, clamp, angle } from '../../../engine/river/river.js';

export const BOAT = Object.freeze({ accel: 8.4, drag: .56, brake: 9, reverse: -3.5, turn: 1.25, grip: 3.4, half: .8, hull: [-2, 0, 2] });
// Turbo: a meter filled by riding the chorro, clean jumps and the toninas'
// wake; Espacio spends half of it on a burst.
export const TURBO = Object.freeze({ seconds: 1.6, accel: 5, cost: 50, chorro: 5, idle: .8, jump: 30, tonina: 35 });
// How long the motor stays dead after each knock.
export const STALL = Object.freeze({ rock: .7, caiman: 1.1, landing: .9 });
export const CAIMAN = Object.freeze({ reach: 3.2, jolt: 3, slow: .5 });
export const PHOTO = Object.freeze({ within: 12, gap: 3.5, real: 1.6, speed: .3 });
export const COLORS = ['#e2683c', '#2f9e8f', '#e6b33a', '#7a5bc4', '#d64f7a', '#4d8fd6', '#8fb84a', '#c9824a'];
export const SLOTS = 8;
const RIVALS = { easy: { cap: .8, wobble: 1.5 }, normal: { cap: .93, wobble: 1 }, hard: { cap: 1, wobble: .5 } };
const BOT_NAMES = ['El Motorista', 'La Curva', 'Don Chalupa', 'La Garza', 'El Bagre', 'Tía Lancha', 'El Rayao', 'La Sardina', 'Cheo Motor', 'La Payara', 'El Morocoto', 'Yoli Fuera de Borda'];
const BOT_OUTFITS = ['#d6553d', '#3f8f7a', '#e1a83a', '#6c58b8', '#c94f74', '#4a86c8', '#7fa848', '#b97a46'];
const START = { rows: [34, 24], offsets: [-7.2, -2.4, 2.4, 7.2] };

export function cleanInput(input = {}) {
  return { throttle: input.throttle ? 1 : 0, steer: clamp(Number(input.steer) || 0, -1, 1), back: !!input.back, turbo: Number(input.turbo) | 0 };
}

// Seeded so a race replays the same way on any host.
export function seeded(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Race {
  constructor(river = RIVER) {
    this.river = river; this.options = cleanOptions();
    Object.assign(this, { phase: 'lobby', time: 0, countdown: 3, players: [], boats: [], finishGrace: null, raceId: 0, seed: 1, snaps: {}, photo: null, slowmo: 0 });
  }
  configure(patch = {}) {
    if (!['lobby', 'finished'].includes(this.phase)) return false;
    const next = applyRoomOptions(FIELDS, this.options, patch); if (!next) return false;
    const changed = next.falls !== this.options.falls || next.items !== this.options.items;
    this.options = next; if (changed) this.river = courseRiver(next);
    this.boats = []; return true;
  }
  addPlayer(id, name, avatar = {}) {
    let p = this.players.find(p => p.id === id);
    if (p) { p.avatar = avatar; p.name = String(name || p.name).slice(0, 16); return p; }
    // Late arrivals watch until the next start so no one gets a shortened race.
    p = { id, name: String(name || 'pana').slice(0, 16), avatar, spectator: !['lobby', 'finished'].includes(this.phase) };
    this.players.push(p); return p;
  }
  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
    // A lancha that loses its pana mid-race keeps going with a river driver.
    for (const b of this.boats) if (b.driver.id === id) this.takeHelm(b);
  }
  takeHelm(b) { Object.assign(b.driver, { bot: true, id: `bot-${b.id}`, brain: this.brain(Number(b.id.slice(1))) }); b.driver.brain.turbo = b.seen.turbo ?? 0; }
  canStart() { return this.players.length <= SLOTS; }
  brain(i) {
    const r = seeded(this.seed * 977 + i * 131);
    return { skill: .62 + .33 * r(), phase: r() * 6.28, igapo: r() < .3, turbo: 0, r: Math.floor(r() * 1e9) };
  }
  start(seed = Math.floor(Math.random() * 1e9)) {
    if (!this.canStart()) return false;
    this.seed = seed; this.boats = [];
    const humans = this.players.slice(0, SLOTS), bots = this.options.rivals === 'none' ? 0 : SLOTS - humans.length;
    humans.forEach(p => this.boats.push(this.newBoat({ id: p.id, name: p.name, avatar: p.avatar, bot: false })));
    for (let i = 0; i < bots; i++) {
      const slot = this.boats.length;
      this.boats.push(this.newBoat({ id: `bot-c${slot}`, name: BOT_NAMES[(i + this.seed) % BOT_NAMES.length], avatar: { outfitColor: BOT_OUTFITS[slot % 8], hat: i % 3 ? 'none' : 'cap' }, bot: true, brain: this.brain(slot) }));
    }
    for (const p of this.players) p.spectator = false;
    Object.assign(this, { phase: 'countdown', countdown: 3, time: 0, finishGrace: null, snaps: {}, photo: null, slowmo: 0 });
    this.raceId++; return true;
  }
  newBoat(driver) {
    const slot = this.boats.length, s0 = START.rows[Math.floor(slot / 4) % 2], offset = START.offsets[slot % 4], q = this.river.at(s0, offset);
    return { id: `c${slot}`, driver, color: COLORS[slot % 8], x: q.x, z: q.z, h: q.h, v: 0, lat: 0, w: 0, steer: 0, throttle: 0, y: this.river.levelAt(s0, offset), vy: 0, air: 0,
      s: s0, progress: s0, u: 0, offset, channel: 'main', checkpoint: 0, finish: null, stalled: 0, turbo: 0, meter: 0, turbos: 0, jumps: 0, hits: 0, bitten: 0, bumps: 0, toninas: 0,
      gx: 0, gz: 0, eddy: 0, whirl: 0, seen: {}, place: slot + 1 };
  }
  update(dt, inputs = new Map()) {
    dt = clamp(dt, 0, .05);
    if (this.phase === 'countdown') {
      // A turbo pressed before the start doesn't bank up for the first tick.
      for (const b of this.boats) if (!b.driver.bot) b.seen.turbo = Math.max(b.seen.turbo ?? 0, cleanInput(inputs.get(b.driver.id)).turbo);
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
    for (const b of this.boats) this.drive(b, dt, b.driver.bot ? this.botInput(b) : cleanInput(inputs.get(b.driver.id)));
    this.collide();
    standings(this).forEach((b, i) => { b.place = i + 1; });
    const humans = this.boats.filter(b => !b.driver.bot);
    if (this.boats.some(b => b.finish !== null) && this.finishGrace === null) this.finishGrace = this.time + 30;
    if ((humans.length && humans.every(b => b.finish !== null)) || this.boats.every(b => b.finish !== null) || (this.finishGrace !== null && this.time >= this.finishGrace) || this.time >= 300) this.phase = 'finished';
  }
  // A river driver: aims down the guide line, wobbling with less skill.
  botInput(b) {
    const k = b.driver.brain, river = this.river, look = 16 + Math.max(0, b.v) * 1.1, rival = RIVALS[this.options.rivals] || RIVALS.normal;
    let target;
    if (river.branch && k.igapo && k.skill > .7 && (b.channel === 'branch' || (b.s > river.branch.from - 40 && b.s < river.branch.from + 2))) target = river.branch.path.at(Math.min(river.branch.length, (b.channel === 'branch' ? b.u : 0) + look * .7));
    else {
      const s = Math.min(river.LENGTH, b.s + look), half = river.halfWidth(s) - 2;
      target = river.at(s, clamp(river.guideAt(s, this.time) + Math.sin(s * .02 + k.phase) * (1 - k.skill) * 6 * rival.wobble, -half, half));
    }
    const err = angle(Math.atan2(target.x - b.x, target.z - b.z) - b.h), turnAround = Math.abs(err) > 1.6 && b.v < 4;
    const input = { throttle: 1, steer: clamp(-err * 2.4, -1, 1), back: turnAround, turbo: k.turbo };
    if (turnAround) input.steer = -input.steer;
    b.botCap = rival.cap * (.94 + .06 * k.skill) * (Math.abs(err) > .7 ? .65 : 1);
    // Turbo on the straights, never right before a raudal.
    if (b.meter >= TURBO.cost && Math.abs(err) < .15 && !river.drops.some(d => b.s > d.s - d.span - 60 && b.s < d.s + d.span) && seeded(k.r++)() < .03 + k.skill * .03) input.turbo = ++k.turbo;
    return input;
  }
  drive(b, dt, input) {
    const river = this.river, help = this.options.steeringHelp;
    b.stalled = Math.max(0, b.stalled - dt); b.turbo = Math.max(0, b.turbo - dt); b.jolt = Math.max(0, (b.jolt || 0) - dt);
    const done = b.finish !== null, dead = b.stalled > 0 || done;
    // Turbo is a press: a counter that went up since the last tick.
    if (input.turbo > (b.seen.turbo ?? 0)) { if (!dead && b.meter >= TURBO.cost && b.turbo <= 0) { b.meter -= TURBO.cost; b.turbo = TURBO.seconds; b.turbos++; } b.seen.turbo = input.turbo; }
    const auto = this.options.throttle === 'auto' && !b.driver.bot;
    const throttle = dead || input.back ? 0 : (auto ? 1 : input.throttle) * (b.driver.bot ? b.botCap ?? 1 : 1);
    b.throttle = throttle; b.back = input.back && !dead;
    b.steer += (input.steer - b.steer) * Math.min(1, dt * 8);
    // Thrust along the hull, drag, brake or reverse.
    let a = BOAT.accel * throttle - BOAT.drag * b.v;
    if (b.turbo > 0) a += TURBO.accel;
    if (b.back) a = b.v > .5 ? -BOAT.brake : (BOAT.reverse - b.v) * 2.5;
    if (done) a = -1.5 * b.v;
    b.v += a * dt;
    // The outboard turns the stern: little bite when slow, a touch less flat out.
    const bite = clamp(Math.abs(b.v) / 4, .2, 1) * (1 - .2 * clamp((b.v - 10) / 5, 0, 1)), want = -b.steer * BOAT.turn * bite * (b.v < -.3 ? -1 : 1);
    b.w += (want - b.w) * Math.min(1, dt * 6);
    const where = river.locate(b.x, b.z, b), flow = river.currentAt(b.x, b.z, where), scale = { normal: 1, slow: .6, hard: 1.45 }[this.options.current] ?? 1;
    flow.x *= scale; flow.z *= scale;
    let turn = b.w + flow.swirl;
    // Ayuda de dirección: hands off the tiller, the lancha settles along the
    // river; near a bank it turns away from it.
    if (help && !done && Math.abs(input.steer) < .1 && !b.back) {
      const err = angle(where.h - b.h);
      if (Math.abs(err) < 1.3) turn += clamp(err * 1.4, -.7, .7);
      const into = Math.sign(where.offset) * Math.sin(angle(b.h - where.h)) * -1;
      if (where.edge > -6 && into > .05) turn += Math.sign(where.offset) * .9;
    }
    // Turning keeps the water speed's direction for a moment: the hull slides.
    const dh = turn * dt, cos = Math.cos(dh), sin = Math.sin(dh), v = b.v * cos - b.lat * sin;
    b.lat = b.v * sin + b.lat * cos; b.v = v; b.h = angle(b.h + dh);
    b.lat *= Math.exp(-BOAT.grip * dt);
    // Toninas' wake: a strip of fast water that also fills the turbo.
    let boost = 0;
    if (this.options.items && where.channel === 'main') for (const pod of river.toninasAt(this.time)) if (pod.wake && where.s > pod.s - 2 && where.s < pod.s + TONINA.length && Math.abs(where.offset - pod.offset) < TONINA.width * 1.4) boost = TONINA.push;
    if (boost && !b.boost) { b.toninas++; b.meter = Math.min(100, b.meter + TURBO.tonina); }
    b.boost = boost;
    if (!done && where.channel === 'main' && river.def.chorroBoost(where.s) > .5 && Math.abs(where.offset - river.def.chorro(where.s)) < 2.6) b.meter = Math.min(100, b.meter + TURBO.chorro * dt);
    else if (!done) b.meter = Math.min(100, b.meter + TURBO.idle * dt);
    const fx = Math.sin(b.h), fz = Math.cos(b.h), ux = Math.sin(where.h), uz = Math.cos(where.h);
    b.gx = fx * b.v - fz * b.lat + flow.x + ux * boost; b.gz = fz * b.v + fx * b.lat + flow.z + uz * boost; b.eddy = flow.eddy;
    b.x += b.gx * dt; b.z += b.gz * dt;
    b.whirl = river.whirl ? Math.max(0, 1 - Math.hypot(b.x - river.whirl.x, b.z - river.whirl.z) / river.whirl.r) : 0;
    // The remolino's eye spins a lancha round.
    if (b.whirl > .7) b.w += river.whirl.spin * 2.5 * dt;
    this.banks(b);
    this.water(b, dt);
    this.hazards(b, where);
    this.advance(b);
  }
  // Soft banks: push back in, lose the speed into them, glance along.
  banks(b) {
    const w = this.river.locate(b.x, b.z, b), limit = w.half - BOAT.half;
    if (w.distance <= limit) return;
    const nx = (b.x - w.x) / (w.distance || 1), nz = (b.z - w.z) / (w.distance || 1), push = w.distance - limit;
    b.x -= nx * push; b.z -= nz * push;
    const into = Math.sin(b.h) * nx + Math.cos(b.h) * nz;
    if (into > 0) {
      if (into * b.v > 4 && this.time - (b.lastBank ?? -9) > .6) { b.bumps++; b.lastBank = this.time; }
      b.v *= 1 - .55 * into;
      const along = Math.abs(angle(w.h - b.h)) < Math.PI / 2 ? w.h : w.h + Math.PI;
      b.h = angle(b.h + angle(along - b.h) * Math.min(1, .3 * into));
    }
    b.lat *= .5;
  }
  // Raudales: the lancha flies off each step, faster than the water falls.
  water(b, dt) {
    const w = this.river.locate(b.x, b.z, b), level = this.river.levelAt(w.s, w.offset);
    b.landing = 0;
    // On the water the hull rides the river's gentle slope; only a step
    // falling away faster than that launches it.
    if (b.air === 0 && b.vy <= 0 && b.y - level < .08) { b.y = level; return; }
    // Leaving the lip at speed throws the bow up: a real jump.
    if (b.air === 0 && b.vy <= 0 && b.v > 6) b.vy = b.v * .14;
    b.vy -= 9.8 * dt; b.y += b.vy * dt; b.air += dt;
    if (b.y <= level) {
      if (b.air > .25 && b.finish === null) {
        const impact = -b.vy, crooked = Math.abs(Math.sin(angle(b.h - w.h)));
        b.landing = impact;
        if (crooked > .55 && impact > 3) { b.stalled = Math.max(b.stalled, STALL.landing); b.v *= .7; b.crashes = (b.crashes || 0) + 1; }
        else { b.jumps++; if (crooked < .35) b.meter = Math.min(100, b.meter + TURBO.jump); }
      }
      b.y = level; b.vy = 0; b.air = 0;
    }
  }
  // Circles along the hull: stern, middle and bow.
  hull(b) { const fx = Math.sin(b.h), fz = Math.cos(b.h); return BOAT.hull.map(d => ({ x: b.x + fx * d, z: b.z + fz * d, d })); }
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
      const fx = Math.sin(b.h), fz = Math.cos(b.h), dvx = nx * into * 1.2, dvz = nz * into * 1.2;
      b.v += dvx * fx + dvz * fz; b.lat += -dvx * fz + dvz * fx; b.w += c.d * (-dvx * fz + dvz * fx) * .18;
      b.gx += dvx; b.gz += dvz;
      worst = Math.max(worst, into);
    }
    return worst;
  }
  hazards(b, where) {
    const river = this.river;
    if (b.finish !== null) return;
    let contact = false;
    for (const list of this.options.items ? [river.rocks, river.snags] : []) for (const r of list) if (Math.abs(r.x - b.x) < 6 && Math.abs(r.z - b.z) < 6) {
      const hit = this.bump(b, r.x, r.z, r.r);
      if (hit > 0) contact = true;
      // A fresh, hard knock kills the motor for a moment.
      if (hit > 5 * (this.options.collisions === 'soft' ? 1.6 : 1) && this.time - (b.lastHit ?? -9) > .6) { b.stalled = Math.max(b.stalled, STALL.rock); b.hits++; b.lastHit = this.time; }
    }
    for (const r of river.buoys) if (Math.abs(r.x - b.x) < 4 && Math.abs(r.z - b.z) < 4) this.bump(b, r.x, r.z, r.r);
    // Pinned on rocks, the current swings the hull round to slip past.
    b.pinned = contact ? (b.pinned || 0) + .05 : 0;
    if (b.pinned > .5) { const along = Math.abs(angle(where.h - b.h)) < Math.PI / 2 ? where.h : where.h + Math.PI; b.h = angle(b.h + clamp(angle(along - b.h), -.08, .08)); }
    // Caimanes: on the caño's banks and swimming across the Orinoco.
    if (this.options.items && where.channel === 'main') {
      for (const log of river.logs) if (log.caiman && Math.abs(log.s - where.s) < 7) this.bite(b, log, -log.side);
      for (const c of river.caimanesAt(this.time)) if (Math.abs(c.s - where.s) < 9) this.bite(b, c, Math.sign(where.offset - c.offset) || 1);
    }
  }
  bite(b, c, away) {
    if (this.time - (this.snaps[c.id] ?? -99) < 4 || !this.hull(b).some(p => Math.hypot(p.x - c.x, p.z - c.z) < CAIMAN.reach)) return;
    this.snaps[c.id] = this.time;
    b.lat += away * CAIMAN.jolt; b.v *= CAIMAN.slow; b.jolt = .6; b.bitten++; b.caimanAt = this.time;
    b.stalled = Math.max(b.stalled, STALL.caiman);
  }
  // Lancha against lancha: equal circles. Bumping someone is fair play.
  collide() {
    const soft = this.options.collisions === 'soft';
    for (let i = 0; i < this.boats.length; i++) for (let j = i + 1; j < this.boats.length; j++) {
      const A = this.boats[i], B = this.boats[j];
      if (Math.abs(A.x - B.x) > 8 || Math.abs(A.z - B.z) > 8 || A.air > 0 || B.air > 0) continue;
      for (const a of this.hull(A)) for (const c of this.hull(B)) {
        const dx = c.x - a.x, dz = c.z - a.z, dist = Math.hypot(dx, dz) || 1e-3, gap = BOAT.half * 2 - dist;
        if (gap <= 0) continue;
        const nx = dx / dist, nz = dz / dist;
        A.x -= nx * gap / 2; A.z -= nz * gap / 2; B.x += nx * gap / 2; B.z += nz * gap / 2;
        const closing = (A.gx - B.gx) * nx + (A.gz - B.gz) * nz;
        if (closing <= 0) continue;
        const impulse = closing * (soft ? .4 : .9);
        for (const [boat, sign] of [[A, -1], [B, 1]]) {
          const fx = Math.sin(boat.h), fz = Math.cos(boat.h), dvx = sign * nx * impulse, dvz = sign * nz * impulse;
          boat.v += dvx * fx + dvz * fz; boat.lat += -dvx * fz + dvz * fx; boat.gx += dvx; boat.gz += dvz;
        }
        if (closing > 2 && this.time - Math.max(A.lastBump ?? -9, B.lastBump ?? -9) > .5) { A.bumps++; B.bumps++; A.lastBump = B.lastBump = this.time; }
      }
    }
  }
  advance(b) {
    const river = this.river, w = river.locate(b.x, b.z, b), delta = w.s - b.s;
    Object.assign(b, { s: w.s, u: w.u, channel: w.channel, offset: w.offset });
    // Point to point: progress is the furthest s reached, never double counted.
    if (Math.abs(delta) < 14) b.progress = Math.max(b.progress, w.s);
    if (b.checkpoint < river.gates.length && b.progress >= river.gates[b.checkpoint]) b.checkpoint++;
    if (b.finish === null && b.checkpoint >= river.gates.length && b.progress >= river.LENGTH - 5) b.finish = this.time;
  }
  boatOf(id) { return this.boats.find(b => b.driver.id === id); }
  snapshot() {
    return JSON.parse(JSON.stringify({ options: this.options, phase: this.phase, time: this.time, countdown: this.countdown, players: this.players, boats: this.boats, finishGrace: this.finishGrace, raceId: this.raceId, seed: this.seed, snaps: this.snaps, photo: this.photo, slowmo: this.slowmo }));
  }
  static restore(snapshot, members) {
    const race = new Race();
    Object.assign(race, JSON.parse(JSON.stringify(snapshot)));
    race.options = cleanOptions(race.options); race.river = courseRiver(race.options);
    race.players = race.players.filter(p => members.has(p.id));
    for (const b of race.boats) if (!b.driver.bot && !members.has(b.driver.id)) race.takeHelm(b);
    return race;
  }
}

export function standings(state) {
  return state.boats.slice().sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.progress - a.progress);
}
