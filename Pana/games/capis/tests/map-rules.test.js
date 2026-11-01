// The generated maps are playable, fair and replayable, over many seeds and
// every size: spawns on dry ground with room, teams spread out, water between
// the banks, nothing floating, the two sides alike, every capi in the fight.
// The numbers (generation time, re-rolls) are printed as test diagnostics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, spawnStats, reachable, planMap, buildGround, MAP_SIZES, FAIR, ATTEMPTS } from '../public/map-rules.js';
import { surfaceY } from '../../../engine/play/terrain-mask.js';
import { dropFloating, headroom } from '../../../engine/play/terrain-gen.js';

const SEEDS = { medium: 50, small: 20, large: 20 };
const GAP = { small: 5, medium: 7, large: 8 };
const maps = {};
const timing = {};
for (const [size, count] of Object.entries(SEEDS)) {
  const list = [], start = performance.now();
  for (let seed = 1; seed <= count; seed++) list.push({ seed, ...generateMap(seed * 7919 % 99991, size) });
  timing[size] = (performance.now() - start) / count;
  maps[size] = list;
}
const all = Object.values(maps).flat();

test('generation is fast and deterministic: the same seed and size give the same cells, byte for byte', t => {
  for (const [size, ms] of Object.entries(timing)) {
    const rerolls = maps[size].reduce((n, g) => n + g.map.attempt, 0), reasons = {};
    for (const g of maps[size]) for (const r of g.map.rejected) reasons[r] = (reasons[r] || 0) + 1;
    t.diagnostic(`${size}: ${maps[size].length} seeds, ${ms.toFixed(1)} ms a map, ${rerolls} re-rolls (${maps[size].filter(g => g.map.attempt).length} seeds re-rolled) ${JSON.stringify(reasons)}`);
    assert.ok(ms < 150, `${size} maps take ${ms.toFixed(0)} ms`);
    assert.ok(maps[size].every(g => !g.map.failed), `${size}: every seed passes within ${ATTEMPTS} attempts`);
  }
  for (const g of [...maps.medium.slice(0, 20), ...maps.small.slice(0, 5), ...maps.large.slice(0, 5)]) {
    const again = generateMap(g.map.seed, g.map.size);
    assert.ok(Buffer.from(again.mask.solid).equals(Buffer.from(g.mask.solid)), `seed ${g.map.seed} ${g.map.size} solid`);
    assert.ok(Buffer.from(again.mask.hollow).equals(Buffer.from(g.mask.hollow)), `seed ${g.map.seed} ${g.map.size} hollow`);
    assert.deepEqual(again.map.spawns, g.map.spawns);
  }
  // A re-roll is part of the seed: building the passing attempt directly gives the same ground.
  const rerolled = all.find(g => g.map.attempt > 0);
  assert.ok(rerolled, 'some seed re-rolls');
  const { mask } = buildGround(planMap(rerolled.map.seed, rerolled.map.size, rerolled.map.attempt));
  assert.ok(Buffer.from(mask.solid).equals(Buffer.from(rerolled.mask.solid)));
  assert.notDeepEqual(generateMap(1).mask.solid, generateMap(2).mask.solid, 'another seed, another map');
  assert.deepEqual(Object.keys(MAP_SIZES), ['small', 'medium', 'large']);
});

test('every kind of middle shows up: El Tepuyito on about half the seeds, islands, open rivers', t => {
  const kinds = {}; for (const g of maps.medium) kinds[g.map.kind] = (kinds[g.map.kind] || 0) + 1;
  t.diagnostic(`medium kinds over ${maps.medium.length} seeds: ${JSON.stringify(kinds)}`);
  assert.ok(kinds.tepuy >= 12 && kinds.tepuy <= 32, `tepuy on ${kinds.tepuy} of 50`);
  assert.ok(kinds.island >= 5 && kinds.river >= 5);
  const features = new Set(all.flatMap(g => g.map.plan.features.map(f => f.type)));
  assert.deepEqual([...features].sort(), ['arch', 'cave', 'mesa']);
});

