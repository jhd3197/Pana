import test from 'node:test';
import assert from 'node:assert/strict';
import { createHitFeats, MULTI_WINDOW_MS } from '../public/feats.js';

// A fake feat() recording calls, and a clock the test advances by hand.
function rig() {
  const calls = [];
  let t = 0;
  const feats = createHitFeats((id, text) => { calls.push([id, text]); return true; }, { now: () => t });
  return { calls, feats, advance: (ms) => { t += ms; } };
}

test('a hit names the painted rival', () => {
  const { calls, feats } = rig();
  feats.hit('María');
  assert.deepEqual(calls, [['pintada:María', '¡Pintaste a María!']]);
});

test('two hits inside the window celebrate the double, three the triple', () => {
  const { calls, feats, advance } = rig();
  feats.hit('María');
  advance(1200); feats.hit('Juan');
  assert.deepEqual(calls[1], ['pintada:Juan', '¡Pintaste a Juan!']);
  assert.deepEqual(calls[2], ['doble', '¡Doble pintada!']);
  advance(1200); feats.hit('María');
  assert.deepEqual(calls[4], ['triple', '¡Triple pintada!']);
  assert.equal(calls.length, 5);   // the triple does not also fire the double
});

test('hits further apart than the window start the count over', () => {
  const { calls, feats, advance } = rig();
  feats.hit('María');
  advance(MULTI_WINDOW_MS + 100); feats.hit('Juan');
  advance(MULTI_WINDOW_MS + 100); feats.hit('Luis');
  assert.ok(!calls.some(([id]) => id === 'doble' || id === 'triple'));
});

test('a fourth quick hit does not pile on more multi feats', () => {
  const { calls, feats, advance } = rig();
  for (const name of ['A', 'B', 'C', 'D']) { feats.hit(name); advance(500); }
  assert.equal(calls.filter(([id]) => id === 'doble').length, 1);
  assert.equal(calls.filter(([id]) => id === 'triple').length, 1);
});

test('reset starts a new round clean', () => {
  const { calls, feats } = rig();
  feats.hit('María');
  feats.reset();
  feats.hit('Juan');
  assert.ok(!calls.some(([id]) => id === 'doble'));
});

test('a round win counts once until the next round resets', () => {
  const { feats } = rig();
  assert.equal(feats.win(), true);
  assert.equal(feats.win(), false);   // a results re-render must not recount
  feats.reset();
  assert.equal(feats.win(), true);
});

test('each rival painted reports one per-weapon event for the camo unlocks', () => {
  const events = [];
  const feats = createHitFeats(() => true, { now: () => 0, event: id => events.push(id) });
  feats.hit('María');
  assert.equal(feats.weaponHit('sniper'), true);
  assert.equal(feats.weaponHit('bat'), true);
  // Grenade blasts, unknown and missing ids count nothing.
  for (const id of ['pinita', 'nope', null, undefined, 3]) assert.equal(feats.weaponHit(id), false);
  assert.deepEqual(events, ['pintura.paint-hits', 'pintura.hits.sniper', 'pintura.hits.bat']);
});
