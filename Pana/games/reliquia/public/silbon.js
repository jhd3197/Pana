// El Silbón: the one thing on the floor that nothing can kill (`unkillable` in
// enemies.js, a blow only staggers it). You lose it or you drop it: out of its
// sight it goes to where it saw you last, looks around the nooks there and
// wanders off; a noise, a bat's screech above all, draws it; and it never looks
// down, so a straight run at someone across the pit ends in the pit. Hiding
// nooks are too narrow for its body. How hard it looks inside one depends on
// the difficulty, all of it in PEEK. Renderer-free: the host runs it in
// updateEnemies; what clients need (`mode`, `peek`, `alert`) is plain JSON.
import { hearNoise } from '../../../engine/play/noise.js';
import { floorOf, inRect, nookDepth } from './deck.js';
import { distance } from './layout.js';
import { random } from './director.js';
import { locKey } from '../../../engine/i18n.js';

// Its body: wider than a nook's gap (deck.js NOOK), so it never fits inside.
export const SILBON_BODY = .72;
export const SILBON = { sight: 20, feel: 1.3, lost: .8, searchFor: 14, nooks: 3, nookRange: 13, wander: .55, seek: .7, hunt: .9, sniff: 1.6, linger: .8, fall: 1.4, exposed: 5, giveUp: 15 };
// The one table for how it treats a hiding nook. `chance` it really looks when
// it reaches one; `windup` the seconds of warning before the look lands; `depth`
// how far inside (m from the opening) the look still finds you; `stun` and
// `hurt` what it does then. Easy never looks; the same nooks on all three.
export const PEEK = {
  easy: { chance: 0, windup: 0, depth: 0, stun: 0, hurt: 0 },
  normal: { chance: .5, windup: 1, depth: .6, stun: 1.1, hurt: 0 },
  hard: { chance: .9, windup: .7, depth: Infinity, stun: 1.6, hurt: 14 },
};
export const peekRule = difficulty => PEEK[difficulty] || PEEK.normal;
// Does it look into this nook, for a roll in 0…1?
export const willPeek = (difficulty, roll) => roll < peekRule(difficulty).chance;
// Does a look that lands find a pana this deep inside?
export const peekFinds = (difficulty, depth) => peekRule(difficulty).chance > 0 && depth <= peekRule(difficulty).depth;
// The warning as plain data: which nook, the seconds left, the total, a counter
// so each client plays its cue exactly once.
export const startPeek = (difficulty, spot, seq) => { const windup = peekRule(difficulty).windup; return { spot, t: windup, of: windup, seq }; };
// True on the tick the look lands: nothing happens to anyone before that.
export const stepPeek = (peek, dt) => { peek.t = Math.max(0, peek.t - dt); return peek.t <= 0; };
// Has this client's cue for this peek still to play?
export const peekCueDue = (e, heard) => !!e.peek && e.peek.t > 0 && e.peek.seq !== heard;

const standing = p => !p.downed && !p.spectator;
const setMode = (g, e, mode) => { e.mode = mode; e.modeT = 0; g.paths.delete(e.id); };

