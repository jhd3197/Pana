// A controller plays Capis like Pepazo: RT / R2 charges and fires, A / Cross
// jumps (playtest: firing on A felt wrong, jump belongs on the bottom button).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPad, playKeys } from '/engine/gamepad.js';
import { PAD } from '../public/pad.js';
import page from '../public/instructions.js';

const ORDER = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
const pad = (held = [], values = {}) => readPad({ buttons: ORDER.map(n => ({ pressed: held.includes(n), value: values[n] ?? (held.includes(n) ? 1 : 0) })), axes: [0, 0, 0, 0] });
const keys = (...held) => [...playKeys(pad(held), PAD)];

test('RT charges and fires (Space), A jumps (Enter), Y shows the map', () => {
  assert.deepEqual(keys('rt'), ['Space']);
  assert.deepEqual(keys('a'), ['Enter']);
  assert.deepEqual(keys('y'), ['KeyZ']);
  assert.deepEqual(keys('b'), [], 'B no longer jumps: it stays the menu back button');
  assert.deepEqual(keys('x'), [], 'X (Square) never fires');
});

test('a half-pulled trigger already charges, a resting one does not', () => {
  assert.deepEqual([...playKeys(pad([], { rt: .6 }), PAD)], ['Space']);
  assert.deepEqual([...playKeys(pad([], { rt: .1 }), PAD)], []);
});

test('the Instrucciones page names the same buttons', () => {
  const rows = page.sections.flatMap(s => s.rows);
  const fire = rows.find(r => r.keyboard?.includes('Clic')), jump = rows.find(r => r.keyboard === 'Enter / J');
  assert.equal(fire.gamepad, 'RT');
  assert.equal(jump.gamepad, 'A');
  for (const [button, [code]] of Object.entries(PAD.keys)) assert.ok(['rt', 'a', 'y'].includes(button), `${button} → ${code}`);
});
