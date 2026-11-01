// The machine's capis. Pure: it reads the match and returns the same input a
// player's keys make, so it can never do what a player cannot. On its turn it
// weighs every weapon its team still has against every rival (a quick search
// with each weapon's real flight, wind included) by the paint the best shot
// would land, minus what a scarce shot is worth keeping: La Bazuca for a good
// hit, La Lejana for an exposed rival it can finish, La Piñita bounced behind
// cover or into a hole, El Trueno into a group. With no shot at anyone it
// walks closer (never into the water or off a drop, and not forever), then
// bores a way with La Licuadora if a wall is in the way, else lobs La Piñita,
// which never runs out. It searches angle and power finely, misses by an
// amount set by the difficulty, waits like a person would and fires before
// the clock runs out.
import { simulateFlight, simulateBounce } from '../../../engine/play/ballistic.js';
import { falloff, solveLob } from '../../../engine/play/lob.js';
import { difficultyInfo } from '../../../engine/play/difficulty.js';
import { rng, clamp } from '../../../engine/random.js';
import { stepSideWalker } from '../../../engine/play/side-walker.js';
import { RULES, activeCapy, alive, center, flightOptions, capiTargets, launch, canUse } from './rules.js';
import { weaponOf, reachOf, BASIC_WEAPON } from './weapons.js';

// The shared difficulty's aimError (radians, tuned for a cue) scaled to a lob.
const ANGLE_ERROR = 3, POWER_ERROR = 1.6;
const DEFAULT_SHOT = { angle: .8, power: .7 };
// A rival farther than this is out of comfortable range: walk closer first,
// for at most WALK_SHARE of the turn (THROW_RANGE once La Bazuca is spent).
export const RANGE = 34, THROW_RANGE = 28;   // the second with only La Piñita left: it carries less far
const WALK_SHARE = .45;

// How each weapon is searched: its arc of angles and the powers tried (La
// Lejana always fires at full charge) on a coarse grid; the shot itself then
// refines around the best few (`refine`).
const SEARCH = {
  bazooka: { a: [-.2, 1.4], p: [.2, 1], grid: [.1, .05] },
  scatter: { a: [-.2, 1.4], p: [.2, 1], grid: [.1, .05] },
  grenade: { a: [-.2, 1.4], p: [.25, 1], grid: [.14, .075], pitches: [.25, .55, .85, 1.15, -.1] },
  sniper: { a: [-1, 1.2], p: [1, 1], grid: [.015, 1], window: .3 },   // only near the straight line to the target
  drill: { a: [-.5, 1.1], p: [.3, 1], grid: [.1, .1] },
};
// What a scarce shot is worth keeping, in paint: a weapon is only fired when
// it beats La Piñita by more than this.
const KEEP = { bazooka: 0, sniper: 30, scatter: 4, drill: 0, grenade: 0 };
// Paint worth more than its amount: a rival painted out.
const FINISH = 40;
// How far a shot typically lands from where it was aimed, for valuing it (a bounced throw: further).
const SLIP = 1.2, BOUNCE_SLIP = 2;

// Where a shot of `weapon` from `start` ends: { x, y, hit, victim }. A drill's
// end is the far end of the tunnel it would bore; a grenade's where its fuse runs out.
function shotEnd(weapon, start, options) {
  const w = weaponOf(weapon);
  if (w.flight === 'bounce') return simulateBounce(start, options, { fuse: w.fuse, every: 1e9 });
  const end = simulateFlight(start, options, { dt: 1 / 60, maxTime: 7, every: 1e9 });
  if (w.flight === 'drill' && end.hit === 'ground') {
    const l = Math.hypot(end.vx, end.vy) || 1;
    return { ...end, at: { x: end.x, y: end.y }, x: end.x + end.vx / l * w.tunnel.length, y: end.y + end.vy / l * w.tunnel.length };
  }
  return end;
}