// The nearest pana it can actually see. A hidden one is not there at all.
function preyInSight(g, e) {
  const f = floorOf(e.x); let best = null, near = Infinity;
  for (const p of g.players) {
    if (!standing(p) || floorOf(p.x) !== f || p.hidden) continue;
    const d = distance(p, e); if (d >= near) continue;
    if (d < SILBON.feel || (d < SILBON.sight && g.layout.sightClear(e, p, g))) { near = d; best = p; }
  }
  return best;
}
function stride(g, e, goal, pace, dt) {
  const d = distance(e, goal); if (d < .01) return true;
  e.h = Math.atan2(goal.x - e.x, goal.z - e.z);
  return g.layout.moveAcross(e, (goal.x - e.x) / d * pace * dt, (goal.z - e.z) / d * pace * dt, g, SILBON_BODY);
}
// Along a path around everything; false when there is no way.
function follow(g, e, goal, pace, dt) {
  let nav = g.paths.get(e.id);
  if (!nav || nav.until < g.time || distance(nav.goal, goal) > 2) { nav = { path: g.layout.findPath(e, goal, g, SILBON_BODY), goal: { x: goal.x, z: goal.z }, until: g.time + 1.2 }; g.paths.set(e.id, nav); }
  while (nav.path.length && distance(e, nav.path[0]) < .6) nav.path.shift();
  const next = nav.path[0]; if (!next) return false;
  return stride(g, e, next, pace, dt);
}
// Hunting it takes the straight line whenever there is one, pit or no pit.
function run(g, e, goal, pace, dt) {
  if (g.layout.crossable(e, goal, g, SILBON_BODY)) return stride(g, e, goal, pace, dt);
  return follow(g, e, goal, pace, dt);
}
function hear(g, e) {
  const heard = hearNoise(g.noise, e, { floor: floorOf(e.x), since: e.heardAt ?? -1, time: g.time, muffled: n => g.layout.lineClear(e, n, g, .05) ? 1 : .6 });
  if (!heard) return false;
  e.heardAt = heard.time; e.goalX = heard.x; e.goalZ = heard.z; return true;
}
function search(g, e, x, z) {
  e.lastX = x; e.lastZ = z; e.searchLeft = SILBON.searchFor; e.checked = []; e.nook = null; setMode(g, e, 'search');
}
// Forced out of a nook: a stun, a shove through the opening, and for a while
// no nook hides whoever was just pulled out.
function flush(g, p, n, rule, e) {
  p.hidden = null; p.exposed = SILBON.exposed; p.stun = Math.max(p.stun, rule.stun);
  g.layout.moveBody(p, n.front.x - p.x, n.front.z - p.z, g, .42);
  if (rule.hurt) g.damage(p, rule.hurt, e);
  g.event('flush', locKey('¡El Silbón sacó a {name}!'), { player: p.id, enemy: e.id, vars: { name: p.name } });
}

