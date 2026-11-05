import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeedFeel, fovFor, linesFor, windFor } from '../fx/speed.js';

const DT = 1 / 60;

test('the view opens from about 50 to about 75 with speed', () => {
  assert.equal(fovFor(0), 50);
  assert.equal(fovFor(1), 75);
  assert.equal(fovFor(2), 75, 'it never goes past the top');
  assert.ok(fovFor(.3) < fovFor(.8));
});

test('lines and wind stay quiet when slow and rise with speed', () => {
  assert.equal(linesFor(.3), 0);
  assert.ok(linesFor(1) > linesFor(.8));
  assert.equal(windFor(0), 0);
  assert.equal(windFor(1), 1);
});

test('hard acceleration pulls the camera back, then it catches up with a small shake', () => {
  const feel = createSpeedFeel();
  let out = feel.update(DT, 0, 50), peak = 0, v = 0;
  for (let i = 0; i < 60; i++) { v += 40 * DT; out = feel.update(DT, v, 50); peak = Math.max(peak, out.pull); }
  assert.ok(peak > .5, `pulled back ${peak}`);
  let shook = 0;
  for (let i = 0; i < 40; i++) { out = feel.update(DT, v, 50); shook = Math.max(shook, Math.abs(out.shake)); }
  assert.ok(shook > 0 && shook <= .12, `shake ${shook}`);
  for (let i = 0; i < 360; i++) out = feel.update(DT, v, 50);
  assert.ok(out.pull < .01, 'it settles on the car');
  assert.ok(out.shake < .01, 'and the shake dies');
});

test('a boost opens the view even before the speed arrives', () => {
  const feel = createSpeedFeel();
  feel.update(DT, 10, 50);
  assert.ok(feel.update(DT, 10, 50, true).fov > 73);
});

test('braking never pulls the camera back', () => {
  const feel = createSpeedFeel();
  feel.update(DT, 50, 50);
  let out;
  for (let v = 50; v > 0; v -= 1) out = feel.update(DT, v, 50);
  assert.equal(out.pull, 0);
});