// The best shot of `weapon` from `capy` at `target` (a point; its `id` is a
// capi struck directly), searched on the weapon's coarse grid over the whole
// arc (or starting from `seed`, the `top` of an earlier coarse search) and,
// when `fine`, refined twice around the three best. Returns { angle, power,
// facing, miss, weapon, top } where miss is how far it ends.
export function bestShot(m, capy, target, { avoid = [], weapon = 'bazooka', fine = true, seed = null } = {}) {
  const w = weaponOf(weapon), s = SEARCH[w.id], facing = target.x >= capy.x ? 1 : -1, [da, dp] = s.grid;
  // The arc searched: all of it, or (La Lejana) a window round the straight line from the shoulder.
  const line = Math.atan2(target.y - capy.y - RULES.shoulder, Math.abs(target.x - capy.x) || 1e-6);
  const lo = s.window ? Math.max(s.a[0], line - s.window) : s.a[0], hi = s.window ? Math.min(s.a[1], line + s.window) : s.a[1];
  // La Lejana is judged by what it strikes, so it flies among the capis; the rest land on the ground.
  const options = flightOptions(m, w.direct ? capiTargets(m) : [], w.id), keep = (w.crater + 1) ** 2;
  const missOf = (angle, power) => {
    const shells = launch(capy, w.id, angle, facing, power), end = shotEnd(w.id, shells[(shells.length - 1) / 2], options);
    if (!end.hit) return Infinity;
    let miss = end.victim ? (end.victim.id === target.id ? 0 : Math.hypot(end.victim.x - target.x, end.victim.y - target.y)) : Math.hypot(end.x - target.x, end.y - target.y);
    if (end.hit === 'water' || end.hit === 'out') miss += 50;
    for (const a of avoid) if ((end.x - a.x) ** 2 + (end.y - a.y) ** 2 < keep) miss += 30;
    if (end.victim && avoid.some(a => a.id === end.victim.id)) miss += 50;
    return miss;
  };
  let top = seed ? seed.filter(c => c.weapon === w.id && c.facing === facing).map(c => ({ ...c })) : [];
  const consider = (angle, power) => {
    if (angle < lo - 1e-9 || angle > hi + 1e-9 || power < s.p[0] - 1e-4 || power > s.p[1] + 1e-4) return;
    const miss = missOf(angle, power);
    if (!Number.isFinite(miss) || (top.length >= 3 && miss >= top[2].miss)) return;
    top.push({ angle, power, facing, miss, weapon: w.id }); top.sort((a, b) => a.miss - b.miss); top = top.slice(0, 3);
  };
  // Bounces scatter where a grid lands: per throw angle, bisect the power for the distance (lob.js solveLob).
  if (!top.length && s.pitches) {
    const dist = facing * (target.x - capy.x), toPower = k => s.p[0] + (s.p[1] - s.p[0]) * k;
    const reach = (pitch, k) => { const end = shotEnd(w.id, launch(capy, w.id, pitch, facing, toPower(k))[0], options); return facing * (end.x - capy.x); };
    for (const pitch of s.pitches) { const r = solveLob(reach, dist, { pitches: [pitch], tolerance: .3, iterations: 9 }); if (r) consider(pitch, toPower(r.power)); }
  }
  if (!top.length) for (let angle = lo; angle <= hi + 1e-9; angle += da) for (let power = s.p[0]; power <= s.p[1] + 1e-4; power += dp) consider(angle, power);
  if (fine) for (const k of [3, 9]) {
    for (const c of top.slice(0, k === 3 ? 3 : 1)) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i || j) consider(c.angle + i * da / k, Math.min(s.p[1], c.power + j * dp / k));
  }
  return top[0] ? { ...top[0], top } : { ...DEFAULT_SHOT, facing, miss: Infinity, weapon: w.id, top };
}

