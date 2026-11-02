import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInstructions, fromLegacy, rowKey, sectionsFor, devicesFor, loadInstructions, DEVICES } from '../controls-page.js';

const DATA = normalizeInstructions({
  goal: ' Llega primero. ',
  howTo: 'Una frase.',
  sections: [
    { title: 'Moverte', rows: [
      { action: 'Caminar', keyboard: 'W A S D / Flechas', gamepad: 'Stick izq.', touch: 'Joystick' },
      { action: 'Saltar', keyboard: 'Espacio', gamepad: 'A' },
      { action: '', keyboard: 'X' },
    ] },
    { title: 'Vacía', rows: [] },
    { title: 'Solo teclado', rows: [{ action: 'Tabla', keyboard: 'Tab', gamepad: null, touch: '' }] },
  ],
  tips: ['', 'Un consejo.'],
});
const ps = text => ({ A: 'Cruz', 'Stick izq.': 'Joystick izq.' })[text] ?? text;

test('normalize trims text and drops empty parts', () => {
  assert.equal(DATA.goal, 'Llega primero.');
  assert.deepEqual(DATA.howTo, ['Una frase.'], 'a single paragraph becomes a list');
  assert.deepEqual(DATA.tips, ['Un consejo.']);
  assert.deepEqual(DATA.sections.map(s => s.title), ['Moverte', 'Solo teclado'], 'sections without rows are gone');
  assert.equal(DATA.sections[0].rows.length, 2, 'rows without an action are gone');
  assert.equal(DATA.sections[1].rows[0].touch, null, 'an empty key is no key');
  assert.deepEqual(normalizeInstructions(null), { goal: '', howTo: [], sections: [], tips: [] });
});

test('a row shows the key of the device, formatted for pads only', () => {
  const walk = DATA.sections[0].rows[0];
  assert.equal(rowKey(walk, 'keyboard', ps), 'W A S D / Flechas');
  assert.equal(rowKey(walk, 'gamepad', ps), 'Joystick izq.');
  assert.equal(rowKey(walk, 'touch', ps), 'Joystick');
  assert.equal(rowKey(DATA.sections[0].rows[1], 'touch'), null);
  assert.equal(rowKey(walk, 'mystery'), 'W A S D / Flechas', 'an unknown device falls back to the keyboard');
});

test('sections for a device skip rows and sections it cannot use', () => {
  assert.deepEqual(sectionsFor(DATA, 'touch').map(s => s.rows.map(r => r.action)), [['Caminar']]);
  assert.deepEqual(sectionsFor(DATA, 'gamepad', { format: ps }).flatMap(s => s.rows.map(r => r.key)), ['Joystick izq.', 'Cruz']);
  assert.equal(sectionsFor(DATA, 'keyboard').length, 2);
});

test('a pad falls back to the menu pad setup when the data names no buttons', () => {
  const keysOnly = normalizeInstructions({ sections: [{ title: 'T', rows: [{ action: 'Disparar', keyboard: 'Clic' }] }] });
  const padRows = [['RT', 'Disparar'], ['Start', 'Menú']];
  const sections = sectionsFor(keysOnly, 'gamepad', { format: ps, padRows });
  assert.deepEqual(sections[0].rows, [{ action: 'Disparar', key: 'RT' }, { action: 'Menú', key: 'Start' }]);
  assert.deepEqual(sectionsFor(DATA, 'gamepad', { padRows }).flatMap(s => s.rows.map(r => r.action)), ['Caminar', 'Saltar'], 'declared buttons win');
  assert.deepEqual(devicesFor(keysOnly, 'keyboard'), ['keyboard']);
  assert.deepEqual(devicesFor(keysOnly, 'keyboard', { padRows }), ['keyboard', 'gamepad']);
  assert.deepEqual(devicesFor(keysOnly, 'touch'), ['keyboard', 'touch'], 'the device in use always has a view');
  assert.deepEqual(devicesFor(DATA, 'keyboard'), DEVICES);
});

test('older menus keep their controls and tips on the page', () => {
  const data = fromLegacy({ controls: [['W A S D', 'Moverte'], ['M', '']], tips: ['Juega.'] });
  assert.deepEqual(data.sections[0].rows, [{ action: 'Moverte', keyboard: 'W A S D', gamepad: null, touch: null }]);
  assert.deepEqual(data.tips, ['Juega.']);
  assert.deepEqual(fromLegacy().sections, []);
});

test('instructions load from data, a function or a promise', async () => {
  assert.deepEqual(await loadInstructions({ goal: 'a' }), { goal: 'a' });
  assert.deepEqual(await loadInstructions(() => ({ goal: 'b' })), { goal: 'b' });
  assert.deepEqual(await loadInstructions(async () => ({ goal: 'c' })), { goal: 'c' });
  assert.equal(await loadInstructions(null), null);
});
