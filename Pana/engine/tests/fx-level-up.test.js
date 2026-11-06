import test from 'node:test';
import assert from 'node:assert/strict';
import { sliverEase } from '../progress-ui.js';

test('the bar covers most of the way quickly, then crawls the last sliver', () => {
  assert.equal(sliverEase(0), 0);
  assert.equal(sliverEase(1), 1);
  assert.ok(sliverEase(.35) >= .84, 'most of it by a third of the time');
  const last = 1 - sliverEase(.35), early = sliverEase(.35);
  assert.ok(early / .35 > last / .65 * 5, 'the end is far slower than the start');
  for (let t = .02; t <= 1; t += .02) assert.ok(sliverEase(t) >= sliverEase(t - .02) - 1e-9, 'it never goes back');
});

test('stats count in whole steps that end on the real total', async () => {
  const { countSteps, unlockName } = await import('../fx/level-up.js');
  assert.deepEqual(countSteps(18, 21), [19, 20, 21]);
  const many = countSteps(0, 1000);
  assert.equal(many.length, 14);
  assert.equal(many.at(-1), 1000);
  assert.deepEqual(countSteps(5, 5), [5]);
  assert.equal(unlockName('traje:franja'), 'Traje Franja');
});