// The paint a shot of `weapon` would put on each capi (all of El Trueno's
// pellets), scored for `capy`'s team: paint on rivals (more for one it
// paints out), paint on its own team counted against it.
export function shotValue(m, capy, weapon, shot) {
  const w = weaponOf(weapon), options = flightOptions(m, w.direct ? capiTargets(m) : [], w.id), reach = reachOf(w, RULES.radius);
  const slip = w.flight === 'bounce' ? BOUNCE_SLIP : w.pellets ? SLIP / 2 : SLIP;
  const ends = launch(capy, w.id, shot.angle, shot.facing, shot.power).map(s => shotEnd(w.id, s, options)).filter(e => e.hit && e.hit !== 'water' && e.hit !== 'out');
  let value = 0;
  for (const c of m.capys) {
    if (!alive(c)) continue;
    const o = center(c);
    let paint = 0;
    for (const e of ends) {
      if (w.flight === 'drill') continue;
      const d = e.victim?.id === c.id ? 0 : Math.hypot(o.x - e.x, o.y - e.y);
      // Half as if it landed where aimed, half a typical slip (SLIP) further: a bigger blast forgives
      // more, and so does El Trueno's fan (half the slip); bounces scatter a throw more (BOUNCE_SLIP).
      const f = k => w.paint * falloff(k, reach, { inner: w.inner || 0, min: w.min });
      paint += e.victim?.id === c.id ? w.paint : (f(d) + f(d + slip)) / 2;
    }
    if (!paint) continue;
    const out = c.paint + paint >= 100;
    value += c.team === capy.team ? -(paint * 1.5 + (out ? 2 * FINISH : 0)) : Math.min(paint, 100 - c.paint) + (out ? FINISH : 0);
  }
  return value;
}

// A landing this close counts as a shot the bot can take (La Bazuca's; each
// weapon's scales with its blast).
export const FEASIBLE = 2.5;
const feasibleOf = w => w.direct ? .01 : w.pellets ? 2 : FEASIBLE;
const aimAt = c => ({ x: c.x, y: c.y + RULES.radius * .5, id: c.id });
const nearest = (capy, list) => list.reduce((a, b) => Math.abs(a.x - capy.x) <= Math.abs(b.x - capy.x) ? a : b);
const ownTeam = (m, capy) => m.capys.filter(c => alive(c) && c.team === capy.team).map(c => ({ ...center(c), id: c.id }));

// Which rival to shoot, and with what, from where `capy` stands: every
// weapon its team has shots of gets a quick search at every rival (El Trueno
// only at a close rival or one with a team-mate near it) and a value: the paint the best
// shot lands (shotValue), less what the shot is worth keeping (KEEP), a little
// for distance (a long shot is harder to land), plus `noise` (an easy bot
// chooses less well). The best feasible one, else the nearest rival with
// `feasible: false` and La Piñita.
export function pickTarget(m, capy, { noise = () => 0 } = {}) {
  const rivals = m.capys.filter(c => alive(c) && c.team !== capy.team);
  if (!rivals.length) return null;
  // La Lejana and La Bazuca first: a search that cannot beat what is already found is skipped.
  const avoid = ownTeam(m, capy), weapons = ['sniper', 'bazooka', 'scatter', 'grenade'].filter(id => canUse(m, capy.team, id));
  let best = null;
  for (const id of weapons) {
    const w = weaponOf(id);
    for (const rival of rivals) {
      const far = Math.hypot(rival.x - capy.x, rival.y - capy.y);
      if (id === 'scatter' && far > 22 && (far > 40 || !rivals.some(r => r !== rival && Math.abs(r.x - rival.x) < 8))) continue;
      if (best && best.value >= ceiling(w, rival, rivals) - KEEP[id] + 6) continue;
      const shot = bestShot(m, capy, aimAt(rival), { avoid, weapon: id, fine: false });
      // A scarce shot must land close; La Piñita only has to paint someone.
      if (Number.isFinite(w.ammo) && !(shot.miss < feasibleOf(w))) continue;
      const value = shotValue(m, capy, id, shot) - KEEP[id] - .03 * far + noise();
      if (value > 8 && (!best || value > best.value)) best = { rival, value, miss: shot.miss, weapon: id, shot };
    }
  }
  return best ? { rival: best.rival, feasible: true, miss: best.miss, weapon: best.weapon, value: best.value, shot: best.shot }
    : { rival: nearest(capy, rivals), feasible: false, weapon: BASIC_WEAPON };
}

