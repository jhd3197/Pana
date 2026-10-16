import test from 'node:test';
import assert from 'node:assert/strict';
import { Race, standings, cleanInput } from '../public/rules.js';
import { RIVER, GREYBOX } from '../public/river.js';

// A solo race (no bots) past the countdown. `pana(t)` returns strokes to send.
export function solo(river = RIVER, seed = 3) {
  const r = new Race(river); r.addPlayer(1, 'Pana'); r.start(false, seed);
  for (let t = 0; t < 3.1; t += .05) r.update(.05);
  return r;
}
// Drives player 1 with exact stroke times, `gap(i)` seconds apart.
export function row(r, seconds, { gap = () => .4, side = i => i % 2 ? 1 : -1, extra = {} } = {}) {
  const strokes = [], start = r.time;
  let next = r.time, i = 0;
  for (let t = 0; t < seconds; t += .05) {
    while (gap && next <= r.time + .05) { strokes.push([i + 1, side(i), next]); next += gap(i++); }
    r.update(.05, new Map([[1, { strokes: strokes.slice(-8), ...(typeof extra === 'function' ? extra(r.time - start) : extra) }]]));
  }
  return r.boats[0];
}

test('grey box: rhythm carries the canoe, mashing does not', () => {
  const a = row(solo(GREYBOX), 12), b = row(solo(GREYBOX), 12, { gap: () => .1 });
  assert.ok(a.progress > b.progress + 20, `${a.progress} vs ${b.progress}`);
  assert.ok(a.remazos > 20);
});

test('the current carries a stopped canoe downstream', () => {
  const r = solo(GREYBOX), b = r.boats[0], s = b.progress;
  row(r, 6, { gap: null });
  assert.ok(b.progress - s > 6 * 1.2, `drifted ${b.progress - s}`);
  assert.ok(Math.abs(b.v) < .01);
});

test('the countdown holds the canoes and swallows early strokes', () => {
  const r = new Race(GREYBOX); r.addPlayer(1, 'Pana'); r.start(false, 1);
  const b = r.boats[0], s = b.s;
  for (let t = 0; t < 2.9; t += .05) r.update(.05, new Map([[1, { strokes: [[1, -1, 0], [2, 1, .1], [3, -1, .2]] }]]));
  assert.equal(b.s, s); assert.equal(r.phase, 'countdown');
  r.update(.25, new Map([[1, { strokes: [[1, -1, 0], [2, 1, .1], [3, -1, .2]] }]]));
  assert.equal(b.strokes, 0);
});

test('back-paddling brakes', () => {
  const r = solo(GREYBOX), b = row(r, 4);
  const v = b.v; row(r, .6, { gap: null, extra: { back: true } });
  assert.ok(b.v < v - 1.2, `${v} → ${b.v}`);
});

test('banks keep the canoe in the river', () => {
  const r = solo(GREYBOX), b = row(r, 8, { side: () => 1, gap: () => .5 });
  assert.ok(Math.abs(r.river.locate(b.x, b.z).offset) <= r.river.halfWidth(b.s));
});

test('inputs are cleaned', () => {
  assert.deepEqual(cleanInput({ strokes: [[1, 5, .2], ['x', 1, 2], [2, -3, NaN]], steer: 9, back: 1, splash: '2' }), { strokes: [[1, 1, .2]], back: true, steer: 1, splash: 2 });
});

test('a grey-box race finishes, orders and replays from a snapshot', () => {
  const r = new Race(GREYBOX); r.addPlayer(1, 'Pana'); r.start(true, 9);
  assert.equal(r.boats.length, 8);
  for (let t = 0; t < 200 && r.phase !== 'finished'; t += .05) r.update(.05, new Map());
  assert.equal(r.phase, 'finished');
  assert.ok(r.boats.filter(b => b.finish !== null).length >= 7, 'bots finish');
  const ordered = standings(r); assert.ok(ordered[0].finish <= ordered[1].finish);
  const restored = Race.restore(r.snapshot(), new Map([[1, {}]]), GREYBOX);
  assert.deepEqual(restored.snapshot(), r.snapshot());
});
