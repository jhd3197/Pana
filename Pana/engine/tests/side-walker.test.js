import test from 'node:test';
import assert from 'node:assert/strict';
import { createMask, fillHeights, splash, carve } from '../play/terrain-mask.js';
import { stepSideWalker, knock, settled, SIDE_WALKER } from '../play/side-walker.js';
import { pressJump } from '../play/jump.js';

const DT = 1 / 60;
const run = (p, input, mask, seconds, options) => { const log = []; for (let t = 0; t < seconds; t += DT) log.push(stepSideWalker(p, input, DT, mask, options)); return log; };
const ground = (heightAt) => { const m = createMask({ width: 60, height: 30, cell: .1 }); fillHeights(m, heightAt); return m; };
const body = (x, y) => ({ x, y, vx: 0, vy: 0, grounded: false, facing: 1 });

test('drops onto the ground, then walks along it at walking speed', () => {
  const m = ground(() => 10), p = body(10, 14);
  run(p, {}, m, 1.5);
  assert.ok(p.grounded && Math.abs(p.y - 10) < .11 && settled(p));
  run(p, { x: 1 }, m, 1);
  assert.ok(Math.abs(p.x - 10 - SIDE_WALKER.walk) < .15, `walked to ${p.x}`);
  assert.equal(p.facing, 1);
  run(p, { x: -1 }, m, .2); assert.equal(p.facing, -1);
});

test('steps over small bumps and up gentle hills, not up a cliff', () => {
  const bump = ground(x => x > 12 ? 10.3 : 10), p = body(10, 10.05);
  run(p, {}, bump, .2); run(p, { x: 1 }, bump, 2);
  assert.ok(p.x > 14 && Math.abs(p.y - 10.3) < .11, 'climbed the step');
  const hill = ground(x => x > 12 ? 10 + (x - 12) * .5 : 10), q = body(10, 10.05);
  run(q, {}, hill, .2); run(q, { x: 1 }, hill, 2);
  assert.ok(q.x > 13.5 && q.y > 10.5, 'walked up a 27 degree hill');
  const cliff = ground(x => x > 12 ? 10 + (x - 12) * 3 : 10), c = body(10, 10.05);
  run(c, {}, cliff, .2); run(c, { x: 1 }, cliff, 2);
  assert.ok(c.x < 12.6 && c.y < 11, `stopped at the 72 degree wall (${c.x}, ${c.y})`);
});

test('paint on a slope makes it slippery: it slides down and cannot be climbed', () => {
  const slope = x => 20 - x * .5;                            // 27 degrees, falling to the right
  const bare = ground(slope), p = body(20, 10.05);
  run(p, {}, bare, 1);
  assert.ok(Math.abs(p.x - 20) < .05, 'bare ground holds still');
  const wet = ground(slope);
  for (let x = 10; x < 40; x += 1) splash(wet, x, slope(x), 1.5, 0);
  const q = body(20, 10.05);
  run(q, {}, wet, 1);
  assert.ok(q.x > 21, `slid downhill to ${q.x}`);
  const r = body(30, 5.05);
  run(r, {}, wet, .05); const from = r.x; run(r, { x: -1 }, wet, 1);
  assert.ok(r.x > from - .8, 'barely gains climbing a painted slope');
});

test('jumping uses the shared press counter and lands again', () => {
  const m = ground(() => 10), p = body(10, 10.05);
  run(p, {}, m, .2);
  const r = stepSideWalker(p, { jump: pressJump(p.jumpPress || 0) }, DT, m);
  assert.ok(r.jumped && !p.grounded && p.vy > 0);
  const log = run(p, { jump: p.jumpPress }, m, 2);
  assert.ok(log.some(e => e.landed) && p.grounded && p.x > 11, 'a forward hop');
});

test('a crater under the feet drops it; knockback throws it into the river', () => {
  const m = ground(x => x < 30 ? 10 : 0), p = body(20, 10.05);
  run(p, {}, m, .2);
  carve(m, 20, 10, 2);
  run(p, {}, m, 1.5);
  assert.ok(p.grounded && p.y < 8.3, 'fell to the crater floor');
  const q = body(26, 10.05); run(q, {}, m, .2);
  knock(q, 10, 8);
  const log = run(q, {}, m, 4, { water: 3 });
  assert.ok(q.drowned && log.some(e => e.drowned), 'thrown past the bank into the water');
  knock(p, 16, 14); run(p, {}, m, 4, { water: 3 });
  assert.ok(p.grounded && !p.drowned && p.y > 9.8, 'out of the crater, its rim turns the throw upward');
  assert.deepEqual(stepSideWalker(q, { x: 1 }, DT, m, { water: 3 }), { jumped: false, landed: false, drowned: false, blocked: false });
});
