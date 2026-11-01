import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeDamage, falloffConfig } from '../play/weapon-falloff.js';

const SNIPER = { near: 10, far: 50, close: 3, min: 1 };

test('close damage holds up to near, then falls linearly to min at far', () => {
  assert.deepEqual([0, 6, 10, 20, 30, 40, 50].map(d => rangeDamage(SNIPER, d)), [3, 3, 3, 3, 2, 2, 1]);
  assert.equal(rangeDamage({ ...SNIPER, round: false }, 30), 2);
  assert.equal(rangeDamage({ ...SNIPER, round: false }, 20), 2.5);
});

test('it never drops below min, however far', () => {
  assert.equal(rangeDamage(SNIPER, 70), 1); assert.equal(rangeDamage(SNIPER, 1e6), 1);
  assert.equal(rangeDamage({ near: 0, far: 10, close: 5, min: 2, round: false }, 99), 2);
});

test('bad distances count as point blank', () => {
  assert.equal(rangeDamage(SNIPER, -5), 3); assert.equal(rangeDamage(SNIPER, NaN), 3);
});

test('a weapon without a config deals its flat base damage', () => {
  assert.equal(rangeDamage(null, 60), 1); assert.equal(rangeDamage(undefined, 60, 2), 2);
  assert.equal(falloffConfig(null), null); assert.equal(falloffConfig({ near: 1, far: 2 }), null);
});

test('near equal to far is a step from close to min', () => {
  const step = { near: 20, far: 20, close: 4, min: 1 };
  assert.equal(rangeDamage(step, 20), 4); assert.equal(rangeDamage(step, 20.01), 1);
});
