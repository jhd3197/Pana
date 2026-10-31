import { cleanKit, kitStats, GRENADES, MARKERS } from './armory-data.js';
import { canMoveSeats } from '../../../engine/play/seat-rules.js';
import { DEFAULT_OPTIONS, validOptions } from './options.js';
import { paintArenaInfo, arenaLayout, ARENA_SPAWNS, validPaintArena } from '../../../engine/worlds/arena-layouts.js';
import { MUELLE_COVERS, MUELLE_SPAWNS, MUELLE_SIZE } from './muelle-layout.js';
import { NOCHE_COVERS, NOCHE_SPAWNS, NOCHE_SIZE } from './noche-layout.js';
import { TERMINAL_COVERS, TERMINAL_SPAWNS, TERMINAL_BOUNDS } from './terminal-layout.js';
import { DEFAULT_DIFFICULTY, validDifficulty } from '../../../engine/play/difficulty.js';
import { clamp } from '../../../engine/random.js';
import { pickSpawn } from './spawn-picker.js';
import { locKey } from '../../../engine/i18n.js';
import { resetJump, jumpCount } from '../../../engine/play/jump.js';
import { stepWalker, axisMove } from '../../../engine/play/walker.js';
import { segmentBox, launch, sweep } from '../../../engine/play/projectile.js';
export { segmentBox };

// Pepazo plays a 54 m court: every map's cover spreads 1.5× from the centre and
// an outer ring of barricades keeps the long perimeter lanes from staying open.
export const SIZE = 27, SPREAD = 1.5, DURATION = 180, TARGET = 10, SPEED = 7, RADIUS = .55, BALL_SPEED = 34;
// A round holds still until every pana has loaded its court (or READY_TIMEOUT
// seconds passed), then counts COUNTDOWN seconds down before anyone moves.
export const READY_TIMEOUT = 8, COUNTDOWN = 3;
export const COLORS = ['#f28b42', '#29c5cd', '#d363a6', '#a1bd43', '#8d85df', '#f0c34c', '#ed615c', '#64b898'];
const RING = [[11, 21.5, 3.6, 1.6, 2], [-11, -21.5, 3.6, 1.6, 2], [-11, 21.5, 3.6, 1.6, 1.8], [11, -21.5, 3.6, 1.6, 1.8],
  [21.5, -11, 1.6, 3.6, 2], [-21.5, 11, 1.6, 3.6, 2], [21.5, 11, 1.6, 3.6, 1.8], [-21.5, -11, 1.6, 3.6, 1.8]].map(([x, z, w, d, h]) => ({ x, z, w, d, h, height: h }));
