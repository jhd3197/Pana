// Parapente race simulation. Pure: the host runs it, guests render snapshots
// and predict their own wing with the same fly(). The course (course.js) owns
// beacons, thermals, rings and the ground under them.
import { clamp } from '../../../engine/random.js';
import { defaultOptions, roomOptions, migrateRivals } from './options.js';
import { airAt, targetOf, remaining, outside } from './course.js';

// Airspeed in m/s and sink in m/s for each control. Brakes sink least and turn
// tightest; the speed bar is fast and sinks most; big ears (orejas) only sink.
export const WING = Object.freeze({ trim: 16, bar: 22, brake: 11, accel: 1.4, sink: 1.45, barSink: 1.25, brakeSink: -.3, ears: 3.4, turnSink: 1.7, yaw: .78, brakeYaw: .5 });
// A ring's push: extra airspeed and a fraction of the sink while it lasts.
export const BOOST = Object.freeze({ seconds: 3, speed: 7, sink: .3 });
// A touchdown off the diana: seconds on the ground before the relaunch, and how high it puts you.
export const DOWN = Object.freeze({ seconds: 2.5, above: 55, contact: .4 });
// Touching down off the diana but within `near` metres still finishes, with a penalty.
export const LANDING = Object.freeze({ near: 150, perMetre: .2, cap: 25 });
export const COUNTDOWN = 3, LIMIT = 360, GRACE = 5, SLOTS = 8, BOT_SEAT = 1000;
export const COLORS = ['#2fa3e0', '#ff8a1f', '#ffc629', '#e8443a', '#8e4de8', '#2ad1b2', '#f15bb5', '#5fc93a'];
const BOT_NAMES = ['La Zamura', 'El Cóndor', 'Doña Brisa', 'El Turpial', 'La Térmica', 'Cheo Alas', 'La Guacamaya', 'El Gavilán', 'Tía Nube', 'El Colibrí']; // i18n-ignore: bot names
const BOT_FUR = ['#cf7d22', '#d4914f', '#e0a463', '#c47f42', '#e8b97f', '#b06d3b', '#9a6038'];
const RIVALS = { easy: { skill: [.45, .65] }, normal: { skill: [.65, .85] }, hard: { skill: [.85, 1] } };

export const angle = a => Math.atan2(Math.sin(a), Math.cos(a));

export function cleanInput(raw = {}) {
  return { steer: clamp(Number(raw.steer) || 0, -1, 1), bar: !!raw.bar, brake: !!raw.brake, ears: !!raw.ears };
}

// One wing for dt seconds. Touches only the pilot; the host and a guest's
// prediction call this very function.
export function fly(course, p, dt, input, time = 0) {
  if (p.finish !== null) return p;
  if (p.down > 0) {
    p.down = Math.max(0, p.down - dt);
    if (p.down === 0) relaunch(course, p);
    return p;
  }
  const c = cleanInput(input), boost = p.boost > 0;
  p.steer += (c.steer - p.steer) * Math.min(1, dt * 5);
  p.bar = c.bar && !c.brake ? 1 : 0; p.brake = c.brake ? 1 : 0; p.ears = c.ears ? 1 : 0;
  const want = (p.bar ? WING.bar : p.brake ? WING.brake : WING.trim) + (boost ? BOOST.speed : 0);
  p.v += (want - p.v) * Math.min(1, dt * WING.accel);
  const yaw = (WING.yaw + p.brake * WING.brakeYaw) * (p.bar ? .7 : 1) * (p.ears ? .6 : 1);
  p.h = angle(p.h - p.steer * yaw * dt);
  const sink = (WING.sink + p.bar * WING.barSink + p.brake * WING.brakeSink + p.ears * WING.ears) * (1 + WING.turnSink * p.steer * p.steer) * (boost ? BOOST.sink : 1);
  p.lift = airAt(course, p.x, p.y, p.z);
  p.vy = p.lift - sink;
  p.x += Math.sin(p.h) * p.v * dt; p.z += Math.cos(p.h) * p.v * dt;
  p.y = Math.min(course.ceiling, p.y + p.vy * dt);
  p.boost = Math.max(0, p.boost - dt);
  for (const ring of course.rings) {
    if (p.rings.includes(ring.id) || Math.hypot(ring.x - p.x, ring.y - p.y, ring.z - p.z) > ring.r) continue;
    p.rings.push(ring.id); p.boost = BOOST.seconds;
  }
  const next = course.beacons[p.beacon];
  if (next && Math.hypot(next.x - p.x, next.z - p.z) < next.r) { p.beacon++; p.splits.push(+time.toFixed(2)); }
  // Too far off the course (out over Caracas, say): back over the last beacon.
  if (outside(course, p)) { p.down = DOWN.seconds; p.downs++; p.outs++; p.v = 0; return p; }
  const ground = course.groundAt(p.x, p.z);
  p.agl = p.y - ground;
  if (p.agl > DOWN.contact) return p;
  p.y = ground + DOWN.contact; p.vy = 0;
  // After the last beacon a touchdown near the diana finishes: off the
  // painted circle it costs seconds per metre. Anywhere else is a relaunch.
  const L = course.landing, miss = Math.hypot(L.x - p.x, L.z - p.z);
  p.v = 0;
  if (p.beacon >= course.beacons.length && miss < LANDING.near) {
    p.penalty = +Math.min(LANDING.cap, Math.max(0, miss - L.r) * LANDING.perMetre).toFixed(2);
    p.finish = +(time + p.penalty).toFixed(2); p.miss = +miss.toFixed(1);
  } else { p.down = DOWN.seconds; p.downs++; }
  return p;
}