export function updateSilbon(g, e, k, speed, damage, dt) {
  const L = g.layout, difficulty = g.options?.difficulty;
  if (e.mode === 'fall') {
    if (e.modeT >= SILBON.fall) { e.hp = 0; g.defeated(e, g.players.find(p => p.id === e.prey) || null); }
    return;
  }
  // Its centre over the pit: there is nothing under it.
  if (L.overPit(e.x, e.z)) { e.peek = null; e.windup = 0; e.alert = 0; setMode(g, e, 'fall'); g.event('silbon-falling', '', { enemy: e.id }); return; }
  if (e.stun > 0) return;
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) {
      for (const p of g.players) if (standing(p) && !p.hidden && Math.hypot(p.x - e.attackX, p.z - e.attackZ) < k.radius && L.lineClear(e, p, g, .1)) g.damage(p, damage, e);
      e.cooldown = k.cooldown;
    }
    return;
  }
  // The look: a warning first, and only when it ends does it find anybody.
  if (e.peek) {
    e.alert = .9;
    if (stepPeek(e.peek, dt)) {
      const n = L.run.nooks.find(q => q.id === e.peek.spot), rule = peekRule(difficulty); e.peek = null;
      if (n) for (const p of g.players) if (standing(p) && p.hidden === n.id && peekFinds(difficulty, nookDepth(n, p))) flush(g, p, n, rule, e);
      setMode(g, e, 'linger');
    }
    return;
  }
  const prey = preyInSight(g, e);
  if (prey) {
    if (e.mode !== 'chase') setMode(g, e, 'chase');
    e.prey = prey.id; e.lastX = prey.x; e.lastZ = prey.z; e.lostT = 0;
  } else if (e.mode !== 'chase' && hear(g, e) && e.mode !== 'hunt') setMode(g, e, 'hunt'); // A new noise beats whatever it was doing.
  switch (e.mode) {
    case 'chase': {
      e.alert = 1;
      const goal = { x: e.lastX, z: e.lastZ };
      if (prey) {
        const d = distance(e, prey);
        e.h = Math.atan2(prey.x - e.x, prey.z - e.z);
        if (d < k.reach && e.cooldown <= 0) { e.windup = k.windup; e.attackX = e.x + Math.sin(e.h) * .8; e.attackZ = e.z + Math.cos(e.h) * .8; return; }
        if (d > 1.4) run(g, e, goal, speed, dt);
        return;
      }
      // Out of sight: it runs on to the spot a moment longer, then starts looking.
      e.lostT = (e.lostT || 0) + dt;
      if (e.lostT > SILBON.lost || distance(e, goal) < .8) { search(g, e, goal.x, goal.z); return; }
      run(g, e, goal, speed, dt);
      return;
    }
    case 'hunt': {
      e.alert = .75;
      const goal = { x: e.goalX, z: e.goalZ };
      if (distance(e, goal) < 1.4 || e.modeT > SILBON.giveUp || !run(g, e, goal, speed * SILBON.hunt, dt)) search(g, e, goal.x, goal.z);
      return;
    }
    case 'search': {
      e.alert = .5; e.searchLeft = (e.searchLeft ?? 0) - dt;
      if (e.searchLeft <= 0) { e.wx = null; setMode(g, e, 'wander'); return; }
      if (!e.nook) {
        const last = { x: e.lastX ?? e.x, z: e.lastZ ?? e.z };
        if (e.modeT < 5 && distance(e, last) > 1.4 && follow(g, e, last, speed * SILBON.seek, dt)) return;
        // The nearest nook around there it has not tried yet.
        const options = L.run.nooks.filter(n => n.floor === floorOf(e.x) && !(e.checked || []).includes(n.id) && distance(n.front, last) < SILBON.nookRange).sort((a, b) => distance(a.front, e) - distance(b.front, e));
        if (!options.length || (e.checked || []).length >= SILBON.nooks) { e.searchLeft = 0; return; }
        e.nook = options[0].id; e.modeT = 0;
      }
      const n = L.run.nooks.find(q => q.id === e.nook);
      if (!n || e.modeT > 8) { (e.checked ||= []).push(e.nook); e.nook = null; return; }
      if (distance(e, n.front) > .7 && follow(g, e, n.front, speed * SILBON.seek, dt)) return;
      // At the opening: face it, and either really look in or only sniff around.
      e.h = n.h + Math.PI; (e.checked ||= []).push(n.id); e.nook = null;
      if (willPeek(difficulty, random(g))) { e.peeks = (e.peeks || 0) + 1; e.peek = startPeek(difficulty, n.id, e.peeks); setMode(g, e, 'peek'); }
      else setMode(g, e, 'sniff');
      return;
    }
    case 'sniff': case 'linger':
      e.alert = .5; e.searchLeft = (e.searchLeft ?? 0) - dt;
      if (e.modeT >= (e.mode === 'sniff' ? SILBON.sniff : SILBON.linger)) { e.mode = 'search'; e.modeT = 0; }
      return;
    default: wander(g, e, speed * SILBON.wander, dt);
  }
}
// Lost interest: room to room with pauses, listening.
function wander(g, e, pace, dt) {
  e.mode = 'wander'; e.alert = .2;
  if (e.pause > 0) { e.pause -= dt; return; }
  if (e.wx == null || Math.hypot(e.wx - e.x, e.wz - e.z) < 1.2 || g.time > (e.wUntil ?? 0)) {
    const rooms = g.layout.run.rooms.filter(r => r.floor === floorOf(e.x) && (!r.hidden || g.revealed?.[r.hidden]));
    e.wx = null; e.pause = .8 + random(g) * 2;
    for (let i = 0; i < 6 && rooms.length; i++) {
      const r = rooms[Math.floor(random(g) * rooms.length)], x = r.x + (random(g) - .5) * (r.w - 4), z = r.z + (random(g) - .5) * (r.d - 4);
      if (g.layout.walkable(x, z, g, SILBON_BODY) && !g.layout.run.nooks.some(n => inRect(x, z, n.rect, .5))) { e.wx = x; e.wz = z; e.wUntil = g.time + 20; g.paths.delete(e.id); break; }
    }
    return;
  }
  if (!follow(g, e, { x: e.wx, z: e.wz }, pace, dt)) { e.wx = null; e.pause = 1; }
}