// The most a shot of `w` at `rival` could be worth: all its paint on it and
// on every rival standing within its reach.
function ceiling(w, rival, rivals) {
  const reach = reachOf(w, RULES.radius) + 1;
  return rivals.filter(r => Math.hypot(r.x - rival.x, r.y - rival.y) < reach || r === rival)
    .reduce((sum, r) => { const paint = w.paint * (w.pellets || 1); return sum + Math.min(paint, 100 - r.paint) + (r.paint + paint >= 100 ? FINISH : 0); }, 0);
}

// No shot at anyone, even after walking: bore towards `rival` with La
// Licuadora when its tunnel would end at the rival (dropping it) or when a
// wall stands close in the way (opening a path), else null.
export function drillPlan(m, capy, rival) {
  if (!canUse(m, capy.team, 'drill')) return null;
  const shot = bestShot(m, capy, aimAt(rival), { avoid: ownTeam(m, capy), weapon: 'drill', fine: false });
  if (!Number.isFinite(shot.miss)) return null;
  const options = flightOptions(m, [], 'drill'), start = launch(capy, 'drill', shot.angle, shot.facing, shot.power)[0], end = shotEnd('drill', start, options);
  if (end.hit !== 'ground') return null;
  const gap = Math.hypot(rival.x - capy.x, rival.y - capy.y), wall = Math.hypot(end.at.x - capy.x, end.at.y - capy.y);
  return shot.miss < 3 || (wall < 15 && shot.miss < gap - 4) ? shot : null;
}

// The shot the bot will take this turn with `weapon` at `target` (a rival's
// id; the nearest rival by default), with its difficulty's error applied.
export function planShot(m, capy, { difficulty = 'normal', random = Math.random, target: id = null, weapon = 'bazooka', seed = null } = {}) {
  const rivals = m.capys.filter(c => alive(c) && c.team !== capy.team);
  if (!rivals.length) return { ...DEFAULT_SHOT, facing: capy.facing, miss: Infinity, weapon };
  const target = rivals.find(c => c.id === id) || nearest(capy, rivals), w = weaponOf(weapon);
  const shot = bestShot(m, capy, aimAt(target), { avoid: ownTeam(m, capy), weapon, seed });
  // Out of reach: no shot lands at all, take the default lob; one that only lands far still goes the right way.
  if (!Number.isFinite(shot.miss)) return { ...DEFAULT_SHOT, facing: target.x >= capy.x ? 1 : -1, miss: shot.miss, target: target.id, weapon };
  if (shot.miss > 25) return { ...shot, target: target.id };
  const err = difficultyInfo(difficulty).aimError, wobble = () => random() + random() - 1;
  return { ...shot, target: target.id,
    angle: clamp(shot.angle + wobble() * err * ANGLE_ERROR, RULES.aimMin, RULES.aimMax),
    power: w.floor > .5 ? 1 : clamp(shot.power + wobble() * err * POWER_ERROR, .1, 1) };
}

