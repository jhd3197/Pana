import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseFar } from '../models/core/lod-band.js';

const BAND = { far: 55, near: 47 };

test('full detail up close, the far copy beyond the far line', () => {
  assert.equal(chooseFar(false, 31, BAND), false);
  assert.equal(chooseFar(false, 80, BAND), true);
});

test('between the two lines the current choice stays (no flicker)', () => {
  assert.equal(chooseFar(false, 50, BAND), false);
  assert.equal(chooseFar(true, 50, BAND), true);
  assert.equal(chooseFar(true, 46, BAND), false);
  // A model wobbling around the far line switches once, not every frame.
  let far = false, switches = 0;
  for (let i = 0; i < 100; i++) { const next = chooseFar(far, 55 + Math.sin(i) * 3, BAND); if (next !== far) switches++; far = next; }
  assert.equal(switches, 1);
});

test('near defaults to 85 % of far, and a bad distance keeps the choice', () => {
  assert.equal(chooseFar(true, 43, { far: 50 }), true);
  assert.equal(chooseFar(true, 42, { far: 50 }), false);
  assert.equal(chooseFar(true, NaN, BAND), true);
  assert.equal(chooseFar(false, undefined, BAND), false);
});
