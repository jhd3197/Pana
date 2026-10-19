import { canMoveSeats } from '../../../engine/play/seat-rules.js';
import { DEFAULT_OPTIONS, validOptions } from './options.js';
import { paintArenaInfo, arenaLayout, ARENA_SPAWNS, validPaintArena } from '../../../engine/worlds/arena-layouts.js';
import { MUELLE_COVERS, MUELLE_SPAWNS, MUELLE_SIZE } from './muelle-layout.js';
import { NOCHE_COVERS, NOCHE_SPAWNS, NOCHE_SIZE } from './noche-layout.js';
import { DEFAULT_DIFFICULTY, validDifficulty } from '../../../engine/play/difficulty.js';
import { clamp } from '../../../engine/random.js';

// Pepazo plays a 54 m court: every map's cover spreads 1.5× from the centre and
// an outer ring of barricades keeps the long perimeter lanes from staying open.
export const SIZE = 27, SPREAD = 1.5, DURATION = 180, TARGET = 10, SPEED = 7, RADIUS = .55, BALL_SPEED = 34;
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
// time a bot with a clear line keeps the trigger down (sine threshold).
export const BOT_SKILL = { facil: { wobble: .16, trigger: .45 }, normal: { wobble: .07, trigger: -.2 }, dificil: { wobble: .035, trigger: -.5 }, experto: { wobble: .012, trigger: -.8 } };
export function cleanInput(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const num = n => Number.isFinite(n) ? clamp(n, -1, 1) : 0;
  let x = num(input.x), z = num(input.z), length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
  let ax = num(input.ax), az = num(input.az); length = Math.hypot(ax, az); if (length > .01) { ax /= length; az /= length; } else { ax = 0; az = -1; }
  return { x, z, ax, az, weapon: ['pistol', 'scatter', 'rapid'].includes(input.weapon) ? input.weapon : 'pistol', fire: input.fire === true, reload: input.reload === true, sprint: input.sprint === true };
}
export const spawnsFor = id => id === 'muelle' ? MUELLE_SPAWNS : id === 'noche' ? NOCHE_SPAWNS : arenaLayout(id) ? PAINT_SPAWNS : SPAWNS;
// Half-width of each map's court: the container yard is larger still.
export const sizeFor = id => id === 'muelle' ? MUELLE_SIZE : id === 'noche' ? NOCHE_SIZE : SIZE;
// Every map has three fixed layouts and the round number picks one, so a rematch
// plays a different court. Not random: everyone learns them.
export const VARIANTS = 3;
const VARIANT_NAMES = { muelle: ['Patio', 'Laberinto', 'Torres'], noche: ['Torre', 'Inflables', 'Tubos'], default: ['Clásica', 'Girada', 'Cerrada'] };
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
  else {
    const layout = arenaLayout(id), base = layout ? spread(layout.cover) : COVER;
    cover = [base, rotate(base), closed(base, layout ? id : 'plaza')][variant];
  }
  covers.set(key, cover); return cover;
}
export function blocked(x, z, radius = RADIUS, mapId = 'plaza', variant = 0) {
  const size = sizeFor(mapId);
  return Math.abs(x) > size - radius || Math.abs(z) > size - radius || coverFor(mapId, variant).some(o => Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
}
export function segmentBox(x, z, dx, dz, o, padding = 0) {
  let near = 0, far = 1;
  for (const [p, d, lo, hi] of [[x, dx, o.x - o.w / 2 - padding, o.x + o.w / 2 + padding], [z, dz, o.z - o.d / 2 - padding, o.z + o.d / 2 + padding]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return null; }
    else { let a = (lo - p) / d, b = (hi - p) / d; if (a > b) [a, b] = [b, a]; near = Math.max(near, a); far = Math.min(far, b); if (near > far) return null; }
  }
  return near;
}
function segmentCircle(x, z, dx, dz, p) {
  const a = dx * dx + dz * dz, ox = x - p.x, oz = z - p.z, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - .7 ** 2;
  if (c <= 0) return 0; const disc = b * b - 4 * a * c; if (!a || disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a); return t >= 0 && t <= 1 ? t : null;
}
export class Arena {
  constructor(mapId = 'plaza', difficulty = DEFAULT_DIFFICULTY, options = {}) { this.options = { ...DEFAULT_OPTIONS, ...(validOptions(options) ? options : {}) }; this.flags = []; this.teamScores = [0, 0]; this.mapId = paintArenaInfo(mapId).id; this.variant = 0; this.events = []; this.eventSerial = 0; this.difficulty = validDifficulty(difficulty) ? difficulty : DEFAULT_DIFFICULTY; this.phase = 'lobby'; this.players = []; this.balls = []; this.splats = []; this.time = DURATION; this.round = 0; this.serial = 0; this.message = 'La cancha está lista.'; }
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
    if (p) { Object.assign(p, info, { connected: true, seat, team, color }); return p; }
    p = { id, ...info, connected: true, seat, team, eliminated: false, slow: 0, weapon: 'pistol', ...spawnsFor(this.mapId)[this.players.length % 8], ax: 0, az: -1, score: 0, hits: 0, paint: 0, stains: [], calm: 0, streak: 0, nemesis: null, stamina: 1, sprint: false, ammo: 12, reload: 0, cooldown: 0, respawn: 0, shield: 1.5, color };
    this.players.push(p); return p;
  }
  start() {
    if (this.phase === 'playing' || !this.canStart()) return false;
    this.players = this.players.filter(p => p.connected); this.phase = 'playing'; this.survivors = null; this.round++; this.variant = (this.round - 1) % VARIANTS; this.time = this.options.duration; this.teamScores = [0, 0]; this.flags = spawnsFor(this.mapId).slice(0, 2).map(({ x, z }, team) => ({ team, x, z, homeX: x, homeZ: z, carrier: null })); this.balls = []; this.splats = [];
    this.players.forEach((p, i) => Object.assign(p, spawnsFor(this.mapId)[i % 8], { eliminated: false, slow: 0, color: (this.options.mode === 'teams' || this.options.flag) ? COLORS[p.team] : COLORS[i % 8], score: 0, hits: 0, paint: 0, stains: [], calm: 0, streak: 0, nemesis: null, stamina: 1, sprint: false, ammo: 12, reload: 0, cooldown: 0, respawn: 0, shield: 1.5 }));
    this.message = `¡A pintar! Cancha ${variantName(this.mapId, this.variant).toLowerCase()}.`; return true;
  }
  respawn(p) {
    const spawn = [...spawnsFor(this.mapId)].sort((a, b) => {
      const nearest = s => Math.min(...this.players.filter(q => q.id !== p.id && q.connected && !q.respawn && !q.eliminated && !this.sameTeam(p, q)).map(q => Math.hypot(q.x - s.x, q.z - s.z)), 100);
      return nearest(b) - nearest(a);
    })[0];
    Object.assign(p, spawn, { ammo: 12, reload: 0, cooldown: 0, shield: 1.5, paint: 0, stains: [], calm: 0, stamina: 1 });
  }
  bot(p) {
    const enemies = this.players.filter(q => q.id !== p.id && q.connected && !q.respawn && !q.eliminated && !this.sameTeam(p, q)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const q = enemies[0]; if (!q) return cleanInput();
    const dx = q.x - p.x, dz = q.z - p.z, length = Math.hypot(dx, dz) || 1;
    const clear = !this.cover.some(o => segmentBox(p.x, p.z, dx, dz, o) !== null);
    const t = (DURATION - this.time) * .7 + p.id, strafe = Math.sin(t) > 0 ? 1 : -1, skill = BOT_SKILL[this.difficulty] || BOT_SKILL.normal;
    // A deterministic wobble around the true line: weaker bots spray, sharp ones rarely miss.
    const wobble = Math.sin(t * 2.3 + p.id * 1.7) * skill.wobble, aimX = dx / length * Math.cos(wobble) - dz / length * Math.sin(wobble), aimZ = dx / length * Math.sin(wobble) + dz / length * Math.cos(wobble);
    let x = clear ? dx / length * (length > 9 ? .8 : -.25) - dz / length * strafe * .6 : Math.cos(t * .6);
    let z = clear ? dz / length * (length > 9 ? .8 : -.25) + dx / length * strafe * .6 : Math.sin(t * .6);
    if (blocked(p.x + x * 1.4, p.z + z * 1.4, RADIUS, this.mapId, this.variant)) { x = -dz / length; z = dx / length; }
    if (this.options.flag) {
      const carried = this.flags.find(f => f.carrier === p.id), target = carried ? this.flags[p.team] : this.flags[1 - p.team];
      const tx = carried ? target.homeX : target.x, tz = carried ? target.homeZ : target.z, d = Math.hypot(tx - p.x, tz - p.z) || 1;
      x = (tx - p.x) / d; z = (tz - p.z) / d;
      if (blocked(p.x + x * 1.4, p.z + z * 1.4, RADIUS, this.mapId, this.variant)) { const swap = x; x = -z; z = swap; }
    }
    return cleanInput({ x, z, ax: aimX, az: aimZ, fire: clear && length < 34 && Math.sin(t * 3) > skill.trigger, reload: p.ammo < 3 && !clear });
  }
  step(dt, inputs = new Map()) {
    if (this.phase !== 'playing') return; dt = clamp(dt, 0, .05); this.time = Math.max(0, this.time - dt);
    for (const p of this.players) {
      if (!p.connected || p.eliminated) continue;
      p.slow = Math.max(0, (p.slow || 0) - dt);
      if (p.respawn > 0) { p.respawn = Math.max(0, p.respawn - dt); if (!p.respawn) this.respawn(p); continue; }
      p.shield = Math.max(0, p.shield - dt); p.cooldown = Math.max(0, p.cooldown - dt);
      // Paint wears off after four quiet seconds, one pepazo every 1.5 s.
      if (p.paint > 0 && (p.calm += dt) >= 4) { p.paint--; p.stains = p.stains.slice(1); p.calm = 2.5; }
      if (p.reload > 0) { p.reload = Math.max(0, p.reload - dt); if (!p.reload) p.ammo = 12; }
      const input = p.bot ? this.bot(p) : cleanInput(inputs.get(p.id));
      p.weapon = this.options.weapons === 'pistol' ? 'pistol' : input.weapon;
      p.ax = input.ax; p.az = input.az;
      // Shift sprints 45% faster for up to three seconds; sprinting holds fire.
      const sprinting = input.sprint && !input.fire && p.stamina > 0 && !!(input.x || input.z);
      p.stamina = clamp(p.stamina + (sprinting ? -dt / 3 : dt / 5), 0, 1); p.sprint = sprinting;
      const speed = SPEED * (p.slow > 0 ? .45 : 1) * (sprinting ? 1.45 : 1), x = p.x + input.x * speed * dt, z = p.z + input.z * speed * dt;
      if (!blocked(x, p.z, RADIUS, this.mapId, this.variant)) p.x = x; if (!blocked(p.x, z, RADIUS, this.mapId, this.variant)) p.z = z;
      p.walk = !!(input.x || input.z);
      if ((input.reload || p.ammo === 0) && !p.reload && p.ammo < 12) p.reload = this.options.fastReload ? .55 : 1.3;
      if (input.fire && !sprinting && !p.cooldown && !p.reload && p.ammo > 0) {
        p.ammo--; p.cooldown = p.weapon === 'rapid' ? .13 : p.weapon === 'scatter' ? .75 : .25; p.shield = 0;
        for (const angle of p.weapon === 'scatter' ? [-.18, 0, .18] : [0]) this.balls.push({ id: ++this.serial, owner: p.id, color: p.color, x: p.x, z: p.z, vx: (p.ax * Math.cos(angle) - p.az * Math.sin(angle)) * BALL_SPEED, vz: (p.az * Math.cos(angle) + p.ax * Math.sin(angle)) * BALL_SPEED, life: p.weapon === 'scatter' ? .5 : 1.5 });
      }
    }
    for (const ball of this.balls) {
      const dx = ball.vx * dt, dz = ball.vz * dt; let earliest = 1.01, victim = null;
      for (const o of this.cover) { const t = segmentBox(ball.x, ball.z, dx, dz, o, .12); if (t !== null && t < earliest) earliest = t; }
      for (const p of this.players) if (p.id !== ball.owner && p.connected && !p.respawn && !p.eliminated && !p.shield && (this.options.friendlyFire || !this.sameTeam(p, this.players.find(q => q.id === ball.owner)))) {
        const t = segmentCircle(ball.x, ball.z, dx, dz, p); if (t !== null && t < earliest) { earliest = t; victim = p; }
      }
      ball.x += dx * Math.min(1, earliest); ball.z += dz * Math.min(1, earliest); ball.life -= dt;
      if (earliest <= 1 || Math.abs(ball.x) > sizeFor(this.mapId) || Math.abs(ball.z) > sizeFor(this.mapId)) {
        ball.life = 0; this.splats.push({ id: ball.id, x: ball.x, z: ball.z, color: ball.color, life: 9 });
        if (victim) this.hit(victim, this.players.find(p => p.id === ball.owner), ball.color);
      }
    }
    this.balls = this.balls.filter(b => b.life > 0); this.splats = this.splats.filter(s => (s.life -= dt) > 0).slice(-64);
    if (this.options.flag) this.updateFlags();
    const alive = this.players.filter(p => p.connected && !p.eliminated), teams = this.options.mode === 'teams' || this.options.flag;
    const eliminatedEnd = this.options.lives > 0 && this.players.some(p => p.eliminated) && this.players.length > 1 && (teams ? new Set(alive.map(p => p.team)).size <= 1 : alive.length <= 1);
    if (eliminatedEnd) this.survivors = alive.map(p => p.id);
    if (this.time <= 0 || eliminatedEnd || (this.options.flag ? this.teamScores.some(s => s >= 3) : teams ? this.teamScores.some(s => s >= TARGET) : this.players.some(p => p.score >= TARGET))) { this.phase = 'finished'; this.balls = []; }
  }
  // A pepazo stains the victim; the last one their aguante allows takes them out.
  hit(victim, owner, color) {
    const distance = owner ? Math.round(Math.hypot(owner.x - victim.x, owner.z - victim.z)) : 0;
    victim.paint++; victim.stains = [...victim.stains, color].slice(-5); victim.calm = 0;
    if (victim.paint < this.options.toughness) { this.event('hit', owner, victim, distance); return; }
    victim.respawn = 2.5; victim.hits++; victim.slow = this.options.paint === 'sticky' ? 7 : 0; victim.eliminated = this.options.lives > 0 && victim.hits >= this.options.lives;
    const rival = !!owner && !this.sameTeam(owner, victim), revenge = rival && owner.nemesis === victim.id;
    if (rival) { owner.score++; owner.streak++; if (revenge) owner.nemesis = null; victim.nemesis = owner.id; if (!this.options.flag) this.teamScores[owner.team]++; }
    victim.streak = 0;
    for (const flag of this.flags) if (flag.carrier === victim.id) { flag.carrier = null; flag.x = victim.x; flag.z = victim.z; }
    this.message = `${owner?.name || 'Un pana'} pintó a ${victim.name} · ${distance} m`;
    this.event('out', owner, victim, distance, { streak: rival ? owner.streak : 0, revenge });
  }
  event(type, owner, victim, distance, extra = {}) {
    this.events = [...this.events, { n: ++this.eventSerial, type, owner: owner?.id ?? null, victim: victim.id, color: owner?.color || victim.color, distance, ...extra }].slice(-12);
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
            this.teamScores[p.team]++; p.score += 3; this.message = `${p.name} capturó la bandera.`; reset(flag);
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
  view() { return { winners: this.winners(), options: { ...this.options }, flags: this.flags.map(f => ({ ...f })), teamScores: [...this.teamScores], mapId: this.mapId, variant: this.variant, events: this.events.map(e => ({ ...e })), difficulty: this.difficulty, phase: this.phase, round: this.round, time: this.time, players: this.players.map(p => ({ ...p, stains: [...p.stains] })), balls: this.balls.map(b => ({ ...b })), splats: this.splats.map(s => ({ ...s })), message: this.message }; }
}

// Stable lobby positions are independent of member IDs and survive roster changes.
export function paintSeats(players) { return Array.from({ length: 8 }, (_, seat) => players.find(p => p.connected && p.seat === seat) || null); }
