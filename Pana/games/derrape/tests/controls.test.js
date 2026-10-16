import test from 'node:test';
import assert from 'node:assert/strict';
import { padInput, pressed, keyInput, SPLIT_KEYS, wrongWayStep, lapSplit } from '../public/controls.js';

const pad = (buttons = {}, axes = [0, 0]) => ({
  axes, buttons: Array.from({ length: 17 }, (_, i) => buttons[i] != null ? { pressed: buttons[i] > 0.5, value: buttons[i] } : { pressed: false, value: 0 }),
});

test('triggers drive, the stick steers (left is positive), RB drifts', () => {
  assert.equal(padInput(pad({ 7: 1 })).throttle, 1);
  assert.equal(padInput(pad({ 6: 1 })).throttle, -1);
  assert.equal(padInput(pad({}, [-1, 0])).steer, 1);
  assert.equal(padInput(pad({}, [0.1, 0])).steer, 0, 'dead zone');
  assert.equal(padInput(pad({ 14: 1 })).steer, 1, 'd-pad left');
  assert.equal(padInput(pad({ 5: 1 })).drift, true);
  assert.equal(padInput(null), null);
});

test('item buttons fire once per press', () => {
  const a = padInput(pad({ 4: 1 })), b = padInput(pad({ 4: 1 }));
  assert.equal(pressed(a, null).item, true);
  assert.equal(pressed(b, a).item, false);
});

test('split screen: each driver has their own keys', () => {
  const codes = { KeyW: true, ArrowLeft: true };
  assert.deepEqual(keyInput(codes, SPLIT_KEYS[1]), { throttle: 1, steer: 0, drift: false, look: false });
  assert.deepEqual(keyInput(codes, SPLIT_KEYS[2]), { throttle: 0, steer: 1, drift: false, look: false });
});

test('wrong way builds while heading against the road, fades otherwise', () => {
  let t = 0;
  for (let i = 0; i < 70; i++) t = wrongWayStep(t, Math.PI, 0, 20, 1 / 60);
  assert.ok(t > 1);
  assert.equal(wrongWayStep(0.5, 0, 0, 20, 1), 0);
  assert.equal(wrongWayStep(0, Math.PI, 0, 1, 1), 0, 'too slow to matter');
});

test('lap splits mark the best lap', () => {
  const splits = [];
  assert.deepEqual(lapSplit(splits, 40), { lap: 40, best: true });
  assert.deepEqual(lapSplit(splits, 78), { lap: 38, best: true });
  assert.equal(lapSplit(splits, 120).best, false);
});