const spread = cover => [...cover.map(o => ({ ...o, x: o.x * SPREAD, z: o.z * SPREAD, w: o.w * 1.15, d: o.d * 1.15 })), ...RING];
// The original plaza court, before spreading.
const PLAZA_COVER = [
  { x: 0, z: 0, w: 4, d: 2, h: 2.4 },
  ...[-1, 1].flatMap(s => [{ x: s * 8, z: -6, w: 2.4, d: 5, h: 2.8 }, { x: s * 8, z: 6, w: 2.4, d: 5, h: 2.8 },
    { x: s * 3.5, z: -11, w: 4, d: 1.8, h: 1.8 }, { x: s * 3.5, z: 11, w: 4, d: 1.8, h: 1.8 }]),
];
export const COVER = spread(PLAZA_COVER);
export const SPAWNS = [{ x: -14, z: -14 }, { x: 14, z: 14 }, { x: 14, z: -14 }, { x: -14, z: 14 }, { x: 0, z: -15 }, { x: 0, z: 15 }, { x: -15, z: 0 }, { x: 15, z: 0 }].map(p => ({ x: p.x * SPREAD, z: p.z * SPREAD }));
const PAINT_SPAWNS = ARENA_SPAWNS.map(p => ({ x: p.x * SPREAD, z: p.z * SPREAD }));
// Bot marksmanship per difficulty: aim wobble (radians) and how much of the
// time a bot with a clear line keeps the trigger down (sine threshold), and how
// stale (seconds) the rival's position is when it aims: paintballs fly 85 m/s, so
// without that lag bots would rarely miss a strafing rival at range.
export const BOT_SKILL = { facil: { wobble: .16, trigger: .45, reaction: .15 }, normal: { wobble: .07, trigger: -.2, reaction: .4 }, dificil: { wobble: .035, trigger: -.5, reaction: .5 }, experto: { wobble: .012, trigger: -.8, reaction: .6 } };
export function cleanInput(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const num = n => Number.isFinite(n) ? clamp(n, -1, 1) : 0;
  let x = num(input.x), z = num(input.z), length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
  let ax = num(input.ax), az = num(input.az); length = Math.hypot(ax, az); if (length > .01) { ax /= length; az /= length; } else { ax = 0; az = -1; }
  return { x, z, ax, az, weapon: MARKERS.some(m => m.id === input.weapon) ? input.weapon : null, fire: input.fire === true, aim: input.aim === true, reload: input.reload === true, sprint: input.sprint === true, grenade: input.grenade === true, jump: jumpCount(input) };
}
export const spawnsFor = id => id === 'muelle' ? MUELLE_SPAWNS : id === 'noche' ? NOCHE_SPAWNS : id === 'terminal' ? TERMINAL_SPAWNS : arenaLayout(id) ? PAINT_SPAWNS : SPAWNS;
// Half-extents of each map's court. Most are square; El Puerto runs long between its two bases.
const BOUNDS = new Map([['muelle', { x: MUELLE_SIZE, z: MUELLE_SIZE }], ['noche', { x: NOCHE_SIZE, z: NOCHE_SIZE }], ['terminal', TERMINAL_BOUNDS]]);
export const boundsFor = id => BOUNDS.get(id) || { x: SIZE, z: SIZE };
// The larger half-extent, for whatever frames the whole court.
export const sizeFor = id => { const { x, z } = boundsFor(id); return Math.max(x, z); };
const outside = (id, x, z, margin = 0) => { const b = boundsFor(id); return Math.abs(x) > b.x - margin || Math.abs(z) > b.z - margin; };
// Every map has three fixed layouts and the round number picks one, so a rematch
// plays a different court. Not random: everyone learns them.
export const VARIANTS = 3;
// Spanish keys: clients show them with loc().
const VARIANT_NAMES = { muelle: [locKey('Patio'), locKey('Laberinto'), locKey('Torres')], terminal: [locKey('Pasillos'), locKey('Fortaleza'), locKey('Laberinto')], noche: [locKey('Torre'), locKey('Inflables'), locKey('Tubos')], default: [locKey('Clásica'), locKey('Girada'), locKey('Cerrada')] };
export const variantName = (id, variant = 0) => (VARIANT_NAMES[id] || VARIANT_NAMES.default)[variant % VARIANTS];
const gap = (a, b) => Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
// "Girada" turns the cover a quarter; the spawns and ring are symmetric under it.
const rotate = cover => cover.map(o => ({ ...o, x: o.z, z: -o.x, w: o.d, d: o.w }));
// "Cerrada" fills open lanes with crate stacks wherever they keep 2.4 m passages.
const FILL = [[7.5, 15], [15, 7.5], [0, 15], [15, 0], [7.5, 7.5], [18, 18], [0, 7.5], [7.5, 0], [22, 4], [4, 22]]
  .flatMap(([x, z]) => [[x, z], [-x, -z], [-z, x], [z, -x]]);