// Back in the air over the last beacon passed, pointed at the next one.
function relaunch(course, p) {
  const from = p.beacon > 0 ? course.beacons[p.beacon - 1] : course.launch, to = targetOf(course, p.beacon);
  const ground = course.groundAt(from.x, from.z);
  Object.assign(p, { x: from.x, z: from.z, y: Math.max(ground + DOWN.above, from.ref ?? from.y), h: Math.atan2(to.x - from.x, to.z - from.z), v: WING.trim, vy: 0, steer: 0, boost: 0 });
}

export function standings(state) {
  return state.pilots.slice().sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.progress - a.progress);
}

export class Race {
  constructor(course = null, seed = Date.now()) {
    this.course = course;
    this.seed = (seed >>> 0) || 1;
    this.options = defaultOptions();
    this.players = []; this.pilots = [];
    this.phase = 'lobby'; this.time = 0; this.countdown = 0; this.raceId = 0; this.closing = 0;
  }

  // The course is rebuilt by every client from the map; it never travels.
  snapshot() { const { course, ...rest } = this; return JSON.parse(JSON.stringify(rest)); }
  configure(patch) { const next = ['lobby', 'finished'].includes(this.phase) && roomOptions(this.options, patch); if (!next) return false; this.options = next; return true; }

  // A new host continues from the last snapshot without the panas who left.
  static restore(state, members, course) {
    const race = Object.assign(new Race(course), JSON.parse(JSON.stringify(state)));
    race.course = course;
    race.options = { ...defaultOptions(), ...migrateRivals(race.options) };
    race.players = race.players.filter(p => members.has(p.id));
    race.pilots = race.pilots.filter(p => p.bot || members.has(p.id));
    return race;
  }

  addPlayer(id, name, avatar = {}) {
    const known = this.players.find(p => p.id === id);
    if (known) { Object.assign(known, { name, avatar }); for (const p of this.pilots) if (p.id === id) Object.assign(p, { name, avatar }); return known; }
    const player = { id, name, avatar }; this.players.push(player); return player;
  }
  removePlayer(id) { this.players = this.players.filter(p => p.id !== id); this.pilots = this.pilots.filter(p => p.bot || p.id !== id); }
  pilotOf(id) { return this.pilots.find(p => p.id === id); }

  pilot(slot, who, bot = null) {
    const s = this.course.slots[slot], L = this.course.launch;
    return { id: who.id, name: who.name, avatar: who.avatar || {}, bot, color: COLORS[slot % COLORS.length], slot,
      x: s.x, y: L.y, z: s.z, h: L.h, v: WING.trim, vy: 0, lift: 0, agl: 0, steer: 0, bar: 0, brake: 0, ears: 0, boost: 0,
      beacon: 0, rings: [], splits: [], down: 0, downs: 0, outs: 0, finish: null, miss: null, penalty: 0, progress: 0 };
  }

  start() {
    if (!this.course || !this.players.length || this.players.length > SLOTS) return false;
    const random = seeded(this.seed + this.raceId * 977);
    this.pilots = this.players.map((p, i) => this.pilot(i, p));
    const rivals = this.options.bots !== false && RIVALS[this.options.rivals];
    for (let i = this.pilots.length, k = Math.floor(random() * BOT_NAMES.length); rivals && i < SLOTS; i++, k++) {
      const [lo, hi] = rivals.skill, skill = lo + random() * (hi - lo);
      const avatar = { fur: BOT_FUR[i % BOT_FUR.length], outfitColor: COLORS[i % COLORS.length], face: 'feliz' };
      this.pilots.push(this.pilot(i, { id: BOT_SEAT + i, name: BOT_NAMES[k % BOT_NAMES.length], avatar }, { skill, side: random() < .5 ? -1 : 1, wobble: random() * 6 }));
    }
    Object.assign(this, { phase: 'countdown', countdown: COUNTDOWN, time: 0, closing: 0 }); this.raceId++;
    return true;
  }

