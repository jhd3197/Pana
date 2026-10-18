import { arenaInfo, arenaLayout, ARENA_SPAWNS, validArena } from '../../../engine/arena-layouts.js';
import { DEFAULT_DIFFICULTY, validDifficulty } from '../../../engine/difficulty.js';

export const SIZE = 18, DURATION = 120, TARGET = 10, SPEED = 7, RADIUS = .55;
export const COLORS = ['#f28b42', '#29c5cd', '#d363a6', '#a1bd43', '#8d85df', '#f0c34c', '#ed615c', '#64b898'];
export const COVER = [
  { x: 0, z: 0, w: 4, d: 2, h: 2.4 },
  ...[-1, 1].flatMap(s => [{ x: s * 8, z: -6, w: 2.4, d: 5, h: 2.8 }, { x: s * 8, z: 6, w: 2.4, d: 5, h: 2.8 },
    { x: s * 3.5, z: -11, w: 4, d: 1.8, h: 1.8 }, { x: s * 3.5, z: 11, w: 4, d: 1.8, h: 1.8 }]),
];
export const SPAWNS = [{ x: -14, z: -14 }, { x: 14, z: 14 }, { x: 14, z: -14 }, { x: -14, z: 14 }, { x: 0, z: -15 }, { x: 0, z: 15 }, { x: -15, z: 0 }, { x: 15, z: 0 }];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
// Bot marksmanship per difficulty: aim wobble (radians) and how much of the
// time a bot with a clear line keeps the trigger down (sine threshold).
export const BOT_SKILL = { facil: { wobble: .16, trigger: .45 }, normal: { wobble: .07, trigger: -.2 }, dificil: { wobble: .035, trigger: -.5 }, experto: { wobble: .012, trigger: -.8 } };
export function cleanInput(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const num = n => Number.isFinite(n) ? clamp(n, -1, 1) : 0;
  let x = num(input.x), z = num(input.z), length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
  let ax = num(input.ax), az = num(input.az); length = Math.hypot(ax, az); if (length > .01) { ax /= length; az /= length; } else { ax = 0; az = -1; }
  return { x, z, ax, az, fire: input.fire === true, reload: input.reload === true };
}
export const coverFor = id => arenaLayout(id)?.cover || COVER;
export const spawnsFor = id => arenaLayout(id) ? ARENA_SPAWNS : SPAWNS;
export function blocked(x, z, radius = RADIUS, mapId = 'plaza') {
  return Math.abs(x) > SIZE - radius || Math.abs(z) > SIZE - radius || coverFor(mapId).some(o => Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
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
  constructor(mapId = 'plaza', difficulty = DEFAULT_DIFFICULTY) { this.mapId = arenaInfo(mapId).id; this.difficulty = validDifficulty(difficulty) ? difficulty : DEFAULT_DIFFICULTY; this.phase = 'lobby'; this.players = []; this.balls = []; this.splats = []; this.time = DURATION; this.round = 0; this.serial = 0; this.message = 'La cancha está lista.'; }
  selectMap(id) {
    if (this.phase !== 'lobby' || !validArena(id)) return false;
    this.mapId = id; this.players.forEach((p, i) => Object.assign(p, spawnsFor(id)[i % 8])); return true;
  }
  selectDifficulty(id) {
    if (this.phase === 'playing' || !validDifficulty(id)) return false;
    this.difficulty = id; return true;
  }
  add(id, info) {
    let p = this.players.find(p => p.id === id);
    if (p) { Object.assign(p, info, { connected: true }); return p; }
    p = { id, ...info, connected: true, ...spawnsFor(this.mapId)[this.players.length % 8], ax: 0, az: -1, score: 0, hits: 0, ammo: 12, reload: 0, cooldown: 0, respawn: 0, shield: 1.5, color: COLORS[this.players.length % 8] };
    this.players.push(p); return p;
  }
  start() {
    if (this.phase === 'playing') return false;
    this.players = this.players.filter(p => p.connected); this.phase = 'playing'; this.round++; this.time = DURATION; this.balls = []; this.splats = [];
    this.players.forEach((p, i) => Object.assign(p, spawnsFor(this.mapId)[i % 8], { score: 0, hits: 0, ammo: 12, reload: 0, cooldown: 0, respawn: 0, shield: 1.5 }));
    this.message = '¡A pintar!'; return true;
  }
  respawn(p) {
    const spawn = [...spawnsFor(this.mapId)].sort((a, b) => {
      const nearest = s => Math.min(...this.players.filter(q => q.id !== p.id && q.connected && !q.respawn).map(q => Math.hypot(q.x - s.x, q.z - s.z)), 100);
      return nearest(b) - nearest(a);
    })[0];
    Object.assign(p, spawn, { ammo: 12, reload: 0, cooldown: 0, shield: 1.5 });
  }
  bot(p) {
    const enemies = this.players.filter(q => q.id !== p.id && q.connected && !q.respawn).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const q = enemies[0]; if (!q) return cleanInput();
    const dx = q.x - p.x, dz = q.z - p.z, length = Math.hypot(dx, dz) || 1;
    const clear = !coverFor(this.mapId).some(o => segmentBox(p.x, p.z, dx, dz, o) !== null);
    const t = (DURATION - this.time) * .7 + p.id, strafe = Math.sin(t) > 0 ? 1 : -1, skill = BOT_SKILL[this.difficulty] || BOT_SKILL.normal;
    // A deterministic wobble around the true line: weaker bots spray, sharp ones rarely miss.
    const wobble = Math.sin(t * 2.3 + p.id * 1.7) * skill.wobble, aimX = dx / length * Math.cos(wobble) - dz / length * Math.sin(wobble), aimZ = dx / length * Math.sin(wobble) + dz / length * Math.cos(wobble);
    let x = clear ? dx / length * (length > 9 ? .8 : -.25) - dz / length * strafe * .6 : Math.cos(t * .6);
    let z = clear ? dz / length * (length > 9 ? .8 : -.25) + dx / length * strafe * .6 : Math.sin(t * .6);
    if (blocked(p.x + x * 1.4, p.z + z * 1.4, RADIUS, this.mapId)) { x = -dz / length; z = dx / length; }
    return cleanInput({ x, z, ax: aimX, az: aimZ, fire: clear && length < 24 && Math.sin(t * 3) > skill.trigger, reload: p.ammo < 3 && !clear });
  }
  step(dt, inputs = new Map()) {
    if (this.phase !== 'playing') return; dt = clamp(dt, 0, .05); this.time = Math.max(0, this.time - dt);
    for (const p of this.players) {
      if (!p.connected) continue;
      if (p.respawn > 0) { p.respawn = Math.max(0, p.respawn - dt); if (!p.respawn) this.respawn(p); continue; }
      p.shield = Math.max(0, p.shield - dt); p.cooldown = Math.max(0, p.cooldown - dt);
      if (p.reload > 0) { p.reload = Math.max(0, p.reload - dt); if (!p.reload) p.ammo = 12; }
      const input = p.bot ? this.bot(p) : cleanInput(inputs.get(p.id));
      p.ax = input.ax; p.az = input.az;
      const x = p.x + input.x * SPEED * dt, z = p.z + input.z * SPEED * dt;
      if (!blocked(x, p.z, RADIUS, this.mapId)) p.x = x; if (!blocked(p.x, z, RADIUS, this.mapId)) p.z = z;
      p.walk = !!(input.x || input.z);
      if ((input.reload || p.ammo === 0) && !p.reload && p.ammo < 12) p.reload = 1.3;
      if (input.fire && !p.cooldown && !p.reload && p.ammo > 0) {
        p.ammo--; p.cooldown = .25; p.shield = 0;
        this.balls.push({ id: ++this.serial, owner: p.id, color: p.color, x: p.x, z: p.z, vx: p.ax * 29, vz: p.az * 29, life: 1.5 });
      }
    }
    for (const ball of this.balls) {
      const dx = ball.vx * dt, dz = ball.vz * dt; let earliest = 1.01, victim = null;
      for (const o of coverFor(this.mapId)) { const t = segmentBox(ball.x, ball.z, dx, dz, o, .12); if (t !== null && t < earliest) earliest = t; }
      for (const p of this.players) if (p.id !== ball.owner && p.connected && !p.respawn && !p.shield) {
        const t = segmentCircle(ball.x, ball.z, dx, dz, p); if (t !== null && t < earliest) { earliest = t; victim = p; }
      }
      ball.x += dx * Math.min(1, earliest); ball.z += dz * Math.min(1, earliest); ball.life -= dt;
      if (earliest <= 1 || Math.abs(ball.x) > SIZE || Math.abs(ball.z) > SIZE) {
        ball.life = 0; this.splats.push({ id: ball.id, x: ball.x, z: ball.z, color: ball.color, life: 9 });
        if (victim) {
          victim.respawn = 2.5; victim.hits++; const owner = this.players.find(p => p.id === ball.owner); if (owner) owner.score++;
          this.message = `${owner?.name || 'Un pana'} pintó a ${victim.name}.`;
        }
      }
    }
    this.balls = this.balls.filter(b => b.life > 0); this.splats = this.splats.filter(s => (s.life -= dt) > 0).slice(-64);
    if (this.time <= 0 || this.players.some(p => p.score >= TARGET)) { this.phase = 'finished'; this.balls = []; }
  }
  view() { return { mapId: this.mapId, difficulty: this.difficulty, phase: this.phase, round: this.round, time: this.time, players: this.players.map(p => ({ ...p })), balls: this.balls.map(b => ({ ...b })), splats: this.splats.map(s => ({ ...s })), message: this.message }; }
}
