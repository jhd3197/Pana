// Trifulca's bots: the same buttons a pana has (a stick, held golpe and
// cubrirse, press counters), decided every few tenths of a second with the
// game's seeded randomness so a restored host plays on identically. Pure.
import { draw, clamp } from '/engine/random.js';
import { edge, inRing, canAct, BODY_GAP } from './fight-rules.js';
import { INTRO, AFTER, TUTORIAL } from './rules.js';

const CHAIN_SKILL = [.1, .25, .4];
const AFTER_MANO = { min: .8, spread: 2 };
const bump = (ai, key) => (ai[key] = ((ai[key] || 0) + 1) % 256);

export function botInput(game, p, dt) {
  const ai = p.ai ||= { think: 0, hold: 0, block: 0, plan: 0, side: 1, mash: 0, gp: 0, e: 0, a: 0, t: 0,
    betAt: 1 + draw(game) * 3, manoAt: AFTER_MANO.min + draw(game) * AFTER_MANO.spread };
  const out = { x: 0, z: 0, g: false, b: false, gp: ai.gp, e: ai.e, a: ai.a, t: ai.t, k: ai.k || 0, s: ai.s || 0, v: ai.v || 0 };
  const level = p.level ?? game.options.nivel, body = game.body(p.id);
  if (game.tutorial && body) return profe(game, body, ai, out, dt);
  if (game.phase === 'after') {
    if (body && AFTER - game.time > ai.manoAt && !p.mano && draw(game) < .9) out.a = bump(ai, 'a');
    return out;
  }
  if (!body || game.phase === 'intro') return botCrowd(game, p, ai, out);
  if (!inRing(body)) return out;
  const other = game.body(body.foe);
  if (!other) return out;
  if (body.act === 'down') {
    ai.mash -= dt;
    if (ai.mash <= 0) { out.gp = bump(ai, 'gp'); ai.mash = 1 / (4.5 + 2 * level) * (.7 + draw(game) * .6); }
    return out;
  }
  const dx = other.x - body.x, dz = other.z - body.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d;
  const rx = fz, rz = -fx;
  // Ranges count from where bodies stop, not from the rival's centre.
  const room = d - BODY_GAP;
  ai.think -= dt; ai.hold -= dt; ai.block -= dt;
  // Parejas: hurt and near the partner, tag out.
  const partner = game.bodies.find(o => o.team === body.team && o.bench);
  const wantsTag = partner && body.mareo > 60;
  // Trifulca libre: grab something to swing or throw.
  const prop = game.mode === 'libre' && !body.prop ? game.props.filter(o => !o.held && !o.fly).map(o => ({ o, d: Math.hypot(o.x - body.x, o.z - body.z) })).sort((a, b) => a.d - b.d)[0] : null;
  if (ai.think <= 0) {
    ai.think = [.5, .32, .2][level] * (.6 + draw(game) * .8) * (wantsTag ? .5 : 1);
    const roll = draw(game);
    ai.plan = 0;
    if (wantsTag && Math.hypot(partner.x - body.x, partner.z - body.z) < 2.1) ai.plan = 'grab';
    else if (body.prop && room > .8 && d < 4.5 && roll < .18 + .06 * level) ai.plan = 'grab';
    else if (prop && prop.d < 1.1 && room > .4 && roll < .3) ai.plan = 'grab';
    else if (other.act === 'wind' && room < 1.3) {
      if (room < .5 && roll < .35 + .2 * level) ai.plan = 'jab';
      else if (roll < .75) ai.plan = 'dodge';
      else ai.plan = 'block';
    } else if (other.act === 'jab' && other.at < .1 && roll < .25 + .2 * level) ai.plan = 'block';
    else if (other.act === 'block' && room < .4 && roll < .5) ai.plan = 'grab';
    else if (['open', 'stun', 'dizzy'].includes(other.act) && room < .8) ai.plan = other.act === 'stun' && roll < .6 ? 'jab' : 'trompon';
    else if (room < .5) {
      ai.plan = roll < .5 ? 'jab' : roll < .66 ? 'trompon' : roll < .74 ? 'grab' : roll < .86 ? 'block' : roll < .93 ? 'dodge' : roll < .96 ? 'taunt' : 0;
    }
    if (!body.prop && body.aguante > 35 && ['jab', 'grab'].includes(ai.plan) && roll > .22) {
      if (room < .1 && other.act === 'block') ai.plan = 'toss';
      else if (roll < .36) ai.plan = 'kick';
      else if (roll < .43) ai.plan = 'sweep';
    }
    if (draw(game) < .25) ai.side = -ai.side;
    if (body.mareo > 75 && draw(game) < .6 && ai.plan !== 'grab') ai.plan = ai.plan === 'jab' ? 'jab' : 0;
    // A pana's tap waits for the hands to be free; a bot just decides again then,
    // or every plan it had while busy would pile up into kicks.
    if (!canAct(body) && body.act !== 'block' && !['jab', 'trompon'].includes(ai.plan)) ai.plan = 0;
    // Chaining is a skill: a bot's next hit counts as timed only so often.
    if (body.chainLeft > 0 && draw(game) > CHAIN_SKILL[level]) body.mashed = true;
    if (ai.plan === 'kick') out.k = bump(ai, 'k');
    if (ai.plan === 'sweep') out.s = bump(ai, 's');
    if (ai.plan === 'toss') out.v = bump(ai, 'v');
    if (ai.plan === 'jab') out.gp = bump(ai, 'gp');
    if (ai.plan === 'trompon') { out.gp = bump(ai, 'gp'); ai.hold = .3; }
    if (ai.plan === 'dodge') out.e = bump(ai, 'e');
    if (ai.plan === 'grab') out.a = bump(ai, 'a');
    if (ai.plan === 'taunt') out.t = bump(ai, 't');
    if (ai.plan === 'block') ai.block = .45 + draw(game) * .3;
  }
  out.g = ai.hold > 0; out.b = ai.block > 0;
  // Close in, keep a jab's distance, circle; back off when dizzy or hurt.
  let f = room > .3 ? 1 : room < 0 ? -.6 : 0;
  if (body.act === 'dizzy' || body.mareo > 80) f = -1;
  if (body.prop && room < 1.2) f = -.8;
  out.x = fx * f + rx * ai.side * .45; out.z = fz * f + rz * ai.side * .45;
  if (wantsTag) { const tx = partner.x - body.x, tz = partner.z - body.z, n = Math.hypot(tx, tz) || 1; out.x = tx / n; out.z = tz / n; }
  else if (prop && prop.d < 3 && !body.prop && room > .6) { const tx = prop.o.x - body.x, tz = prop.o.z - body.z, n = Math.hypot(tx, tz) || 1; out.x = tx / n; out.z = tz / n; }
  const e = edge(game.arena, body.x, body.z);
  if (e.out > -.9 && !wantsTag) { out.x += e.nx * 1.2; out.z += e.nz * 1.2; }
  if (ai.plan === 'dodge') { out.x += rx * ai.side; out.z += rz * ai.side; }
  return out;
}

