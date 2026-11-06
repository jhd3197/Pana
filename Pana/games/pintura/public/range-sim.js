// The armory's shooting range, without Three.js: the lane, its targets and an
// Arena that runs the real rules (rules.js) for the equipped kit. Targets are
// dummy panas that never get knocked out, so every hit, its distance and the
// pepazos it paints (the weapon's falloff) can be read back. range.js drives it,
// range-scene.js draws it; tests/range.test.js fires at it in Node.
import { Arena, EYE, TICK, SPEED } from './rules.js';
import { kitStats } from './armory-data.js';

// The court is El Puerto's (the longest bounds, 116 m along x); the shooter
// stands at FIRE and looks down +x. Its cover is replaced by the lane's walls.
export const FIRE = { x: -55, z: 0 }, LANE = { half: 6, length: 105, height: 5.2 };
// The firing bay the shooter can walk in (WASD, the left stick): behind the line, across the lane.
export const BAY = { back: 3, half: LANE.half - 1 };
// Distance markers on the floor and on the hanging signs.
export const MARKS = [10, 25, 50, 75, 100];
// kind: paper (a silhouette), board (a white panel that takes paint), popup (drops
// and rises), rail (slides across the lane), back (the big board at the berm).
export const TARGETS = [
  { id: 2, d: 10, z: -2.2, kind: 'paper' },
  { id: 3, d: 25, z: 3.6, kind: 'board' },
  { id: 4, d: 35, z: -4, kind: 'popup', up: 2.4, down: 1.3 },
  { id: 5, d: 50, z: 0, kind: 'rail', swing: 3, speed: .3 },
  { id: 6, d: 75, z: 3.2, kind: 'popup', up: 3, down: 1.5, phase: 1.2 },
  { id: 7, d: 100, z: 0, kind: 'back' },
];
// A melee kit gets its first target within arm's reach.
export const MELEE_REACH = 1.9;
const BIG = 1e6;
// The lane's colliders: both side walls, the berm behind the back target. No height:
// the lane has a roof, so a ball aimed up still ends on them.
export const LANE_COVER = [
  { x: FIRE.x + LANE.length / 2, z: -LANE.half - .5, w: LANE.length + 4, d: 1 },
  { x: FIRE.x + LANE.length / 2, z: LANE.half + .5, w: LANE.length + 4, d: 1 },
  { x: FIRE.x + LANE.length + 1, z: 0, w: 2, d: LANE.half * 2 + 2 },
];
export const targetX = t => FIRE.x + t.d;

