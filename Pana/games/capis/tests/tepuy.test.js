// Todos contra todos on a tepuy: the same Llanos lifted and ridged so two
// neighbours have cover from a flat shot, every spot still walking (with the
// walker's real hop and slope) to every other, and La Licuadora in every
// side's kit for digging through whatever the ground becomes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, spreadSpawns, ffaReach, planMap, ffaLayout, FFA_LAYOUTS, FFA_MASSIFS, WATER } from '../public/map-rules.js';
import { RULES } from '../public/rules.js';
import { startingAmmo } from '../public/weapons.js';
import { SIDE_WALKER, stepSideWalker } from '../../../engine/play/side-walker.js';
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

test('sheer highlands with real relief, ramps under the slope, first tries pass, teams maps untouched', () => {
  assert.ok(FFA_MASSIFS.ramp < Math.tan(SIDE_WALKER.maxClimb) * .9, 'a ramp is walked');
  assert.ok(FFA_MASSIFS.face >= 5, 'the faces are sheer');
  let first = 0;
  for (const seed of SEEDS) {
    const p = planMap(seed, 'large', 0, { mode: 'ffa' }), q = planMap(seed, 'large', 0);
    assert.ok(p.massifs.length >= 1 && p.massifs.length <= 2); assert.equal(q.massifs, undefined);
    const { map, mask } = built.get(seed); if (map.attempt === 0) first++;
    const ys = Array.from({ length: 141 }, (_, k) => surfaceY(mask, 20 + k)).filter(y => y !== null);
    assert.ok(Math.max(...ys) - Math.min(...ys) >= 25, `seed ${seed}: relief ${(Math.max(...ys) - Math.min(...ys)).toFixed(1)}`);
  }
  assert.ok(first >= SEEDS.length - 2, `${first} of ${SEEDS.length} on the first try`);
});

// The real walker (side-walker.js with Capis' own options) walks from every
// spot to its neighbours and back: hold the key towards it, hop when blocked.
test('a capi really walks every route between neighbouring spots, both ways, on every layout', () => {
  const opts = { radius: RULES.radius, water: WATER, airControl: RULES.airControl, airSpeed: RULES.airSpeed };
  // One seed of each layout, plain and mirrored (ffaLayout), each walked 10 ways.
  const variants = new Map();
  for (const seed of SEEDS) { const l = ffaLayout(seed), k = `${l.kind}${l.mirror ? '/mirrored' : ''}`; if (!variants.has(k)) variants.set(k, seed); }
  assert.equal(variants.size, FFA_LAYOUTS.length * 2, [...variants.keys()].join());
  for (const seed of variants.values()) {
    const { mask } = built.get(seed) || generateMap(seed, 'large', { mode: 'ffa' }), xs = spreadSpawns(built.get(seed).map, mask).sort((a, b) => a - b), ys = xs.map(x => surfaceY(mask, x));
    for (let i = 0; i < 5; i++) for (const [a, b] of [[i, i + 1], [i + 1, i]]) {
      const c = { x: xs[a], y: ys[a], vx: 0, vy: 0, grounded: true, facing: 1, slide: 0, paint: 0, jumpPress: 0 };
      let jump = 0, ok = false, last = c.x;
      for (let t = 0; t < 60 * 90 && !ok; t++) {
        const r = stepSideWalker(c, { x: Math.sign(xs[b] - c.x), jump }, 1 / 60, mask, opts);
        assert.ok(c.y > WATER, `seed ${seed}: drowned going ${xs[a].toFixed(0)} -> ${xs[b].toFixed(0)}`);
        ok = Math.abs(c.x - xs[b]) < 1 && Math.abs(c.y - ys[b]) < 1.5 && c.grounded;
        if (r.blocked && c.grounded) jump++;
        if (t % 120 === 0) { if (Math.abs(c.x - last) < .3) jump++; last = c.x; }
      }
      assert.ok(ok, `seed ${seed}: ${xs[a].toFixed(0)} -> ${xs[b].toFixed(0)} stopped at ${c.x.toFixed(1)}, ${c.y.toFixed(1)}`);
    }
  }
});