// The tutorial's profe: does exactly what the current step needs.
function profe(game, body, ai, out, dt) {
  const step = TUTORIAL[game.tutorial.step]?.id, me = game.body(game.tutorial.me);
  ai.think -= dt; ai.hold -= dt;
  if (!me || game.tutorial.done) return out;
  const d = Math.hypot(me.x - body.x, me.z - body.z);
  if (body.act === 'down') { out.gp = bump(ai, 'gp'); return out; }
  if (step === 'cubrir' && ai.think <= 0 && d < BODY_GAP + .6) { ai.think = 1.3; out.gp = bump(ai, 'gp'); }
  if ((step === 'esquivar' || step === 'contra') && ai.think <= 0 && d < BODY_GAP + .8) { ai.think = 2.4; out.gp = bump(ai, 'gp'); ai.hold = .4; }
  out.g = ai.hold > 0;
  out.b = step === 'agarrar';
  // Stay close and in the middle of the ring.
  if (d > BODY_GAP + .3 && step !== 'mover') { out.x = (me.x - body.x) / d * .7; out.z = (me.z - body.z) / d * .7; }
  return out;
}

// A bot in the crowd: bet and walk around the ring toward the action. Shoving is
// a pana's move: a bot in the crowd never touches a fighter.
function botCrowd(game, p, ai, out) {
  if (game.phase === 'intro') {
    if (!game.fighting(p.id)) {
      if (!p.bet && INTRO - game.time > ai.betAt) {
        const corners = game.corners(), champ = game.body(game.fight.champion)?.team;
        game.bet(p.id, champ && draw(game) < .6 ? champ : corners[Math.floor(draw(game) * corners.length)]);
      }
      if (!p.water && INTRO - game.time > ai.betAt + 1 && draw(game) < .02) out.gp = bump(ai, 'gp');
    }
    return out;
  }
  const arena = game.arena;
  const near = game.bodies.filter(inRing).map(b => ({ b, e: edge(arena, b.x, b.z) })).sort((x, y) => y.e.out - x.e.out)[0];
  if (!near || near.e.out < -1.2) return out;
  const target = Math.atan2(near.b.x, near.b.z);
  let diff = target - p.angle; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const tx = Math.cos(p.angle), tz = -Math.sin(p.angle), s = clamp(diff * 3, -1, 1);
  out.x = tx * s; out.z = tz * s;
  return out;
}
