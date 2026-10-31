import test from 'node:test';
import assert from 'node:assert/strict';
import { stepJump, resetJump, pressJump, jumpCount, JUMP_SPEED } from '../play/jump.js';

const air = (p, input, frames = 1) => { for (let i = 0; i < frames; i++) stepJump(p, input, .05); };

test('a new press counter takes off, lands, and holding it does not jump again', () => {
  const p = {}; air(p, { jump: 0 });
  assert.equal(p.jumpHeight, 0, 'an unchanged counter stays on the ground');
  air(p, { jump: 1 }); assert.ok(p.jumpHeight > 0 && p.jumpVelocity > 0);
  let peak = 0; for (let i = 0; i < 40; i++) { air(p, { jump: 1 }); peak = Math.max(peak, p.jumpHeight); }
  assert.equal(p.jumpHeight, 0); assert.equal(p.jumpVelocity, 0);
  assert.ok(peak > .6 && peak < 1.2, `peak ${peak}`);
  air(p, { jump: 1 }); assert.equal(p.jumpHeight, 0);
  air(p, { jump: 2 }); assert.ok(p.jumpHeight > 0);
});

test('no double jump in the air; a blocked pana stays down', () => {
  const p = {}; air(p, { jump: 1 }); air(p, { jump: 1 }, 3);
  const velocity = p.jumpVelocity; air(p, { jump: 2 });
  assert.ok(p.jumpVelocity < velocity, 'a press mid-air does not relaunch');
  const q = {}; stepJump(q, { jump: 1 }, .05, { blocked: true }); assert.equal(q.jumpHeight, 0);
});

test('gravity and speed are the game\'s own, and a delay holds the take-off back', () => {
  const p = {}; stepJump(p, { jump: 1 }, .05, { speed: 10, gravity: 20 });
  assert.ok(Math.abs(p.jumpVelocity - (10 - 20 * .05)) < 1e-9);
  const q = {}; for (let i = 0; i < 20; i++) stepJump(q, { jump: 1, jumpDelay: .95 }, .05);
  assert.ok(q.jumpHeight > .1 && q.jumpVelocity > 0, 'takes off near the end of the catch-up');
  assert.ok(JUMP_SPEED > 0);
});

test('the press counter wraps, ignores junk, and resetJump grounds without a stray press', () => {
  assert.equal(pressJump(255), 0); assert.equal(pressJump(3), 4);
  assert.equal(jumpCount({ jump: 258 }), 2); assert.equal(jumpCount({ jump: 'x' }, 7), 7); assert.equal(jumpCount(null), 0);
  const p = {}; air(p, { jump: 1 }, 2); resetJump(p, { jump: 5 });
  assert.equal(p.jumpHeight, 0); assert.equal(p.jumpPress, 5);
  air(p, { jump: 5 }); assert.equal(p.jumpHeight, 0, 'the frozen press is spent');
});