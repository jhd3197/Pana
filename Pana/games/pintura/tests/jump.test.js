import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../public/rules.js';

const arena = (live = true) => {
  const g = new Arena('plaza', 'normal', { toughness: 1 }); g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} }); g.start();
  if (live) g.go(); return g;
};
const run = (g, input, frames = 1) => { for (let i = 0; i < frames; i++) g.step(.05, new Map([[1, input]])); };

test('Space is a server-side hop: up, down, no double jump', () => {
  const g = arena(), p = g.players[0];
  run(g, { jump: 0 }); assert.equal(p.jumpHeight, 0);
  run(g, { jump: 1 }); assert.ok(p.jumpHeight > 0, 'a new press counter takes off');
  let peak = 0; for (let i = 0; i < 40; i++) { run(g, { jump: 1 }); peak = Math.max(peak, p.jumpHeight); }
  assert.equal(p.jumpHeight, 0); assert.ok(peak > .6 && peak < 1.2);
  run(g, { jump: 2 }); run(g, { jump: 2 }, 3); const v = p.jumpVelocity; run(g, { jump: 3 }); assert.ok(p.jumpVelocity < v, 'no relaunch mid-air');
});

test('jumping does not stop movement, firing or the shield rules', () => {
  const g = arena(), p = g.players[0]; Object.assign(p, { x: -3, z: -4, shield: 0 });
  run(g, { jump: 1, x: 1, fire: true, ax: 1, az: 0 }, 4);
  assert.ok(p.jumpHeight > 0 && p.x > -3 && p.ammo < 12);
});

test('loading and the 3-2-1 block jumping, and a press made then is not saved for YA', () => {
  const g = arena(false), p = g.players[0];
  assert.ok(g.loading); run(g, { jump: 1 }, 2); assert.equal(p.jumpHeight, 0);
  g.loading = 0; g.countdown = 3; run(g, { jump: 2 }, 3); assert.equal(p.jumpHeight, 0); assert.equal(p.jumpPress, 2);
  g.go(); run(g, { jump: 2 }); assert.equal(p.jumpHeight, 0, 'the frozen press was spent');
  run(g, { jump: 3 }); assert.ok(p.jumpHeight > 0, 'a fresh press after YA jumps');
});

test('a knocked-out pana lands for the respawn and bots stay on the ground', () => {
  const g = arena(), p = g.players[0]; run(g, { jump: 1 }, 2); assert.ok(p.jumpHeight > 0);
  p.respawn = .5; run(g, { jump: 1 }); assert.equal(p.jumpHeight, 0);
  const h = new Arena('plaza', 'normal', {}); h.add(1, { name: 'A', avatar: {} }); h.add(1000, { name: 'Bot', avatar: {}, bot: true }); h.start(); h.go();
  let high = 0; for (let i = 0; i < 100; i++) { h.step(.05, new Map()); high = Math.max(high, h.players[1].jumpHeight); } assert.equal(high, 0);
});