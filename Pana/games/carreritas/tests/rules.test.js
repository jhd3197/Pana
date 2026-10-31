import test from 'node:test';
import assert from 'node:assert/strict';
import { clockText, wrapAngle, raceOrder, aiPedals, resolveContact, CAR_RADIUS } from '../public/rules.js';
import { packPose, validPose, POSE_LENGTH, FLAG, cleanCar, cleanWheel, cleanTrack, gridSlot, CAR_COUNT, TRACK_IDS } from '../public/online-rules.js';

const car = (fields) => ({ x: 0, y: 0, z: 0, h: 0, vx: 0, vz: 0, def: { tune: { mass: 1 } }, ...fields });

test('race clock: seconds under a minute, m:ss.s above', () => {
  assert.equal(clockText(9.87), '9.8');
  assert.equal(clockText(72.4), '1:12.4');
  assert.equal(clockText(605), '10:05.0');
});

test('angles wrap into -π…π', () => {
  assert.ok(Math.abs(wrapAngle(3 * Math.PI) - Math.PI) < 1e-9 || Math.abs(wrapAngle(3 * Math.PI) + Math.PI) < 1e-9);
  assert.ok(Math.abs(wrapAngle(-Math.PI / 2) + Math.PI / 2) < 1e-9);
});

test('finishers by time, then the rest by distance', () => {
  const cars = [
    { name: 'slow', done: true, time: 90 }, { name: 'leader', done: false, lap: 2, prog: 10 },
    { name: 'fast', done: true, time: 80 }, { name: 'back', done: false, lap: 1, prog: 300 },
  ];
  assert.deepEqual(raceOrder(cars, 400).map(c => c.name), ['fast', 'slow', 'leader', 'back']);
});

test('rivals brake into turns and ease off when far ahead', () => {
  assert.deepEqual(aiPedals(0, 0), { throttle: 1, steer: 0 });
  assert.equal(aiPedals(0.8, 0).throttle, 0.55);
  assert.equal(aiPedals(0.1, 60).throttle, 0.75);
  assert.equal(aiPedals(2, 0).steer, 1);
  assert.equal(aiPedals(-2, 0).steer, -1);
});

test('cars apart, stacked or both remote never touch', () => {
  assert.equal(resolveContact(car(), car({ x: CAR_RADIUS * 2 + 0.1 })), null);
  assert.equal(resolveContact(car(), car({ x: 1, y: 2 })), null);
  assert.equal(resolveContact(car({ remote: true }), car({ x: 1, remote: true })), null);
});

test('a head-on hit pushes apart, trades momentum by mass and crashes', () => {
  const a = car({ vx: 10 }), b = car({ x: 3, vx: -10, def: { tune: { mass: 3 } } });
  const hit = resolveContact(a, b);
  assert.equal(hit.kind, 'crash');
  assert.ok(b.x - a.x >= CAR_RADIUS * 2 - 1e-9);
  assert.ok(a.vx < 0 && b.vx < 0, 'the heavier car pushes through');
  assert.ok(hit.a.power > hit.b.power, 'the lighter car takes the bigger hit');
  assert.ok(hit.a.hit && hit.b.hit);
});

test('online, a client moves only its own car', () => {
  const mine = car({ vx: 4 }), theirs = car({ x: 3, remote: true });
  const hit = resolveContact(mine, theirs);
  assert.equal(theirs.x, 3);
  assert.equal(theirs.vx, 0);
  assert.equal(hit.kind, 'bump');
  assert.equal(hit.b.hit, false);
});

test('poses pack to fifteen numbers with flags, and validate', () => {
  const pose = packPose({ x: 1.234, y: 0, z: -2, h: 0.5, pitch: 0, roll: 0, vf: 10, steer: 0, spin: 0, boost: 0,
    onGround: true, dizzy: 1, inventory: [1, 2], done: false, lap: 2, prog: 120.6, lost: 1, coins: 3 });
  assert.equal(pose.length, POSE_LENGTH);
  assert.equal(pose[0], 1.23);
  assert.equal(pose[10], FLAG.ground | FLAG.dizzy | FLAG.full);
  assert.ok(validPose(pose));
  assert.equal(validPose(pose.slice(1)), false);
  assert.equal(validPose([...pose.slice(1), NaN]), false);
});

test('join options are cleaned to known cars, wheels and tracks', () => {
  assert.equal(cleanCar(CAR_COUNT), 0);
  assert.equal(cleanCar(1), 1);
  assert.equal(cleanWheel('nope'), 'calle');
  assert.equal(cleanTrack('playa'), cleanTrack('bululu'), 'the legacy playa id follows bululu, whichever build has it');
  assert.equal(cleanTrack('nope'), TRACK_IDS[0]);
  assert.deepEqual([gridSlot(0), gridSlot(3)], [{ lane: 3.5, row: 0 }, { lane: -3.5, row: 1 }]);
});
