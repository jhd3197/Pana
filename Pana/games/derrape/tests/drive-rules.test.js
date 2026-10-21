import test from 'node:test';
import assert from 'node:assert/strict';
import { driftLevel, driftSteer, assistDrift, driftCharge, startBoost, trickBoost, inSlipstream, loseCoins, DRIFT_LEVELS, DRIFT_BOOST,
  overheatWarn, overheated, OVERHEAT_WARN, OVERHEAT_TIME, heatedCharge, HEAT_MAX_SLOW } from '../public/drive-rules.js';

test('drift charge climbs through three spark levels', () => {
  assert.equal(driftLevel(0), 0);
  assert.equal(driftLevel(DRIFT_LEVELS[0]), 1);
  assert.equal(driftLevel(DRIFT_LEVELS[1] + 0.01), 2);
  assert.equal(driftLevel(99), 3);
  assert.ok(DRIFT_BOOST[3] > DRIFT_BOOST[2] && DRIFT_BOOST[2] > DRIFT_BOOST[1] && DRIFT_BOOST[0] === 0);
});

test('drift steering is gentle at neutral and countersteering can open the corner', () => {
  for (const dir of [-1, 1]) {
    assert.equal(Math.sign(driftSteer(dir, dir)), dir);
    assert.equal(Math.sign(driftSteer(dir, -dir)), -dir);
    assert.ok(Math.abs(driftSteer(dir, 0)) < 0.2);
    assert.ok(Math.abs(driftSteer(dir, dir)) < 1);
  }
  assert.ok(Math.abs(driftSteer(1, 1)) > Math.abs(driftSteer(1, 0)));
  assert.ok(driftCharge(1, 1) > driftCharge(1, -1));
});

test('drift assist preserves safe input and corrects predicted edge or excess rotation symmetrically', () => {
  assert.deepEqual(assistDrift(.5,.2,1,8,1.8),{steer:.5,amount:0});
  const edge=assistDrift(.85,-.3,-7,8,1.8);
  assert.ok(edge.steer<0&&edge.amount>.9,'correct before the car reaches a wall');
  const overshoot=assistDrift(.85,-.5,0,8,1.8);
  assert.ok(overshoot.steer<0,'do not keep rotating past the road');
  const mirror=assistDrift(-.85,.3,7,8,1.8);
  assert.equal(mirror.steer,-edge.steer);assert.equal(mirror.amount,edge.amount);
  for(const steer of [-1,0,1])for(const aim of [-2,0,2]) {
    const result=assistDrift(steer,aim,12,8,1.8);
    assert.ok(Math.abs(result.steer)<=1&&result.amount>=0&&result.amount<=1);
  }
});

test('rocket start: late press boosts, early press stalls, no press does nothing', () => {
  assert.deepEqual(startBoost(null), { boost: 0, stall: 0 });
  assert.ok(startBoost(1.3).boost > 0);
  assert.ok(startBoost(3.5).stall > 0);
  assert.deepEqual(startBoost(2.2), { boost: 0, stall: 0 });
  assert.ok(startBoost(1.8).boost > 0 && startBoost(1.8).boost < startBoost(1.3).boost, 'early in "1" is a smaller turbo');
  assert.ok(startBoost(3.5).stall < 0.9, 'holding from "3" costs a moment, not the start');
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

test('purple is a window: the sparks warn, then the tyres burn', () => {
  const purple = DRIFT_LEVELS[2];
  assert.ok(OVERHEAT_WARN < OVERHEAT_TIME);
  assert.ok(!overheatWarn(purple) && !overheated(purple), 'reaching purple is safe');
  assert.ok(overheatWarn(purple + OVERHEAT_WARN) && !overheated(purple + OVERHEAT_WARN), 'the warning comes first');
  assert.ok(overheated(purple + OVERHEAT_TIME), 'held too long, the tyres burn');
});

test('hot tyres charge the next drift slower, never to a standstill', () => {
  assert.equal(heatedCharge(0), 1);
  assert.equal(heatedCharge(undefined), 1);
  assert.ok(heatedCharge(0.3) < 1 && heatedCharge(0.3) > heatedCharge(0.5));
  assert.equal(heatedCharge(10), 1 - HEAT_MAX_SLOW, 'capped');
});
