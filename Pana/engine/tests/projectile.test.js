import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentBox, segmentCircle, launch, sweep, traceRay, flightTime, sweepArc, stepArc } from '../play/projectile.js';

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

test('an arc falls under gravity, flies over low cover and stops on tall cover, a target or the ground', () => {
  const ball = { x: 0, y: 2, z: 0, vx: 10, vy: 0, vz: 0 };
  stepArc(ball, .5, 10); assert.ok(Math.abs(ball.x - 5) < 1e-9 && Math.abs(ball.y - .75) < 1e-9 && Math.abs(ball.vy + 5) < 1e-9);
  const from = () => ({ x: 0, y: 1.5, z: 0, vx: 20, vy: 0, vz: 0 });
  assert.ok(sweepArc(from(), .1, { boxes: [{ x: 1, z: 0, w: .2, d: 2, h: .5 }], gravity: 10 }).t > 1, 'over a low crate');
  const wall = sweepArc(from(), .1, { boxes: [{ x: 1, z: 0, w: .2, d: 2, h: 3 }], gravity: 10 });
  assert.equal(wall.hit, 'cover'); assert.ok(Math.abs(wall.t * wall.dx - .9) < 1e-9);
  const pana = sweepArc(from(), .1, { targets: [{ x: 1.5, z: 0 }], radius: .5, gravity: 10 });
  assert.equal(pana.hit, 'target'); assert.ok(Math.abs(pana.t * pana.dx - 1) < 1e-9);
  assert.ok(sweepArc(from(), .1, { targets: [{ x: 1.5, z: 0 }], radius: .5, height: 1, gravity: 10 }).t > 1, 'over a short target');
  const ground = sweepArc({ x: 0, y: .1, z: 0, vx: 1, vy: -2, vz: 0 }, .1, { gravity: 10 });
  assert.equal(ground.hit, 'ground'); assert.ok(Math.abs(.1 + ground.dy * ground.t) < 1e-9);
});

test('a level shot flying at y passes over cover no taller than y', () => {
  const low = { x: 5, z: 0, w: 1, d: 2, h: .7 }, tall = { ...low, h: 2.6 }, ball = { x: 3, z: 0, vx: 85, vz: 0 };
  assert.ok(sweep(ball, .05, { boxes: [low], y: 1.1 }).t > 1, 'waist-high cover lets it pass');
  assert.ok(sweep(ball, .05, { boxes: [tall], y: 1.1 }).t <= 1, 'tall cover stops it');
  assert.ok(sweep(ball, .05, { boxes: [low] }).t <= 1, 'without y every box is a wall');
  assert.equal(traceRay(0, 0, 1, 0, 60, { boxes: [low], y: 1.1 }), 60);
});
