import test from 'node:test';
import assert from 'node:assert/strict';
import { walkVector, axisMove, stepWalker } from '../play/walker.js';
import { createFootsteps } from '../play/footsteps.js';

const walker = (o = {}) => ({ walk: 4, run: 6, move: (p, dx, dz) => { p.x += dx; p.z += dz; }, ...o });

test('the vector is clamped, capped to length 1 and can be reversed', () => {
  assert.deepEqual(walkVector({ x: 5, z: 0 }), { x: 1, z: 0, length: 1 });
  const d = walkVector({ x: 1, z: 1 }); assert.ok(Math.abs(Math.hypot(d.x, d.z) - 1) < 1e-9);
  assert.deepEqual(walkVector({ x: .5, z: 0 }, true), { x: -.5, z: 0, length: .5 });
  assert.deepEqual(walkVector({ x: NaN }), { x: 0, z: 0, length: 0 });
});

test('walking moves at the walk speed and sprinting spends stamina', () => {
  const p = { x: 0, z: 0, stamina: 1 };
  const walk = stepWalker(p, { x: 1, z: 0 }, .5, walker());
  assert.equal(p.x, 2); assert.equal(walk.sprinting, false); assert.ok(walk.moving);
  const run = stepWalker(p, { x: 1, z: 0, sprint: true }, .5, walker({ drain: 2 }));
  assert.equal(p.x, 5); assert.equal(run.sprinting, true); assert.equal(p.stamina, .75);
  p.stamina = 0; assert.equal(stepWalker(p, { x: 1, z: 0, sprint: true }, .1, walker()).sprinting, false);
  assert.ok(p.stamina > 0, 'it refills while not sprinting');
});

test('sprint rules: a game veto, a still stick and a stamina floor all stop it', () => {
  const p = () => ({ x: 0, z: 0, stamina: 1 });
  assert.equal(stepWalker(p(), { x: 1, sprint: true }, .1, walker({ canSprint: false })).sprinting, false);
  assert.equal(stepWalker(p(), { sprint: true }, .1, walker()).sprinting, false);
  assert.equal(stepWalker({ ...p(), stamina: .04 }, { x: 1, sprint: true }, .1, walker({ minStamina: .05 })).sprinting, false);
});

test('inertia eases the velocity and a stun (scale 0) stands still', () => {
  const p = { x: 0, z: 0, stamina: 1 }, held = {};
  stepWalker(p, { x: 1 }, .1, walker({ inertia: 2, velocity: held }));
  assert.ok(held.vx > 0 && held.vx < 4);
  const q = { x: 0, z: 0, stamina: 1 }; assert.equal(stepWalker(q, { x: 1 }, .1, walker({ scale: 0 })).moving, false);
});

test('a jump is shared and the floor lifts p.y', () => {
  const p = { x: 0, z: 0, stamina: 1 };
  stepWalker(p, { jump: 1 }, .05, walker({ ground: () => 2 }));
  assert.ok(p.jumpHeight > 0); assert.equal(p.y, 2 + p.jumpHeight);
  const q = { x: 0, z: 0, stamina: 1 }; stepWalker(q, { jump: 1 }, .05, walker({ jump: false })); assert.equal(q.jumpHeight, undefined);
});

test('axisMove slides along a wall', () => {
  const p = { x: 0, z: 0 }; axisMove((x) => x > 1)(p, 2, 1);
  assert.deepEqual(p, { x: 0, z: 1 });
});

test('footsteps follow the distance walked, alternate feet and cadence rises with speed', () => {
  const log = [], sink = { step: (s, o) => log.push(['step', s, o.foot, o.sprint]), jump: () => log.push(['jump']), land: (s, o) => log.push(['land', o.power]) };
  const count = speed => { const f = createFootsteps(), seen = []; let t = 0; for (let i = 0; i < 100; i++) f.update(.05, { speed, surface: 'wood' }, { step: () => seen.push(t) }); return seen.length; };
  assert.ok(count(7) > count(4.5) && count(4.5) > 0 && count(0) === 0);
  const f = createFootsteps(); for (let i = 0; i < 40; i++) f.update(.05, { speed: 5, surface: 'grass' }, sink);
  const feet = log.filter(e => e[0] === 'step').map(e => e[2]); assert.ok(feet.length >= 3); assert.ok(feet.every((n, i) => i === 0 || n !== feet[i - 1]));
  log.length = 0; f.update(.05, { height: .3 }, sink); f.update(.05, { height: .8 }, sink); f.update(.05, { height: 0 }, sink);
  assert.deepEqual(log.map(e => e[0]), ['jump', 'land']); assert.ok(log[1][1] > .8);
});
