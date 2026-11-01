// The machine's capis. Pure: it reads the match and returns the same input a
// player's keys make, so it can never do what a player cannot. On its turn it
// picks the nearest rival, walks closer while that rival is out of range (never
// into the river or off a drop, and not forever), searches angle and power with
// the real flight (wind included), misses by an amount set by the difficulty,
// waits like a person would and fires before the clock runs out.
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
export function bestShot(m, capy, target, { avoid = [] } = {}) {
  const facing = target.x >= capy.x ? 1 : -1, options = flightOptions(m, []);
  let best = { ...DEFAULT_SHOT, facing, miss: Infinity };
  for (let angle = -.2; angle <= 1.4; angle += .05) for (let power = .2; power <= 1.0001; power += .025) {
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

// The shot the bot will take this turn, with its difficulty's error applied.
export function planShot(m, capy, { difficulty = 'normal', random = Math.random } = {}) {
  const rivals = m.capys.filter(c => alive(c) && c.team !== capy.team);
  if (!rivals.length) return { ...DEFAULT_SHOT, facing: capy.facing, miss: Infinity };
  const target = rivals.reduce((a, b) => Math.abs(a.x - capy.x) <= Math.abs(b.x - capy.x) ? a : b);
  const avoid = m.capys.filter(c => alive(c) && c.team === capy.team).map(center);
  const shot = bestShot(m, capy, { x: target.x, y: target.y + RULES.radius * .5 }, { avoid });
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
        const rival = m.capys.filter(c => alive(c) && c.team !== team).sort((a, b) => Math.abs(a.x - capy.x) - Math.abs(b.x - capy.x))[0];
        plan = { rival: rival?.id, walkUntil: m.clock + m.turn.time * WALK_SHARE, dir: rival ? Math.sign(rival.x - capy.x) : 0, walking: true,
          think: .9 + random() * 1.3, shot: null, fireAt: Infinity, last: capy.x, lastAt: m.clock, hopped: false, jumps: capy.jumpPress || 0 };
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
      if (!plan.shot) { plan.shot = planShot(m, capy, { difficulty, random }); plan.fireAt = m.clock + plan.think; }
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
