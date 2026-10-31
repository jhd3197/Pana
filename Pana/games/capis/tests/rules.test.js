import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents, fire, explode, activeCapy, teamAlive, center, standings, RULES } from '../public/rules.js';
import { buildMap, llanosHeight, LLANOS, SPAWNS } from '../public/map-rules.js';
import { planShot, bestShot, createBot } from '../public/bot.js';
import { fillHeights, surfaceY } from '../../../engine/play/terrain-mask.js';
import { simulateFlight, aimVelocity } from '../../../engine/play/ballistic.js';
import { muzzle, flightOptions } from '../public/rules.js';

const DT = 1 / 60;
const run = (m, seconds, input = () => ({})) => { for (let t = 0; t < seconds && m.phase !== 'finished'; t += DT) tickMatch(m, DT, input(m)); };
const solidCount = m => m.mask.solid.reduce((a, b) => a + b, 0);
// A flat field with no wind, capis placed by hand.
function flatMatch(xs = [[10, 14, 18], [50, 56, 62]]) {
  const m = createMatch({ seed: 5 });
  fillHeights(m.mask, () => 10);
  m.capys.forEach(c => { c.x = xs[c.team][c.slot]; c.y = 10; c.grounded = true; c.vx = c.vy = 0; });
  m.wind = 0; takeEvents(m);
  return m;
}

test('the Llanos riverbank is the same on every load, with water at both ends', () => {
  const a = buildMap(), b = buildMap();
  assert.deepEqual(a.solid, b.solid);
  assert.ok(llanosHeight(1) < LLANOS.water && llanosHeight(LLANOS.width - 1) < LLANOS.water, 'the river at both banks');
  for (const x of SPAWNS.flat()) assert.ok(surfaceY(a, x) > LLANOS.water + 3, `spawn ${x} on dry land`);
});

test('a match starts with two teams of three capis standing on the ground, team 0 first', () => {
  const m = createMatch({ seconds: 30 });
  assert.equal(m.capys.length, 6);
  for (const c of m.capys) assert.ok(c.grounded && !c.out && c.paint === 0, `${c.name} grounded`);
  assert.equal(m.turn.team, 0); assert.equal(activeCapy(m).id, '0-0'); assert.equal(m.turn.time, 30);
  assert.ok(m.wind >= -1 && m.wind <= 1);
  assert.equal(createMatch({ seconds: 99 }).options.seconds, 35, 'unknown turn times fall back to 35 s');
});

test('turns alternate teams and rotate through each team\'s capis, skipping the ones out', () => {
  const m = createMatch(), order = [];
  m.capys.find(c => c.id === '1-1').out = 'paint';
  for (let i = 0; i < 6; i++) {
    order.push(activeCapy(m).id);
    m.turn.time = .01; run(m, RULES.settleMax + 1);
  }
  assert.deepEqual(order, ['0-0', '1-0', '0-1', '1-2', '0-2', '1-0']);
});

test('the clock ends a turn without a shot, and a shot after it is refused', () => {
  const m = createMatch({ seconds: 30 });
  run(m, 29.9);
  assert.equal(m.phase, 'aim'); assert.ok(m.turn.time > 0);
  m.turn.time = DT / 2; tickMatch(m, DT, {});
  assert.equal(m.phase, 'settle');
  assert.equal(fire(m, 1), false); assert.equal(m.shots, 0);
  assert.ok(takeEvents(m).some(e => e.type === 'timeout'));
  tickMatch(m, DT, {});
  assert.equal(m.turn.team, 1, 'the rivals play next');
});

