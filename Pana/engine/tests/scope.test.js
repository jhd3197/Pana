import test from 'node:test';
import assert from 'node:assert/strict';
import { createScope, scopedFov, lookScale } from '../play/scope.js';

test('zoom narrows the view and slows the look by the same factor', () => {
  assert.equal(scopedFov(72, 4, 0), 72);
  assert.equal(scopedFov(72, 4, 1), 18);
  assert.equal(lookScale(4, 1), .25);
  assert.equal(scopedFov(72, 4, 2), 18, 'the blend is clamped');
});

test('the scope eases in while aiming and drops faster than it rises', () => {
  const scope = createScope({ zoom: 3.5, inTime: .2, outTime: .1 });
  scope.update(.1, true); assert.ok(Math.abs(scope.amount - .5) < 1e-9); assert.equal(scope.scoped, false);
  scope.update(.1, true); assert.equal(scope.amount, 1); assert.equal(scope.scoped, true);
  assert.ok(scope.fov(70) < 21 && scope.sensitivity() < .3);
  scope.update(.05, false); assert.ok(Math.abs(scope.amount - .5) < 1e-9);
  scope.update(.2, false); assert.equal(scope.amount, 0); assert.equal(scope.fov(70), 70);
});

test('a light zoom (iron sights) never counts as through the scope', () => {
  const scope = createScope({ zoom: 1.2 }); scope.update(1, true);
  assert.equal(scope.scoped, false); scope.setZoom(3.5); assert.equal(scope.scoped, true);
});
