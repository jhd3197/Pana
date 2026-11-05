// A loose prop on destructible ground: it comes down, rests, falls again when
// the ground goes, flies when thrown and sinks in the water.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMask, fillHeights, carve } from '../play/terrain-mask.js';
import { dropProp, stepProp, throwProp, propTouches } from '../play/loose-prop.js';

const flat = (h = 6) => { const m = createMask({ width: 40, height: 20, cell: .1 }); fillHeights(m, () => h); return m; };
const run = (p, m, seconds, o) => { let last = {}; for (let t = 0; t < seconds; t += 1 / 60) { const r = stepProp(p, 1 / 60, m, o); last = { landed: last.landed || r.landed, sunk: last.sunk || r.sunk }; } return last; };

test('a prop on a parachute comes down at its steady speed and rests on the ground', () => {
  const m = flat(), p = dropProp({ x: 20, y: 18, chute: 6 });
  stepProp(p, 1, m);
  assert.ok(Math.abs(p.y - 12) < .01, 'six units in a second');
  assert.equal(run(p, m, 2).landed, true);
  assert.ok(p.grounded && Math.abs(p.y - 6) < .15 && p.chute === 0, `rests at ${p.y}`);
});

test('it falls again when the ground under it is blown away', () => {
  const m = flat(), p = dropProp({ x: 20, y: 7 });
  run(p, m, 1); assert.ok(p.grounded);
  carve(m, 20, 6, 2);
  run(p, m, 1);
  assert.ok(p.grounded && p.y < 5, `lies in the crater at ${p.y}`);
});

test('a blast throws it away and a wall stops it', () => {
  const m = createMask({ width: 40, height: 20, cell: .1 }); fillHeights(m, x => x > 24 ? 14 : 6);
  const p = dropProp({ x: 20, y: 6.1, chute: 6 });
  throwProp(p, 18, 6, 12);
  assert.equal(p.chute, 0, 'the parachute is gone');
  assert.ok(p.vx > 0 && p.vy > 0);
  run(p, m, 3);
  assert.ok(p.grounded && p.x > 20 && p.x <= 24.1, `stopped at ${p.x}`);
});

test('it sinks in the water, and touching is measured from its middle', () => {
  const m = flat(2), p = dropProp({ x: 20, y: 8 });
  assert.equal(run(p, m, 2, { water: 4 }).sunk, true);
  const q = dropProp({ x: 10, y: 6 });
  assert.equal(propTouches(q, 11, 6.5, 1.5), true);
  assert.equal(propTouches(q, 12, 6.5, 1.5), false);
});
