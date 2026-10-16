import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceLap, ALL_SECTORS, SECTORS, plankHeight, isOpenEdge, offCourse, stuckStep, segmentPoint } from '../public/course-rules.js';

const TOTAL = 800;
// Drive c forward one full lap from prog `from` in small steps, as stepCar would.
const drive = (c, from) => {
  let prev = from;
  for (let d = 10; d <= TOTAL; d += 10) {
    const p = (from + d) % TOTAL;
    advanceLap(c, prev, p, TOTAL);
    prev = p;
  }
};

test('a full lap counts; the grid start counts as lap 1', () => {
  const c = { lap: 0 };
  advanceLap(c, TOTAL - 5, 3, TOTAL);
  assert.equal(c.lap, 1);
  drive(c, 3);
  assert.equal(c.lap, 2);
});

test('rocking back and forth over the line never gains a lap', () => {
  const c = { lap: 1, sectors: ALL_SECTORS };
  for (let i = 0; i < 5; i++) {
    advanceLap(c, 5, TOTAL - 5, TOTAL);
    advanceLap(c, TOTAL - 5, 5, TOTAL);
  }
  assert.equal(c.lap, 1);
});

test('a shortcut that skips one checkpoint still counts; skipping half the lap does not', () => {
  const c = { lap: 1, sectors: 1 };
  // skip sector 3 only
  for (const p of [150, 250, 450, 550, 650, 750]) advanceLap(c, p - 100, p, TOTAL);
  advanceLap(c, 790, 5, TOTAL);
  assert.equal(c.lap, 2);
  const cheat = { lap: 1, sectors: 1 };
  advanceLap(cheat, 50, 700, TOTAL - 1);   // a teleport across half the lap
  advanceLap(cheat, 790, 5, TOTAL);
  assert.equal(cheat.lap, 1);
  assert.equal(SECTORS, 8);
});

test('plank roads have an arched deck and a width', () => {
  const sc = { a: { x: 0, z: 0, y: 1 }, b: { x: 100, z: 0, y: 3 }, w: 6, arch: 2 };
  assert.ok(Math.abs(plankHeight(sc, 50, 0) - 4) < 1e-9);
  assert.equal(plankHeight(sc, 50, 4), null);
  assert.equal(plankHeight(sc, -5, 0), null);
  assert.ok(Math.abs(segmentPoint(50, 3, 0, 0, 100, 0).d - 3) < 1e-9);
});

test('open edges cover lap ranges on one side, wrapping past the line', () => {
  const drops = [{ u0: 0.4, u1: 0.5, side: 1 }, { u0: 0.95, u1: 0.05, side: 0 }];
  assert.equal(isOpenEdge(drops, 0.45, 1), true);
  assert.equal(isOpenEdge(drops, 0.45, -1), false);
  assert.equal(isOpenEdge(drops, 0.02, -1), true);
  assert.equal(isOpenEdge(drops, 0.7, 1), false);
});

test('off the course past an open edge or far off the road, never on a plank', () => {
  assert.equal(offCourse(9.2, 8, true, false), true);
  assert.equal(offCourse(9.2, 8, false, false), false);
  assert.equal(offCourse(20, 8, false, false), true);
  assert.equal(offCourse(20, 8, false, true), false);
  assert.equal(stuckStep(1, 0.5, true, 0.5), 1.5);
  assert.equal(stuckStep(1, 9, true, 0.5), 0);
  assert.equal(stuckStep(1, 0, false, 0.5), 0);
});
