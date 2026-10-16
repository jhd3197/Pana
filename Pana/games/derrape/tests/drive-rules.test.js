import test from 'node:test';
import assert from 'node:assert/strict';
import { driftLevel, driftSteer, driftCharge, startBoost, trickBoost, inSlipstream, loseCoins, DRIFT_LEVELS, DRIFT_BOOST } from '../public/drive-rules.js';

test('drift charge climbs through three spark levels', () => {
  assert.equal(driftLevel(0), 0);
  assert.equal(driftLevel(DRIFT_LEVELS[0]), 1);
  assert.equal(driftLevel(DRIFT_LEVELS[1] + 0.01), 2);
  assert.equal(driftLevel(99), 3);
  assert.ok(DRIFT_BOOST[3] > DRIFT_BOOST[2] && DRIFT_BOOST[2] > DRIFT_BOOST[1] && DRIFT_BOOST[0] === 0);
});

test('a drift always turns into the corner; the stick only widens or tightens it', () => {
  for (const dir of [-1, 1]) {
    for (const steer of [-1, 0, 1]) assert.equal(Math.sign(driftSteer(dir, steer)), dir);
  }
  assert.ok(Math.abs(driftSteer(1, 1)) > Math.abs(driftSteer(1, 0)));
  assert.ok(Math.abs(driftSteer(1, -1)) < Math.abs(driftSteer(1, 0)));
  assert.ok(driftCharge(1, 1) > driftCharge(1, -1));
});

test('rocket start: late press boosts, early press stalls, no press does nothing', () => {
  assert.deepEqual(startBoost(null), { boost: 0, stall: 0 });
  assert.ok(startBoost(1.3).boost > 0);
  assert.ok(startBoost(3.5).stall > 0);
  assert.deepEqual(startBoost(2.2), { boost: 0, stall: 0 });
});

test('tricks pay only after real air and a clean landing', () => {
  assert.ok(trickBoost(0.6, true) > 0);
  assert.equal(trickBoost(0.1, true), 0);
  assert.equal(trickBoost(0.6, false), 0);
});

test('slipstream needs speed and a car right ahead', () => {
  const a = { x: 0, z: 0, h: 0, vf: 30 };
  assert.equal(inSlipstream(a, { x: 0, z: -8, h: 0, vf: 30 }), true);
  assert.equal(inSlipstream(a, { x: 5, z: -8, h: 0, vf: 30 }), false, 'off the line');
  assert.equal(inSlipstream(a, { x: 0, z: 8, h: 0, vf: 30 }), false, 'ahead, not behind');
  assert.equal(inSlipstream({ ...a, vf: 5 }, { x: 0, z: -8, h: 0, vf: 30 }), false, 'too slow');
});

test('hits spill coins but never below zero', () => {
  const c = { coins: 3 };
  assert.equal(loseCoins(c, 2), 2);
  assert.equal(loseCoins(c, 2), 1);
  assert.equal(c.coins, 0);
  assert.equal(loseCoins({}, 2), 0);
});
