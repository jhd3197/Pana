import test from 'node:test';
import assert from 'node:assert/strict';
import { embusteOptions, defaultEmbusteOptions } from '../public/options.js';
test('room choices preserve explicit false and reject non-boolean or unknown options atomically', () => {
  const current = defaultEmbusteOptions();
  assert.deepEqual(embusteOptions(current, { bots: false, chat: false }), { bots: false, reveal: true, chat: false });
  for (const patch of [null, [], {}, { chat: 'false' }, { bots: 0 }, { reveal: false, tasks: 0 }]) assert.equal(embusteOptions(current, patch), null);
});
