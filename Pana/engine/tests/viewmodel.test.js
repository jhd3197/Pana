import test from 'node:test';
import assert from 'node:assert/strict';
import { MELEE_CARRY, MELEE_SWING, applyHeld, createHeldMotion, swingPose, swingTable } from '../play/viewmodel.js';

const prop = () => ({ position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: { set(x, y, z) { Object.assign(this, { x, y, z }); } } });
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} is not ${b}`);
const play = (frames, each, dt = 1 / 60) => { for (let i = 0; i < frames; i++) each(i, dt); };

test('a swing goes rest, cocked, through and back to rest on time', () => {
  const windup = .15, recovery = .55, { rest, cocked, through, strike } = MELEE_SWING;
  assert.deepEqual(swingPose(-1, windup, recovery), rest);
  assert.deepEqual(swingPose(0, windup, recovery), rest);
  swingPose(windup - 1e-9, windup, recovery).forEach((value, i) => near(value, cocked[i], 1e-6));
  swingPose(windup + strike - 1e-9, windup, recovery).forEach((value, i) => near(value, through[i], 1e-6));
  swingPose(windup + recovery + 1, windup, recovery).forEach((value, i) => near(value, rest[i]));
});

test('a swing writes into the array it is given, and the same time gives the same pose', () => {
  const out = [0, 0, 0, 0, 0, 0];
  assert.equal(swingPose(.2, .1, .3, out), out);
  assert.deepEqual(swingPose(.2, .1, .3), [...out]);
});

test('a game can bring its own pose table', () => {
  const rest = [-.2, 0, .2, -.2, -.5, .1], table = swingTable(rest, { cocked: [.5], through: [-1, .4], strike: .05 });
  assert.deepEqual(swingPose(-1, .1, .2, undefined, table), rest);
  near(table.cocked[0], .3); near(table.through[0], -1.2); near(table.through[1], .4); near(table.cocked[5], .1);
  assert.equal(table.strike, .05);
  swingPose(9, .1, .2, undefined, table).forEach((value, i) => near(value, rest[i]));
});

test('a higher swing count starts the clock, and it stops by itself', () => {
  const m = createHeldMotion(), timing = { windup: .1, recovery: .3 };
  m.equip('machete', 4);
  assert.equal(m.swing(1 / 60, { swings: 4, ...timing }), -1, 'joining with an old count plays nothing');
  assert.equal(m.swing(1 / 60, { swings: 5, ...timing }), 0);
  near(m.swing(.1, { swings: 5, ...timing }), .1);
  m.swing(.5, { swings: 5, ...timing });
  assert.equal(m.swing(.1, { swings: 5, ...timing }), -1);
});

test('a new item rises from below; the first one and the same one do not', () => {
  const m = createHeldMotion();
  assert.equal(m.equip('machete'), true); assert.equal(m.swap, 0);
  assert.equal(m.equip('machete'), false); assert.equal(m.swap, 0);
  m.equip('farol'); assert.equal(m.swap, 1);
  assert.ok(m.carry({}, {}).y < -.25);
  play(30, (_, dt) => m.step(dt));
  assert.equal(m.swap, 0); assert.ok(Math.abs(m.carry({}, {}).y) < .01);
});

test('a new item drops the swing it interrupted', () => {
  const m = createHeldMotion(), timing = { windup: .1, recovery: .3 };
  m.equip('a', 0); m.swing(.01, { swings: 1, ...timing }); assert.equal(m.since, 0);
  m.equip('b', 1); assert.equal(m.since, -1);
});

test('sprinting lowers the carry and a downed pana stands it back up', () => {
  const m = createHeldMotion(), c = {};
  play(90, (_, dt) => m.step(dt, { sprint: true }));
  m.carry(c, {}); near(c.rx, MELEE_CARRY.sprint[3], .01); assert.ok(c.y < -.07);
  play(90, (_, dt) => m.step(dt, { sprint: true, down: true }));
  m.carry(c, {}); near(c.rx, 0, .01); assert.ok(Math.abs(c.y) < .01);
});

test('the bob follows the stride and stands still with no sway', () => {
  const m = createHeldMotion(), a = {}, b = {};
  m.carry(a, { bob: Math.PI / 2, sway: 1 }); m.carry(b, { bob: Math.PI / 2, sway: 0 });
  near(a.x, MELEE_CARRY.bobX); near(b.x, 0);
  m.carry(a, { bob: 0, sway: 1 }); m.carry(b, { bob: 0, sway: 0 });
  near(a.y - b.y, MELEE_CARRY.bobY);
});

test('idle breathing stays within a hand-width and runs the same every time', () => {
  const run = () => { const m = createHeldMotion(), ys = []; play(600, (_, dt) => { m.step(dt); ys.push(m.carry({}, {}).y); }); return ys; };
  const ys = run(), spread = Math.max(...ys) - Math.min(...ys);
  assert.ok(spread > .004 && spread < .02);
  assert.deepEqual(ys, run());
});

test('a jump dips the hand and a wall pushes it back', () => {
  const m = createHeldMotion(), c = m.carry({}, { air: 1, push: .2 });
  assert.ok(c.y < -.03); near(c.z, .2);
});

test('carry reuses the object it is given', () => {
  const m = createHeldMotion(), c = {};
  assert.equal(m.carry(c, {}), c);
});

test('reset forgets the item and the sprint', () => {
  const m = createHeldMotion();
  m.equip('a'); m.equip('b'); play(30, (_, dt) => m.step(dt, { sprint: true })); m.reset();
  assert.equal(m.swap, 0); assert.equal(m.sprint, 0); assert.equal(m.since, -1);
  m.equip('c'); assert.equal(m.swap, 0, 'the first item after a reset does not rise');
});

test('a left hand is the mirror of the right, a narrow screen brings both in', () => {
  const m = createHeldMotion(), c = m.carry({}, { bob: 1, sway: 1 }), right = prop(), left = prop(), narrow = prop(), pose = [.1, .3, .2, -.2, -.5, .4];
  applyHeld(right, pose, c); applyHeld(left, pose, c, { side: -1 }); applyHeld(narrow, pose, c, { spread: .5 });
  near(left.position.x, -right.position.x); near(left.position.y, right.position.y); near(left.position.z, right.position.z);
  near(left.rotation.x, right.rotation.x); near(left.rotation.y, -right.rotation.y); near(left.rotation.z, -right.rotation.z);
  near(narrow.position.x, .1 + c.x);
});
