import test from 'node:test';
import assert from 'node:assert/strict';
import { createMask, fillHeights, fill, carve, solidAt } from '../play/terrain-mask.js';
import { seededStream, bumps, dropFloating, walkSpans, walkTo, skyExposure, headroom, topLine } from '../play/terrain-gen.js';

const ground = (heightAt, width = 60) => { const m = createMask({ width, height: 30, cell: .1 }); fillHeights(m, heightAt); return m; };

test('a seeded stream replays from its key; another key gives another stream', () => {
  const a = seededStream('map:7:0'), b = seededStream('map:7:0'), c = seededStream('map:7:1');
  const xs = Array.from({ length: 5 }, a), ys = Array.from({ length: 5 }, b), zs = Array.from({ length: 5 }, c);
  assert.deepEqual(xs, ys); assert.notDeepEqual(xs, zs);
  assert.ok(xs.every(v => v >= 0 && v < 1));
});

test('bumps sum smooth hills and hollows', () => {
  const hills = [{ at: 10, height: 4, width: 3 }, { at: 30, height: -2, width: 5 }];
  assert.ok(Math.abs(bumps(10, hills) - 4) < 1e-3 && Math.abs(bumps(30, hills) + 2) < 1e-3 && Math.abs(bumps(50, hills)) < 1e-3);
});

test('dropFloating removes specks in the air and reports pieces too big to drop', () => {
  const m = ground(() => 10);
  fill(m, 20, 20, .5);          // a speck
  fill(m, 40, 20, 3);           // a big floating blob
  fill(m, 10, 10.5, 1);         // a bump on the ground: joined, stays
  const r = dropFloating(m, 200);
  assert.ok(r.removed > 0 && !solidAt(m, 20, 20), 'the speck is gone');
  assert.equal(r.floating.length, 1); assert.ok(solidAt(m, 40, 20), 'the big blob is reported, not removed');
  assert.ok(solidAt(m, 10, 11), 'ground joined to the bottom stays');
  assert.equal(dropFloating(m, 1e9).floating.length, 0);
});

test('walk spans break at walls and water; walkTo goes down ledges but not up walls', () => {
  // Flat, a wall up to a plateau at 30, water from 45.
  const m = ground(x => x < 30 ? 10 : x < 45 ? 16 : 2);
  const spans = walkSpans(m, { water: 4 });
  assert.notEqual(spans.at(10), spans.at(35), 'the wall splits the ground');
  assert.equal(spans.at(50), -1, 'the water is no stretch');
  assert.ok(Math.abs(walkTo(m, 10, 1, { water: 4 }) - 30) < .5, 'stops at the wall');
  assert.ok(Math.abs(walkTo(m, 40, -1, { water: 4 })) < .5, 'goes down the ledge to the end');
  assert.ok(Math.abs(walkTo(m, 35, 1, { water: 4 }) - 45) < .5, 'stops at the water');
  // A gentle hill and a small step join; the top line follows the ground.
  const hill = ground(x => 10 + Math.sin(x * .2) * 2 + (x > 30 ? .6 : 0));
  assert.equal(walkSpans(hill).spans.length, 1);
  assert.ok(Math.abs(topLine(hill)[50] - (10 + Math.sin(10.1 * .2) * 2)) < .15);
});

test('sky exposure and headroom see a roof', () => {
  const m = ground(() => 10);
  assert.equal(skyExposure(m, 20, 10.5), 1);
  assert.ok(headroom(m, 20, 10));
  fill(m, 20, 13, 1.5);   // a ledge over the spot (joined to nothing: we only test the rays)
  assert.ok(skyExposure(m, 20, 10.5) < .8);
  assert.equal(headroom(m, 20, 10), false);
  carve(m, 20, 13, 2);
  assert.equal(skyExposure(m, 20, 10.5), 1);
});
