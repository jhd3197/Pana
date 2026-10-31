import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, QUALITY, normalizeSettings, parseUrlSettings, inputAxis, getSettings, setSettings, resetInputSettings, pixelRatio, shadowSize } from '/engine/settings.js';
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

test('a picture preset sets its knobs and a hand-made change becomes custom', () => {
  const legacy = normalizeSettings({ quality: 'baja' });
  assert.deepEqual([legacy.resolution, legacy.shadows, legacy.detail], [1, 'baja', 'baja'], 'a preset saved before the knobs keeps meaning the same');
  setSettings({ quality: 'media' });
  assert.equal(getSettings().resolution, QUALITY.media.resolution);
  setSettings({ shadows: 'off' });
  assert.equal(getSettings().quality, 'custom'); assert.equal(getSettings().resolution, 1.5, 'other knobs stay');
  setSettings({ shadows: 'media' });
  assert.equal(getSettings().quality, 'media', 'matching every knob of a preset names it again');
  setSettings({ quality: 'baja', detail: 'alta' });
  assert.equal(getSettings().detail, 'alta', 'a knob named with a preset wins'); assert.equal(getSettings().quality, 'custom');
  assert.equal(normalizeSettings({ resolution: 3, shadows: 'ultra', fpsCap: 45 }).quality, DEFAULTS.quality, 'unknown values fall back');
  setSettings(DEFAULTS);
});

test('picture knobs drive pixel ratio and shadow size', () => {
  setSettings({ quality: 'alta', resolution: 1 });
  assert.equal(pixelRatio(2), Math.min(1, globalThis.devicePixelRatio || 1));
  setSettings({ shadows: 'media' }); assert.equal(shadowSize(2048), 1024);
  setSettings({ shadows: 'baja' }); assert.equal(shadowSize(1024), 256);
  setSettings(DEFAULTS);
});

test('settings in the address are parsed, validated and limited to this page', () => {
  assert.deepEqual(parseUrlSettings('?pana-quality=baja&pana-shadows=off&pana-autoscale=0&pana-stats&pana-fps=30&other=1'),
    { resolution: 1, shadows: 'off', detail: 'baja', autoScale: false, perfOverlay: true, fpsCap: 30 });
  assert.deepEqual(parseUrlSettings('?pana-resolution=7&pana-shadows=ultra&pana-sound=no'), { sound: false }, 'invalid values are dropped');
  assert.deepEqual(parseUrlSettings(''), {});
});
