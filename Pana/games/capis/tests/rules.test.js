import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents, fire, explode, activeCapy, teamAlive, center, standings, RULES } from '../public/rules.js';
import { generateMap, rockAt, grassAt, MAP_SIZES, KINDS, strataPalette, STRATA_KEYS } from '../public/map-rules.js';
import { planShot, bestShot, createBot, pickTarget } from '../public/bot.js';
import { fillHeights, surfaceY, solidAt, groundBelow, carve } from '../../../engine/play/terrain-mask.js';
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

// The first seed whose medium map passes `test`.
function seedWith(test, from = 1) { for (let seed = from; seed < from + 400; seed++) { const g = generateMap(seed); if (test(g.map)) return { seed, ...g }; } throw new Error('no seed'); }
const ground = (mask, x) => groundBelow(mask, x, mask.height);
const hollowAt = (mask, x, y) => mask.hollow[Math.floor(y / mask.cell) * mask.cols + Math.floor(x / mask.cell)] === 1;

test('a seed builds the same ground on every load: land across the map, the sea at both ends', () => {
  const a = generateMap(4242), b = generateMap(4242);
  assert.deepEqual(a.mask.solid, b.mask.solid); assert.deepEqual(a.map.spawns, b.map.spawns);
  const { map, mask } = a;
  assert.equal(mask.width, MAP_SIZES.medium.width);
  assert.ok(KINDS.includes(map.kind) || map.kind === 'suave');
  assert.ok(ground(mask, 1) < map.water && ground(mask, map.width - 1) < map.water, 'the sea at both ends');
  for (const x of map.spawns.flat()) assert.ok(surfaceY(mask, x) > map.water + 2.5, `spawn ${x.toFixed(1)} on dry land`);
});

test('Montaña de cuevas: a massif over the middle, a tunnel through its foot with a room, marked hollow', () => {
  const { map, mask } = seedWith(m => m.kind === 'cuevas'), f = map.plan.features.find(k => k.type === 'mountain'), t = map.plan.tunnels[0];
  // The front capis stand on its crest, well above the lowland at its feet.
  assert.ok(surfaceY(mask, map.spawns[0][0]) > ground(mask, f.at - f.half - 4) + 6);
  // The tunnel: air with rock over it, all the way through, a back wall behind it.
  for (let k = 1; k < 4; k++) {
    const p = t.points[k];
    assert.ok(!solidAt(mask, p.x, p.y + 1) && solidAt(mask, p.x, p.y + 4.5), `the tunnel at ${p.x.toFixed(1)}`);
    assert.ok(hollowAt(mask, p.x, p.y + 1), 'the tunnel is a hollow');
  }
  assert.ok(rockAt(map, f.at - f.half + 2, map.plan.base + 5) > .5 && rockAt(map, f.at + f.half - 2, map.plan.base + 5) > .5, 'its sheer faces are rock');
});

test('Islas con puentes: islands at different heights, rock bridges over the water between them', () => {
  const { map, mask } = seedWith(m => m.kind === 'islas'), islands = map.plan.features.filter(f => f.type === 'island');
  for (const s of map.plan.bridges) {
    const x = (s.a.x + s.b.x) / 2;
    assert.ok(ground(mask, x) > map.water + 6, 'a bridge stands over the gap');
    assert.ok(groundBelow(mask, x, ground(mask, x) - 2.5) < map.water, 'and the sea under it');
    assert.ok(rockAt(map, x, ground(mask, x) - .4) > .5, 'the bridge is rock');
  }
  assert.ok(new Set(islands.map(f => Math.round(f.top))).size > 1, 'not all at one height');
});

test('Valle con laguna: sheer sides, an arch from rim to rim, the pond under it', () => {
  const { map, mask } = seedWith(m => m.kind === 'valle'), v = map.plan.features.find(f => f.type === 'valley'), pond = map.plan.features.find(f => f.type === 'pond');
  assert.ok(ground(mask, pond.at) > v.left - 6, 'the arch is the top over the pond');
  assert.ok(groundBelow(mask, pond.at, ground(mask, pond.at) - 2.5) < map.water, 'the pond under the arch');
  let floor = Infinity;
  for (let x = v.at - v.floor + 1; x < v.at + v.floor - 1; x += .5) floor = Math.min(floor, groundBelow(mask, x, ground(mask, x) - 2.5) ?? -1);
  assert.ok(floor < Math.min(v.left, v.right) - 8, 'the valley floor is deep under the rims');
});

