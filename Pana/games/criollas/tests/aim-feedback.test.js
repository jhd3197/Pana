import test from 'node:test';
import assert from 'node:assert/strict';
import { aimFeedback } from '../public/aim-feedback.js';
import { createPitch, previewThrow, landing, COURT, throwBall, stepPitch, moving, copy, flightPath, validShot } from '../../../engine/play/bolas-criollas.js';
const normal = { reach: 1, ghost: true, after: .35 };
test('the stopping target tracks power and clips out throws to the court edge', () => {
  const low = aimFeedback({ angle: 0, power: .2 }, normal);
  const high = aimFeedback({ angle: 0, power: .6 }, normal);
  assert.ok(high.range > low.range); assert.equal(high.out, false);
  assert.deepEqual(high.end, landing({ angle: 0, power: .6 }));
  const out = aimFeedback({ angle: .65, power: 1, mode: 'boche' }, normal);
  assert.equal(out.out, true); assert.equal(out.label, 'FUERA DE CANCHA');
  assert.ok(Math.abs(out.end.x) <= COURT.halfWidth - COURT.radius + 1e-8);
  assert.ok(Math.abs(out.end.z) <= COURT.halfLength - COURT.radius + 1e-8);
});
test('an airborne throw clears an intervening ball and lands at its preview', () => {
  const pitch = createPitch(-4, -8), shot = { angle: 0, power: .5, mode: 'aire', loft: 2.5 };
  pitch.balls.push({ id: pitch.nextId++, owner: 1, x: 0, z: 3, vx: 0, vz: 0, radius: .25, out: false });
  const before = copy(pitch), preview = previewThrow(pitch, 0, shot), ball = throwBall(pitch, 0, shot);
  let peak = 0;
  for (let i = 0; i < 2000 && moving(pitch); i++) { stepPitch(pitch); peak = Math.max(peak, ball.height || 0); }
  assert.ok(peak > 2.49); assert.equal(moving(pitch), false); assert.equal(ball.height, 0);
  assert.equal(pitch.balls[1].z, before.balls[1].z, 'flies above the blocker');
  assert.ok(Math.hypot(ball.x - landing(shot).x, ball.z - landing(shot).z) < .001);
  assert.ok(Math.hypot(ball.x - preview.path.at(-1).x, ball.z - preview.path.at(-1).z) < 1e-9);
  const feedback = aimFeedback(shot, normal);
  assert.ok(feedback.touchdown); assert.ok(feedback.touchdown.z > feedback.end.z, 'roll follows touchdown');
  assert.deepEqual(feedback.path[0], feedback.touchdown, 'ground guide starts after flight');
  assert.ok(flightPath({ ...shot, loft: 4 }).at(-1).z < feedback.touchdown.z);
  assert.equal(validShot({ ...shot, loft: 99 }), false);
});
test('airborne collision preview and snapshot recovery match the real physics', () => {
  const shot = { angle: 0, power: .5, mode: 'aire', loft: 1.2 }, drop = flightPath(shot).at(-1);
  const pitch = createPitch(0, drop.z), preview = previewThrow(pitch, 0, shot), ball = throwBall(pitch, 0, shot);
  for (let i = 0; i < 30; i++) stepPitch(pitch);
  const restored = copy(pitch);
  for (let i = 0; i < 2000 && moving(pitch); i++) { stepPitch(pitch); stepPitch(restored); }
  assert.equal(moving(pitch), false); assert.deepEqual(restored, pitch);
  assert.ok(preview.moved.some(b => b.id === 0), 'descending ball hits the mingo');
  assert.ok(Math.hypot(ball.x - preview.path.at(-1).x, ball.z - preview.path.at(-1).z) < 1e-9);
});
test('easy uses the collision simulation and hard modes conceal the stopping target', () => {
  const shot = { angle: 0, power: .62 }, preview = previewThrow(createPitch(), 0, shot);
  const easy = aimFeedback(shot, { ...normal, after: 1 }, preview);
  assert.deepEqual(easy.end, preview.path.at(-1)); assert.equal(easy.label, 'AQUÍ FRENA');
  const hard = aimFeedback(shot, { reach: .14, ghost: false, after: 0 });
  assert.equal(hard.visible, false); assert.ok(hard.path.at(-1).z > easy.end.z);
});