  // Bots fly to the next target, circle a thermal when they are too low to
  // reach it, take the bar when they have height to spare and spiral down
  // over the diana.
  botInput(p) {
    const C = this.course, k = p.bot, to = targetOf(C, p.beacon), dist = Math.hypot(to.x - p.x, to.z - p.z);
    const last = p.beacon >= C.beacons.length;
    // Height it needs: glide to the target and clear the highest ground on the way.
    const glide = 9 + k.skill;
    let need = (last ? C.landing.y + 4 : C.groundAt(to.x, to.z) + 24 - k.skill * 10) + dist / glide;
    for (let f = .2; f < 1; f += .2) need = Math.max(need, C.groundAt(p.x + (to.x - p.x) * f, p.z + (to.z - p.z) * f) + 15 + dist * (1 - f) / glide);
    // Whatever the leg, enough height to glide the rest of the course home.
    const rest = remaining(C, p);
    need = Math.max(need, C.landing.y + 8 + rest / glide);
    // The bar only when the leg and the rest of the course still clear on the
    // bar's glide (about 8:1); timid bots want more margin.
    const barNeed = Math.max(need + dist / 8 - dist / glide, C.landing.y + 8 + rest / 8) + 10 + (1 - k.skill) * 70;
    const steerTo = (x, z) => clamp(-angle(Math.atan2(x - p.x, z - p.z) - p.h) * 1.8, -1, 1);
    // Ground rising ahead: turn to the clear heading nearest the target (the
    // lowest side would often be the cliff down to Caracas). Not on the last
    // metres to the diana.
    const ahead = h => C.groundAt(p.x + Math.sin(h) * 70, p.z + Math.cos(h) * 70);
    if (!(last && dist < 120) && ahead(p.h) > p.y - 12) {
      const want = Math.atan2(to.x - p.x, to.z - p.z), turns = [.6, -.6, 1.2, -1.2, 2, -2];
      const clear = turns.filter(d => ahead(p.h + d) < p.y - 12).sort((a, b) => Math.abs(angle(p.h + a - want)) - Math.abs(angle(p.h + b - want)))[0];
      const turn = clear ?? (ahead(p.h + .6) < ahead(p.h - .6) ? .6 : -.6);
      return { steer: turn > 0 ? -1 : 1 };
    }
    // Keep climbing in the thermal it is in until it has a real margin;
    // otherwise, when too low, pick one it can still glide to, the cheapest
    // detour first.
    let thermal = C.thermals.find(t => t.name === p.climbing) || (p.y < need && C.thermals
      .filter(t => { const d = Math.hypot(t.x - p.x, t.z - p.z); return t.top - p.y > 25 && d < 320 && p.y - t.ground > d / 8 + 8; })
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) + Math.hypot(a.x - to.x, a.z - to.z) - Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(b.x - to.x, b.z - to.z))[0]);
    if (thermal && p.y >= Math.min(thermal.top - 30, need + 30)) thermal = null;
    p.climbing = thermal?.name ?? null;
    if (thermal) {
      const d = Math.hypot(thermal.x - p.x, thermal.z - p.z);
      // Inside the column: orbit its core on the brakes (the tightest
      // circle a wing flies); outside: head straight in.
      if (d > thermal.r * .9) return { steer: steerTo(thermal.x, thermal.z) };
      const around = Math.atan2(p.x - thermal.x, p.z - thermal.z) + k.side * 1.2;
      return { steer: steerTo(thermal.x + Math.sin(around) * thermal.r * .6, thermal.z + Math.cos(around) * thermal.r * .6), brake: true };
    }
    const wobble = Math.sin(this.time * .4 + k.wobble) * (1 - k.skill) * .35;
    // The final glide: far too high for the distance left means big ears on
    // the way in and a spiral over the diana; brakes only for the flare.
    if (last) {
      const agl = p.y - C.landing.y, glide = dist / Math.max(1, agl);
      if (glide < 2.5 && agl > 12) return dist > 80 ? { steer: steerTo(to.x, to.z), ears: true } : { steer: k.side, ears: agl > 25 };
      return { steer: steerTo(to.x, to.z), brake: agl < 6 };
    }
    // Rings are not worth a detour to a bot: it takes the ones on its line.
    return { steer: clamp(steerTo(to.x, to.z) + wobble, -1, 1), bar: p.y > barNeed };
  }

  update(dt, inputs = new Map()) {
    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown === 0) this.phase = 'racing';
      return;
    }
    if (this.phase !== 'racing') return;
    this.time += dt;
    for (const p of this.pilots) {
      fly(this.course, p, dt, p.bot ? this.botInput(p) : inputs.get(p.id) || {}, this.time);
      p.progress = p.finish !== null ? 1e6 : p.beacon * 1e4 - remaining(this.course, p);
    }
    const humans = this.pilots.filter(p => !p.bot);
    if (humans.length && humans.every(p => p.finish !== null)) this.closing += dt;
    if (this.pilots.every(p => p.finish !== null) || this.closing > GRACE || this.time >= LIMIT) this.phase = 'finished';
  }
}

// Seeded so a race replays the same way on any host.
export function seeded(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
