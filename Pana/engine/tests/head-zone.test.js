import test from 'node:test';
import assert from 'node:assert/strict';
import { shotHeight, headHit, aimedPitch } from '../play/head-zone.js';

const EYE = 1.55, from = { x: 0, z: 0, y0: EYE }, east = { x: 1, z: 0 };

test('a shot climbs or drops with its pitch; only a pitched shot at or over the head line is a head hit', () => {
  assert.equal(shotHeight({ y0: 1.5, pitch: 0 }, 30), 1.5);
  assert.ok(Math.abs(shotHeight({ y0: 1.5, pitch: Math.atan(.01) }, 10) - 1.6) < 1e-12);
  assert.equal(headHit({ y0: 1.55, pitch: 0 }, 20, 1.4), true);
  assert.equal(headHit({ y0: 1.55, pitch: 0 }, 20, 1.4, .5), false, 'a jump lifts the head line');
  assert.equal(headHit({ y0: 1.55, pitch: null }, 20, 1.4), false);
});

test('aimedPitch aims at the head of the closest target whose centre the line passes within width of', () => {
  const head = aimedPitch(from, east, [{ id: 2, x: 20, z: .1 }, { id: 3, x: 40, z: 0 }], { head: 1.6, chest: 1.1 });
  assert.equal(head.target, 2); assert.equal(head.zone, 'head');
  assert.ok(Math.abs(shotHeight({ y0: EYE, pitch: head.pitch }, 20) - 1.6) < 1e-9);
  const body = aimedPitch(from, east, [{ id: 2, x: 20, z: .5 }], { width: .25, head: 1.6, chest: 1.1 });
  assert.equal(body.zone, 'body'); assert.ok(Math.abs(shotHeight({ y0: EYE, pitch: body.pitch }, 20) - 1.1) < 1e-9);
  assert.equal(headHit({ y0: EYE, pitch: body.pitch }, 19.5, 1.4), false, 'a chest aim stays under the head line');
});

test('aimedPitch ignores targets behind or outside the cone and needs a direction', () => {
  assert.equal(aimedPitch(from, east, [{ id: 2, x: -10, z: 0 }]), null);
  assert.equal(aimedPitch(from, east, [{ id: 2, x: 10, z: 3 }], { cone: .12 }), null);
  assert.equal(aimedPitch(from, { x: 0, z: 0 }, [{ id: 2, x: 10, z: 0 }]), null);
  assert.equal(aimedPitch(from, { x: 3, z: 0 }, [{ id: 2, x: 10, z: 0 }]).target, 2, 'the direction need not be unit length');
});
