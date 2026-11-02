import test from 'node:test';
import assert from 'node:assert/strict';
// Imported before the fake DOM below exists, so it does not load engine/gamepad.js.
import { hintKey, hintRows, createHintMemory, mountControlHints, keyFor } from '../control-hints.js';

const HINTS = [
  { id: 'fire', label: 'pintar', keys: { keyboard: 'Clic', gamepad: 'RT', touch: null } },
  { id: 'look', label: 'mirar', keys: { keyboard: 'Ratón', gamepad: 'Stick der.', touch: 'Arrastra' } },
  { id: 'reload', label: 'recargar', keys: { keyboard: 'R', gamepad: 'X' } },
];
const ps = text => ({ RT: 'R2', X: 'Cuadrado' })[text] ?? text;

function fakeStorage(start = {}) {
  const data = { ...start };
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('a hint shows the key of the device in use', () => {
  assert.equal(hintKey(HINTS[0], 'keyboard'), 'Clic');
  assert.equal(hintKey(HINTS[0], 'gamepad'), 'RT');
  assert.equal(hintKey(HINTS[0], 'gamepad', ps), 'R2', 'controller keys go through the family format');
  assert.equal(hintKey(HINTS[0], 'keyboard', ps), 'Clic', 'keyboard keys are never reformatted');
  assert.equal(hintKey(HINTS[0], 'touch'), null, 'no key on a device hides the hint there');
  assert.equal(hintKey(HINTS[2], 'touch'), null);
  assert.equal(hintKey(HINTS[1], 'mystery'), 'Ratón', 'an unknown device falls back to the keyboard');
});

test('rows list only the hints the device can do', () => {
  assert.deepEqual(hintRows(HINTS, 'touch').map(r => r.id), ['look']);
  assert.deepEqual(hintRows(HINTS, 'gamepad', ps).map(r => r.key), ['R2', 'Stick der.', 'Cuadrado']);
});

test('dismissed hints persist in storage and come back on the next page', () => {
  const storage = fakeStorage();
  const memory = createHintMemory(storage, 'pana:hints:x');
  assert.deepEqual(memory.fresh(HINTS).map(h => h.id), ['fire', 'look', 'reload']);
  memory.dismiss('fire', 'look');
  assert.deepEqual(JSON.parse(storage.data['pana:hints:x']), ['fire', 'look']);
  const again = createHintMemory(storage, 'pana:hints:x');
  assert.ok(again.has('fire'));
  assert.deepEqual(again.fresh(HINTS).map(h => h.id), ['reload']);
});

test('storage that throws or holds junk falls back to memory', () => {
  const broken = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  const memory = createHintMemory(broken);
  assert.doesNotThrow(() => memory.dismiss('fire'));
  assert.ok(memory.has('fire'), 'still remembered for this page');
  assert.ok(!createHintMemory(fakeStorage({ 'pana:hints': '{not json' })).has('fire'));
  assert.ok(!createHintMemory(null).has('fire'));
});

// Just enough DOM for the mounted line.
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.textContent = ''; this.hidden = false; this.classList = new Set(); this.attrs = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(k, v) { this.attrs[k] = v; }
}
const listeners = {};
globalThis.document = { documentElement: { dataset: { panaInput: 'keyboard' } }, createElement: tag => new El(tag) };
globalThis.addEventListener = (type, fn) => { (listeners[type] ||= new Set()).add(fn); };
globalThis.removeEventListener = (type, fn) => listeners[type]?.delete(fn);
const fire = (type, event = {}) => { for (const fn of listeners[type] || []) fn({ type, ...event }); };
const keys = node => node.children.map(item => item.children[0].textContent);

test('the line shows once, and any input dismisses it for the session', () => {
  const storage = fakeStorage(), node = new El('div');
  const hints = mountControlHints(node, { game: 'g', hints: HINTS, timeout: 0, storage });
  assert.equal(node.hidden, true, 'nothing until play starts');
  assert.equal(hints.show(), true);
  assert.deepEqual(keys(node), ['Clic', 'Ratón', 'R']);
  assert.ok(node.classList.has('pk-control-hints'));
  fire('keydown', { repeat: true });
  assert.equal(node.hidden, false, 'a held key repeating is not a new press');
  fire('pointerdown');
  assert.equal(node.hidden, true, 'a click dismisses it');
  assert.equal(hints.show(), false, 'and it never comes back this session');
  const reloaded = mountControlHints(new El('div'), { game: 'g', hints: HINTS, timeout: 0, storage });
  assert.equal(reloaded.show(), false, 'not after a reload either');
  hints.dispose(); reloaded.dispose();
});

test('doing the hinted action dismisses that hint', () => {
  const node = new El('div'), hints = mountControlHints(node, { game: 'h', hints: HINTS, timeout: 0, storage: fakeStorage() });
  hints.show();
  hints.done('fire');
  assert.deepEqual(keys(node), ['Ratón', 'R']);
  hints.done('look'); hints.done('reload');
  assert.equal(node.hidden, true);
  hints.dispose();
});

test('a touch press or a controller key press dismisses too; disposed lines stop listening', () => {
  for (const type of ['touchstart', 'keydown']) {
    const node = new El('div'), hints = mountControlHints(node, { game: type, hints: HINTS, timeout: 0, storage: fakeStorage() });
    hints.show(); fire(type);
    assert.equal(node.hidden, true, type);
    hints.dispose();
  }
  assert.equal([...Object.values(listeners)].reduce((n, set) => n + set.size, 0), 0);
});

test('the line uses the device the page reports', () => {
  document.documentElement.dataset.panaInput = 'touch';
  const node = new El('div'), hints = mountControlHints(node, { game: 't', hints: HINTS, timeout: 0, storage: fakeStorage() });
  hints.show();
  assert.deepEqual(keys(node), ['Arrastra']);
  assert.equal(node.dataset.device, 'touch');
  assert.equal(keyFor({ keyboard: 'R', gamepad: 'X', touch: null }), null);
  document.documentElement.dataset.panaInput = 'gamepad';
  assert.equal(keyFor({ keyboard: 'R', gamepad: 'X', touch: null }), 'X');
  document.documentElement.dataset.panaInput = 'keyboard';
  hints.dispose();
});

test('a line with a timeout hides by itself', async () => {
  const node = new El('div'), hints = mountControlHints(node, { game: 'time', hints: HINTS, timeout: 5, storage: fakeStorage() });
  hints.show();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(node.hidden, true);
  hints.dispose();
});
