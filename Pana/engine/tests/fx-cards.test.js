import test from 'node:test';
import assert from 'node:assert/strict';
import { clampTo, leanToward, scaleFor, springStep } from '../fx/card-feel.js';
import { gapPath } from '../fx/hand-feel.js';

test('a card closing a gap starts where it was, passes its spot, and ends exactly there', () => {
  const path = gapPath(-60);
  assert.equal(path[0].x, -60);
  assert.ok(path.some((p) => p.x > .5), 'it overshoots');
  assert.deepEqual(path.at(-1), { x: 0, lean: 0 });
  assert.ok(path.some((p) => Math.abs(p.lean) > 1), 'and leans with its speed');
  assert.ok(path.every((p) => Math.abs(p.lean) <= 14), 'within a limit');
});

const settle = (start, target, seconds, dt = 1 / 60) => {
  let x = start, v = 0, peak = start;
  for (let t = 0; t < seconds; t += dt) { [x, v] = springStep(x, v, target, dt); peak = Math.max(peak, x); }
  return { x, v, peak };
};

test('a card snaps past where it belongs, then settles there', () => {
  const { x, v, peak } = settle(0, 1, 3);
  assert.ok(peak > 1.02, `overshoots to ${peak}`);
  assert.ok(peak < 1.4, 'but not wildly');
  assert.ok(Math.abs(x - 1) < .001 && Math.abs(v) < .01, 'and comes to rest');
});

test('the spring stays stable at the slowest step the feel allows', () => {
  const { x } = settle(0, 1, 6, 1 / 30);
  assert.ok(Math.abs(x - 1) < .001);
});

test('a card leans toward the pointer, up to a limit', () => {
  assert.deepEqual(leanToward(0, 0), [0, 0]);
  const [x, y] = leanToward(.03, -.03);
  assert.ok(x > 0 && y < 0);
  assert.deepEqual(leanToward(5, -5), [1, -1]);
  assert.equal(clampTo(-3, 2), -2);
});

test('held reads bigger than hovered, hovered bigger than at rest', () => {
  assert.ok(scaleFor(false, true) > scaleFor(true, false));
  assert.ok(scaleFor(true, false) > scaleFor(false, false));
  assert.equal(scaleFor(false, false), 1);
});
