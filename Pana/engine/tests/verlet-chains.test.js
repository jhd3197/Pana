// The chain solver: links keep their length, walls push out, a scatter lets go
// and the chain pulls itself back together.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VerletChains } from '../play/verlet-chains.js';
import { bakeDistanceField } from '../play/distance-field.js';

const REST = .17, POINTS = 12;
const links = (chains, c) => { const out = [], s = c * chains.points; for (let i = 1; i < chains.points; i++) out.push(Math.hypot(chains.x[s + i] - chains.x[s + i - 1], chains.y[s + i] - chains.y[s + i - 1], chains.z[s + i] - chains.z[s + i - 1])); return out; };
const worst = (chains, c) => Math.max(...links(chains, c).map(l => Math.abs(l - chains.rest) / chains.rest));
const crawl = (chains, c, vx, vz, frames) => { for (let f = 0; f < frames; f++) { chains.nudge(c, vx * chains.h, vz * chains.h); chains.step(); } };
// A room with a wall sticking out of its north side at x = 10..11.
const room = (size = 20) => bakeDistanceField({ w: size * 4, h: size * 4, cell: .25, solid: (i, j) => i < 4 || j < 4 || i >= size * 4 - 4 || j >= size * 4 - 4 || (i > 40 && i < 44 && j < 60) });

test('links hold their length while the head crawls and turns', () => {
  const chains = new VerletChains({ chains: 1, points: POINTS, rest: REST });
  chains.place(0, 0, 0);
  crawl(chains, 0, 2.4, 0, 60);
  assert.ok(worst(chains, 0) < .06, `straight: ${worst(chains, 0)}`);
  for (let f = 0; f < 180; f++) { const a = f * .1; chains.nudge(0, Math.cos(a) * 2.4 * chains.h, Math.sin(a) * 2.4 * chains.h); chains.step(); }
  assert.ok(worst(chains, 0) < .08, `turning: ${worst(chains, 0)}`);
});

test('a chain laid out in a heap stretches to its full length', () => {
  const chains = new VerletChains({ chains: 1, points: POINTS, rest: REST });
  chains.place(0, 3, 3, 1, 0, 0);
  crawl(chains, 0, 2, 0, 90);
  assert.ok(worst(chains, 0) < .08, `${worst(chains, 0)}`);
});

test('the body follows the head: its tail ends up behind it', () => {
  const chains = new VerletChains({ chains: 1, points: POINTS, rest: REST });
  chains.place(0, 0, 0, -1, 0);
  crawl(chains, 0, 2, 0, 90);
  const head = chains.x[0], tail = chains.x[POINTS - 1];
  assert.ok(head > 5.5, `head at ${head}`);
  assert.ok(Math.abs(head - tail - REST * (POINTS - 1)) < .25, `tail at ${tail}`);
});

test('collision pushes points out of walls and keeps them out', () => {
  const field = room(), chains = new VerletChains({ chains: 1, points: POINTS, rest: REST, field, radius: .06 });
  // A point dropped inside the wall comes out on the first step.
  chains.place(0, .4, 5);
  chains.step();
  for (let i = 0; i < POINTS; i++) assert.ok(field.at(chains.x[i], chains.z[i]) >= .055, `point ${i}: ${field.at(chains.x[i], chains.z[i])}`);
  // Pressing against a wall for seconds never gets through.
  chains.place(0, 8, 8);
  for (let f = 0; f < 200; f++) {
    chains.nudge(0, 2.4 * chains.h, 0); chains.step();
    for (let i = 0; i < POINTS; i++) assert.ok(field.at(chains.x[i], chains.z[i]) >= .05, `frame ${f} point ${i}`);
  }
  assert.ok(chains.x[0] < 10.25, 'stopped by the inner wall');
});

test('dropped points stay finite in a heap; nothing is NaN after stacking', () => {
  const chains = new VerletChains({ chains: 2, points: POINTS, rest: REST, grid: { cell: .4, x0: -5, z0: -5, w: 30, h: 30 }, gap: .16 });
  chains.place(0, 1, 1, 0, 0, 0); chains.place(1, 1, 1, 0, 0, 0);
  for (let f = 0; f < 60; f++) chains.step();
  for (const v of [...chains.x, ...chains.z, ...chains.y]) assert.ok(Number.isFinite(v));
});

test('separation keeps different chains apart, through neighbours only', () => {
  const chains = new VerletChains({ chains: 2, points: POINTS, rest: REST, grid: { cell: .4, x0: -5, z0: -5, w: 30, h: 30 }, gap: .16 });
  chains.place(0, 0, 0, 1, 0); chains.place(1, 0, .02, 1, 0);
  for (let f = 0; f < 60; f++) chains.step();
  let closest = Infinity;
  for (let a = 0; a < POINTS; a++) for (let b = POINTS; b < 2 * POINTS; b++) closest = Math.min(closest, Math.hypot(chains.x[a] - chains.x[b], chains.z[a] - chains.z[b]));
  assert.ok(closest > .13, `closest ${closest}`);
});

test('a scatter throws points apart, up in the air, then the chain reforms', () => {
  const field = room(30), chains = new VerletChains({ chains: 1, points: POINTS, rest: REST, field });
  chains.place(0, 20, 20);
  for (let f = 0; f < 10; f++) chains.step();
  assert.equal(chains.scatter(21, 20, 3, { seconds: 1 }), 1);
  assert.equal(chains.stiff[0], 0, 'the links let go');
  let tallest = 0, longest = 0;
  for (let f = 0; f < 25; f++) { chains.step(); tallest = Math.max(tallest, ...chains.y); longest = Math.max(longest, ...links(chains, 0)); }
  assert.ok(tallest > .2, `up to ${tallest}`);
  assert.ok(longest > REST * 1.5, `flew apart: ${longest}`);
  assert.equal(chains.alive[0], 1, 'the head is alive');
  for (let f = 0; f < 90; f++) chains.step();
  assert.equal(chains.stiff[0], 1, 'the links are back');
  assert.ok(worst(chains, 0) < .1, `reformed: ${worst(chains, 0)}`);
  assert.equal(Math.max(...chains.y), 0, 'back on the floor');
});

test('a scatter misses what is out of reach and what the spot test refuses', () => {
  const chains = new VerletChains({ chains: 2, points: POINTS, rest: REST });
  chains.place(0, 0, 0); chains.place(1, 50, 50);
  assert.equal(chains.scatter(100, 100, 2), 0);
  assert.equal(chains.scatter(1, 0, 2, { spot: () => false }), 0);
  assert.equal(chains.scatter(1, 0, 2), 1);
  assert.equal(chains.stiff[1], 1);
});

test('a link caught behind a wall catches up instead of stretching for ever', () => {
  const chains = new VerletChains({ chains: 1, points: 4, rest: REST, maxStretch: 1 });
  chains.place(0, 0, 0);
  chains.x[3] = chains.ox[3] = 9;
  chains.step();
  assert.ok(Math.abs(chains.x[3] - chains.x[2]) <= REST * 1.5, `${chains.x[3]}`);
});

test('advance runs fixed steps, carries the rest and caps a long hitch', () => {
  const chains = new VerletChains({ chains: 1, points: 2, rest: REST, h: 1 / 32 });
  assert.equal(chains.advance(3 / 64), 1);
  assert.equal(chains.advance(1 / 64), 1);
  assert.equal(chains.advance(5, 4), 4);
});