test('landmarks: a mesa with a steep, capped face, a cliff end with its notch, a walkable beach', () => {
  const mesa = seedWith(m => m.plan.features.some(f => f.type === 'mesa' && f.cap)), f = mesa.map.plan.features.find(k => k.type === 'mesa' && k.cap);
  const edge = f.at + f.face * f.top;
  assert.ok(ground(mesa.mask, edge - f.face) > f.T - 1.2, 'the mesa top is flat ground');
  assert.ok(solidAt(mesa.mask, edge + f.face * 1.2, f.T - .5) && !solidAt(mesa.mask, edge + f.face * 1.2, f.T - 2.6), 'its cap overhangs the steep face');
  assert.ok(rockAt(mesa.map, f.at, f.T - 2) > .5, 'the mesa is rock');
  const cliff = seedWith(m => m.plan.ends[0].style === 'cliff'), face = cliff.map.plan.ends[0].run, water = cliff.map.water;
  assert.ok(!solidAt(cliff.mask, face + .3, water + 2.3) && solidAt(cliff.mask, face + .6, water + 6), 'the sea notched the cliff');
  const beach = seedWith(m => m.plan.ends[0].style === 'beach');
  for (let x = 2; ground(beach.mask, x) < beach.map.water + 2.4; x += .5) assert.ok(Math.abs(ground(beach.mask, x + 1) - ground(beach.mask, x)) < Math.tan(52 * Math.PI / 180), `the beach climbs at ${x.toFixed(1)}`);
  // Grass only near the starting ground: a crater's floor is bare earth.
  const x = beach.map.spawns[0][1], top = surfaceY(beach.mask, x);
  assert.ok(grassAt(beach.map, x, top) && !grassAt(beach.map, x, top - 3), 'a crater floor is bare earth');
});

test('the front capis can lob a shell onto each other on every kind of map', () => {
  for (const kind of KINDS) {
    const { seed } = seedWith(m => m.kind === kind), m = createMatch({ seed }); m.wind = 0;
    const c = m.capys.find(k => k.id === '0-0'), rival = m.capys.find(k => k.id === '1-0');
    const shot = bestShot(m, c, { x: rival.x, y: surfaceY(m.mask, rival.x) });
    assert.ok(shot.miss < 3, `${kind} seed ${seed}: a lob reaches the rivals' front capi (miss ${shot.miss.toFixed(2)})`);
  }
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

test('at the turn limit the team with more capis standing wins, then the one with less paint, else a draw', () => {
  const end = (setup) => { const m = flatMatch(); setup(m); m.turn.n = RULES.turnLimit; m.turn.time = .01; run(m, RULES.settleMax + 1); return m; };
  const more = end(m => { m.capys.find(c => c.id === '1-2').out = 'paint'; });
  assert.equal(more.phase, 'finished'); assert.equal(more.endedBy, 'turns'); assert.equal(more.winner, 0);
  const cleaner = end(m => { m.capys.find(c => c.id === '0-1').paint = 40; });
  assert.equal(cleaner.winner, 1, 'the same count: less paint wins');
  assert.equal(end(() => {}).winner, -1, 'level in everything: a draw');
  const before = flatMatch(); before.turn.n = RULES.turnLimit - 1; before.turn.time = .01; run(before, RULES.settleMax + 1);
  assert.notEqual(before.phase, 'finished', 'one turn before the limit the match goes on');
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

test('the bot picks the rival it can hit, not just the nearest one', () => {
  // The nearest rival sits in a pocket inside a rock; the next one stands in the open.
  const m = flatMatch([[10, 14, 18], [34, 50, 62]]), capy = m.capys.find(c => c.id === '0-2');
  fillHeights(m.mask, x => x > 28 && x < 40 ? 20 : 10);
  carve(m.mask, 34, 12.4, 2.4);
  for (const c of m.capys) c.y = groundBelow(m.mask, c.x, c.x === 34 ? 12 : m.mask.height);
  const pick = pickTarget(m, capy);
  assert.ok(pick.feasible && pick.rival.id === '1-1', `picked ${pick.rival.id}`);
  // No rival in reach at all: the nearest, flagged so the bot walks towards it.
  fillHeights(m.mask, x => Math.abs(x - capy.x) < 2 ? 10 : 39);
  const none = pickTarget(m, capy);
  assert.equal(none.feasible, false); assert.equal(none.rival.id, '1-0');
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

test('the layers of the cut face belong to the map: same seed and kind, same look; colours and numbers in range', () => {
  for (const kind of [...KINDS, 'suave']) {
    for (const seed of [1, 2, 101, 4242, 99999]) {
      const a = strataPalette(seed, kind), b = strataPalette(seed, kind);
      assert.deepEqual(a, b, `${kind} ${seed} is deterministic`);
      for (const key of STRATA_KEYS) {
        assert.equal(a[key].length, 3);
        for (const v of a[key]) assert.ok(Number.isInteger(v) && v >= 0 && v <= 255, `${kind} ${key} ${v}`);
      }
      assert.ok(a.period >= 3.8 && a.period <= 5.6, `period ${a.period}`);
      assert.ok(a.fold >= .3 && a.fold <= .55 && Math.abs(a.tilt) <= .02 && a.phase >= 0 && a.phase < 100);
      // The topsoil is darker than the pale ash, the base darker than the loam over it.
      const lum = c => c[0] * .3 + c[1] * .55 + c[2] * .15;
      assert.ok(lum(a.topsoil) < lum(a.ash) && lum(a.base) < lum(a.loam) && lum(a.pumice) > lum(a.clay));
    }
  }
  assert.notDeepEqual(strataPalette(101, 'cerros'), strataPalette(102, 'cerros'), 'another seed shifts the look');
  assert.notDeepEqual(strataPalette(101, 'cerros').clay, strataPalette(101, 'terrazas').clay, 'another kind has its own colours');
  assert.deepEqual(strataPalette(101, 'nada'), strataPalette(101, 'nada'), 'an unknown kind falls back');
});

