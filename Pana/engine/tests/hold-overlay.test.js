import test from 'node:test';
import assert from 'node:assert/strict';
import { createHold, createHoldOverlay, holdKeyOf } from '../hold-overlay.js';

const key = (type, code, extra = {}) => Object.assign(new Event(type, { cancelable: true }), { code, key: code, ...extra });
function rig(options = {}) {
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { hidden: false, pointerLockElement: null });
  const changes = [];
  const info = createHoldOverlay({ keys: ['Tab'], target: win, doc, change: on => changes.push(on), ...options });
  return { win, doc, info, changes };
}

test('the layer is open while any source holds it, and reports only changes', () => {
  const seen = [], hold = createHold(on => seen.push(on));
  hold.press('key'); hold.press('key'); hold.press('touch');
  assert.equal(hold.held, true);
  hold.lift('key'); assert.equal(hold.held, true, 'the touch toggle still holds it');
  hold.toggle('touch'); assert.equal(hold.held, false);
  hold.toggle('touch'); hold.release();
  assert.deepEqual(seen, [true, false, true, false]);
});

test('a key matches by code or by key', () => {
  assert.equal(holdKeyOf({ code: 'Tab', key: 'Tab' }, ['Tab']), 'Tab');
  assert.equal(holdKeyOf({ code: 'KeyM', key: 'm' }, ['m']), 'm');
  assert.equal(holdKeyOf({ code: 'KeyE', key: 'e' }, ['Tab']), null);
});

test('holding Tab shows it, letting go hides it, and the browser never moves focus', () => {
  const { win, info, changes } = rig();
  const press = key('keydown', 'Tab');
  win.dispatchEvent(press);
  assert.equal(press.defaultPrevented, true);
  assert.equal(info.held, true);
  win.dispatchEvent(key('keydown', 'Tab', { repeat: true }));
  win.dispatchEvent(key('keyup', 'Tab'));
  assert.equal(info.held, false);
  assert.deepEqual(changes, [true, false]);
  const other = key('keydown', 'KeyE'); win.dispatchEvent(other);
  assert.equal(other.defaultPrevented, false); assert.equal(info.held, false);
});

test('a lost window, a hidden page or a lost pointer lock always lets go', () => {
  const { win, doc, info } = rig();
  win.dispatchEvent(key('keydown', 'Tab')); win.dispatchEvent(new Event('blur'));
  assert.equal(info.held, false, 'blur');
  win.dispatchEvent(key('keydown', 'Tab')); doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(info.held, false, 'visibilitychange'); doc.hidden = false;
  win.dispatchEvent(key('keydown', 'Tab')); doc.dispatchEvent(new Event('pointerlockchange'));
  assert.equal(info.held, false, 'pointer lock lost');
  doc.pointerLockElement = {}; win.dispatchEvent(key('keydown', 'Tab')); doc.dispatchEvent(new Event('pointerlockchange'));
  assert.equal(info.held, true, 'gaining the lock keeps it');
});

test('disabled (a menu is open) it leaves Tab alone, and check() hides it', () => {
  let allowed = false;
  const { win, info } = rig({ enabled: () => allowed });
  const press = key('keydown', 'Tab'); win.dispatchEvent(press);
  assert.equal(press.defaultPrevented, false, 'the menu keeps its own Tab');
  assert.equal(info.held, false);
  info.toggle(); assert.equal(info.held, false, 'no touch toggle while disabled');
  allowed = true; info.toggle(); assert.equal(info.held, true);
  allowed = false; info.check(); assert.equal(info.held, false);
});

test('typing in a field never opens it, and dispose stops listening', () => {
  const { win, info } = rig();
  const field = Object.assign(new EventTarget(), { tagName: 'INPUT' });
  const press = key('keydown', 'Tab'); Object.defineProperty(press, 'target', { value: field });
  win.dispatchEvent(press);
  assert.equal(info.held, false);
  info.dispose(); win.dispatchEvent(key('keydown', 'Tab'));
  assert.equal(info.held, false);
});
