import test from 'node:test';
import assert from 'node:assert/strict';
import { lobVelocity, stepLob, traceLob, groundAt, falloff, solveLob, touched, LOB } from '../play/lob.js';

const throwAt = (elevation, speed, y = 1.5) => ({ x: 0, y, z: 0, ...lobVelocity(1, 0, elevation, speed) });

test('a lob on open ground lands where the textbook range formula says', () => {
  const speed = 15, angle = .5, h = 1.5, vy = Math.sin(angle) * speed, vx = Math.cos(angle) * speed;
  const flight = (vy + Math.sqrt(vy * vy + 2 * LOB.gravity * (h - LOB.radius))) / LOB.gravity, expected = vx * flight;
  const out = [], r = traceLob(throwAt(angle, speed, h), {}, { dt: .01, time: 4, out });
  assert.ok(r.landed); assert.ok(Math.abs(out[r.land].x - expected) < .3, `${out[r.land].x} vs ${expected}`);
});

test('a higher elevation peaks higher', () => {
  const peaks = [.2, .5, .9].map(angle => traceLob(throwAt(angle, 14), {}, { time: 3 }).peak);
  assert.ok(peaks[0] < peaks[1] && peaks[1] < peaks[2], peaks.join(' < '));
});

test('every bounce loses speed and it comes to rest', () => {
  const g = throwAt(.6, 12), speeds = [];
  for (let i = 0; i < 400 && !g.resting; i++) { const e = stepLob(g, .05, { restitution: .4, friction: .7 }); if (e?.type === 'ground') speeds.push(e.speed); }
  assert.ok(speeds.length >= 2); for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] < speeds[i - 1]);
  assert.ok(g.resting); assert.equal(g.vx, 0); assert.ok(Math.abs(g.y - LOB.radius) < 1e-9);
});

test('a sticky throw stops where it first lands', () => {
  const out = [], r = traceLob(throwAt(.5, 12), { sticky: true }, { time: 4, out });
  assert.equal(r.x, out[r.land].x); assert.equal(r.z, out[r.land].z);
});

test('walls bounce it back; a box lower than the throw is flown over and landed on', () => {
  const wall = { x: 6, z: 0, w: 1, d: 8, h: 3 };
  const g = { x: 0, y: 1, z: 0, vx: 10, vy: 0, vz: 0 };
  for (let i = 0; i < 20; i++) stepLob(g, .05, { boxes: [wall] });
  assert.ok(g.x < 5.5 && g.vx <= 0, 'bounced off the side');
  const low = { x: 6, z: 0, w: 4, d: 4, h: .8 }, r = traceLob(throwAt(.7, 7), { boxes: [low], sticky: true }, { time: 3 });
  assert.ok(Math.abs(r.y - (.8 + LOB.radius)) < 1e-6 && Math.abs(r.x - 6) < 2, 'stuck on the crate top');
  assert.equal(groundAt(6, 0, [low]), .8); assert.equal(groundAt(9, 0, [low]), 0);
  const fenced = traceLob(throwAt(.3, 20), { bounds: { x: 10, z: 10 } }, { time: 4 });
  assert.ok(Math.abs(fenced.x) < 10, 'the court edge keeps it in');
});

test('with land, a throw still airborne when time runs out waits for touchdown', () => {
  const g = throwAt(1.1, 18), short = traceLob(g, {}, { time: 1 }), waited = traceLob(g, {}, { time: 1, land: true });
  assert.ok(short.y > 3); assert.ok(waited.y < .2); assert.ok(waited.landed);
  assert.equal(touched({}), false); assert.equal(touched({ bounces: 1 }), true);
});

test('falloff is full inside 40%, falls towards the edge and is zero outside', () => {
  assert.equal(falloff(0, 4), 1); assert.equal(falloff(1.6, 4), 1);
  assert.ok(falloff(3, 4) < 1 && falloff(3, 4) > falloff(3.9, 4));
  assert.ok(Math.abs(falloff(4, 4) - .35) < 1e-9); assert.equal(falloff(4.01, 4), 0); assert.equal(falloff(NaN, 4), 0);
});

test('solveLob finds the power for a distance, and says when none reaches it', () => {
  const reach = (pitch, power) => traceLob(throwAt(.45 + pitch, 10 + 8 * power), {}, { time: 5, land: true }).x;
  const shot = solveLob(reach, 20, { pitches: [0] });
  assert.ok(shot.exact); assert.ok(Math.abs(reach(shot.pitch, shot.power) - 20) < .5);
  const far = solveLob(reach, 400, { pitches: [0] }); assert.equal(far.exact, false); assert.equal(far.power, 1);
});
