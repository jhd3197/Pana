import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents, fire, explode, activeCapy, teamAlive, center, standings, RULES } from '../public/rules.js';
import { buildMap, llanosHeight, rockAt, grassAt, LLANOS, SPAWNS, FEATURES } from '../public/map-rules.js';
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

test('the Llanos riverbank is the same on every load, with water at both ends', () => {
  const a = buildMap(), b = buildMap();
  assert.deepEqual(a.solid, b.solid);
  assert.ok(llanosHeight(1) < LLANOS.water && llanosHeight(LLANOS.width - 1) < LLANOS.water, 'the river at both banks');
  for (const x of SPAWNS.flat()) assert.ok(surfaceY(a, x) > LLANOS.water + 3, `spawn ${x} on dry land`);
});

test('the map has its landmarks: tower on a mound, caves, arch, lip, cliff notch, beach and sandbar', () => {
  const m = buildMap(), { tower, caves, arch, lip, cliff, island } = FEATURES, ground = x => groundBelow(m, x, LLANOS.height);
  // El Tepuyito stands well above both plateaus and stands on the mound (no floating rock).
  assert.ok(surfaceY(m, tower.x) > tower.top - 1 && surfaceY(m, tower.x) > Math.max(...SPAWNS.flat().map(x => surfaceY(m, x))) + 6);
  // Its cap overhangs: rock above, air just under the lip.
  for (const side of [-1, 1]) {
    const x = tower.x + side * (tower.half + 1.5);
    assert.ok(solidAt(m, x, tower.top - .3) && !solidAt(m, x, tower.top - 2), 'the cap juts out over air');
  }
  // A cave on each side, the two parted by a thin wall; marked hollow for the back wall.
  for (const side of [-1, 1]) {
    const x = tower.x + side * (caves.wall + caves.radius + 1);
    let floor = 10; while (solidAt(m, x, floor)) floor += .1;
    assert.ok(floor < 16 && !solidAt(m, x, floor + 1) && solidAt(m, x, floor + caves.radius * 2 + .4), `a cave with a roof at ${x}`);
    assert.equal(m.hollow[Math.floor((floor + 1) / m.cell) * m.cols + Math.floor(x / m.cell)], 1, 'the cave is a hollow');
  }
  for (let y = 10; y < tower.top - 1; y += .1) assert.ok(solidAt(m, tower.x, y), 'the wall between the caves');
  // The arch spans the west caño with air under it; the east caño has a lip with air under it.
  const archX = (arch.from + arch.to) / 2;
  assert.ok(solidAt(m, archX, arch.y - .5) && !solidAt(m, archX, arch.y - 2.5), 'air under the arch');
  assert.ok(solidAt(m, lip.x - 1, lip.y) && !solidAt(m, lip.x - 1, lip.y - 1.6), 'air under the east lip');
  // The cliff drops into the river with a notch at the water; the sandbar stands just above the water.
  assert.ok(!solidAt(m, cliff - .2, LLANOS.water + 2.3) && solidAt(m, cliff - .4, LLANOS.water + 6), 'the notch under the cliff');
  assert.ok(ground(cliff + 1.4) < LLANOS.water, 'the river between the cliff and the sandbar');
  const bar = ground(island.x);
  assert.ok(bar > LLANOS.water && bar < LLANOS.water + 1.6, `the sandbar at ${bar}`);
  // The beach is walkable from the water to the plateau (never steeper than 52°).
  for (let x = 2; x < FEATURES.beach; x += .5) assert.ok(Math.abs(ground(x + 1) - ground(x)) < Math.tan(52 * Math.PI / 180), `the beach climbs at ${x.toFixed(1)}`);
  // The painter's hints: rock in the tower and the cliff, earth in the plateau, grass only near the first ground.
  assert.ok(rockAt(tower.x, tower.top - 3) > .5 && rockAt(cliff - .5, 10) > .5 && rockAt(20, 12) < .5);
  assert.ok(grassAt(20, llanosHeight(20)) && !grassAt(20, llanosHeight(20) - 3), 'a crater floor is bare earth');
});

test('the tower blocks a flat shot across the middle, a lob clears it', () => {
  const m = createMatch({ seed: 3 }); m.wind = 0;
  const c = m.capys.find(k => k.id === '0-2');
  const flat = simulateFlight({ ...muzzle(c, .05, 1), ...aimVelocity(.05, 1, RULES.speed) }, flightOptions(m, []));
  assert.ok(flat.hit === 'ground' && flat.x < FEATURES.tower.x + FEATURES.tower.half + 2, `a flat shot stops at the tower (${flat.x.toFixed(1)})`);
  const shot = bestShot(m, c, { x: 55, y: surfaceY(m.mask, 55) });
  assert.ok(shot.miss < 3, `a lob reaches the far plateau (miss ${shot.miss.toFixed(2)})`);
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