// A bot for one team. input(m, dt) is called every tick of its turns.
export function createBot({ team = 1, difficulty = 'normal', seed = 7 } = {}) {
  const random = rng(seed), spread = difficultyInfo(difficulty).aimError * 400, noise = () => (random() - .5) * spread;
  let turn = 0, plan = null;
  return {
    get plan() { return plan; },   // this turn's choice, for tests and match reports
    input(m) {
      const capy = activeCapy(m);
      if (!capy || capy.team !== team || m.phase !== 'aim' || !alive(capy)) return {};
      if (m.turn.n !== turn) {
        turn = m.turn.n;
        // The best rival and weapon from here: no walking needed. With no shot at any, walk towards the nearest.
        const pick = pickTarget(m, capy, { noise }), rival = pick?.rival;
        plan = { rival: rival?.id, weapon: pick?.weapon || BASIC_WEAPON, seed: pick?.shot?.top || null, feasible: !!pick?.feasible, walkUntil: m.clock + m.turn.time * WALK_SHARE,
          dir: rival ? Math.sign(rival.x - capy.x) : 0, walking: !pick?.feasible,
          think: .9 + random() * 1.3, shot: null, startX: capy.x, fireAt: Infinity, last: capy.x, lastAt: m.clock, hopped: false, jumps: capy.jumpPress || 0 };
      }
      const hurry = m.turn.time < 2;
      if (plan.walking) plan.walking = !hurry && keepWalking(m, capy, plan);
      if (plan.walking) {
        // Stuck against a bump: hop once if the landing is dry far enough ahead, then give up walking.
        if (m.clock - plan.lastAt > .8) {
          if (Math.abs(capy.x - plan.last) < .3) { if (plan.hopped || !safeWalk(m, capy, plan.dir, true)) { plan.walking = false; } else { plan.hopped = true; plan.jumps++; } }
          plan.last = capy.x; plan.lastAt = m.clock;
        }
        if (plan.walking) return { x: plan.dir, jump: plan.jumps };
      }
      if (!plan.shot) {
        // After a walk, look again from the new spot (only when the walk moved it).
        if (!plan.feasible && Math.abs(capy.x - plan.startX) > 1) {
          const again = pickTarget(m, capy, { noise });
          if (again?.feasible) Object.assign(plan, { rival: again.rival.id, weapon: again.weapon, seed: again.shot.top, feasible: true });
        }
        // Still nothing: bore a way with La Licuadora, else lob La Piñita (it never runs out).
        if (!plan.feasible && !hurry) {
          const rival = m.capys.find(c => c.id === plan.rival);
          const bore = rival && drillPlan(m, capy, rival);
          Object.assign(plan, bore ? { weapon: 'drill', seed: bore.top } : { weapon: BASIC_WEAPON, seed: null });
        }
        if (!canUse(m, capy.team, plan.weapon)) plan.weapon = BASIC_WEAPON;
        plan.shot = planShot(m, capy, { difficulty, random, target: plan.rival, weapon: plan.weapon, seed: plan.seed }); plan.fireAt = m.clock + plan.think;
      }
      const s = plan.shot, aimed = Math.abs(capy.aim - s.angle) < .02 && capy.facing === s.facing;
      // Swing the barrel at a person's speed, then hold and fire.
      const step = RULES.aimRate / 60, aimTo = capy.aim + clamp(s.angle - capy.aim, -step, step);
      if ((aimed && m.clock >= plan.fireAt) || hurry) return { weapon: plan.weapon, face: s.facing, aimTo: s.angle, fire: s.power, jump: plan.jumps };
      return { weapon: plan.weapon, face: s.facing, aimTo, jump: plan.jumps };
    },
  };
}

// Walk on while the rival is out of range, the turn's walking time lasts, and
// the ground a step ahead (or below a ledge) is dry.
function keepWalking(m, capy, plan) {
  const rival = m.capys.find(c => c.id === plan.rival);
  if (!rival || !alive(rival) || !plan.dir || m.clock >= plan.walkUntil) return false;
  if (Math.abs(rival.x - capy.x) <= (canUse(m, capy.team, 'bazooka') ? RANGE : THROW_RANGE)) return false;
  if (!capy.grounded) return true;
  // Look ahead with the real walker (a ledge, a steep bank, a painted slope can carry it on), a few times a second.
  if (!plan.checkAt || m.clock >= plan.checkAt) { plan.safe = safeWalk(m, capy, plan.dir, false); plan.checkAt = m.clock + .2; }
  return plan.safe;
}
// Would walking (or hopping) `dir` for the next two seconds keep the capi out of the river?
function safeWalk(m, capy, dir, hop) {
  const ghost = { x: capy.x, y: capy.y, vx: capy.vx, vy: capy.vy, grounded: capy.grounded, facing: capy.facing, jumpPress: capy.jumpPress || 0, slide: capy.slide || 0 };
  const options = { radius: RULES.radius, water: m.map.water };
  for (let i = 0; i < 120; i++) {
    const r = stepSideWalker(ghost, { x: dir, jump: (capy.jumpPress || 0) + (hop ? 1 : 0) }, 1 / 60, m.mask, options);
    if (r.drowned || ghost.y < m.map.water + 1) return false;
  }
  // And it ends on the ground, not still falling towards the water.
  return ghost.grounded || ghost.y > m.map.water + 4;
}

