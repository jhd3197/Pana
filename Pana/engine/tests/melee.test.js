import test from 'node:test';
import assert from 'node:assert/strict';
import { meleeDef, createMelee, startSwing, stepMelee, swingHit, throwStart, stepThrown, readiness, recall, swingInterval, aimThrow, inHand } from '../play/melee.js';

const bat = meleeDef({ id: 'bat', reach: 2.2, arc: .6, windup: .2, recovery: .5, damage: 3, sweetSpot: { from: .7, bonus: 1 } });
const sandal = meleeDef({ id: 'sandal', reach: 1.8, arc: .6, windup: .15, recovery: .45, damage: 3, throwable: { speed: 20, lift: .15, gravity: 9.8, radius: .3, damage: 3, life: 2.5, recall: 2.5 } });
const pose = { x: 0, z: 0, ax: 0, az: -1 };
const run = (state, def, seconds, dt = .05) => { const out = []; for (let t = 0; t < seconds - 1e-9; t += dt) { const e = stepMelee(state, def, dt); if (e) out.push(e); } return out; };

test('a swing hits exactly one target: the nearest of two in reach', () => {
  const near = { x: .2, z: -1.2 }, far = { x: -.1, z: -2 };
  assert.equal(swingHit(pose, [far, near], bat).target, near);
  assert.equal(swingHit(pose, [near, far], bat).target, near);
});

test('a swing misses outside the reach and outside the facing cone', () => {
  assert.equal(swingHit(pose, [{ x: 0, z: -3 }], bat), null, 'too far');
  assert.equal(swingHit(pose, [{ x: 2, z: 0 }], bat), null, 'beside, outside the cone');
  assert.equal(swingHit(pose, [{ x: 0, z: 2 }], bat), null, 'behind');
  assert.ok(swingHit(pose, [{ x: .9, z: -1.5 }], bat), 'inside the cone, off centre');
});

test('cover between the two blocks a swing', () => {
  const target = { x: 0, z: -1.6 }, crate = { x: 0, z: -.8, w: 1, d: .3 };
  assert.ok(swingHit(pose, [target], bat));
  assert.equal(swingHit(pose, [target], bat, { boxes: [crate] }), null);
});

test('the sweet spot adds damage at the end of the reach', () => {
  assert.equal(swingHit(pose, [{ x: 0, z: -1 }], bat).damage, 3);
  assert.equal(swingHit(pose, [{ x: 0, z: -2.2 }], bat).damage, 4);
});

test('a swing strikes once after its windup and respects the cooldown', () => {
  const s = createMelee();
  assert.ok(startSwing(s, bat)); assert.equal(startSwing(s, bat), false, 'no second swing mid-swing');
  assert.deepEqual(run(s, bat, .2), ['strike']);
  assert.equal(startSwing(s, bat), false, 'still recovering');
  assert.deepEqual(run(s, bat, .5), ['ready']);
  assert.ok(startSwing(s, bat)); assert.equal(s.swings, 2);
  assert.ok(Math.abs(swingInterval(bat) - .7) < 1e-9);
});

test('readiness runs 0 → 1 across a swing and a throw', () => {
  const s = createMelee(); assert.equal(readiness(s, bat), 1);
  startSwing(s, bat); assert.equal(readiness(s, bat), 0);
  run(s, bat, .35); assert.ok(Math.abs(readiness(s, bat) - .5) < 1e-6);
  const t = createMelee(); throwStart(t, sandal, { x: 0, z: 0, ax: 0, az: -1 }); run(t, sandal, 1.25);
  assert.ok(Math.abs(readiness(t, sandal) - .5) < 1e-6);
});

