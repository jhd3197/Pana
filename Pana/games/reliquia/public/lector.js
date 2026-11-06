// El Lector: the blind librarian of the buried library. It hunts by ear
// only (engine/play/noise.js): the newest loud noise that reaches it makes it
// stop dead and cock its head toward it (`listen`, the tell), then it homes
// in fast (`hunt`), searches around the spot for a while (`search`) and goes
// back to wandering slowly, listening (`prowl`). Walking, standing still and
// riding make no noise, so it walks right past a quiet pana; it only claws
// at someone it bumps into (within about a metre) or someone making noise in
// its reach. Light means nothing to it; a hit staggers it like anything else.
// Renderer-free: the host runs it in updateEnemies (enemies.js).
import { hearNoise, noisySince } from '../../../engine/play/noise.js';
import { floorOf } from './deck.js';
import { distance } from './layout.js';
import { random } from './director.js';

export const LECTOR = { listen: .7, search: 6, bump: 1.1, fresh: .8, hunt: 1, seek: .55, prowl: .35, giveUp: 12 };
const standing = p => !p.downed && !p.spectator;
const goal = { x: 0, z: 0 };

// Wander toward a point near (cx, cz), now and then stopping to listen.
function wander(g, e, cx, cz, r, pace, dt, walk) {
  if (e.pause > 0) { e.pause -= dt; return; }
  if (e.wx == null || Math.hypot(e.wx - e.x, e.wz - e.z) < .6 || g.time > e.wUntil) {
    if (e.wx != null && random(g) < .5) { e.pause = 1 + random(g) * 2.5; e.wx = null; return; }
    e.wx = null;
    for (let i = 0; i < 6; i++) {
      const a = random(g) * Math.PI * 2, d = .8 + random(g) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (g.layout.walkable(x, z, g, .5)) { e.wx = x; e.wz = z; e.wUntil = g.time + 6; g.paths.delete(e.id); break; }
    }
    return;
  }
  goal.x = e.wx; goal.z = e.wz; walk(g, e, goal, pace, dt);
}

export function updateLector(g, e, k, speed, damage, dt, { walk, stunned = false }) {
  const f = floorOf(e.x);
  // Ears first, even while staggered: walls muffle a noise to 60 % of its reach.
  const heard = hearNoise(g.noise, e, { floor: f, since: e.heardAt ?? -1, time: g.time, muffled: n => g.layout.lineClear(e, n, g, .05) ? 1 : .6 });
  if (heard) {
    if (e.goalX == null || Math.hypot(heard.x - e.goalX, heard.z - e.goalZ) > 1) g.paths.delete(e.id);
    e.heardAt = heard.time; e.goalX = heard.x; e.goalZ = heard.z;
    if (e.mode !== 'hunt' && e.mode !== 'listen') { e.mode = 'listen'; e.modeT = 0; e.wx = null; e.pause = 0; }
  }
  if (e.mode === 'listen' && e.goalX != null) { const yaw = Math.atan2(e.goalX - e.x, e.goalZ - e.z) - e.h; e.look = Math.round(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 100) / 100; }
  else if (e.look) e.look = 0;
  if (stunned) return;
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) {
      for (const p of g.players) if (standing(p) && Math.hypot(p.x - e.attackX, p.z - e.attackZ) < k.radius && g.layout.lineClear(e, p, g, .1)) g.damage(p, damage, e);
      e.cooldown = k.cooldown;
    }
    return;
  }
  // Prey: someone it bumps into, or someone noisy within its reach.
  let prey = null, best = k.reach;
  for (const p of g.players) {
    if (!standing(p) || floorOf(p.x) !== f) continue;
    const d = distance(p, e);
    if (d < best && (d < LECTOR.bump || noisySince(g.noise, p.id, g.time - LECTOR.fresh))) { best = d; prey = p; }
  }
  if (prey) {
    e.h = Math.atan2(prey.x - e.x, prey.z - e.z);
    if (e.cooldown <= 0 && g.layout.lineClear(e, prey, g, .1)) { e.windup = k.windup; e.attackX = e.x + Math.sin(e.h) * .6; e.attackZ = e.z + Math.cos(e.h) * .6; }
    return;
  }
  if (e.mode === 'listen') { if (e.modeT >= LECTOR.listen) { e.mode = 'hunt'; e.modeT = 0; } return; }
  if (e.mode === 'hunt') {
    goal.x = e.goalX; goal.z = e.goalZ;
    if (distance(e, goal) < 1 || e.modeT > LECTOR.giveUp) { e.mode = 'search'; e.modeT = 0; e.wx = null; return; }
    walk(g, e, goal, speed * LECTOR.hunt, dt); return;
  }
  if (e.mode === 'search') {
    if (e.modeT > LECTOR.search) { e.mode = 'prowl'; e.modeT = 0; e.homeX = e.x; e.homeZ = e.z; e.wx = null; return; }
    wander(g, e, e.goalX ?? e.x, e.goalZ ?? e.z, 3, speed * LECTOR.seek, dt, walk); return;
  }
  wander(g, e, e.homeX, e.homeZ, 4, speed * LECTOR.prowl, dt, walk);
}
