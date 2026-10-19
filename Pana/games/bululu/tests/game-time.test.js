import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameTime, ease } from '../public/game-time.js';

const settle = () => new Promise((r) => setImmediate(r));

test('waits and tweens move only with game time', async () => {
  const time = createGameTime(), seen = [], ks = [];
  time.wait(1).then(() => seen.push('wait'));
  time.tween(0.5, (k) => ks.push(+k.toFixed(2))).then(() => seen.push('tween'));
  await settle();
  assert.deepEqual(seen, [], 'no frame, no progress');
  time.step(0.25); await settle();
  time.step(0.25); await settle();
  assert.deepEqual(seen, ['tween']);
  assert.deepEqual(ks, [0.5, 1]);
  time.step(0.5); await settle();
  assert.deepEqual(seen, ['tween', 'wait']);
});

test('cancel rejects everything pending with the reason', async () => {
  const time = createGameTime(), reason = new Error('host changed');
  const a = time.wait(5), b = time.tween(5, () => {});
  time.cancel(reason);
  await assert.rejects(a, reason); await assert.rejects(b, reason);
  time.step(10); await settle();   // nothing left to resolve
});

test('ease is a smoothstep', () => {
  assert.deepEqual([ease(0), ease(0.5), ease(1)], [0, 0.5, 1]);
});