// kit: the armory's kit; options: the room's options (pistol-only rooms and the like).
export function createRangeSim(kit, options = {}) {
  const arena = new Arena('terminal', undefined, options), stats = () => kitStats(arena.players[0].kit, arena.options);
  arena.add(1, { name: '' }); for (const t of TARGETS) arena.add(t.id, { name: '' });
  arena.selectKit(1, kit); arena.start(); arena.go();
  Object.defineProperty(arena, 'cover', { value: LANE_COVER });
  const melee = !!stats().melee, me = arena.players[0];
  const targets = TARGETS.map(t => ({ ...t, ...(melee && t.id === 2 ? { d: MELEE_REACH, z: 0 } : {}), x: 0, offset: 0, raised: 1 }));
  for (const t of targets) t.x = targetX(t);
  // Every hit the rules land: who, how many pepazos (Infinity: a direct rocket or a head hit), the splat it made.
  let landed = [];
  arena.hit = function (victim, owner, color, impact = {}, damage = 1) {
    const splat = impact.blast ? null : this.splats.at(-1);
    landed.push({ id: victim.id, damage, head: !!impact.headshot, blast: !!impact.blast, melee: !!impact.melee, splat: splat ? { x: splat.x, z: splat.z } : null, splatId: splat?.id ?? null });
    return Arena.prototype.hit.call(this, victim, owner, color, impact, damage);
  };
  let time = 0, acc = 0; const flying = new Map(), counts = { shots: 0, hits: 0 }, stand = { x: FIRE.x, z: FIRE.z };
  // A step in the bay at the kit's walk (halved through a scope); the rules never move the shooter.
  function walk(x = 0, z = 0, aim = false) {
    const length = Math.hypot(x, z); if (length < .01) return; if (length > 1) { x /= length; z /= length; }
    const step = SPEED * stats().mobility * (aim && stats().aims ? .5 : 1) * TICK;
    stand.x = Math.min(FIRE.x, Math.max(FIRE.x - BAY.back, stand.x + x * step)); stand.z = Math.min(BAY.half, Math.max(-BAY.half, stand.z + z * step));
  }
  function place() {
    Object.assign(me, { x: stand.x, z: stand.z, shield: 0, score: 0, streak: 0, paint: 0, hits: 0 });
    for (const t of targets) {
      const p = arena.players.find(q => q.id === t.id);
      t.offset = t.kind === 'rail' ? Math.sin(time * t.speed * Math.PI) * t.swing : 0;
      if (t.kind === 'popup') { const cycle = t.up + t.down, at = (time + (t.phase || 0)) % cycle; t.raised = at < t.up ? 1 : 0; }
      Object.assign(p, { x: t.x, z: t.z + t.offset, shield: t.raised ? 0 : BIG, respawn: 0, paint: 0, soak: 0, hits: 0, stains: [], eliminated: false, slow: 0 });
    }
  }
  place();
  // One 50 ms tick of the real rules with the shooter's input ({ ax, az, pitch, fire, aim, reload, grenade, charge, alt, x, z }).
  function tick(input) {
    walk(input.x, input.z, input.aim); place();
    const before = new Set(arena.balls.map(b => b.id)), report = { hits: [], walls: [], shorts: [], booms: [] };
    landed = []; arena.time = BIG; time += TICK;
    for (const b of arena.balls) flying.set(b.id, { ...flying.get(b.id), x: b.x + b.vx * TICK, z: b.z + b.vz * TICK, x0: b.x0, z0: b.z0 });
    arena.step(TICK, new Map([[1, { ...input, x: 0, z: 0, weapon: null }]]));
    for (const b of arena.balls) if (!before.has(b.id)) { flying.set(b.id, { pitch: input.pitch ?? 0, x0: b.x0, z0: b.z0, x: b.x, z: b.z }); counts.shots++; }
    const victims = new Set(landed.filter(h => h.splatId != null).map(h => h.splatId));
    for (const h of landed) {
      const t = targets.find(q => q.id === h.id); if (!t) continue;
      const shot = h.splatId != null ? flying.get(h.splatId) : null;
      counts.hits++;
      report.hits.push({ target: t, distance: Math.round(Math.hypot(t.x - stand.x, t.z + t.offset - stand.z)), damage: h.damage, head: h.head, blast: h.blast, melee: h.melee, at: h.splat, pitch: shot?.pitch ?? input.pitch ?? 0 });
    }
    // Paint that stopped on a wall or the berm, and balls that ran out of range in the air.
    const splatted = new Set(arena.splats.map(s => s.id));
    for (const s of arena.splats) if (!s.seen) {
      s.seen = true; if (s.blast || victims.has(s.id)) continue;
      const f = flying.get(s.id) || { pitch: input.pitch ?? 0, x0: stand.x, z0: stand.z };
      report.walls.push({ x: s.x, z: s.z, pitch: f.pitch, travel: Math.hypot(s.x - f.x0, s.z - f.z0) });
    }
    for (const id of before) if (!arena.balls.some(b => b.id === id)) {
      const f = flying.get(id); flying.delete(id);
      if (!splatted.has(id) && f) report.shorts.push({ x: f.x, z: f.z, pitch: f.pitch, travel: Math.hypot(f.x - f.x0, f.z - f.z0) });
    }
    for (const b of arena.booms) if (!b.seen) { b.seen = true; report.booms.push({ ...b }); }
    // The range never runs dry: a spent grenade comes back once it blew, a reserve refills.
    const s = stats();
    if (!me.grenadeReady && !arena.grenades.some(g => g.owner === 1)) me.grenadeReady = true;
    if (s.reserve != null && !me.reserve && !me.ammo && !me.reload) me.reserve = s.reserve;
    place();
    return report;
  }
  return {
    arena, targets, counts, melee,
    get me() { return me; }, get stand() { return { ...stand }; }, get stats() { return stats(); }, get time() { return time; },
    // Runs as many ticks as dt holds; `input()` is read once per tick. Returns the merged reports.
    advance(dt, input) {
      acc += Math.min(dt, .25); const out = { hits: [], walls: [], shorts: [], booms: [] };
      while (acc >= TICK) { acc -= TICK; const r = tick(input()); for (const k in out) out[k].push(...r[k]); }
      return out;
    },
    tick,
    // The pitch a ball left at (it climbs or drops along it on screen).
    pitchOf: id => flying.get(id)?.pitch ?? 0,
    // The yaw and pitch that point the eye at target t's chest.
    aimAt(t, y = 1.1) { const dx = t.x - stand.x, dz = t.z + t.offset - stand.z, d = Math.hypot(dx, dz); return { ax: dx / d, az: dz / d, pitch: Math.atan2(y - EYE, d) }; },
    reset() { counts.shots = counts.hits = 0; arena.splats = []; arena.balls = []; flying.clear(); },
  };
}
