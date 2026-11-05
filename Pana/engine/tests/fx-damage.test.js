import test from 'node:test';
import assert from 'node:assert/strict';
import { barTone, chunkTone, createBarModel, createKnock, fanAt, numberSize } from '../fx/damage.js';

const run = (model, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) model.step(dt); };

test('a hit leaves a chunk that holds a beat, then drains to the new value', () => {
  const bar = createBarModel();
  bar.set(70);
  run(bar, .2);
  assert.ok(bar.shown < 72, 'the fill falls almost at once');
  assert.equal(bar.trail, 100, 'the chunk still marks what was lost');
  run(bar, 2);
  assert.equal(bar.trail, 70);
  assert.equal(bar.shown, 70);
});

test('the chunk cools white, orange, red', () => {
  assert.deepEqual([chunkTone(0), chunkTone(.1), chunkTone(.3)], ['white', 'orange', 'red']);
});

test('a second hit during the hold keeps the whole chunk and restarts the beat', () => {
  const bar = createBarModel();
  bar.set(80); run(bar, .3);
  bar.set(60);
  assert.equal(bar.age, 0);
  assert.equal(bar.trail, 100);
});

test('a heal rises slowly and leaves no chunk behind', () => {
  const bar = createBarModel({ value: 40 });
  assert.equal(bar.set(70), 30);
  bar.step(1 / 60);
  assert.ok(bar.shown > 40 && bar.shown < 45, 'the fill climbs');
  run(bar, 3);
  assert.equal(bar.shown, 70);
  assert.equal(bar.trail, 70);
});

test('values stay inside the bar and a new round snaps', () => {
  const bar = createBarModel();
  bar.set(-20); assert.equal(bar.target, 0);
  bar.snap(100); assert.equal(bar.shown, 100); assert.equal(bar.trail, 100);
});

test('reduced motion skips the animation', () => {
  const bar = createBarModel({ reduced: true });
  bar.set(30);
  assert.equal(bar.shown, 30); assert.equal(bar.trail, 30);
});

test('the bar colour follows what is left', () => {
  assert.deepEqual([barTone(.9), barTone(.4), barTone(.2)], ['ok', 'warn', 'low']);
});

test('bigger hits draw bigger numbers, crits bigger still, and the fan spreads', () => {
  assert.ok(numberSize(30) > numberSize(5));
  assert.ok(numberSize(10, 'crit') > numberSize(10));
  assert.notEqual(Math.sign(fanAt(0)), Math.sign(fanAt(1)));
});

test('a knock returns to rest where it started', () => {
  const knock = createKnock();
  knock.kick(1, 0, 2);
  let peak = 0, at;
  for (let i = 0; i < 180; i++) { at = knock.step(1 / 60); peak = Math.max(peak, at.x); }
  assert.ok(peak > .05, 'it visibly moves');
  assert.deepEqual([Math.abs(at.x) < .01, Math.abs(at.z) < .01], [true, true]);
});
