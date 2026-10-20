// What hunts the panas, renderer-free. Mummies freeze in a farol's beam and
// rush you in the dark; phantoms come with the echo mask; the guardian slams;
// jaguars prowl, crouch and pounce, and a farol dazes them once in a while.
// Guácharos fly in flocks and scatter from a beam; spiders hang from the
// ceiling until a pana walks under and their bite slows; cuaimas lie coiled
// by the loot, strike and poison, but never leave home for long.
import { clamp } from '../../../engine/random.js';
import { floorOf } from './deck.js';
import { distance } from './layout.js';

export const KINDS = {
  mummy: { hp: 60, speed: 2.6, reach: 1.7, windup: .65, radius: 2.1, damage: 12, cooldown: 1.15, light: 'freeze' },
  phantom: { hp: 24, speed: 3.3, reach: 1.5, windup: .5, radius: 1.8, damage: 8, cooldown: 1, light: 'freeze' },
  guardian: { hp: 260, scale: 80, speed: 2.3, reach: 3.4, windup: 1.15, radius: 3.8, damage: 28, cooldown: 1.8, light: 'slow' },
  jaguar: { hp: 620, scale: 160, speed: 4.2, reach: 7, windup: .9, radius: 2.1, damage: 30, cooldown: 1.2, light: 'daze', cat: true },
  stalker: { hp: 300, scale: 70, speed: 4.6, reach: 6.5, windup: .8, radius: 1.9, damage: 24, cooldown: 1.4, light: 'daze', cat: true },
  bat: { hp: 14, speed: 6.2, reach: 1.3, windup: .3, radius: 1.2, damage: 5, cooldown: 1.3, light: 'scatter', flying: true },
  spider: { hp: 30, speed: 4.3, reach: 1.4, windup: .28, radius: 1.3, damage: 8, cooldown: 1, light: 'none', slows: 2.5 },
  snake: { hp: 40, speed: 1.6, reach: 2.4, windup: .35, radius: 2.5, damage: 16, cooldown: 1.6, light: 'none', poison: 5, home: 3.5 },
};
const DIFFICULTY = { easy: { hp: .75, damage: .65, speed: .85 }, normal: { hp: 1, damage: 1, speed: 1 }, hard: { hp: 1.35, damage: 1.45, speed: 1.15 } };
export const scaleFor = g => DIFFICULTY[g.options.difficulty] || DIFFICULTY.normal;
export const holds = (p, kind) => !!p?.hands?.some(h => h?.kind === kind);
const standing = p => !p.downed && !p.spectator;

// Is this enemy lit? 'beam' when a farol points at it, 'glow' near a crown or brazier.
export function lightOn(g, e) {
  const f = floorOf(e.x);
  let glow = g.layout.run.lights.some(l => l.floor === f && (l.x - e.x) ** 2 + (l.z - e.z) ** 2 < 25);
  for (const p of g.players) {
    if (!standing(p) || floorOf(p.x) !== f) continue;
    const d = distance(p, e);
    if (holds(p, 'sunCrown') && d < 5.5) glow = true;
    if (holds(p, 'farol') && d < 7.5) {
      const ahead = ((e.x - p.x) * Math.sin(p.h) + (e.z - p.z) * Math.cos(p.h)) / (d || 1);
      if (ahead > .8 && g.layout.lineClear(p, e, g, .1)) return 'beam';
      if (d < 3) glow = true;
    }
  }
  return glow ? 'glow' : 'dark';
}

export function spawnEnemy(g, kind, x, z, extra = {}) {
  const live = g.enemies.filter(e => e.hp > 0);
  if (!KINDS[kind]) return null;
  if (['mummy', 'phantom', 'bat', 'spider'].includes(kind) && live.length >= 18) return null;
  if (!g.layout.walkable(x, z, g, .5)) return null;
  const k = KINDS[kind], s = scaleFor(g), floor = floorOf(x), roster = g.players.filter(p => !p.spectator).length;
  const hp = (k.hp + (k.scale || 0) * Math.max(0, roster - 1)) * s.hp * (1 + .22 * Math.max(0, floor - 1));
  const e = { id: ++g.enemyId, kind, x, z, h: 0, hp, maxHp: hp, cooldown: .8, windup: 0, stun: 0, hit: 0, awake: !['guardian', 'jaguar'].includes(kind),
    born: g.time, mode: 'prowl', modeT: 0, immune: 0, attackX: x, attackZ: z, lit: 'dark', homeX: x, homeZ: z, ...(k.flying ? { y: 2.2 } : {}), ...extra };
  g.enemies.push(e); return e;
}

