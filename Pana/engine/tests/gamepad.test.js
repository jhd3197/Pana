import test from 'node:test';
import assert from 'node:assert/strict';
import { keyOf, readPad, playKeys, padHelp, activePad, padList } from '/engine/gamepad.js';

// A "standard" pad with these buttons held and these stick positions.
function pad(held = [], axes = [0, 0, 0, 0]) {
  const order = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
  return readPad({ buttons: order.map(name => ({ pressed: held.includes(name), value: held.includes(name) ? 1 : 0 })), axes });
}

test('codes become the key a game reads with e.key', () => {
  assert.equal(keyOf('Space'), ' ');
  assert.equal(keyOf('KeyW'), 'w');
  assert.equal(keyOf('Digit3'), '3');
  assert.equal(keyOf('ArrowLeft'), 'ArrowLeft');
  assert.equal(keyOf('ShiftLeft'), 'Shift');
});

test('the stick and d-pad hold the movement keys, past a dead zone', () => {
  assert.deepEqual([...playKeys(pad([], [.9, -.1]), { move: 'wasd' })], ['KeyD']);
  assert.deepEqual([...playKeys(pad([], [.3, .3]), { move: 'wasd' })], [], 'a resting stick drifts a little');
  assert.deepEqual([...playKeys(pad(['up', 'left']), { move: 'arrows' })].sort(), ['ArrowLeft', 'ArrowUp']);
});

test('two buttons on one key hold it once, and a triggered key needs no label', () => {
  const keys = { a: ['Space', 'Turbo'], rb: ['Space', 'Turbo'], x: 'KeyR' };
  assert.deepEqual([...playKeys(pad(['a', 'rb', 'x']), { keys })].sort(), ['KeyR', 'Space']);
  assert.equal(pad(['lt']).held.lt, true);
});

test('with HUD buttons, A and the d-pad stay with the buttons', () => {
  const keys = { a: ['Space', 'Tirar'], up: 'ArrowUp', x: ['KeyP', 'Pasar'] };
  assert.deepEqual([...playKeys(pad(['a', 'up', 'x']), { buttons: true, keys })], ['KeyP']);
});

test('the Controles tab lists each action once with all its buttons', () => {
  const rows = padHelp({ move: 'wasd', keys: { rt: ['KeyW', 'Acelerar'], a: ['KeyW', 'Acelerar'], x: 'KeyQ' } });
  assert.deepEqual(rows, [['Stick izq. / Cruceta', 'Moverte'], ['RT / A', 'Acelerar'], ['Start', 'Menú']]);
  assert.deepEqual(padHelp({ native: true, help: [['A', 'Golpe']] }), [['A', 'Golpe'], ['Start', 'Menú']]);
});

test('the controller in use wins over other devices Windows lists first', () => {
  const device = (index, id, mapping, axes = [0, 0, 0, 0]) => ({ index, id, mapping, connected: true, axes,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
  const hub = device(0, 'SV507 (Vendor: 2006)', '', [-1, .3]), xbox = device(1, 'Xbox Wireless Controller', 'standard');
  const sony = device(2, 'DualSense Wireless Controller', 'standard');
  const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [hub, xbox, null, sony] } });
  try {
    assert.equal(activePad().id, xbox.id, 'a standard pad before the device in slot 0');
    hub.buttons[0] = { pressed: true, value: 1 }; hub.axes = [1, 1];
    assert.equal(activePad().id, xbox.id, 'the other device cannot take over');
    sony.buttons[0] = { pressed: true, value: 1 };
    assert.equal(activePad().id, sony.id, 'the pad pressed last is the one in use');
    assert.deepEqual(padList().map(p => p.index), [1, 2, 0]);
  } finally {
    if (real) Object.defineProperty(globalThis, 'navigator', real); else delete globalThis.navigator;
  }
});
