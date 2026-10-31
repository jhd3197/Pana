// The machine's capis. Pure: it reads the match and returns the same input a
// player's keys make, so it can never do what a player cannot. On its turn it
// picks the nearest rival, walks a little closer when far, searches angle and
// power with the real flight (wind included), misses by an amount set by the
// difficulty, waits like a person would and fires before the clock runs out.
import { simulateFlight, aimVelocity } from '../../../engine/play/ballistic.js';
import { difficultyInfo } from '../../../engine/play/difficulty.js';
import { rng, clamp } from '../../../engine/random.js';
import { RULES, activeCapy, alive, center, muzzle, flightOptions } from './rules.js';

// The shared difficulty's aimError (radians, tuned for a cue) scaled to a lob.
const ANGLE_ERROR = 3, POWER_ERROR = 1.6;
const DEFAULT_SHOT = { angle: .8, power: .7 };

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
  if (shot.miss > 25) return { ...DEFAULT_SHOT, facing: target.x >= capy.x ? 1 : -1, miss: shot.miss, target: target.id };
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
        const far = rival && Math.abs(rival.x - capy.x) > 34;
        plan = { walkUntil: m.clock + (far ? .8 + random() * 1.2 : 0), dir: rival ? Math.sign(rival.x - capy.x) : 0,
          think: .9 + random() * 1.3, shot: null, fireAt: Infinity };
      }
      const hurry = m.turn.time < 2;
      if (m.clock < plan.walkUntil && !hurry) return { x: plan.dir };
      if (!plan.shot) { plan.shot = planShot(m, capy, { difficulty, random }); plan.fireAt = m.clock + plan.think; }
      const s = plan.shot, aimed = Math.abs(capy.aim - s.angle) < .02 && capy.facing === s.facing;
      // Swing the barrel at a person's speed, then hold and fire.
      const step = RULES.aimRate / 60, aimTo = capy.aim + clamp(s.angle - capy.aim, -step, step);
      if ((aimed && m.clock >= plan.fireAt) || hurry) return { face: s.facing, aimTo: s.angle, fire: s.power };
      return { face: s.facing, aimTo };
    },
  };
}
