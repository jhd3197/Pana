import test from 'node:test';
import assert from 'node:assert/strict';
import { optionDefaults, normalizeRoomOptions, applyRoomOptions } from '../room-options-rules.js';

const fields = [
  { id: 'mode', default: 'normal', choices: [['normal', 'Normal'], ['fast', 'Rápido']] },
  { id: 'rounds', default: 3, choices: [[3, '3'], [6, '6']] },
  { id: 'help', default: true, choices: [[true, 'Sí'], [false, 'No']] },
];
test('room choices normalize missing snapshots and preserve typed false values', () => {
  assert.deepEqual(optionDefaults(fields), { mode: 'normal', rounds: 3, help: true });
  assert.deepEqual(normalizeRoomOptions(fields, { mode: 'invalid', rounds: 6, help: false, extra: 4 }), { mode: 'normal', rounds: 6, help: false });
});
test('room patches reject malformed and mixed invalid input atomically', () => {
  const before = optionDefaults(fields);
  for (const patch of [null, [], 'fast', {}, { rounds: '6' }, { help: 0 }, { mode: 'fast', extra: true }, { rounds: 6, help: 'false' }]) assert.equal(applyRoomOptions(fields, before, patch), null);
  assert.deepEqual(before, optionDefaults(fields));
  assert.deepEqual(applyRoomOptions(fields, before, { help: false, rounds: 6 }), { mode: 'normal', rounds: 6, help: false });
});
