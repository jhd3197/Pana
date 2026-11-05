import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, launchAimed } from '../play/projectile.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('aiming straight ahead is the level launch, with no climb', () => {
  const v = launchAimed(0, -1, 0, 85), flat = launch(0, -1, 85);
  assert.ok(near(v.vx, flat.vx) && near(v.vz, flat.vz));
  assert.equal(v.vy, 0);
});

test('aiming up climbs and aiming down drops', () => {
  assert.ok(launchAimed(1, 0, .4, 1).vy > 0);
  assert.ok(launchAimed(1, 0, -.4, 1).vy < 0);
});

test('a diagonal aim is both forward and up, and keeps the full speed', () => {
  const v = launchAimed(.6, .8, .5, 1);
  assert.ok(near(v.vx, .6 * Math.cos(.5)) && near(v.vz, .8 * Math.cos(.5)));
  assert.ok(near(v.vy, Math.sin(.5)));
  assert.ok(near(Math.hypot(v.vx, v.vy, v.vz), 1));
  assert.ok(near(Math.hypot(...Object.values(launchAimed(.6, .8, -.7, 85))), 85));
});

test('spread turns the heading and leaves the pitch alone', () => {
  const v = launchAimed(1, 0, .3, 10, .1), flat = launch(1, 0, 10 * Math.cos(.3), .1);
  assert.ok(near(v.vx, flat.vx) && near(v.vz, flat.vz));
  assert.ok(near(v.vy, 10 * Math.sin(.3)));
});

test('an aim that is not unit length still gives the full speed', () => {
  assert.ok(near(Math.hypot(...Object.values(launchAimed(3, 4, .2, 10))), 10));
});
