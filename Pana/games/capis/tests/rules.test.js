import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents, fire, explode, activeCapy, teamAlive, center, standings, RULES } from '../public/rules.js';
import { generateMap, rockAt, grassAt, MAP_SIZES } from '../public/map-rules.js';
import { planShot, bestShot, createBot } from '../public/bot.js';
import { fillHeights, surfaceY, solidAt, groundBelow } from '../../../engine/play/terrain-mask.js';
import { simulateFlight, aimVelocity } from '../../../engine/play/ballistic.js';
import { muzzle, shoulder, flightOptions } from '../public/rules.js';
import { aiming, bodyPose, barrelPose, CARRY_PITCH, CARRY_DROP } from '../public/poses.js';

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

// The first seeds whose map has `kind` (and passes `keep`), medium size.
function seedWith(test, from = 1) { for (let seed = from; seed < from + 200; seed++) { const g = generateMap(seed); if (test(g.map)) return { seed, ...g }; } throw new Error('no seed'); }
const ground = (mask, x) => groundBelow(mask, x, mask.height);

test('a seed builds the same riverbank on every load, with water at both ends and between the banks', () => {
  const a = generateMap(4242), b = generateMap(4242);
  assert.deepEqual(a.mask.solid, b.mask.solid); assert.deepEqual(a.map.spawns, b.map.spawns);
  const { map, mask } = a;
  assert.equal(mask.width, MAP_SIZES.medium.width);
  assert.ok(ground(mask, 1) < map.water && ground(mask, map.width - 1) < map.water, 'the river at both ends');
  let channel = false; for (let x = map.spawns[0][0]; x < map.spawns[1][0]; x += .25) channel ||= ground(mask, x) < map.water;
  assert.ok(channel, 'water between the two banks');
  for (const x of map.spawns.flat()) assert.ok(surfaceY(mask, x) > map.water + 2.5, `spawn ${x.toFixed(1)} on dry land`);
});

test('El Tepuyito: a tower on a mound with an overhanging cap and a cave each side, parted by a wall', () => {
  const { map, mask } = seedWith(m => m.kind === 'tepuy' && m.plan.center.caves), c = map.plan.center, mid = map.width / 2;
  // It stands well above both banks' front capis and on the mound (no floating rock).
  assert.ok(surfaceY(mask, mid) > c.tower.top - 1.2 && surfaceY(mask, mid) > Math.max(surfaceY(mask, map.spawns[0][0]), surfaceY(mask, map.spawns[1][0])) + 6);
  for (const side of [-1, 1]) {
    const x = mid + side * (c.tower.half + 1.5);
    assert.ok(solidAt(mask, x, c.tower.top - .3) && !solidAt(mask, x, c.tower.top - 2), 'the cap juts out over air');
    // The cave: air with a roof over it, marked hollow for the back wall.
    const cx = mid + side * (c.tower.half + 1), floor = heightOfCave(mask, cx);
    assert.ok(floor !== null && solidAt(mask, cx, floor + 2.8), `a cave with a roof at ${cx.toFixed(1)}`);
    assert.equal(mask.hollow[Math.floor((floor + .6) / mask.cell) * mask.cols + Math.floor(cx / mask.cell)], 1, 'the cave is a hollow');
  }
  for (let y = c.foot; y < c.tower.top - 1; y += .1) assert.ok(solidAt(mask, mid, y), 'the wall between the caves');
  assert.ok(rockAt(map, mid, c.tower.top - 3) > .5, 'the tower is rock');
});
// The first air above solid ground under the surface in column x (a cave's floor).
function heightOfCave(mask, x) { let y = 1, inside = false; for (; y < mask.height; y += .1) { if (!solidAt(mask, x, y)) { inside = true; break; } } return inside && y < surfaceY(mask, x) - 1 ? y : null; }

