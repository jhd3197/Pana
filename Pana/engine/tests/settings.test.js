import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeSettings, inputAxis, getSettings, setSettings, resetInputSettings } from '/engine/settings.js';
import { controllerFamily, formatPadLabel, readPad, playKeys } from '/engine/gamepad.js';
import { padInput } from '../../games/carreritas/public/controls.js';

test('saved input settings reject malformed values and clamp usable ranges', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULTS);
  assert.equal(normalizeSettings({quality:'toString'}).quality, DEFAULTS.quality);
  const s = normalizeSettings({ mouseSensitivity: 100, padDeadzone: -.2, padVertical: NaN, padFamily: 'bad', mouseInvertY: 'yes', padCurve: 'suave', quality: 'baja' });
  assert.equal(s.mouseSensitivity, 3); assert.equal(s.padDeadzone, 0);
  assert.equal(s.padVertical, 1); assert.equal(s.padFamily, 'auto');
  assert.equal(s.mouseInvertY, false); assert.equal(s.padCurve, 'suave'); assert.equal(s.quality, 'baja');
});

test('deadzone removes drift, curves stay symmetric and camera speed scales full travel', () => {
  const s = { ...DEFAULTS, padDeadzone: .2 };
  assert.equal(inputAxis(.19, s), 0); assert.equal(inputAxis(-.2, s), 0);
  assert.ok(Math.abs(inputAxis(.6, s) - .5) < 1e-10);
  assert.equal(inputAxis(-.6, s), -inputAxis(.6, s));
  assert.ok(inputAxis(.6, { ...s, padCurve: 'suave' }) < inputAxis(.6, s));
  assert.ok(inputAxis(.6, { ...s, padCurve: 'rapida' }) > inputAxis(.6, s));
  assert.equal(inputAxis(1, { ...s, padLookSensitivity: 3 }, 'look'), 3);
  assert.equal(inputAxis(1, { ...s, padMoveSensitivity: 2 }), 1);
  assert.equal(inputAxis(NaN, s), 0);
});

test('native driving and translated game controls consume the same tuning', () => {
  const raw = { axes: [.6, 0, 0, 0], buttons: [] }, s = { ...DEFAULTS, padDeadzone: .2 };
  assert.ok(Math.abs(padInput(raw, s).steer + readPad(raw, s).left.x) < 1e-10);
  const low = readPad({ axes: [1, 0], buttons: [] }, { ...s, padMoveSensitivity: .5 });
  assert.ok(playKeys(low, { move: 'wasd' }).has('KeyD'), 'minimum sensitivity still permits movement');
});

test('controller labels follow family without relabeling action prose', () => {
  assert.equal(controllerFamily('Sony DualSense (054c)'), 'playstation');
  assert.equal(controllerFamily('Nintendo Switch Pro (057e)'), 'nintendo');
  assert.equal(controllerFamily('Xbox Wireless Controller'), 'xbox');
  assert.equal(controllerFamily('USB Gamepad'), 'generic');
  assert.equal(formatPadLabel('RT / A + Start', 'playstation'), 'R2 / Cruz + Options');
  assert.equal(formatPadLabel('A / B', 'nintendo'), 'B / A');
});

test('reset controls preserves audio, picture and the visibility preference', () => {
  setSettings({ sound: false, quality: 'baja', hints: false, mouseSensitivity: 2, padDeadzone: .4, inputHints: 'gamepad' });
  resetInputSettings(); const s = getSettings();
  assert.equal(s.mouseSensitivity, 1); assert.equal(s.padDeadzone, .18); assert.equal(s.inputHints, 'auto');
  assert.equal(s.sound, false); assert.equal(s.quality, 'baja'); assert.equal(s.hints, false);
  setSettings(DEFAULTS);
});
