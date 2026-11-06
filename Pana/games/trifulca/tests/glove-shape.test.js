import test from 'node:test';
import assert from 'node:assert/strict';
import { fistPoint, thumbLine, handRoll, rigidFrame, WRIST, FIST_TOP, FIST_LENGTH } from '../public/glove-shape.js';
import { GLOVE_SIZE } from '../public/fighter-look.js';

const ring = (v, side = 1, n = 48) => Array.from({ length: n }, (_, i) => fistPoint(i / n, v, side));
const widest = (points, axis) => Math.max(...points.map(p => p[axis])) - Math.min(...points.map(p => p[axis]));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Three's Euler XYZ: Z is applied first, then Y, then X.
function turn([x, y, z], { rx = 0, ry = 0, rz = 0 }) {
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  return [x, y, z];
}

test('the fist is a padded mitt: pinched at the wrist, knuckles at the far end', () => {
  const [, tipY] = fistPoint(0, 1);
  assert.ok(Math.abs(tipY - (FIST_TOP - FIST_LENGTH)) < 1e-9);
  for (let v = 0; v <= 1; v += .05) assert.ok(ring(v)[0][1] >= tipY - 1e-9, 'nothing passes the knuckles');
  assert.ok(widest(ring(.55), 2) > widest(ring(.12), 2) * 1.3, 'wider at the hand than at the wrist');
  assert.ok(widest(ring(.68), 0) < widest(ring(.55), 0) * 1.05, 'no flat-ended block');
});

test('the fist curls toward the palm, mirrored on each hand', () => {
  for (const side of [1, -1]) assert.ok(fistPoint(0, 1, side)[0] * side < -.04, 'the knuckles lean palm-side');
  const left = fistPoint(.2, .6, 1), right = fistPoint(.5 - .2, .6, -1);
  assert.ok(Math.abs(left[0] + right[0]) < 1e-9, 'right is left in a mirror');
  assert.ok(Math.abs(left[1] - right[1]) < 1e-9 && Math.abs(left[2] - right[2]) < 1e-9);
});

test('the thumb sits on the inner, +Z side and shows past the fist', () => {
  for (const side of [1, -1]) {
    const { from, to, radius } = thumbLine(side);
    assert.ok(from[0] * side < 0 && to[0] * side < 0, 'toward the palm');
    assert.ok(to[1] < from[1], 'its tip toward the knuckles');
    const v = Math.acos(1 - 2 * (FIST_TOP - to[1]) / FIST_LENGTH) / Math.PI;
    assert.ok(to[2] + radius > Math.max(...ring(v, side).map(p => p[2])), 'a bump, not buried');
  }
});

test('the cuff closes over the wrist with no gap', () => {
  // The arm's radius (avatar model: sculpt units ×.6) where the cuff's top sits.
  const y = -.86 + .11 * GLOVE_SIZE / .6, h = (y + .43) / .57;
  const armRadius = .23 * Math.sqrt(1 - h * h) ** .68 * .6;
  assert.ok(WRIST * GLOVE_SIZE > armRadius, 'wider than the arm it wraps');
  assert.ok(FIST_TOP > -.05, 'the fist starts inside the cuff');
});

test('a straight punch lands knuckles first, palm down; a guard keeps the thumb up', () => {
  // Authored full jab of each arm: rx lifts it forward, rz aims it inward.
  for (const [side, rz] of [[1, -.06], [-1, .06]]) {
    const pose = { rx: -1.6, rz }, aim = turn([0, -1, 0], pose);
    assert.ok(aim[2] > .95, 'the knuckles aim at the rival');
    const roll = -side * handRoll('jab', { striking: true, extension: 1, style: 'recto' });
    const hand = (v) => turn(turn(v, { ry: roll }), pose);
    assert.ok(hand([-side, 0, 0])[1] < -.9, 'palm down');
    assert.ok(hand([0, 0, 1])[0] * side < -.9, 'thumb inward');
    const guard = -side * handRoll('idle');
    assert.ok(turn(turn([0, 0, 1], { ry: guard }), pose)[1] > .8, 'thumb up in guard');
  }
});

test('an upper turns the palm up, and only the punching hand turns', () => {
  assert.ok(handRoll('trompon', { style: 'upper', striking: true, extension: 1 }) < 0);
  assert.ok(handRoll('jab', { style: 'recto', striking: false, extension: 1 }) < .5, 'the other hand stays in cover');
  assert.equal(handRoll('down'), 0, 'limp arms lie as they fall');
  for (const style of ['alta', 'cruz', 'concha']) assert.ok(handRoll('block', { style }) < .6);
});

test('a stretched, squashed arm still gives the glove a square frame', () => {
  // An arm axis stretched ×2.3 and skewed by the body's squash (column-major).
  const frame = rigidFrame([.7, .1, 0, 0, .3, 2.1, .8, 0, -.2, -.4, .9, 0, 0, 0, 0, 1]);
  for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(dot(frame[axis], frame[axis]) - 1) < 1e-9, `${axis} is a unit`);
  assert.ok(Math.abs(dot(frame.x, frame.y)) < 1e-9 && Math.abs(dot(frame.y, frame.z)) < 1e-9 && Math.abs(dot(frame.x, frame.z)) < 1e-9, 'no shear');
  const length = Math.hypot(.3, 2.1, .8);
  assert.ok(Math.abs(dot(frame.y, [.3 / length, 2.1 / length, .8 / length]) - 1) < 1e-9, 'Y stays on the arm');
});
