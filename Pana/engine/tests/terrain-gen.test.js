import test from 'node:test';
import assert from 'node:assert/strict';
import { createMask, fillHeights, fill, carve, solidAt } from '../play/terrain-mask.js';
import { seededStream, bumps, dropFloating, walkSpans, walkTo, skyExposure, headroom, topLine, floorGraph, coverToward, relief } from '../play/terrain-gen.js';

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

test('floorGraph walks slopes and tunnels, drops off ledges one way, hops small gaps, never into the water', () => {
  // A hill with a tunnel through it, ground both sides.
  const m = ground(x => 10 + Math.max(0, 12 - Math.abs(x - 30) * 1.6), 60);
  for (let x = 18; x <= 42; x += .2) carve(m, x, 11.2, 1.3);
  const g = floorGraph(m, { water: 4 });
  const left = g.near(10, 10), right = g.near(50, 10), inside = g.near(30, 10, 1.2);
  assert.ok(left >= 0 && right >= 0 && inside >= 0, 'floors on both sides and in the tunnel');
  assert.ok(g.reach(left)[right] && g.reach(right)[left], 'walked through both ways');
  assert.ok(g.reach(left)[inside]);
  assert.ok(Math.abs(g.distance(left, right) - 40) < 2, `about 40 units walked (${g.distance(left, right)})`);
  assert.ok(g.layered > 0, 'the tunnel puts two floors in some columns');
  // A wall of 3 is dropped down but not climbed back; a step of 0.8 is hopped, not walked.
  const step = ground(x => x < 30 ? 13 : 10, 60), s = floorGraph(step, { water: 4 });
  const top = s.near(20, 13), low = s.near(40, 10);
  assert.ok(s.reach(top)[low] && !s.reach(low)[top], 'one way down');
  const small = ground(x => x < 30 ? 10.8 : 10, 60), h = floorGraph(small, { water: 4 });
  assert.ok(h.reach(h.near(40, 10))[h.near(20, 10.8)], 'hopped up');
  assert.ok(!h.reach(h.near(40, 10), { hops: false })[h.near(20, 10.8)], 'not walked up');
  // A gap of water 1.4 wide is hopped; one of 6 is not.
  const gap = w => { const k = ground(x => Math.abs(x - 30) < w / 2 ? 2 : 10, 60); const f = floorGraph(k, { water: 4 }); return f.reach(f.near(20, 10))[f.near(40, 10)]; };
  assert.ok(gap(1.4)); assert.ok(!gap(6));
});

test('cover towards a side sees a wall on that side only; relief measures the dry top', () => {
  const m = ground(x => x > 24 && x < 26 ? 16 : 10);
  assert.ok(coverToward(m, 22, 10.8, 1) > .4, 'a wall to the right shelters from the right');
  assert.equal(coverToward(m, 22, 10.8, -1), 0, 'open to the left');
  const r = relief(m, { water: 4 });
  assert.ok(Math.abs(r.relief - 6) < .3 && r.land === 1);
  const flat = relief(ground(() => 10), { water: 4 });
  assert.ok(flat.relief < .2 && flat.bumpy < .05);
});