test('a bazooka shot flies with the wind, carves a crater, paints the ground and the capis near it', () => {
  const m = flatMatch(), shooter = activeCapy(m), target = m.capys.find(c => c.id === '1-0');
  const shot = bestShot(m, shooter, { x: target.x, y: target.y + .3 });
  assert.ok(shot.miss < 1, `found a shot that lands ${shot.miss} away`);
  const before = solidCount(m);
  run(m, .05, () => ({ face: shot.facing, aimTo: shot.angle }));
  run(m, DT, () => ({ fire: shot.power }));
  assert.equal(m.phase, 'flight');
  run(m, 8);
  const events = takeEvents(m);
  assert.ok(events.some(e => e.type === 'fire') && events.some(e => e.type === 'blast'));
  assert.ok(solidCount(m) < before - 500, 'a crater was dug');
  assert.ok(target.paint >= RULES.paint * .7, `the target took ${target.paint} paint`);
  assert.ok(m.mask.stain.some(v => v > 0), 'the ground is painted');
  assert.ok(m.turn.team === 1 || m.phase === 'retreat' || m.phase === 'settle');
});

test('paint falls off with distance, 100 paint is out, and the blast pushes away', () => {
  const m = flatMatch(), near = m.capys.find(c => c.id === '1-0'), far = m.capys.find(c => c.id === '1-1');
  const o = center(near);
  explode(m, o.x - 1, o.y, 0);
  assert.ok(near.paint > 30 && far.paint === 0);
  assert.ok(near.vx > 0 && near.vy > 0, 'thrown up and away from the blast');
  near.paint = 90; explode(m, near.x, near.y + .7, 0);
  assert.equal(near.out, 'paint');
  assert.ok(takeEvents(m).some(e => e.type === 'out' && e.reason === 'paint'));
});

test('a capi knocked into the river is out, and the last team standing wins', () => {
  const m = flatMatch();
  fillHeights(m.mask, x => x < 66 ? 10 : 0);
  for (const c of teamAlive(m, 1)) { c.x = 64; c.grounded = false; c.vx = 12; c.vy = 6; }
  m.turn.time = .01;
  run(m, 10);
  assert.ok(m.capys.filter(c => c.team === 1).every(c => c.out === 'water'));
  assert.equal(m.phase, 'finished'); assert.equal(m.winner, 0);
  assert.equal(standings(m)[0].team, 0);
});

test('the bot lands next to a still target on flat ground and always returns a shot', () => {
  const m = flatMatch([[10, 14, 18], [40, 56, 62]]), capy = m.capys.find(c => c.id === '0-2'), target = m.capys.find(c => c.id === '1-0');
  let random = 0; const fixed = () => (random = (random * 9301 + 49297) % 233280) / 233280;
  const shot = planShot(m, capy, { difficulty: 'experto', random: fixed });
  const end = simulateFlight({ ...muzzle(capy, shot.angle, shot.facing), ...aimVelocity(shot.angle, shot.facing, shot.power * RULES.speed) }, flightOptions(m, []));
  assert.ok(Math.abs(end.x - target.x) < RULES.blast, `landed ${end.x - target.x} from the target`);
  m.wind = 1;
  const windy = planShot(m, capy, { difficulty: 'experto', random: fixed });
  assert.ok(Math.abs(windy.power - shot.power) > .01 || Math.abs(windy.angle - shot.angle) > .01, 'the wind changes the shot');
  // Walled in: no shot reaches, the default one still comes back.
  fillHeights(m.mask, x => Math.abs(x - capy.x) < 2 ? 10 : 39);
  const stuck = planShot(m, capy, { difficulty: 'facil' });
  for (const k of ['angle', 'power', 'facing']) assert.ok(Number.isFinite(stuck[k]), k);
});

test('a bot fires on its own turn, before the clock, and two bots finish a match', () => {
  const m = createMatch({ seconds: 30, seed: 11 }), bots = [createBot({ team: 0, difficulty: 'experto', seed: 1 }), createBot({ team: 1, difficulty: 'experto', seed: 2 })];
  const fired = [];
  for (let t = 0; t < 600 && m.phase !== 'finished'; t += DT) {
    const team = m.turn.team, input = bots[team].input(m);
    if (Number.isFinite(input.fire)) fired.push({ team, left: m.turn.time });
    tickMatch(m, DT, input);
  }
  assert.ok(fired.length >= 4, `${fired.length} shots`);
  assert.ok(fired.every(f => f.left > 0), 'every shot left before time ran out');
  assert.equal(m.phase, 'finished', `still ${m.phase} after ${m.turn.n} turns`);
});
