import test from 'node:test';
import assert from 'node:assert/strict';
import { shotPower } from '../shot-charge.js';

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
