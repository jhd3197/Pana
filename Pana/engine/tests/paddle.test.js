import test from 'node:test';
import assert from 'node:assert/strict';
import { PADDLE, paddleState, stroke, step, hold, rudder, sync, grade, axisStroke, createPaddler } from '/engine/play/paddle.js';

// Paddles a lone canoe on still water: v gains thrust and loses linear drag.
function paddle(gaps, { seconds = 20, sides } = {}) {
  const s = paddleState();
  let v = 0, h = 0, w = 0, next = 0, i = 0, side = -1;
  for (let t = 0; t < seconds; t += .01) {
    while (next <= t) { side = sides ? sides(i) : -side; stroke(s, side, next); next += gaps(i++); }
    const out = step(s, .01);
    v += out.thrust - .6 * v * .01; w += out.yaw; w *= Math.exp(-2.6 * .01); h += w * .01;
  }
  return { v, h, state: s };
}

test('alternating in rhythm beats mashing and slow strokes', () => {
  const rhythm = paddle(() => .4), mash = paddle(() => .1), slow = paddle(() => 1.1), sweet = paddle(() => .36);
  assert.ok(rhythm.v > 5 && rhythm.v < 6.5, `rhythm ${rhythm.v}`);
  assert.ok(sweet.v > rhythm.v, 'the early edge of the sweet spot is the fastest cadence');
  assert.ok(mash.v < rhythm.v * .5, `mash ${mash.v}`);
  assert.ok(slow.v < rhythm.v * .5, `slow ${slow.v}`);
  assert.equal(rhythm.state.quality, 'remazo');
  assert.equal(mash.state.quality, 'chapoteo');
});

test('a stroke in the sweet spot is a ¡Remazo! worth more than one just outside it', () => {
  assert.equal(grade(.45, false).quality, 'remazo');
  assert.equal(grade(.3, false).quality, 'temprano');
  assert.equal(grade(.75, false).quality, 'bueno');
  assert.equal(grade(1.2, false).quality, 'arranque');
  assert.ok(grade(.45, false).power > grade(.75, false).power && grade(.75, false).power > grade(.3, false).power);
  assert.equal(grade(.1, false).quality, 'chapoteo');
});

test('same side twice turns away from that side; alternating stays straight', () => {
  const right = paddle(() => .45, { seconds: 3, sides: () => 1 }), left = paddle(() => .45, { seconds: 3, sides: () => -1 });
  assert.ok(right.h > .5, `right strokes turn the bow left (h grows): ${right.h}`);
  assert.ok(left.h < -.5, `left strokes turn it right: ${left.h}`);
  assert.equal(right.state.quality, 'giro');
  assert.ok(right.v < paddle(() => .45, { seconds: 3 }).v * .6, 'turn strokes are mostly turn');
  assert.ok(Math.abs(paddle(() => .45).h) < .06, 'alternating cancels its own wiggle');
});

test('back-paddling brakes, pivots with a side held and swallows strokes', () => {
  const s = paddleState();
  hold(s, true, -1);
  assert.equal(stroke(s, 1, 0), 'ciar');
  const out = step(s, .05);
  assert.equal(out.brake, true); assert.equal(out.thrust, 0);
  assert.ok(out.turn > 0, 'S + A pivots left');
  hold(s, false);
  assert.equal(step(s, .05).turn, 0);
  rudder(s, 1); assert.equal(step(s, .05).rudder, 1);
});

test('the back seat calling ¡Ahora! with the stroke adds 15%, once, in either order', () => {
  const solo = paddleState(), after = paddleState(), before = paddleState(), late = paddleState();
  for (const s of [solo, after, before, late]) { stroke(s, -1, 0); step(s, 1); }
  stroke(solo, 1, .45);
  stroke(after, 1, .45); assert.equal(sync(after, .5), true); assert.equal(sync(after, .52), false, 'only once per stroke');
  sync(before, .4); stroke(before, 1, .45);
  stroke(late, 1, .45); assert.equal(sync(late, .7), false);
  const total = s => { let sum = 0; for (let i = 0; i < 10; i++) sum += step(s, .05).thrust; return sum; };
  const base = total(solo);
  assert.ok(Math.abs(total(after) - base * (1 + PADDLE.syncBonus)) < 1e-9);
  assert.ok(Math.abs(total(before) - base * (1 + PADDLE.syncBonus)) < 1e-9);
  assert.ok(Math.abs(total(late) - base) < 1e-9);
  assert.equal(before.syncs, 1);
});

test('Bululú input: a stroke is x reaching -1 or +1', () => {
  assert.equal(axisStroke(0, -1), -1); assert.equal(axisStroke(-1, -1), 0); assert.equal(axisStroke(-1, 1), 1); assert.equal(axisStroke(.5, .9), 0);
  const p = createPaddler(); assert.equal(p.stroke(1, 0), 'arranque'); assert.equal(p.stroke(-1, .45), 'remazo'); assert.ok(p.step(.1).thrust > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(p.state)), p.state, 'state survives a snapshot');
});
