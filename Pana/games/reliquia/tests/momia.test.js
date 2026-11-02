// The gaunt mummy's motion (engine/models/props/gaunt-pose.js): finite at any
// time, its own rhythm per seed, frozen in the beam, tame under Sustos.
// The model itself (height, draws, the default mummy unchanged) is checked
// in momia.browser.mjs, where Three.js loads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGauntPose } from '../../../engine/models/props/gaunt-pose.js';

const run = (motion, seconds, opts, from = 0, step = 1 / 60) => { let p; for (let t = from; t < from + seconds; t += step) p = motion.update(t, opts); return p; };
const finite = p => Object.entries(p).every(([k, v]) => Number.isFinite(v) || assert.fail(`${k} = ${v}`));

test('every field stays finite for idle, chasing, winding and odd times', () => {
  const motion = createGauntPose({ seed: 7 });
  for (const t of [0, .016, 1, 3.3, 10, 1e4, 1e4 + .5, NaN, Infinity, -5]) finite(motion.update(t, { moving: true, look: .4 }));
  finite(run(motion, 6, { moving: false, look: -.8 }, 2e4));
  finite(run(motion, 6, { moving: true, look: 3, lit: 'dark' }, 2e4 + 6));
  finite(run(motion, 1, { winding: true, look: NaN }, 2e4 + 12));
  finite(run(motion, 2, { frozen: true, look: .2 }, 2e4 + 13));
});

test('each seed moves on its own rhythm; the same seed repeats', () => {
  const pose = seed => ({ ...run(createGauntPose({ seed }), 4, { moving: true }) });
  assert.deepEqual(pose(3), pose(3));
  assert.notDeepEqual(pose(3), pose(4));
});

test('chasing it lurches low with an arm reaching; winding raises both arms', () => {
  const motion = createGauntPose({ seed: 11 }), idle = { ...run(motion, 3, {}) };
  const chase = { ...run(motion, 3, { moving: true }, 3) };
  assert.ok(chase.spineRx > idle.spineRx + .15, 'torso lower and forward');
  assert.ok(Math.min(chase.lArmRx + chase.spineRx, chase.rArmRx + chase.spineRx) < -.9, 'one arm reaches ahead');
  assert.ok(motion.strides >= 2, 'it walks');
  const wind = run(motion, .7, { winding: true }, 6);
  assert.ok(wind.lArmRx < -1.8 && wind.rArmRx < -1.8, 'arms raised');
  assert.ok(wind.jawRx > .35, 'jaw drops');
});

test('in the beam it holds still and only the head turns to you', () => {
  const motion = createGauntPose({ seed: 5 }), before = { ...run(motion, 2, { moving: true }) };
  const after = run(motion, 2, { frozen: true, look: .9 }, 2);
  for (const k of Object.keys(before)) if (!['headRy', 'eye', 'shade'].includes(k)) assert.equal(after[k], before[k], k);
  assert.ok(after.headRy > .6, 'head follows');
  assert.equal(after.eye, 1);
});

test('the eyes gutter only in the dark on normales; suaves twitches less', () => {
  const darkest = (scares, lit = 'dark') => { const m = createGauntPose({ seed: 9 }); let low = 1; for (let t = 0; t < 40; t += 1 / 60) low = Math.min(low, m.update(t, { lit, scares }).eye); return low; };
  assert.ok(darkest('normal') < .1);
  assert.ok(darkest('normal', 'beam') > .6);
  assert.ok(darkest('suaves') > .6 && darkest('apagados') > .6);
  const range = scares => { const m = createGauntPose({ seed: 2 }); let lo = 9, hi = -9; for (let t = 0; t < 60; t += 1 / 30) { const v = m.update(t, { scares }).headRy; lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
  assert.ok(range('suaves') < range('normal'));
  assert.ok(range('apagados') < range('suaves'));
});