test('a throw arcs: it rises above the hand and lands where the parabola says', () => {
  const s = createMelee(), f = throwStart(s, sandal, { x: 0, y: 1.45, z: 0, ax: 1, az: 0, pitch: 0 });
  assert.ok(f && !inHand(s) && s.throws === 1);
  let peak = f.y, r;
  for (let i = 0; i < 100; i++) { r = stepThrown(f, .05); peak = Math.max(peak, f.y); if (r.hit) break; }
  assert.equal(r.hit, 'ground'); assert.ok(peak > 1.45 + .3, `peak ${peak.toFixed(2)}`);
  // y = 1.45 + vy t - g t²/2 = 0
  const vy = Math.sin(.15) * 20, vx = Math.cos(.15) * 20, t = (vy + Math.sqrt(vy * vy + 2 * 9.8 * 1.45)) / 9.8;
  assert.ok(Math.abs(f.x - vx * t) < .3, `landed at ${f.x.toFixed(2)}, expected ${(vx * t).toFixed(2)}`);
  assert.ok(Math.abs(f.y) < 1e-6);
});

test('a throw hits a pana 15 m away and stops on cover in the way', () => {
  const victim = { x: 15, z: 0 };
  let s = createMelee(), f = throwStart(s, sandal, { x: 0, y: 1.45, z: 0, ax: 1, az: 0, pitch: 0 }), r;
  for (let i = 0; i < 100 && !r?.hit; i++) r = stepThrown(f, .05, { targets: [victim] });
  assert.equal(r.hit, 'target'); assert.equal(r.victim, victim); assert.equal(f.damage, 3);
  s = createMelee(); f = throwStart(s, sandal, { x: 0, y: 1.45, z: 0, ax: 1, az: 0, pitch: 0 }); r = null;
  const wall = { x: 8, z: 0, w: .5, d: 4, h: 2.5 };
  for (let i = 0; i < 100 && !r?.hit; i++) r = stepThrown(f, .05, { targets: [victim], boxes: [wall] });
  assert.equal(r.hit, 'cover'); assert.equal(r.victim, null); assert.ok(Math.abs(f.x - 7.75) < .05);
  // A low crate is flown over.
  s = createMelee(); f = throwStart(s, sandal, { x: 0, y: 1.45, z: 0, ax: 1, az: 0, pitch: .05 }); r = null;
  for (let i = 0; i < 100 && !r?.hit; i++) r = stepThrown(f, .05, { targets: [victim], boxes: [{ ...wall, h: .8 }] });
  assert.equal(r.hit, 'target');
});

test('a recalled throw comes back after its cooldown, hit or not; pickup waits', () => {
  const s = createMelee(); throwStart(s, sandal, { x: 0, z: 0, ax: 0, az: -1 });
  assert.equal(throwStart(s, sandal, { x: 0, z: 0, ax: 0, az: -1 }), null, 'one in the air at a time');
  assert.equal(startSwing(s, sandal), false, 'nothing to swing with');
  assert.deepEqual(run(s, sandal, 2.4), []); assert.equal(inHand(s), false);
  assert.deepEqual(run(s, sandal, .1), ['return']); assert.ok(inHand(s) && startSwing(s, sandal));
  assert.equal(throwStart(createMelee(), bat, pose), null, 'a bat is not throwable');
  const pick = meleeDef({ ...sandal, throwable: { ...sandal.throwable, returns: 'pickup' } }), p = createMelee();
  throwStart(p, pick, pose); assert.deepEqual(run(p, pick, 10), []); recall(p); assert.ok(inHand(p));
});

test('aimThrow finds the pitch that reaches a pana at range', () => {
  for (const d of [6, 12, 18, 25]) {
    const aim = aimThrow(sandal, d); assert.ok(aim, `${d} m`);
    const s = createMelee(), f = throwStart(s, sandal, { x: 0, y: 1.45, z: 0, ax: 1, az: 0, pitch: aim.pitch }); let r;
    for (let i = 0; i < 100 && !r?.hit; i++) r = stepThrown(f, .05, { targets: [{ x: d, z: 0 }] });
    assert.equal(r.hit, 'target', `${d} m`);
  }
  assert.equal(aimThrow(bat, 10), null);
});