test('landmarks: a mesa with a steep, capped face, a cliff with its notch, a walkable beach', () => {
  const mesa = seedWith(m => m.plan.features.some(f => f.type === 'mesa' && f.cap)), f = mesa.map.plan.features.find(k => k.type === 'mesa' && k.cap);
  const mid = mesa.map.width / 2, edge = mid - (f.at - f.top), out = 1;   // the left bank's mesa faces the river (+x)
  assert.ok(ground(mesa.mask, edge - 1) > f.T - 1.2, 'the mesa top is flat ground');
  assert.ok(solidAt(mesa.mask, edge + out * 1.2, f.T - .5) && !solidAt(mesa.mask, edge + out * 1.2, f.T - 2.6), 'its cap overhangs the steep face');
  assert.ok(rockAt(mesa.map, mid - f.at, f.T - 2) > .5, 'the mesa is rock');
  const cliff = seedWith(m => m.plan.shore.style === 'cliff'), face = cliff.map.plan.shore.run, water = cliff.map.water;
  assert.ok(!solidAt(cliff.mask, face + .3, water + 2.3) && solidAt(cliff.mask, face + .6, water + 6), 'the river notched the cliff');
  const beach = seedWith(m => m.plan.shore.style === 'beach');
  for (let x = 2; ground(beach.mask, x) < beach.map.water + 2.4; x += .5) assert.ok(Math.abs(ground(beach.mask, x + 1) - ground(beach.mask, x)) < Math.tan(52 * Math.PI / 180), `the beach climbs at ${x.toFixed(1)}`);
  // Grass only near the starting ground: a crater's floor is bare earth.
  const x = beach.map.spawns[0][1], top = surfaceY(beach.mask, x);
  assert.ok(grassAt(beach.map, x, top) && !grassAt(beach.map, x, top - 3), 'a crater floor is bare earth');
});

test('the tower blocks a flat shot across the middle, a lob clears it', () => {
  const { seed, map } = seedWith(m => m.kind === 'tepuy'), m = createMatch({ seed }); m.wind = 0;
  const c = m.capys.find(k => k.id === '0-0'), mid = map.width / 2, tower = map.plan.center.tower;
  const flat = simulateFlight({ ...muzzle(c, .05, 1), ...aimVelocity(.05, 1, RULES.speed) }, flightOptions(m, []));
  assert.ok(flat.hit === 'ground' && flat.x < mid + tower.half + 2, `a flat shot stops at the tower (${flat.x.toFixed(1)})`);
  const rival = m.capys.find(k => k.id === '1-0');
  const shot = bestShot(m, c, { x: rival.x, y: surfaceY(m.mask, rival.x) });
  assert.ok(shot.miss < 3, `a lob reaches the rivals' front capi (miss ${shot.miss.toFixed(2)})`);
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

test('the shell leaves La Bazuca\'s barrel tip, on the shoulder, never inside its own capi', () => {
  const m = flatMatch(), c = activeCapy(m);
  for (const facing of [1, -1]) for (let a = RULES.aimMin; a <= RULES.aimMax; a += .05) {
    const p = muzzle(c, a, facing), o = shoulder(c), own = center(c);
    assert.ok(Math.abs(Math.hypot(p.x - o.x, p.y - o.y) - RULES.muzzle) < 1e-9, 'the barrel is RULES.muzzle long from the shoulder pivot');
    assert.equal(Math.sign(p.x - c.x), facing, 'the barrel points the way the capi faces');
    assert.ok(Math.hypot(p.x - own.x, p.y - own.y) > RULES.radius + .1, `aim ${a.toFixed(2)} starts outside the shooter's body`);
  }
  // A fired shell starts exactly at that tip.
  c.aim = .4; fire(m, .5);
  assert.deepEqual({ x: m.shot.x, y: m.shot.y }, muzzle(c, .4, c.facing));
});

test('poses follow the match: only the capi on its turn raises La Bazuca', () => {
  const m = flatMatch(), me = activeCapy(m), other = m.capys.find(c => c !== me);
  assert.equal(aiming(m, me), true);
  assert.equal(aiming(m, other), false);
  assert.deepEqual(barrelPose(m, me), { pitch: me.aim, drop: 0 });
  assert.deepEqual(barrelPose(m, other), { pitch: CARRY_PITCH, drop: CARRY_DROP });
  assert.equal(bodyPose(m, me, 0), 'idle');
  assert.equal(bodyPose(m, me, 2.4), 'walk');
  me.grounded = false; me.vy = 3; assert.equal(bodyPose(m, me), 'rise');
  me.vy = -3; assert.equal(bodyPose(m, me), 'fall');
  other.out = 'water'; assert.equal(bodyPose(m, other), 'sink');
  other.out = 'paint'; assert.equal(bodyPose(m, other), 'splat');
  m.phase = 'flight'; assert.equal(aiming(m, me), false, 'the barrel lowers once the shell is away');
  m.phase = 'finished'; m.winner = 0; me.grounded = true;
  assert.equal(bodyPose(m, me), 'cheer');
  assert.equal(bodyPose(m, m.capys.find(c => c.team === 1 && !c.out)), 'sulk');
});
