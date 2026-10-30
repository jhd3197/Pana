import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSpawn, rankSpawns } from '../public/spawn-picker.js';
import { Arena, segmentBox, spawnsFor } from '../public/rules.js';
import { rng } from '../../../engine/random.js';
const line = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 20, z: 0 }, { x: 40, z: 0 }];
const draws = [0, .34, .67, .99].map(n => () => n);
const room = (id, players, options = {}, seed = 7) => {
  const g = new Arena(id, 'normal', options); g.random = rng(seed);
  for (let i = 1; i <= players; i++) g.add(i, { name: `P${i}`, avatar: {}, bot: i > 1 });
  g.start(); return g;
};

test('the spawn farthest from the nearest rival wins', () => {
  for (const draw of draws) assert.equal(pickSpawn(line, { enemies: [{ x: 1, z: 0 }], rng: draw }), 3);
  // Two rivals: the best spawn maximises the distance to the closer one.
  assert.equal(rankSpawns(line, { enemies: [{ x: 0, z: 0 }, { x: 40, z: 0 }] })[0].index, 2);
});

test('the last spawn is avoided while another is open', () => {
  for (const draw of draws) assert.notEqual(pickSpawn(line, { enemies: [{ x: 1, z: 0 }], last: 3, rng: draw }), 3);
  assert.equal(pickSpawn([line[0]], { last: 0 }), 0, 'a lone spawn is still used');
  const g = room('plaza', 4); g.go(); const p = g.players[0];
  for (let i = 0; i < 20; i++) { const before = p.spawn; g.respawn(p); assert.notEqual(p.spawn, before); }
});

test('a spawn out of every rival\'s sight beats a slightly farther one in the open', () => {
  const wall = { x: 0, z: 5, w: 4, d: 1 }, sees = (e, s) => segmentBox(e.x, e.z, s.x - e.x, s.z - e.z, wall) === null;
  const spawns = [{ x: 10, z: 10 }, { x: 0, z: 10 }, { x: -10, z: 10 }];
  const enemy = { x: 0, z: -4 };
  assert.equal(rankSpawns(spawns, { enemies: [enemy], sees })[0].index, 1, 'behind the wall, though slightly nearer');
  assert.equal(rankSpawns(spawns, { enemies: [enemy], sees }).find(c => c.index === 1).seen, false);
  for (const draw of draws) assert.equal(pickSpawn(spawns, { enemies: [enemy], sees, rng: draw }), 1);
});

test('round start places every pana on its own spawn, far from those already placed', () => {
  for (const id of ['plaza', 'muelle', 'noche', 'terminal']) for (const options of [{}, { mode: 'teams' }, { flag: true }]) {
    const g = room(id, 8, options);
    assert.equal(new Set(g.players.map(p => p.spawn)).size, 8, `${id} ${JSON.stringify(options)}: eight different spawns`);
    g.players.forEach(p => assert.deepEqual({ x: p.x, z: p.z }, spawnsFor(id)[p.spawn]));
  }
  // Free-for-all on El Puerto: the second pana starts in the other base.
  const duel = room('terminal', 2); assert.equal(Math.sign(duel.players[0].x), -Math.sign(duel.players[1].x));
});

test('teams keep their own side; El Puerto keeps its two facing bases', () => {
  for (const options of [{ mode: 'teams' }, { flag: true }]) for (let seed = 1; seed < 6; seed++) {
    const g = room('terminal', 8, options, seed);
    for (const p of g.players) assert.equal(Math.sign(p.x), p.team ? 1 : -1, `seat ${p.seat} spawns in its team's base`);
    for (const p of g.players) { g.respawn(p); assert.equal(Math.sign(p.x), p.team ? 1 : -1, 'and respawns there'); }
  }
  // Free-for-all on the plaza: a respawn lands far from the rival standing near it.
  const g = room('plaza', 2), [a, b] = g.players; g.go(); Object.assign(b, spawnsFor('plaza')[0]);
  g.respawn(a); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 30, `respawned ${Math.hypot(a.x - b.x, a.z - b.z)} m away`);
});

test('the same seed draws the same spawns', () => {
  const spots = seed => room('plaza', 6, {}, seed).players.map(p => p.spawn);
  assert.deepEqual(spots(42), spots(42));
  assert.ok([1, 2, 3, 4, 5, 6].some(seed => spots(seed).join() !== spots(42).join()), 'other seeds vary the round');
});
