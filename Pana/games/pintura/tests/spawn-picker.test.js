import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSpawn, pickRespawn, rankSpawns, spreadSpawns, MIN_SPAWN_GAP } from '../public/spawn-picker.js';
import { Arena, segmentBox, spawnsFor } from '../public/rules.js';
import { rng } from '../../../engine/random.js';
import { PAINT_ARENAS } from '../../../engine/worlds/arena-layouts.js';
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
  for (const id of ['plaza', 'muelle', 'noche', 'terminal']) for (const options of [{}, { mode: 'teams' }, { mode: 'ctf' }]) {
    const g = room(id, 8, options);
    assert.equal(new Set(g.players.map(p => p.spawn)).size, 8, `${id} ${JSON.stringify(options)}: eight different spawns`);
    g.players.forEach(p => assert.deepEqual({ x: p.x, z: p.z }, spawnsFor(id)[p.spawn]));
  }
  // Free-for-all on El Puerto: the second pana starts in the other base.
  const duel = room('terminal', 2); assert.equal(Math.sign(duel.players[0].x), -Math.sign(duel.players[1].x));
});

test('teams keep their own side; El Puerto keeps its two facing bases', () => {
  for (const options of [{ mode: 'teams' }, { mode: 'ctf' }]) for (let seed = 1; seed < 6; seed++) {
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

// Free-for-all spread. Each court's widest possible spread for n panas, by brute force.
const ARENA_IDS = PAINT_ARENAS.map(map => map.id);
const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const minGapOf = points => Math.min(...points.flatMap((a, i) => points.slice(i + 1).map(b => apart(a, b))));
function widest(spawns, n) {
  let best = 0;
  const walk = (from, chosen) => {
    if (chosen.length === n) { best = Math.max(best, minGapOf(chosen.map(i => spawns[i]))); return; }
    for (let i = from; i < spawns.length; i++) walk(i + 1, [...chosen, i]);
  };
  walk(0, []); return best;
}
const ffa = (id, people, bots, seed) => {
  const g = new Arena(id, 'normal', {}); g.random = rng(seed);
  for (let i = 1; i <= people + bots; i++) g.add(i, { name: `P${i}`, avatar: {}, bot: i > people });
  g.start(); return g;
};
// Courts that fall short of MIN_SPAWN_GAP for 2-8 panas: none. El Puerto's
// bases hold four pads 6 m apart, and its corner and forward pads make up the rest.
const FALLBACKS = {};
const fallbackTable = () => {
  const table = {};
  for (const id of ARENA_IDS) for (let n = 2; n <= 8; n++) {
    const { minGap, fallback } = spreadSpawns(spawnsFor(id), n, { rng: rng(1) });
    if (fallback) table[`${id} ${n}`] = Math.round(minGap * 10) / 10;
  }
  return table;
};

test('free-for-all round start keeps every pana MIN_SPAWN_GAP apart, or as far as the court allows', () => {
  assert.equal(MIN_SPAWN_GAP, 20);
  for (const id of ARENA_IDS) for (let n = 2; n <= 8; n++) {
    const spawns = spawnsFor(id), best = widest(spawns, n), feasible = best >= MIN_SPAWN_GAP;
    for (let seed = 1; seed <= 25; seed++) for (const people of [1, 2]) {
      const g = ffa(id, people, n - people, seed), where = `${id} n=${n} seed=${seed}`;
      assert.equal(new Set(g.players.map(p => p.spawn)).size, n, `${where}: distinct spawns`);
      g.players.forEach(p => assert.deepEqual({ x: p.x, z: p.z }, spawns[p.spawn]));
      const gap = minGapOf(g.players);
      if (feasible) assert.ok(gap >= MIN_SPAWN_GAP, `${where}: ${gap} m`);
      else assert.ok(Math.abs(gap - best) < 1e-6, `${where}: ${gap} m, the court allows ${best}`);
      assert.equal(g.spawnReport.fallback, !feasible, `${where}: fallback flag`);
      assert.equal(g.spawnReport.count, n); assert.equal(g.spawnReport.arena, id);
      assert.ok(Math.abs(g.spawnReport.minGap - gap) < .051, `${where}: reported gap`);
    }
  }
});

test('the fallback table is deterministic and no court falls short for 2-8 panas', () => {
  assert.deepEqual(fallbackTable(), FALLBACKS);
  for (const id of ARENA_IDS) for (let n = 2; n <= 8; n++) assert.ok(widest(spawnsFor(id), n) >= MIN_SPAWN_GAP, `${id}: ${n} panas fit ${MIN_SPAWN_GAP} m apart`);
  assert.deepEqual(fallbackTable(), fallbackTable());
  for (let n = 2; n <= 8; n++) {
    const a = spreadSpawns(spawnsFor('plaza'), n, { rng: rng(9), first: 1 }), b = spreadSpawns(spawnsFor('plaza'), n, { rng: rng(9), first: 1 });
    assert.deepEqual(a, b, 'same rng, same spread');
  }
});

test('El Puerto free-for-all: from one pana and four bots to a full eight, nobody starts within 20 m', () => {
  // The reported round: free-for-all with four bots placed a bot 6 m away in the same base.
  for (let seed = 1; seed <= 60; seed++) for (const [people, bots] of [[1, 4], [2, 3], [1, 7], [3, 5]]) {
    const g = ffa('terminal', people, bots, seed), where = `seed ${seed} ${people}+${bots}`;
    assert.ok(minGapOf(g.players) >= MIN_SPAWN_GAP, `${where}: ${minGapOf(g.players)} m`);
    assert.equal(g.spawnReport.fallback, false, `${where}: no fallback`);
    // At most one pana on each base's four pads.
    for (const side of [-1, 1]) assert.ok(g.players.filter(p => p.spawn < 8 && Math.sign(p.x) === side).length <= 1, `${where}: one pana per base`);
  }
  // The added pads are mirrored through the centre, so both halves get the same spots.
  const spawns = spawnsFor('terminal');
  for (let i = 8; i < spawns.length; i += 2) assert.deepEqual(spawns[i + 1], { x: -spawns[i].x, z: -spawns[i].z });
});

test('lobby panas and a late arrival are never parked on top of each other', () => {
  const g = new Arena('plaza', 'normal', {}); g.random = rng(3);
  for (let i = 1; i <= 6; i++) g.add(i, { name: `P${i}`, avatar: {}, bot: i > 1 });
  assert.ok(minGapOf(g.players) >= MIN_SPAWN_GAP, 'spread already in the lobby');
  g.selectMap('noche'); assert.ok(minGapOf(g.players) >= MIN_SPAWN_GAP, 'and after the map changes');
  g.start(); g.go();
  const late = g.add(7, { name: 'P7', avatar: {} });
  const nearest = Math.min(...g.players.filter(q => q !== late).map(q => apart(late, q)));
  assert.ok(nearest >= MIN_SPAWN_GAP, `late arrival ${nearest} m from the nearest pana`);
});

test('free-for-all respawns go distance first: MIN_SPAWN_GAP from the nearest rival when a spawn allows it', () => {
  const draws = [0, .2, .4, .6, .8, .99].map(n => () => n);
  for (const id of ARENA_IDS) {
    const spawns = spawnsFor(id), random = rng(id.length);
    for (let trial = 0; trial < 40; trial++) {
      // Rivals on a few spawns and scattered over the court.
      const enemies = Array.from({ length: 1 + trial % 6 }, (_, k) => k % 2 ? { ...spawns[Math.floor(random() * spawns.length)] } : { x: (random() - .5) * 40, z: (random() - .5) * 30 });
      const last = trial % spawns.length, nearOf = i => Math.min(...enemies.map(e => apart(e, spawns[i])));
      const old = Math.min(...draws.map(d => nearOf(pickSpawn(spawns, { enemies, last, rng: d }))));
      const reachable = spawns.some((s, i) => i !== last && nearOf(i) >= MIN_SPAWN_GAP);
      for (const d of draws) {
        const index = pickRespawn(spawns, { enemies, last, rng: d }), near = nearOf(index);
        assert.notEqual(index, last, `${id}: not the last spawn`);
        assert.ok(near >= old - 1e-9, `${id}: ${near} m, the old pick could land ${old} m`);
        if (reachable) assert.ok(near >= MIN_SPAWN_GAP, `${id}: ${near} m while a spawn ${MIN_SPAWN_GAP} m away was open`);
      }
    }
  }
  // Through the arena: a respawn on El Puerto with four rivals spread over the court.
  const g = ffa('terminal', 1, 4, 5), me = g.players[0]; g.go();
  for (let k = 0; k < 10; k++) { g.respawn(me); assert.ok(Math.min(...g.players.slice(1).map(q => apart(me, q))) >= MIN_SPAWN_GAP - 1e-9); }
});
