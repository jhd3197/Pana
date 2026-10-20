// Trifulca's bots: the same buttons a pana has (a stick, held golpe and
// cubrirse, press counters), decided every few tenths of a second with the
// game's seeded randomness so a restored host plays on identically. Pure.
import { draw, clamp } from '/engine/random.js';
import { edge, crowdSpot, inRing } from './fight-rules.js';
import { INTRO, AFTER } from './rules.js';

const AFTER_MANO = { min: .8, spread: 2 };
const bump = (ai, key) => (ai[key] = (ai[key] + 1) % 256);

export function botInput(game, p, dt) {
  const ai = p.ai ||= { think: 0, hold: 0, block: 0, plan: 0, side: 1, mash: 0, gp: 0, e: 0, a: 0, t: 0,
    betAt: 1 + draw(game) * 3, manoAt: AFTER_MANO.min + draw(game) * AFTER_MANO.spread };
  const out = { x: 0, z: 0, g: false, b: false, gp: ai.gp, e: ai.e, a: ai.a, t: ai.t };
  const level = game.options.nivel, body = game.body(p.id);
  if (game.phase === 'after') {
    if (body && AFTER - game.time > ai.manoAt && !p.mano && draw(game) < .9) out.a = bump(ai, 'a');
    return out;
  }
  if (!body || game.phase === 'intro') return botCrowd(game, p, ai, out, dt);
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
    else if (body.prop && d > 1.8 && d < 4.5 && roll < .18 + .06 * level) ai.plan = 'grab';
    else if (prop && prop.d < 1.1 && d > 1.4 && roll < .3) ai.plan = 'grab';
    else if (other.act === 'wind' && d < 2.3) {
      if (d < 1.5 && roll < .35 + .2 * level) ai.plan = 'jab';
      else if (roll < .75) ai.plan = 'dodge';
      else ai.plan = 'block';
    } else if (other.act === 'jab' && other.at < .1 && roll < .25 + .2 * level) ai.plan = 'block';
    else if (other.act === 'block' && d < 1.4 && roll < .5) ai.plan = 'grab';
    else if (['open', 'stun', 'dizzy'].includes(other.act) && d < 1.8) ai.plan = other.act === 'stun' && roll < .6 ? 'jab' : 'trompon';
    else if (d < 1.5) {
      ai.plan = roll < .5 ? 'jab' : roll < .66 ? 'trompon' : roll < .74 ? 'grab' : roll < .86 ? 'block' : roll < .93 ? 'dodge' : roll < .96 ? 'taunt' : 0;
    }
    if (draw(game) < .25) ai.side = -ai.side;
    if (body.mareo > 75 && draw(game) < .6 && ai.plan !== 'grab') ai.plan = ai.plan === 'jab' ? 'jab' : 0;
    if (ai.plan === 'jab') out.gp = bump(ai, 'gp');
    if (ai.plan === 'trompon') { out.gp = bump(ai, 'gp'); ai.hold = .3; }
    if (ai.plan === 'dodge') out.e = bump(ai, 'e');
    if (ai.plan === 'grab') out.a = bump(ai, 'a');
    if (ai.plan === 'taunt') out.t = bump(ai, 't');
    if (ai.plan === 'block') ai.block = .45 + draw(game) * .3;
  }
  out.g = ai.hold > 0; out.b = ai.block > 0;
  // Close in, keep a jab's distance, circle; back off when dizzy or hurt.
  let f = d > 1.3 ? 1 : d < 1 ? -.6 : 0;
  if (body.act === 'dizzy' || body.mareo > 80) f = -1;
  if (body.prop && d < 2.2) f = -.8;
  out.x = fx * f + rx * ai.side * .45; out.z = fz * f + rz * ai.side * .45;
  if (wantsTag) { const tx = partner.x - body.x, tz = partner.z - body.z, n = Math.hypot(tx, tz) || 1; out.x = tx / n; out.z = tz / n; }
  else if (prop && prop.d < 3 && !body.prop && d > 1.6) { const tx = prop.o.x - body.x, tz = prop.o.z - body.z, n = Math.hypot(tx, tz) || 1; out.x = tx / n; out.z = tz / n; }
  const e = edge(game.arena, body.x, body.z);
  if (e.out > -.9 && !wantsTag) { out.x += e.nx * 1.2; out.z += e.nz * 1.2; }
  if (ai.plan === 'dodge') { out.x += rx * ai.side; out.z += rz * ai.side; }
  return out;
}

// A bot in the crowd: bet, walk toward trouble at the edge, shove it back in.
function botCrowd(game, p, ai, out, dt) {
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
  const arena = game.arena, spot = crowdSpot(arena, p.angle);
  const near = game.bodies.filter(inRing).map(b => ({ b, e: edge(arena, b.x, b.z) })).sort((x, y) => y.e.out - x.e.out)[0];
  if (!near || near.e.out < -1.2) return out;
  const target = Math.atan2(near.b.x, near.b.z);
  let diff = target - p.angle; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const tx = Math.cos(p.angle), tz = -Math.sin(p.angle), s = clamp(diff * 3, -1, 1);
  out.x = tx * s; out.z = tz * s;
  if (Math.hypot(near.b.x - spot.x, near.b.z - spot.z) < 1.8 && near.e.out > -.4 && p.cd <= 0 && draw(game) < dt * 4) out.gp = bump(ai, 'gp');
  return out;
}
