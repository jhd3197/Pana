// The machine's capis. Pure: it reads the match and returns the same input a
// player's keys make, so it can never do what a player cannot. On its turn it
// picks the rival it has the easiest shot at (a quick search with the real
// flight, wind included: how close it lands, how far, how much paint the
// rival already carries), or the nearest one when it has no shot at any; it
// walks closer while that one is out of range (never into the water or off a
// drop, and not forever), searches angle and power finely, misses by an amount
// set by the difficulty, waits like a person would and fires before the clock
// runs out.
import { simulateFlight, aimVelocity } from '../../../engine/play/ballistic.js';
import { difficultyInfo } from '../../../engine/play/difficulty.js';
import { rng, clamp } from '../../../engine/random.js';
import { stepSideWalker } from '../../../engine/play/side-walker.js';
import { RULES, activeCapy, alive, center, muzzle, flightOptions } from './rules.js';

// The shared difficulty's aimError (radians, tuned for a cue) scaled to a lob.
const ANGLE_ERROR = 3, POWER_ERROR = 1.6;
const DEFAULT_SHOT = { angle: .8, power: .7 };
// A rival farther than this is out of comfortable range: walk closer first,
// for at most WALK_SHARE of the turn.
export const RANGE = 34;
const WALK_SHARE = .45;

// The best shot from `capy` at `target` (a point), searching the whole arc.
// Returns { angle, power, facing, miss } where miss is how far it lands.
export function bestShot(m, capy, target, { avoid = [], angles = .05, powers = .025 } = {}) {
  const facing = target.x >= capy.x ? 1 : -1, options = flightOptions(m, []);
  let best = { ...DEFAULT_SHOT, facing, miss: Infinity };
  for (let angle = -.2; angle <= 1.4; angle += angles) for (let power = .2; power <= 1.0001; power += powers) {
    const start = { ...muzzle(capy, angle, facing), ...aimVelocity(angle, facing, power * RULES.speed) };
    const end = simulateFlight(start, options, { dt: 1 / 60, maxTime: 7, every: 1e9 });
    if (!end.hit) continue;
    let miss = Math.hypot(end.x - target.x, end.y - target.y);
    if (end.hit === 'water' || end.hit === 'out') miss += 50;
    for (const a of avoid) if (Math.hypot(end.x - a.x, end.y - a.y) < RULES.blast + 1) miss += 30;
    if (miss < best.miss) best = { angle, power, facing, miss };
  }
  return best;
}

// A landing this close counts as a shot the bot can take.
export const FEASIBLE = 2.5;
const aimAt = c => ({ x: c.x, y: c.y + RULES.radius * .5 });
const nearest = (capy, list) => list.reduce((a, b) => Math.abs(a.x - capy.x) <= Math.abs(b.x - capy.x) ? a : b);

// Which rival to shoot at from where `capy` stands: every rival gets a quick
// search (a coarse grid, about 290 flights) and a score: how far the best
// landing misses, a little for distance (a long lob is harder to land), less
// for a rival already half painted (a hit may finish it). The best with a
// feasible shot, else the nearest rival with `feasible: false`.
export function pickTarget(m, capy) {
  const rivals = m.capys.filter(c => alive(c) && c.team !== capy.team);
  if (!rivals.length) return null;
  const avoid = m.capys.filter(c => alive(c) && c.team === capy.team).map(center);
  let best = null;
  for (const rival of rivals) {
    const shot = bestShot(m, capy, aimAt(rival), { avoid, angles: .1, powers: .05 });
    if (!(shot.miss < FEASIBLE)) continue;
    const score = shot.miss + .03 * Math.hypot(rival.x - capy.x, rival.y - capy.y) - (rival.paint >= 50 ? 1 : 0);
    if (!best || score < best.score) best = { rival, score, miss: shot.miss };
  }
  return best ? { rival: best.rival, feasible: true, miss: best.miss } : { rival: nearest(capy, rivals), feasible: false };
}

// The shot the bot will take this turn at `target` (a rival's id; the nearest
// rival by default), with its difficulty's error applied.
export function planShot(m, capy, { difficulty = 'normal', random = Math.random, target: id = null } = {}) {
  const rivals = m.capys.filter(c => alive(c) && c.team !== capy.team);
  if (!rivals.length) return { ...DEFAULT_SHOT, facing: capy.facing, miss: Infinity };
  const target = rivals.find(c => c.id === id) || nearest(capy, rivals);
  const avoid = m.capys.filter(c => alive(c) && c.team === capy.team).map(center);
  const shot = bestShot(m, capy, aimAt(target), { avoid });
  // Out of reach: no shot lands at all, take the default lob; one that only lands far still goes the right way.
  if (!Number.isFinite(shot.miss)) return { ...DEFAULT_SHOT, facing: target.x >= capy.x ? 1 : -1, miss: shot.miss, target: target.id };
  if (shot.miss > 25) return { ...shot, target: target.id };
  const err = difficultyInfo(difficulty).aimError, wobble = () => random() + random() - 1;
  return { ...shot, target: target.id,
    angle: clamp(shot.angle + wobble() * err * ANGLE_ERROR, RULES.aimMin, RULES.aimMax),
    power: clamp(shot.power + wobble() * err * POWER_ERROR, .1, 1) };
}

// A bot for one team. input(m, dt) is called every tick of its turns.
export function createBot({ team = 1, difficulty = 'normal', seed = 7 } = {}) {
  const random = rng(seed);
  let turn = 0, plan = null;
  return {
    input(m) {
      const capy = activeCapy(m);
      if (!capy || capy.team !== team || m.phase !== 'aim' || !alive(capy)) return {};
      if (m.turn.n !== turn) {
        turn = m.turn.n;
        // The easiest rival to hit from here: no walking needed. With no shot at any, walk towards the nearest.
        const pick = pickTarget(m, capy), rival = pick?.rival;
        plan = { rival: rival?.id, walkUntil: m.clock + m.turn.time * WALK_SHARE, dir: rival ? Math.sign(rival.x - capy.x) : 0, walking: !pick?.feasible,
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
        if (Math.abs(capy.x - plan.startX) > 1) { const again = pickTarget(m, capy); if (again?.feasible) plan.rival = again.rival.id; }
        plan.shot = planShot(m, capy, { difficulty, random, target: plan.rival }); plan.fireAt = m.clock + plan.think;
      }
      const s = plan.shot, aimed = Math.abs(capy.aim - s.angle) < .02 && capy.facing === s.facing;
      // Swing the barrel at a person's speed, then hold and fire.
      const step = RULES.aimRate / 60, aimTo = capy.aim + clamp(s.angle - capy.aim, -step, step);
      if ((aimed && m.clock >= plan.fireAt) || hurry) return { face: s.facing, aimTo: s.angle, fire: s.power, jump: plan.jumps };
      return { face: s.facing, aimTo, jump: plan.jumps };
    },
  };
}

// Walk on while the rival is out of range, the turn's walking time lasts, and
// the ground a step ahead (or below a ledge) is dry.
function keepWalking(m, capy, plan) {
  const rival = m.capys.find(c => c.id === plan.rival);
  if (!rival || !alive(rival) || !plan.dir || m.clock >= plan.walkUntil) return false;
  if (Math.abs(rival.x - capy.x) <= RANGE) return false;
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
