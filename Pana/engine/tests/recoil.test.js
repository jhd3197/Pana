import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoil, shakeAt } from '../play/recoil.js';

test('a shot kicks and climbs the view, which settles back', () => {
  const feel = createRecoil();
  feel.fire({ cam: 3 });
  const first = feel.update(1 / 60);
  assert.ok(first.kick > .8 && first.pitch > .05);
  let last = first; for (let i = 0; i < 120; i++) last = feel.update(1 / 60);
  assert.equal(last.kick, 0); assert.ok(Math.abs(last.pitch) < .005);
});

test('climb is capped, so holding the trigger never flips the view', () => {
  const feel = createRecoil({ maxClimb: .2 });
  let out; for (let i = 0; i < 50; i++) { feel.fire({ cam: 4 }); out = feel.update(.05); }
  assert.ok(out.pitch <= .2 + 1e-9);
});

test('shake trembles and fades, and is the same for the same inputs', () => {
  const run = () => { const feel = createRecoil(); feel.shake(1.2); return Array.from({ length: 30 }, () => feel.update(1 / 60)); };
  const a = run(), b = run();
  assert.deepEqual(a, b);
  assert.ok(a.some(f => Math.abs(f.yaw) > .01));
  const feel = createRecoil(); feel.shake(1); let out; for (let i = 0; i < 60; i++) out = feel.update(1 / 60);
  assert.equal(out.shake, 0); assert.equal(out.yaw, 0);
});

test('an explosion shakes hardest close by and not at all far away', () => {
  assert.equal(shakeAt(0, 1), 1);
  assert.ok(shakeAt(4, 1) > shakeAt(10, 1));
  assert.equal(shakeAt(20, 1, 16), 0);
});
