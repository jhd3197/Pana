import test from 'node:test';
import assert from 'node:assert/strict';
import { shotPower, createShotCharge } from '../play/shot-charge.js';

test('holding charges to full strength, falls back and repeats', () => {
  for (const [time, expected] of [[0, .05], [500, .525], [1000, 1], [1500, .525], [2000, .05], [2500, .525], [3000, 1]]) {
    assert.ok(Math.abs(shotPower(time) - expected) < 1e-9, `power at ${time}ms`);
  }
  assert.ok(shotPower(1100) < shotPower(1000), 'holding past the peak loses strength');
});

test('charge stays in the legal shot range over long holds and clock boundaries', () => {
  for (const time of [-1, 999.99, 1000.01, 1999.99, 2000.01, 60001, 3600000]) {
    assert.ok(shotPower(time) >= .05 && shotPower(time) <= 1);
  }
});

test('a charge shoots once on release, only from its own source and on the same revision', () => {
  let revision = 1, turn = true;
  const shots = [], charge = createShotCharge({ ready: () => turn, revision: () => revision, shoot: (power, extra) => shots.push([power, extra]) });
  assert.equal(charge.begin('pointer', { pocket: 3 }), true);
  assert.equal(charge.begin(' '), false, 'one charge at a time');
  charge.release(' ');
  assert.equal(charge.active, true, 'another source does not release it');
  charge.release('pointer');
  assert.equal(shots.length, 1); assert.deepEqual(shots[0][1], { pocket: 3 }); assert.equal(charge.active, false);
  charge.begin('Enter'); revision++; charge.release('Enter');
  assert.equal(shots.length, 1, 'the table moved on: the shot is dropped');
  turn = false; assert.equal(charge.begin('Enter'), false, 'not my turn');
});