function targetFor(g, e) {
  const f = floorOf(e.x), range = e.kind === 'guardian' ? 28 : 40;
  let best = null, score = Infinity;
  for (const p of g.players) {
    if (!standing(p) || floorOf(p.x) !== f) continue;
    const d = distance(p, e); if (d > range) continue;
    const s = d - (holds(p, 'sunCrown') ? 8 : 0) - (e.called === p.id ? 6 : 0);
    if (s < score) { score = s; best = p; }
  }
  return best;
}

function walk(g, e, target, speed, dt) {
  let nav = g.paths.get(e.id);
  if (!nav || nav.until < g.time || distance(nav.goal, target) > 3) { nav = { path: g.layout.findPath(e, target, g), goal: { x: target.x, z: target.z }, until: g.time + 1 + (e.id % 5) * .1 }; g.paths.set(e.id, nav); }
  while (nav.path.length && distance(e, nav.path[0]) < .6) nav.path.shift();
  const goal = nav.path[0]; if (!goal) return;
  const d = distance(e, goal);
  if (d) { g.layout.moveBody(e, (goal.x - e.x) / d * speed * dt, (goal.z - e.z) / d * speed * dt, g, e.kind === 'guardian' || KINDS[e.kind].cat ? .7 : .5); e.h = Math.atan2(goal.x - e.x, goal.z - e.z); }
}

export function updateEnemies(g, dt) {
  const s = scaleFor(g), tier = Math.floor(g.codicia / 25);
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const k = KINDS[e.kind];
    e.hit = Math.max(0, e.hit - dt); e.stun = Math.max(0, e.stun - dt); e.immune = Math.max(0, e.immune - dt); e.cooldown -= dt; e.modeT += dt;
    if (g.time - e.born < 1) continue;
    const target = targetFor(g, e);
    // A spider waits on the ceiling until someone walks under it.
    if (e.hanging) { if (target && distance(target, e) < 4.5) { e.hanging = false; e.cooldown = .6; g.event('spider', '¡Cayó una araña del techo!', { enemy: e.id }); } continue; }
    if (!e.awake) {
      if (target && distance(target, e) < (e.kind === 'jaguar' ? 7 : 10)) { e.awake = true; g.event('boss', e.kind === 'jaguar' ? '¡El jaguar de oro despertó!' : 'El guardián del sol se levanta.', { enemy: e.id, boss: e.kind }); }
      else continue;
    }
    e.lit = lightOn(g, e);
    if (e.stun > 0 || !target) { if (e.mode === 'leap') e.mode = 'recover'; continue; }
    if (k.light === 'freeze' && e.lit === 'beam') { e.windup = 0; e.frozen = true; continue; }
    e.frozen = false;
    if (k.light === 'daze' && e.lit === 'beam' && e.immune <= 0 && e.mode !== 'leap') {
      e.stun = 1.6; e.immune = 6; e.mode = 'prowl'; g.event('daze', '¡El farol encandiló al jaguar!', { enemy: e.id }); continue;
    }
    const speed = k.speed * s.speed * (1 + .08 * tier) * (e.lit === 'dark' && k.light === 'freeze' ? 1.35 : 1) * (k.light === 'slow' && e.lit === 'beam' ? .5 : 1);
    const damage = k.damage * s.damage * (1 + .1 * tier) * (.75 + .15 * floorOf(e.x));
    if (k.cat) { cat(g, e, target, speed, damage, dt); continue; }
    if (k.flying) { bat(g, e, target, speed, damage, dt); continue; }
    // Cuaimas defend their spot: past their reach from home they slide back.
    if (k.home && Math.hypot(target.x - e.homeX, target.z - e.homeZ) > k.home + k.reach) {
      const d = Math.hypot(e.homeX - e.x, e.homeZ - e.z); if (d > .3) g.layout.moveBody(e, (e.homeX - e.x) / d * speed * dt, (e.homeZ - e.z) / d * speed * dt, g, .4);
      e.windup = 0; continue;
    }
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) {
        for (const p of g.players) if (standing(p) && Math.hypot(p.x - e.attackX, p.z - e.attackZ) < k.radius && g.layout.lineClear(e, p, g, .1)) {
          g.damage(p, damage, e);
          if (k.slows) p.slow = Math.max(p.slow || 0, k.slows);
          if (k.poison) p.poison = Math.max(p.poison || 0, k.poison);
        }
        e.cooldown = k.cooldown;
      }
      continue;
    }
    e.h = Math.atan2(target.x - e.x, target.z - e.z);
    if (distance(e, target) < k.reach && e.cooldown <= 0 && g.layout.lineClear(e, target, g, .1)) { e.windup = k.windup; e.attackX = e.x + Math.sin(e.h) * (e.kind === 'guardian' ? 1.2 : .6); e.attackZ = e.z + Math.cos(e.h) * (e.kind === 'guardian' ? 1.2 : .6); continue; }
    if (distance(e, target) > 1.2 && (!k.home || Math.hypot(target.x - e.homeX, target.z - e.homeZ) < k.home + k.reach)) walk(g, e, target, speed, dt);
  }
  g.enemies = g.enemies.filter(e => e.hp > 0);
}