function closed(cover, id) {
  const all = [...cover], size = sizeFor(id);
  for (const [x, z] of FILL) {
    const o = { x, z, w: 2.6, d: 2.6, h: 2.65, height: 2.65 };
    if (all.every(c => gap(c, o) >= 2.4) && size - Math.max(Math.abs(x), Math.abs(z)) - 1.3 >= 2.4
      && spawnsFor(id).every(s => Math.abs(s.x - x) > 3.6 || Math.abs(s.z - z) > 3.6)) all.push(o);
  }
  return all;
}
const covers = new Map();
export function coverFor(id, variant = 0) {
  variant = Number.isInteger(variant) ? ((variant % VARIANTS) + VARIANTS) % VARIANTS : 0;
  const key = `${id}:${variant}`; if (covers.has(key)) return covers.get(key);
  let cover;
  if (id === 'muelle') cover = MUELLE_COVERS[variant];
  else if (id === 'noche') cover = NOCHE_COVERS[variant];
  else if (id === 'terminal') cover = TERMINAL_COVERS[variant];
  else {
    const layout = arenaLayout(id), base = layout ? spread(layout.cover) : COVER;
    cover = [base, rotate(base), closed(base, layout ? id : 'plaza')][variant];
  }
  covers.set(key, cover); return cover;
}
export function blocked(x, z, radius = RADIUS, mapId = 'plaza', variant = 0) {
  return outside(mapId, x, z, radius) || coverFor(mapId, variant).some(o => Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
}
// Bots walk to rivals they cannot see: open 1 m cells per layout, and a
// breadth-first distance field from the target's cell, refreshed twice a second.
const grids = new Map();
function navGrid(id, variant) {
  const key = `${id}:${variant}`; if (grids.has(key)) return grids.get(key);
  const b = boundsFor(id), nx = Math.floor(b.x * 2), nz = Math.floor(b.z * 2), open = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) open[j * nx + i] = blocked(i + .5 - b.x, j + .5 - b.z, .6, id, variant) ? 0 : 1;
  const grid = { b, nx, nz, open, cell: (x, z) => clamp(Math.floor(z + b.z), 0, nz - 1) * nx + clamp(Math.floor(x + b.x), 0, nx - 1) };
  grids.set(key, grid); return grid;
}
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function distanceField(grid, target) {
  const { nx, nz, open } = grid, far = new Int32Array(nx * nz).fill(-1), queue = new Int32Array(nx * nz); let head = 0, tail = 0;
  far[target] = 0; queue[tail++] = target;
  while (head < tail) {
    const c = queue[head++], i = c % nx, j = (c - i) / nx;
    for (const [di, dj] of STEPS.slice(0, 4)) { const a = i + di, b = j + dj, n = b * nx + a; if (a >= 0 && b >= 0 && a < nx && b < nz && open[n] && far[n] < 0) { far[n] = far[c] + 1; queue[tail++] = n; } }
  }
  return far;
}
export class Arena {
  constructor(mapId = 'terminal', difficulty = DEFAULT_DIFFICULTY, options = {}) { this.options = { ...DEFAULT_OPTIONS, ...(validOptions(options) ? options : {}) }; this.flags = []; this.teamScores = [0, 0]; this.mapId = paintArenaInfo(mapId).id; this.variant = 0; this.events = []; this.eventSerial = 0; this.difficulty = validDifficulty(difficulty) ? difficulty : DEFAULT_DIFFICULTY; this.phase = 'lobby'; this.players = []; this.balls = []; this.splats = []; this.grenades = []; this.puddles = []; this.booms = []; this.time = DURATION; this.round = 0; this.serial = 0; this.message = locKey('La cancha está lista.'); this.messageVars = null; this.loading = 0; this.countdown = 0; this.ready = new Set(); this.random = Math.random; }
  selectKit(id, value) { const p=this.players.find(p=>p.id===id && p.connected); if(!p || this.phase==='playing') return false; p.kit=cleanKit(value); p.weapon=p.kit.weapon; return true; }
  configure(options) { if (this.phase === 'playing' || !validOptions(options)) return false; Object.assign(this.options, options); this.players.forEach(p => { p.color = COLORS[(this.options.mode === 'teams' || this.options.flag) ? p.team : p.seat]; }); return true; }
  moveSeat(actorId, from, to, hostId) {
    if (!['lobby', 'finished'].includes(this.phase) || !(this.options.mode === 'teams' || this.options.flag)) return false;
    const seats = paintSeats(this.players);
    if (!canMoveSeats(seats, from, to, actorId, hostId) || !this.players.some(p => p.connected && p.id === actorId)) return false;
    [seats[from], seats[to]] = [seats[to], seats[from]];
    seats.forEach((p, seat) => { if (p) Object.assign(p, { seat, team: seat % 2, color: COLORS[seat % 2] }); });
    return true;
  }
  canStart() { const people = this.players.filter(p => p.connected); return !(this.options.mode === 'teams' || this.options.flag) || people.length < 2 || new Set(people.map(p => p.team)).size === 2; }
  get cover() { return coverFor(this.mapId, this.variant); }
  sameTeam(a, b) { return (this.options.mode === 'teams' || this.options.flag) && a?.team === b?.team; }
  selectMap(id) {
    if (this.phase !== 'lobby' || !validPaintArena(id)) return false;
    this.mapId = id; this.players.forEach((p, i) => Object.assign(p, spawnsFor(id)[i % 8])); return true;
  }
  selectDifficulty(id) {
    if (this.phase === 'playing' || !validDifficulty(id)) return false;
    this.difficulty = id; return true;
  }
  add(id, info) {
    let p = this.players.find(p => p.id === id);
    const occupied = this.players.filter(other => other !== p && other.connected).map(other => other.seat);
    const seat = p && !occupied.includes(p.seat) ? p.seat : Array.from({ length: 8 }, (_, i) => i).find(i => !occupied.includes(i));
    if (seat === undefined) return null;
    const team = seat % 2, color = COLORS[(this.options.mode === 'teams' || this.options.flag) ? team : seat];
    // Arriving after the wait (mid-countdown or mid-round) counts as ready.
    if (this.phase === 'playing' && !this.loading) this.ready.add(id);
    if (p) { Object.assign(p, info, { connected: true, seat, team, color }); return p; }
    p = { id, ...info, connected: true, seat, team, eliminated: false, slow: 0, weapon: 'pistol', kit: cleanKit(), grenadeReady: true, grenadeHeld: false, shots: 0, fired: 0, jumpPress: 0, jumpHeight: 0, jumpVelocity: 0, reserve: 0, ...spawnsFor(this.mapId)[this.players.length % 8], ax: 0, az: -1, score: 0, hits: 0, paint: 0, stains: [], calm: 0, streak: 0, nemesis: null, stamina: 1, sprint: false, ammo: 12, reload: 0, cooldown: 0, respawn: 0, shield: 1.5, color };
    this.players.push(p); return p;
  }
  start() {
    if (this.phase === 'playing' || !this.canStart()) return false;
    this.players = this.players.filter(p => p.connected); this.phase = 'playing'; this.survivors = null; this.round++; this.variant = (this.round - 1) % VARIANTS; this.time = this.options.duration; this.teamScores = [0, 0]; this.flags = spawnsFor(this.mapId).slice(0, 2).map(({ x, z }, team) => ({ team, x, z, homeX: x, homeZ: z, carrier: null })); this.balls = []; this.splats = []; this.grenades = []; this.puddles = []; this.booms = [];
    this.players.forEach((p, i) => Object.assign(p, { eliminated: false, slow: 0, color: (this.options.mode === 'teams' || this.options.flag) ? COLORS[p.team] : COLORS[i % 8], score: 0, hits: 0, paint: 0, stains: [], calm: 0, streak: 0, nemesis: null, stamina: 1, sprint: false, ammo: 12, reload: 0, cooldown: 0, respawn: 0, shield: 1.5, jumpHeight: 0, jumpVelocity: 0, jumpPending: false }));
    this.players.forEach(p => this.refill(p));
    // One by one, so each pana spawns away from the rivals already placed and on a free spot.
    const placed = [];
    for (const p of this.players) { Object.assign(p, this.spawnPoint(p, placed.filter(q => !this.sameTeam(p, q)), placed.map(q => q.spawn))); placed.push(p); }
    this.ready = new Set(); this.loading = READY_TIMEOUT; this.countdown = 0; this.checkReady();
    this.say(locKey('¡A pintar! Cancha {variant}.'), { variant: variantName(this.mapId, this.variant) }); return true;
  }
  // Nothing moves, fires or takes paint, and the clock waits, until the 3-2-1 ends.
  get live() { return this.phase === 'playing' && !this.loading && !this.countdown; }
  // A pana's client loaded this round's court. Bots never wait; nor do rounds without people.
  markReady(id, round) {
    if (this.phase !== 'playing' || !this.loading || !Number.isInteger(round) || round !== this.round || !this.players.some(p => p.id === id && p.connected && !p.bot)) return false;
    this.ready.add(id); this.checkReady(); return true;
  }
  checkReady() { if (this.loading && this.players.every(p => p.bot || !p.connected || this.ready.has(p.id))) { this.loading = 0; this.countdown = COUNTDOWN; } }
  // Skip the wait and the countdown: the armory's range and tests that only exercise play.
  go() { this.loading = this.countdown = 0; }
  freezeJumps(inputs) { for (const p of this.players) if (!p.bot) resetJump(p, inputs.get(p.id)); }
  refill(p) { const stats=kitStats(p.kit,this.options); p.ammo=stats.magazine; p.reserve=stats.reserve ?? 0; p.weapon=stats.id; p.grenadeReady=true; p.grenadeHeld=false; p.shots=0; }
  // Respawn protection: 1.5 s of shield (the ring blinks in the scene) so nobody is
  // painted on arrival; firing or throwing cancels it early.
  respawn(p) {
    const spawn = this.spawnPoint(p, this.players.filter(q => q.id !== p.id && q.connected && !q.respawn && !q.eliminated && !this.sameTeam(p, q)));
    Object.assign(p, spawn, { ammo: 12, reload: 0, cooldown: 0, shield: 1.5, paint: 0, stains: [], calm: 0, stamina: 1, jumpHeight: 0, jumpVelocity: 0, jumpPending: false }); this.refill(p);
  }
  // A spawn far from these rivals, out of their sight if possible and not p's last one.
  // Team rounds keep each side on its own half of the spawns: even indices are team 0's
  // (El Puerto's west base and the orange flag), odd ones team 1's.
  spawnPoint(p, enemies, taken = []) {
    const spawns = spawnsFor(this.mapId), teams = this.options.mode === 'teams' || this.options.flag;
    const sees = (e, s) => !this.cover.some(o => segmentBox(e.x, e.z, s.x - e.x, s.z - e.z, o) !== null);
    p.spawn = pickSpawn(spawns, { enemies, taken, last: p.spawn ?? -1, allowed: teams ? spawns.map((_, i) => i).filter(i => i % 2 === p.team) : null, sees, rng: this.random });
    const { x, z } = spawns[p.spawn]; return { x, z };
  }
  // A unit step for bot p along open cells toward (tx, tz), or null when no route is known.
  route(p, tx, tz) {
    const grid = navGrid(this.mapId, this.variant), target = grid.cell(tx, tz);
    this.routes ||= new Map(); let route = this.routes.get(p.id);
    if (!route || route.map !== `${this.mapId}:${this.variant}` || (route.target !== target && route.time - this.time > .5)) {
      route = { map: `${this.mapId}:${this.variant}`, target, time: this.time, far: distanceField(grid, target) }; this.routes.set(p.id, route);
    }
    const { nx, nz, open } = grid, here = grid.cell(p.x, p.z), i = here % nx, j = (here - i) / nx; let best = null, score = route.far[here] >= 0 ? route.far[here] : Infinity;
    for (const [di, dj] of STEPS) {
      const a = i + di, b = j + dj, n = b * nx + a;
      if (a < 0 || b < 0 || a >= nx || b >= nz || route.far[n] < 0 || (di && dj && (!open[j * nx + a] || !open[b * nx + i]))) continue;
      const cost = route.far[n] + (di && dj ? .4 : 0); if (cost < score) { score = cost; best = n; }
    }
    if (best === null) return null;
    const x = best % nx + .5 - grid.b.x - p.x, z = Math.floor(best / nx) + .5 - grid.b.z - p.z, length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
  }
  // Where bot p thinks rival q is: a sample of q refreshed every `reaction` seconds.
  botAim(p, q, reaction) {
    const book = this.botSight ||= new Map(), now = DURATION - this.time, seen = book.get(p.id);
    if (!seen || seen.id !== q.id || now - seen.at >= reaction || now < seen.at) book.set(p.id, { id: q.id, x: q.x, z: q.z, at: now });
    return book.get(p.id);
  }
  bot(p) {
    const enemies = this.players.filter(q => q.id !== p.id && q.connected && !q.respawn && !q.eliminated && !this.sameTeam(p, q)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const q = enemies[0]; if (!q) return cleanInput();
    const dx = q.x - p.x, dz = q.z - p.z, length = Math.hypot(dx, dz) || 1;
    const clear = !this.cover.some(o => segmentBox(p.x, p.z, dx, dz, o) !== null);
    const t = (DURATION - this.time) * .7 + p.id, strafe = Math.sin(t) > 0 ? 1 : -1, skill = BOT_SKILL[this.difficulty] || BOT_SKILL.normal;
    // A deterministic wobble around the true line: weaker bots spray, sharp ones rarely miss.
    const ref = this.botAim(p, q, skill.reaction), rx = ref.x - p.x, rz = ref.z - p.z, rl = Math.hypot(rx, rz) || 1;
    const wobble = Math.sin(t * 2.3 + p.id * 1.7) * skill.wobble, aimX = rx / rl * Math.cos(wobble) - rz / rl * Math.sin(wobble), aimZ = rx / rl * Math.sin(wobble) + rz / rl * Math.cos(wobble);
    let x = clear ? dx / length * (length > 9 ? .8 : -.25) - dz / length * strafe * .6 : Math.cos(t * .6);
    let z = clear ? dz / length * (length > 9 ? .8 : -.25) + dx / length * strafe * .6 : Math.sin(t * .6);
    // A rival out of sight and far away: walk the open lanes toward them.
    const hunt = !clear && length > 12 && this.route(p, q.x, q.z);
    if (hunt) ({ x, z } = hunt);
    else if (blocked(p.x + x * 1.4, p.z + z * 1.4, RADIUS, this.mapId, this.variant)) { x = -dz / length; z = dx / length; }
    if (this.options.flag) {
      const carried = this.flags.find(f => f.carrier === p.id), target = carried ? this.flags[p.team] : this.flags[1 - p.team];
      const tx = carried ? target.homeX : target.x, tz = carried ? target.homeZ : target.z, d = Math.hypot(tx - p.x, tz - p.z) || 1;
      x = (tx - p.x) / d; z = (tz - p.z) / d;
      const step = d > 2 && this.route(p, tx, tz); if (step) ({ x, z } = step);
      else if (blocked(p.x + x * 1.4, p.z + z * 1.4, RADIUS, this.mapId, this.variant)) { const swap = x; x = -z; z = swap; }
    }
    return cleanInput({ x, z, ax: aimX, az: aimZ, fire: clear && length < 34 && Math.sin(t * 3) > skill.trigger, reload: p.ammo < 3 && !clear });
  }
  step(dt, inputs = new Map()) {
    if (this.phase !== 'playing') return; dt = clamp(dt, 0, .05);
    // A press made while everything is frozen is spent, not saved for the YA.
    if (this.loading) { this.freezeJumps(inputs); this.loading = Math.max(0, this.loading - dt); if (this.loading) this.checkReady(); else this.countdown = COUNTDOWN; return; }
    if (this.countdown) { this.freezeJumps(inputs); this.countdown = Math.max(0, this.countdown - dt); return; }
    this.time = Math.max(0, this.time - dt);
    for (const p of this.players) {
      if (!p.connected || p.eliminated) continue;
      p.slow = Math.max(0, (p.slow || 0) - dt);
      if (p.respawn > 0) { p.respawn = Math.max(0, p.respawn - dt); resetJump(p, inputs.get(p.id)); if (!p.respawn) this.respawn(p); continue; }
      p.shield = Math.max(0, p.shield - dt); p.cooldown = Math.max(0, p.cooldown - dt);
      // Paint wears off after four quiet seconds, one pepazo every 1.5 s.
      if (p.paint > 0 && (p.calm += dt) >= 4) { p.paint--; p.stains = p.stains.slice(1); p.calm = 2.5; }
      let stats=kitStats(p.kit,this.options);
      if (p.reload > 0) { p.reload = Math.max(0, p.reload - dt); if (!p.reload) { p.ammo = stats.reserve != null ? Math.min(stats.magazine,p.reserve) : stats.magazine; if(stats.reserve != null) p.reserve-=p.ammo; } }
      const input = p.bot ? this.bot(p) : cleanInput(inputs.get(p.id));
      if(input.weapon && input.weapon !== p.kit.weapon && this.options.weapons !== 'pistol') {
        p.kit={...p.kit,weapon:input.weapon}; stats=kitStats(p.kit,this.options);
        p.ammo=Math.min(p.ammo,stats.magazine); p.reserve=0;
        if(p.shots>0) { p.ammo=0; p.reload=stats.reload; }
      }
      p.weapon=stats.id;
      if(input.grenade && !p.grenadeHeld && p.grenadeReady) this.throwGrenade(p,input);
      p.grenadeHeld=input.grenade;
      p.ax = input.ax; p.az = input.az;
      // A scope (La Lejana) steadies the shot and halves the walk while it is up.
      p.aim = input.aim && !!stats.scope;
      // Shift sprints 45% faster for up to three seconds; sprinting holds fire.
      const walk = SPEED * stats.mobility * (p.slow > 0 ? .45 : 1) * (p.aim ? .5 : 1);
      const sprinting = stepWalker(p, input, dt, { walk, run: walk * 1.45, canSprint: !!stats.sprint && !input.fire && !p.aim, regen: 5, move: axisMove((x, z) => blocked(x, z, RADIUS, this.mapId, this.variant)) }).sprinting; p.sprint = sprinting;
      p.walk = !!(input.x || input.z);
      if ((input.reload || p.ammo === 0) && !p.reload && p.ammo < stats.magazine && (stats.reserve == null || p.reserve > 0)) p.reload = stats.reload;
      if (input.fire && !sprinting && !p.cooldown && !p.reload && p.ammo > 0) {
        p.ammo--; p.shots++; p.fired++; p.cooldown=stats.cadence; p.shield=0;
        const spread=p.aim && stats.aimSpread!=null ? stats.aimSpread : stats.spread;
        const jitter=stats.pellets===1 ? Math.sin(p.shots*2.4)*spread : 0;
        const angles=stats.pellets===3 ? [-spread,0,spread] : [jitter];
        for(const angle of angles) this.balls.push({ id:++this.serial, owner:p.id, color:p.color, x:p.x, z:p.z, ...launch(p.ax, p.az, stats.speed, angle),
          life:stats.life, kind:stats.id, rocket:!!stats.splash, direct:!!stats.direct, damage:stats.damage, splash:stats.splash || 0, pattern:p.kit.pattern, hand:p.weapon==='rapid'?p.shots%2:0 });
      }
    }
    for (const ball of this.balls) {
      const owner = this.players.find(q => q.id === ball.owner);
      const targets = this.players.filter(p => p.id !== ball.owner && p.connected && !p.respawn && !p.eliminated && !p.shield && (this.options.friendlyFire || !this.sameTeam(p, owner)));
      const { t, victim, dx, dz } = sweep(ball, dt, { boxes: this.cover, targets, padding: .12 });
      ball.x += dx * Math.min(1, t); ball.z += dz * Math.min(1, t); ball.life -= dt;
      if (t <= 1 || outside(this.mapId, ball.x, ball.z)) {
        ball.life = 0; this.splats.push({ id: ball.id, x: ball.x, z: ball.z, color: ball.color, life: 9, pattern: ball.pattern });
        // La Bazuca's direct hit knocks out at once; its splash then catches only the panas beside.
        if (victim && (ball.direct || !ball.rocket)) this.hit(victim, owner, ball.color, { x: ball.vx, z: ball.vz, weapon: ball.kind }, ball.direct ? Infinity : ball.damage || 1);
        if (ball.rocket) this.blast(ball,ball.splash);
      }
    }
    for(const ball of this.balls) if(ball.rocket && ball.life<=0 && !ball.exploded) this.blast(ball,ball.splash);
    this.stepGrenades(dt);
    this.balls = this.balls.filter(b => b.life > 0); this.booms = this.booms.filter(b => (b.life -= dt) > 0); this.splats = this.splats.filter(s => (s.life -= dt) > 0).slice(-64);
    if (this.options.flag) this.updateFlags();
    const alive = this.players.filter(p => p.connected && !p.eliminated), teams = this.options.mode === 'teams' || this.options.flag;
    const eliminatedEnd = this.options.lives > 0 && this.players.some(p => p.eliminated) && this.players.length > 1 && (teams ? new Set(alive.map(p => p.team)).size <= 1 : alive.length <= 1);
    if (eliminatedEnd) this.survivors = alive.map(p => p.id);
    if (this.time <= 0 || eliminatedEnd || (this.options.flag ? this.teamScores.some(s => s >= 3) : teams ? this.teamScores.some(s => s >= TARGET) : this.players.some(p => p.score >= TARGET))) { this.phase = 'finished'; this.balls = []; }
  }
  throwGrenade(p,input) {
    p.grenadeReady=false; p.shield=0;
    const def=GRENADES.find(g=>g.id===p.kit.grenade);
    this.grenades.push({id:++this.serial,owner:p.id,color:p.color,kind:def.id,x:p.x,z:p.z,vx:input.ax*12,vz:input.az*12,life:def.fuse,total:def.fuse,radius:def.radius,bounced:false});
  }
  blast(b,radius) {
    if(b.exploded) return; b.exploded=true;
    const owner=this.players.find(p=>p.id===b.owner);
    for(const p of this.players) if(p.id!==b.owner && p.connected && !p.respawn && !p.eliminated && !p.shield
      && (this.options.friendlyFire || !this.sameTeam(p,owner)) && Math.hypot(p.x-b.x,p.z-b.z)<=radius
      && !this.cover.some(o=>segmentBox(b.x,b.z,p.x-b.x,p.z-b.z,o,.01)!==null)) this.hit(p,owner,b.color,{ x:p.x-b.x, z:p.z-b.z, blast:true, weapon:b.kind });
    this.splats.push({id:++this.serial,x:b.x,z:b.z,color:b.color,life:9,radius:Math.max(radius,1.6),pattern:'splat'});
    // Clients turn each new boom into a flash, a fireball, smoke and a shake.
    this.booms.push({id:++this.serial,x:b.x,z:b.z,kind:b.kind||'grenade',color:b.color,life:.6});
  }
  stepGrenades(dt) {
    for(const g of this.grenades) {
      const dx=g.vx*dt,dz=g.vz*dt,wall=this.cover.some(o=>segmentBox(g.x,g.z,dx,dz,o,.15)!==null) || outside(this.mapId,g.x+dx,g.z+dz,.2);
      if(wall) { if(g.kind==='chispita' && !g.bounced) { g.vx*=-.65;g.vz*=-.65;g.bounced=true; } else { g.vx=g.vz=0; } }
      else { g.x+=dx;g.z+=dz; }
      if(g.kind==='chispita' && !g.bounced && g.life<g.total/2) {g.bounced=true;g.vx*=.75;g.vz*=.75;}
      g.life-=dt;
      if(g.life<=0) { this.blast(g,g.radius); if(g.kind==='pegajosa') this.puddles.push({id:++this.serial,owner:g.owner,x:g.x,z:g.z,color:g.color,radius:3.3,life:5}); }
    }
    this.grenades=this.grenades.filter(g=>g.life>0);
    for(const pool of this.puddles) {
      pool.life-=dt; const owner=this.players.find(p=>p.id===pool.owner);
      for(const p of this.players) if(p.id!==pool.owner && !this.sameTeam(p,owner) && !p.shield && Math.hypot(p.x-pool.x,p.z-pool.z)<pool.radius) p.slow=Math.max(p.slow,.2);
    }
    this.puddles=this.puddles.filter(p=>p.life>0);
  }
  // A pepazo stains the victim; the last one their aguante allows takes them out.
  // `damage` pepazos land at once: La Lejana's 2, Infinity for a direct rocket.
  hit(victim, owner, color, impact = {}, damage = 1) {
    const dx = impact.x ?? (victim.x - (owner?.x ?? victim.x)), dz = impact.z ?? (victim.z - (owner?.z ?? victim.z));
    const length = Math.hypot(dx, dz) || 1;
    victim.impact = { x: dx / length, z: dz / length, zone: 'body', blast: !!impact.blast, n: this.eventSerial + 1 };
    const distance = owner ? Math.round(Math.hypot(owner.x - victim.x, owner.z - victim.z)) : 0;
    const toughness = kitStats(victim.kit,this.options).toughness, weapon = impact.weapon || null;
    victim.paint = Math.min(toughness, victim.paint + Math.max(1, damage)); victim.stains = [...victim.stains, color].slice(-5); victim.calm = 0;
    if (victim.paint < toughness) { this.event('hit', owner, victim, distance, { weapon }); return; }
    victim.respawn = 2.5; victim.hits++; victim.slow = this.options.paint === 'sticky' ? 7 : 0; victim.eliminated = this.options.lives > 0 && victim.hits >= this.options.lives;
    const rival = !!owner && !this.sameTeam(owner, victim), revenge = rival && owner.nemesis === victim.id;
    if (rival) { owner.score++; owner.streak++; if (revenge) owner.nemesis = null; victim.nemesis = owner.id; if (!this.options.flag) this.teamScores[owner.team]++; }
    victim.streak = 0;
    for (const flag of this.flags) if (flag.carrier === victim.id) { flag.carrier = null; flag.x = victim.x; flag.z = victim.z; }
    if (owner) this.say(locKey('{owner} pintó a {victim} · {distance} m'), { owner: owner.name, victim: victim.name, distance }); else this.say(locKey('Un pana pintó a {victim} · {distance} m'), { victim: victim.name, distance });
    this.event('out', owner, victim, distance, { streak: rival ? owner.streak : 0, revenge, weapon, direct: damage === Infinity });
  }
  // The feed line is synced: a Spanish key plus its variables, shown with loc() on each client.
  say(message, vars = null) { this.message = message; this.messageVars = vars; }
  event(type, owner, victim, distance, extra = {}) {
    this.events = [...this.events, { n: ++this.eventSerial, type, owner: owner?.id ?? null, victim: victim.id, color: owner?.color || victim.color, distance, impact: { ...victim.impact }, ...extra }].slice(-12);
  }
  updateFlags() {
    const reset = f => Object.assign(f, { x: f.homeX, z: f.homeZ, carrier: null });
    for (const flag of this.flags) {
      const carrier = this.players.find(p => p.id === flag.carrier);
      if (carrier && carrier.connected && !carrier.eliminated && !carrier.respawn) { flag.x = carrier.x; flag.z = carrier.z; }
      else if (flag.carrier != null) flag.carrier = null;
      for (const p of this.players.filter(p => p.connected && !p.eliminated && !p.respawn)) {
        if (flag.carrier == null && Math.hypot(p.x - flag.x, p.z - flag.z) < 1.4) {
          if (p.team === flag.team) reset(flag); else { flag.carrier = p.id; p.shield = 0; }
        }
        if (flag.carrier === p.id) {
          const home = this.flags[p.team];
          if (home.carrier == null && Math.hypot(home.x - home.homeX, home.z - home.homeZ) < .1 && Math.hypot(p.x - home.homeX, p.z - home.homeZ) < 2) {
            this.teamScores[p.team]++; p.score += 3; this.say(locKey('{name} capturó la bandera.'), { name: p.name }); reset(flag);
          }
        }
      }
    }
  }
  winners() {
    const teams = this.options.mode === 'teams' || this.options.flag;
    if (this.survivors?.length) { const survivors = this.players.filter(p => this.survivors.includes(p.id)); return teams ? this.players.filter(p => p.team === survivors[0].team).map(p => p.id) : this.survivors; }
    const best = teams ? Math.max(...this.teamScores) : Math.max(...this.players.map(p => p.score));
    return this.players.filter(p => (teams ? this.teamScores[p.team] : p.score) === best).map(p => p.id);
  }
  view() { return { winners: this.winners(), options: { ...this.options }, flags: this.flags.map(f => ({ ...f })), teamScores: [...this.teamScores], mapId: this.mapId, variant: this.variant, events: this.events.map(e => ({ ...e })), difficulty: this.difficulty, phase: this.phase, round: this.round, loading: this.loading, countdown: this.countdown, time: this.time, players: this.players.map(p => ({ ...p, impact: p.impact ? { ...p.impact } : null, stains: [...p.stains] })), grenades:this.grenades.map(g=>({...g})), booms:this.booms.map(b=>({...b})), puddles:this.puddles.map(p=>({...p})), balls: this.balls.map(b => ({ ...b })), splats: this.splats.map(s => ({ ...s })), message: this.message, messageVars: this.messageVars ? { ...this.messageVars } : null }; }
}

// Stable lobby positions are independent of member IDs and survive roster changes.
export function paintSeats(players) { return Array.from({ length: 8 }, (_, seat) => players.find(p => p.connected && p.seat === seat) || null); }
