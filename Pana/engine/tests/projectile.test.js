import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentBox, segmentCircle, launch, sweep, traceRay, flightTime } from '../play/projectile.js';

const crate = { x: 5, z: 0, w: .4, d: 2 };

test('a fast ball cannot pass a thin crate between two ticks', () => {
  // 85 m/s for 50 ms moves 4.25 m: both ends miss the crate, the segment does not.
  const ball = { x: 3, z: 0, vx: 85, vz: 0 };
  const { t, victim } = sweep(ball, .05, { boxes: [crate] });
  assert.equal(victim, null);
  assert.ok(Math.abs(3 + 85 * .05 * t - 4.8) < 1e-9, 'stops on the near face');
});

test('the first thing along the path wins: a pana in front of cover is hit, behind it is safe', () => {
  const ball = { x: 0, z: 0, vx: 200, vz: 0 }, front = { x: 3, z: 0 }, behind = { x: 7, z: 0 };
  assert.equal(sweep(ball, .05, { boxes: [crate], targets: [front, behind] }).victim, front);
  assert.equal(sweep(ball, .05, { boxes: [crate], targets: [behind] }).victim, null);
  assert.ok(sweep(ball, .05, { targets: [{ x: 4, z: 3 }] }).t > 1, 'a miss reports no hit');
});

test('segment helpers handle starting inside, parallel lines and padding', () => {
  assert.equal(segmentCircle(0, 0, 1, 0, { x: .2, z: 0 }), 0);
  assert.equal(segmentBox(0, 5, 10, 0, crate), null, 'parallel and outside');
  assert.ok(segmentBox(0, 1.1, 10, 0, crate, .12) !== null, 'padding widens the box');
});

test('launch turns the aim by the spread angle and keeps the speed', () => {
  const { vx, vz } = launch(0, -1, 30, Math.PI / 2);
  assert.ok(Math.abs(Math.hypot(vx, vz) - 30) < 1e-9 && Math.abs(vx - 30) < 1e-9);
});

test('a tracer ends at the first cover or at its range', () => {
  assert.ok(Math.abs(traceRay(0, 0, 1, 0, 60, { boxes: [crate] }) - 4.8) < 1e-9);
  assert.equal(traceRay(0, 0, 0, 1, 60, { boxes: [crate] }), 60);
  assert.equal(flightTime(42, 14), 3);
});
