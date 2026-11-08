// The free-for-all's setup: three maps from one seed, only the host switches
// (and a switch clears the picks), panas place only their own capis on good
// ground, and launching locks the seed and every start.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSetup, candidateSeeds, choose, place, unplace, launch, setupGround, resolveSpawns, dropPlayer, setOwner, seedOf, PLACE_GAP } from '../public/setup-rules.js';
import { generateMap, WATER } from '../public/map-rules.js';
import { createMatch } from '../public/rules.js';
import { surfaceY } from '../../../engine/play/terrain-mask.js';

const groundOf = seed => { const { map, mask } = generateMap(seed, 'large', { mode: 'ffa' }); return setupGround(map, mask); };
// Host 'h' owns capis 0 and 1 (a pana may own several), 'g' owns 2; the rest are bots.
const fresh = () => createSetup({ setupSeed: 77, hostId: 'h', owners: { 0: 'h', 1: 'h', 2: 'g' } });

test('three distinct candidate seeds, the same from the same setup seed', () => {
  const a = candidateSeeds(77);
  assert.equal(a.length, 3); assert.equal(new Set(a).size, 3);
  assert.deepEqual(a, candidateSeeds(77)); assert.notDeepEqual(a, candidateSeeds(78));
});

test('only the host switches maps; a switch resets placements; stale revs are turned down', () => {
  const s = fresh(), ground = groundOf(seedOf(s));
  assert.ok(place(s, 'g', 2, ground.auto[2], ground, s.rev).ok);
  assert.deepEqual(choose(s, 'g', 1, s.rev), { ok: false, reason: 'not-host' });
  const old = s.rev;
  assert.ok(choose(s, 'h', 1, s.rev).ok);
  assert.equal(seedOf(s), s.seeds[1]); assert.deepEqual(s.places, {});
  assert.equal(place(s, 'g', 2, 50, ground, old).reason, 'stale', 'a pick meant for the old map');
  assert.equal(choose(s, 'h', 5, s.rev).reason, 'bad-pick');
});

test('placing checks owner, bounds, safe ground, overlap and reach', () => {
  const s = fresh(), ground = groundOf(seedOf(s)), { auto, map, mask } = ground;
  assert.equal(place(s, 'g', 0, auto[0], ground).reason, 'not-owner');
  assert.equal(place(s, 'h', 4, auto[4], ground).reason, 'not-owner', 'a bot capi is nobody\'s to place');
  assert.equal(place(s, 'h', 0, 2, ground).reason, 'out-of-bounds');
  assert.equal(place(s, 'h', 0, NaN, ground).reason, 'out-of-bounds');
  let wet = null; for (let x = 9; x < map.width - 9 && wet === null; x += .5) if (!(surfaceY(mask, x) > WATER + 2.5)) wet = x;
  if (wet !== null) assert.equal(place(s, 'h', 0, wet, ground).reason, 'unsafe');
  assert.ok(place(s, 'h', 0, auto[0], ground).ok);
  assert.ok(place(s, 'h', 1, auto[1], ground).ok, 'a pana places each capi it owns');
  assert.equal(place(s, 'g', 2, auto[0] + PLACE_GAP / 2, ground).reason, 'overlap');
  assert.ok(unplace(s, 'h', 1).ok); assert.equal(s.places[1], undefined);
});

test('bots and panas who did not choose get fair, apart spots; launch locks seed and spawns', () => {
  const s = fresh(), ground = groundOf(seedOf(s)), { auto } = ground;
  // Capi 0 takes capi 3's fair spot: capi 3 moves to the spot nobody holds.
  assert.ok(place(s, 'h', 0, auto[3], ground).ok);
  const xs = resolveSpawns(s, ground);
  assert.equal(xs[0], Math.round(auto[3] * 100) / 100);
  assert.equal(new Set(xs).size, 6);
  const sorted = [...xs].sort((a, b) => a - b);
  for (let i = 1; i < 6; i++) assert.ok(sorted[i] - sorted[i - 1] >= PLACE_GAP, sorted.join());
  assert.deepEqual(xs, resolveSpawns(s, ground), 'deterministic');
  assert.equal(launch(s, 'g', ground).reason, 'not-host');
  const done = launch(s, 'h', ground);
  assert.ok(done.ok); assert.equal(done.seed, s.seeds[0]); assert.deepEqual(done.spawns, xs);
  assert.equal(choose(s, 'h', 2).reason, 'locked'); assert.equal(place(s, 'h', 1, auto[1], ground).reason, 'locked');
  const m = createMatch({ seed: done.seed, mode: 'ffa', spawnXs: done.spawns });
  assert.deepEqual(m.capys.map(c => c.x), done.spawns.map(x => m.capys.find(c => c.x === x).x));
  assert.equal(m.capys[0].x, xs[0]);
});

test('a pana leaving or a late join taking a seat clears that capi\'s pick', () => {
  const s = fresh(), ground = groundOf(seedOf(s));
  assert.ok(place(s, 'g', 2, ground.auto[2], ground).ok);
  dropPlayer(s, 'g');
  assert.equal(s.places[2], undefined); assert.equal(s.owners[2], undefined);
  setOwner(s, 4, 'late');
  assert.ok(place(s, 'late', 4, ground.auto[4], ground).ok);
});
