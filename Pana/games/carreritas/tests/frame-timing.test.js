import assert from 'node:assert/strict';
import test from 'node:test';
import { physicsFrame, DrivingSpring } from '../public/drive-rules.js';

test('low frame rates cover the same race time without changing physics steps', () => {
  for (const fps of [4, 5, 8, 10, 12, 20, 30, 60, 144]) {
    let remainder = 0, ticks = 0;
    for (let frame = 0; frame < fps * 10; frame++) {
      const next = physicsFrame(remainder, 1 / fps);
      remainder = next.remainder; ticks += next.steps;
      assert.ok(next.steps <= 15);
    }
    assert.equal(ticks, 600, `${fps} FPS covers ten seconds`);
    assert.ok(remainder < 1e-8);
  }
});

test('catch-up is bounded after tab suspension, with pause and slow-mo preserved', () => {
  assert.equal(physicsFrame(0, 30).steps, 15);
  assert.deepEqual(physicsFrame(.005, 0), { steps: 0, remainder: .005 });
  assert.equal(physicsFrame(0, .2, 1, .5).steps, 6);
  assert.equal(physicsFrame(0, .2, 2).steps, 24);
});

test('slow presentation frames keep suspension stable and match 60 Hz motion', () => {
  for (const [stiffness, damping] of [[160, 7], [180, 9], [140, 6], [90, 5]]) {
    const fast = new DrivingSpring(), slow = new DrivingSpring();
    fast.v = slow.v = 3;
    for (let frame = 0; frame < 40; frame++) {
      slow.step(.1, stiffness, damping, .25);
      for (let i = 0; i < 15; i++) fast.step(.1, stiffness, damping, 1 / 60);
      assert.ok(Math.abs(slow.x - fast.x) < 1e-9);
      assert.ok(Math.abs(slow.x) < 1);
    }
  }
});
