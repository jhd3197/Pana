import test from 'node:test';
import assert from 'node:assert/strict';
import { comboWorthShowing } from '../fx/pickup-feel.js';

test('the combo is called as a chain gets going and at each full row', () => {
  const shown = Array.from({ length: 16 }, (_, i) => i).filter(comboWorthShowing);
  assert.deepEqual(shown, [3, 5, 10, 15]);
});