// Guácharos circle a pana, dive in to peck and scatter from a farol's beam.
function bat(g, e, target, speed, damage, dt) {
  e.y = 2 + Math.sin(g.time * 3 + e.id) * .35;
  if (e.lit === 'beam' && (e.fleeT || 0) <= 0) { e.fleeT = 1.6; g.event('scatter', '', { enemy: e.id }); }
  e.fleeT = Math.max(0, (e.fleeT || 0) - dt);
  const d = distance(e, target) || 1, ax = (target.x - e.x) / d, az = (target.z - e.z) / d;
  let vx, vz;
  if (e.fleeT > 0) { vx = -ax; vz = -az; }
  else if (e.windup > 0) {
    e.windup -= dt; vx = ax * 1.6; vz = az * 1.6; e.y = 1.4;
    if (e.windup <= 0) { if (d < k(e).reach + .4 && standing(target)) g.damage(target, damage, e); e.cooldown = k(e).cooldown; }
  } else if (d < k(e).reach && e.cooldown <= 0) { e.windup = k(e).windup; vx = ax; vz = az; }
  else { const orbit = d < 4 ? .9 : .2, side = e.id % 2 ? 1 : -1; vx = ax * (1 - orbit) - az * side * orbit; vz = az * (1 - orbit) + ax * side * orbit; }
  g.layout.moveBody(e, vx * speed * dt, vz * speed * dt, g, .25);
  e.h = Math.atan2(vx, vz);
}
const k = e => KINDS[e.kind];

// Jaguars: prowl in close, crouch (the telegraph), pounce at the spot, recover.
function cat(g, e, target, speed, damage, dt) {
  const d = distance(e, target);
  if (e.mode === 'crouch') {
    e.h = Math.atan2(e.attackX - e.x, e.attackZ - e.z);
    if (e.modeT >= KINDS[e.kind].windup) { e.mode = 'leap'; e.modeT = 0; e.leapX = e.x; e.leapZ = e.z; }
    return;
  }
  if (e.mode === 'leap') {
    const t = clamp(e.modeT / .45), x = e.leapX + (e.attackX - e.leapX) * t, z = e.leapZ + (e.attackZ - e.leapZ) * t;
    if (g.layout.walkable(x, z, g, .6)) { e.x = x; e.z = z; }
    if (t >= 1) {
      for (const p of g.players) if (standing(p) && Math.hypot(p.x - e.x, p.z - e.z) < KINDS[e.kind].radius) g.damage(p, damage, e);
      g.event('pounce', '', { enemy: e.id, x: e.x, z: e.z });
      e.mode = 'recover'; e.modeT = 0;
    }
    return;
  }
  if (e.mode === 'recover') { if (e.modeT > 1.1) { e.mode = 'prowl'; e.modeT = 0; e.cooldown = KINDS[e.kind].cooldown; } return; }
  e.h = Math.atan2(target.x - e.x, target.z - e.z);
  if (d < KINDS[e.kind].reach && d > 2.2 && e.cooldown <= 0 && g.layout.lineClear(e, target, g, .5)) {
    // Land a little short of where the pana stands now: a side step dodges it.
    const reach = Math.min(d, 7.5);
    e.mode = 'crouch'; e.modeT = 0; e.attackX = e.x + Math.sin(e.h) * reach; e.attackZ = e.z + Math.cos(e.h) * reach;
    return;
  }
  if (d > 2.4) walk(g, e, target, speed * (d < 9 ? .55 : 1), dt);
  else if (e.cooldown <= 0) { g.damage(target, damage * .5, e); e.cooldown = 1.1; }
}
