import test from 'node:test';
import assert from 'node:assert/strict';
import { pickVariant, distanceGain, panFor, createSampleBank } from '../sample-bank.js';
import { rng } from '../random.js';

test('a variant never repeats the last one and every take gets played', () => {
  const R = rng(5);
  for (const count of [2, 3, 5]) {
    let last = -1; const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const next = pickVariant(count, last, R);
      assert.ok(next >= 0 && next < count, `in range: ${next}`);
      assert.notEqual(next, last);
      seen.add(next); last = next;
    }
    assert.equal(seen.size, count);
  }
});

test('a single take, or none, always picks the first', () => {
  assert.equal(pickVariant(1, 0), 0);
  assert.equal(pickVariant(0, -1), 0);
  assert.equal(pickVariant(3, -1, () => .9999999), 2);
  assert.equal(pickVariant(3, 2, () => .9999999), 1);
});

test('distance gain: full up close, silent past the range, falling between', () => {
  assert.equal(distanceGain(0), 1);
  assert.equal(distanceGain(1, { near: 1 }), 1);
  assert.equal(distanceGain(20, { range: 20 }), 0);
  assert.equal(distanceGain(50, { range: 20 }), 0);
  let before = 1;
  for (let d = 1.5; d < 20; d += .5) { const g = distanceGain(d, { range: 20 }); assert.ok(g < before && g > 0, `falls at ${d}`); before = g; }
  assert.ok(Math.abs(distanceGain(10.5, { near: 1, range: 20, curve: 1 }) - .5) < 1e-9);
});

test('pan: right is positive, behind and ahead are centred', () => {
  const me = { x: 0, z: 0, yaw: 0 };   // facing +z
  assert.ok(panFor(me, -5, 0) > .8, 'a point at -x is on the right when facing +z');
  assert.ok(panFor(me, 5, 0) < -.8);
  assert.ok(Math.abs(panFor(me, 0, 5)) < 1e-9);
  assert.ok(Math.abs(panFor(me, 0, -5)) < 1e-9);
  assert.equal(panFor(me, 0, 0), 0);
  assert.ok(panFor({ x: 0, z: 0, yaw: Math.PI }, -5, 0) < -.8, 'turning round swaps the sides');
});

test('without an audio context the bank stays silent and never throws', () => {
  const bank = createSampleBank({ ctx: null, muted: false }, 'http://x/audio/', { step: ['a', 'b'] });
  assert.equal(bank.play('step'), false);
  assert.equal(bank.play('missing'), false);
  assert.equal(bank.preload(), false);
  const bed = bank.bed('step'); bed.set(.5); assert.equal(bed.playing, false);
});