test('spawns stand on dry ground with headroom, spread out, each with room to walk', () => {
  for (const g of all) {
    const { map, mask } = g, label = `seed ${map.seed} ${map.size}`;
    assert.equal(map.spawns.length, 2); assert.equal(map.spawns[0].length, 3);
    for (const xs of map.spawns) {
      for (const x of xs) {
        const y = surfaceY(mask, x);
        assert.ok(y !== null && y > map.water + 2.5, `${label}: spawn ${x.toFixed(1)} above the water (${y})`);
        assert.ok(headroom(mask, x, y, 2.6), `${label}: room to stand at ${x.toFixed(1)}`);
      }
      const sorted = [...xs].sort((a, b) => a - b);
      for (let i = 1; i < 3; i++) assert.ok(sorted[i] - sorted[i - 1] >= GAP[map.size] - 1e-9, `${label}: capis ${GAP[map.size]} apart`);
    }
    // The teams on opposite banks, front capis far enough apart that the first shot is a lob.
    assert.ok(Math.max(...map.spawns[0]) < map.width / 2 && Math.min(...map.spawns[1]) > map.width / 2, label);
    assert.ok(map.spawns[1][0] - map.spawns[0][0] > 28, `${label}: the front capis are ${(map.spawns[1][0] - map.spawns[0][0]).toFixed(1)} apart`);
    for (const s of spawnStats(map, mask).flat()) assert.ok(s.span >= FAIR.span, `${label}: ${s.span.toFixed(1)} units to walk at ${s.x.toFixed(1)}`);
  }
});

test('no ground floats in the air, and there is water between the banks', () => {
  for (const g of all) {
    const { map, mask } = g, copy = { ...mask, solid: mask.solid.slice() }, label = `seed ${map.seed} ${map.size}`;
    const loose = dropFloating(copy, 0);
    assert.equal(loose.removed, 0, `${label}: ${loose.removed} floating cells`); assert.deepEqual(loose.floating, [], label);
    let channel = 0;
    for (let x = map.spawns[0][0]; x <= map.spawns[1][0]; x += .25) if (surfaceY(mask, x) < map.water) channel += .25;
    assert.ok(channel >= 1.5, `${label}: ${channel} units of water between the banks`);
  }
});

test('the two sides are fair: spawn heights, open sky, distance to the water and to the middle', t => {
  let worst = { height: 0, exposure: 0, water: 0, middle: 0 };
  for (const g of all) {
    const [a, b] = spawnStats(g.map, g.mask), label = `seed ${g.map.seed} ${g.map.size}`;
    for (let i = 0; i < 3; i++) {
      const d = { height: Math.abs(a[i].y - b[i].y), exposure: Math.abs(a[i].exposure - b[i].exposure), water: Math.abs(a[i].water - b[i].water), middle: Math.abs(a[i].middle - b[i].middle) };
      for (const k in d) worst[k] = Math.max(worst[k], d[k]);
      assert.ok(d.height <= FAIR.height && d.exposure <= FAIR.exposure, `${label} slot ${i}: ${JSON.stringify(d)}`);
      assert.ok(d.middle < 1e-6, `${label}: the spawns mirror each other`);
      assert.ok(d.water <= 3, `${label} slot ${i}: ${d.water} difference to the water`);
    }
    const mean = (list, k) => list.reduce((s, x) => s + x[k], 0) / 3;
    assert.ok(Math.abs(mean(a, 'y') - mean(b, 'y')) <= FAIR.meanHeight, label);
  }
  t.diagnostic(`worst difference between the sides: ${JSON.stringify(Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, +v.toFixed(2)])))}`);
});

test('every capi is in the fight: it walks to its front or can hit a rival from where it gets', t => {
  let direct = 0, walked = 0;
  for (const g of [...maps.medium, ...maps.small.slice(0, 8), ...maps.large.slice(0, 8)]) {
    const { map, mask } = g, stats = spawnStats(map, mask), label = `seed ${map.seed} ${map.size}`;
    const at = s => ({ x: s.x, y: s.y }), aim = s => ({ x: s.x, y: s.y + .35 });
    assert.ok(reachable(mask, at(stats[0][0]), aim(stats[1][0])) && reachable(mask, at(stats[1][0]), aim(stats[0][0])), `${label}: the front capis can hit each other`);
    for (let team = 0; team < 2; team++) for (const s of stats[team]) {
      const dir = team ? -1 : 1, front = stats[team][0];
      if ((s.front - front.x) * dir >= -1) { walked++; continue; }
      const there = { x: s.front, y: surfaceY(mask, s.front) };
      assert.ok(reachable(mask, there, aim(stats[1 - team][0])), `${label}: capi at ${s.x.toFixed(1)} is walled in`);
      direct++;
    }
  }
  t.diagnostic(`${walked} capis can walk to their team's front, ${direct} others hit the rivals' front from where they get`);
});
