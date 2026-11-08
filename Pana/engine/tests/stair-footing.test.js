import test from 'node:test';
import assert from 'node:assert/strict';
import { createMask, fillHeights, fill, surfaceY } from '../play/terrain-mask.js';
import { stepSideWalker } from '../play/side-walker.js';
import { stairFloor } from '../play/stair-footing.js';
const body = (x, y) => ({ x, y, vx: 0, vy: 0, grounded: true, facing: 1, jumpPress: 0 });
const run = (p, mask, input, options, seconds) => { for (let i = 0; i < seconds * 60; i++) stepSideWalker(p, input, 1 / 60, mask, options); };

test('authored narrow stairs support feet both ways without increasing walk speed', () => {
  const m = createMask({ width: 20, height: 30, cell: .1 });
  fillHeights(m, x => 3 + Math.min(8, Math.max(0, Math.floor((x - 7) / .3))) * .8); m.stairs = [[6, 11]];
  const p = body(6, surfaceY(m, 6)); run(p, m, { x: 1 }, { stairs: true }, 2);
  assert.ok(p.x > 10.7 && p.x < 10.9); assert.ok(p.y > 9); assert.ok(p.grounded);
  run(p, m, { x: -1 }, { stairs: true }, 2);
  assert.ok(Math.abs(p.x - 6) < .1); assert.ok(Math.abs(p.y - 3) < .11);
});
test('stair metadata is inert unless the caller opts in', () => {
  const m = createMask({ width: 20, height: 20, cell: .1 }); fillHeights(m, x => x > 9 ? 8 : 3); m.stairs = [[5, 12]];
  const a = body(6, 3), b = body(6, 3); run(a, m, { x: 1 }, {}, 3); delete m.stairs; run(b, m, { x: 1 }, {}, 3);
  assert.deepEqual(a, b); assert.ok(a.x < 9);
});
test('stair footing cannot climb a tall wall or snap through a low ceiling', () => {
  const m = createMask({ width: 20, height: 20, cell: .1 }); fillHeights(m, x => x > 9 ? 8 : 3); m.stairs = [[5, 12]];
  const p = body(6, 3); run(p, m, { x: 1 }, { stairs: true }, 3); assert.ok(p.x < 9); assert.ok(p.y < 4.1);
  fill(m, 6, 4.2, .3); assert.equal(stairFloor(m, 6, 3, m.stairs), null);
});
test('outside authored stair runs, jumping and air steering stay exactly unchanged', () => {
  const m = createMask({ width: 30, height: 20, cell: .1 }); fillHeights(m, () => 3); m.stairs = [[20, 25]];
  const a = body(3, 3), b = body(3, 3), opts = { airControl: 9, airSpeed: 4.4 };
  run(a, m, { x: 1, jump: 1 }, opts, 1); run(b, m, { x: 1, jump: 1 }, { ...opts, stairs: true }, 1);
  assert.deepEqual(a, b);
});
