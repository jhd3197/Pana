// Todos contra todos on a tepuy: the same Llanos lifted and ridged so two
// neighbours have cover from a flat shot, every spot still walking (with the
// walker's real hop and slope) to every other, and La Licuadora in every
// side's kit for digging through whatever the ground becomes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, spreadSpawns, ffaReach, planMap, FFA_TEPUY } from '../public/map-rules.js';
import { startingAmmo } from '../public/weapons.js';
import { SIDE_WALKER } from '../../../engine/play/side-walker.js';
import { solidAt, surfaceY } from '../../../engine/play/terrain-mask.js';

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const built = new Map(SEEDS.map(seed => [seed, generateMap(seed, 'large', { mode: 'ffa' })]));

test("the reachability graph's hop and slope are no better than the walker's", () => {
  const jump = SIDE_WALKER.jump ** 2 / (2 * SIDE_WALKER.gravity);
  assert.ok(jump > 1.4 && jump < 1.5, `the low jump stays ${jump.toFixed(2)}`);
  assert.ok(7 ** 2 / (2 * 18) <= jump, 'the graph hops lower than a capi');
  assert.ok(50 <= SIDE_WALKER.maxClimb * 180 / Math.PI, 'the graph climbs no steeper than 52°');
});

test('seeded: all six free-for-all spots walk or hop to one another, both ways', () => {
  for (const seed of SEEDS) {
    const { map, mask } = built.get(seed), r = ffaReach(map, mask);
    assert.ok(r.connected, `seed ${seed} ${map.kind}: cut off ${r.pairs.filter(q => !q[2]).map(q => q.join('>')).join(' ')}`);
    assert.ok(!['cuevas', 'islas'].includes(map.kind), `seed ${seed}: ${map.kind}`);
  }
});

test('La Licuadora is in every side\'s kit from the first turn', () => assert.ok(startingAmmo().drill > 0));

test('neighbours have cover: most flat shots between them hit the ridge', () => {
  let blocked = 0, pairs = 0;
  for (const seed of SEEDS) {
    const { map, mask } = built.get(seed), xs = spreadSpawns(map, mask).sort((a, b) => a - b), ys = xs.map(x => surfaceY(mask, x));
    for (let i = 0; i < 5; i++) {
      pairs++;
      for (let t = .05; t < .95; t += .01) if (solidAt(mask, xs[i] + (xs[i + 1] - xs[i]) * t, ys[i] + 2 + (ys[i + 1] - ys[i]) * t)) { blocked++; break; }
    }
  }
  assert.ok(blocked / pairs >= .8, `${blocked} of ${pairs}`);
});

test('taller than the teams\' Llanos, with five uneven plateaus, and teams maps untouched', () => {
  let ffa = 0, teams = 0;
  for (const seed of SEEDS.slice(0, 8)) {
    const p = planMap(seed, 'large', 0, { mode: 'ffa' }), q = planMap(seed, 'large', 0);
    assert.equal(p.ridges.length, 5); assert.equal(q.ridges, undefined);
    assert.ok(p.ridges.every(f => f.rise >= FFA_TEPUY.rise[0] && f.steep < Math.tan(SIDE_WALKER.maxClimb)));
    const { map, mask } = built.get(seed); ffa += spreadSpawns(map, mask).reduce((a, x) => a + surfaceY(mask, x), 0) / 6;
    teams += generateMap(seed, 'large').map.fair.heights.flat().reduce((a, b) => a + b) / 6;
  }
  assert.ok(ffa > teams + 8 * 2, `ffa ${(ffa / 8).toFixed(1)} vs teams ${(teams / 8).toFixed(1)}`);
});
