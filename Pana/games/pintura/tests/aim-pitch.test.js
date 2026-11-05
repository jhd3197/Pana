// A first-person shot flies along the look: up, down or diagonal, through the real rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, EYE, SHOT_HEIGHT, cleanInput, sweepShot } from '../public/rules.js';

// Two panas on open ground (no cover unless a test gives some), `gap` metres apart along x.
function duel(cover = [], gap = 20) {
  const g = new Arena('plaza', 'normal', { lives: 0 }); g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} }); g.start(); g.go();
  Object.defineProperty(g, 'cover', { value: cover });
  const [a, b] = g.players; Object.assign(a, { x: 0, z: 0, shield: 0 }); Object.assign(b, { x: gap, z: 0, shield: 0 });
  return { g, a, b };
}
const shoot = (g, aim) => g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true, ...aim }]]));
const fly = (g, n = 40) => { for (let i = 0; i < n; i++) g.step(.05, new Map()); };
const hits = b => b.hits + b.paint;

test('the ball leaves the eye along the look: level, up, down', () => {
  const launched = pitch => { const { g } = duel([], 200); shoot(g, { pitch }); return g.balls[0]; };
  const level = launched(0), up = launched(.4), down = launched(-.1);
  assert.equal(level.vy, 0); assert.ok(up.vy > 0); assert.ok(down.vy < 0);
  assert.ok(Math.abs(up.vy / Math.hypot(up.vx, up.vz) - Math.tan(.4)) < .02, 'climbs at the pitch');
  assert.ok(Math.abs(level.y - EYE) < 1e-9, 'from the eye');
  assert.ok(Math.abs(up.y - (EYE + Math.tan(.4) * (up.x - up.x0))) < .02, 'on the ray');
});

test('with no look the shot still flies level at shot height', () => {
  const { g } = duel([], 200); shoot(g, {});
  assert.equal(g.balls[0].vy, 0); assert.equal(g.balls[0].y, SHOT_HEIGHT);
});

test('no look stays no look after cleaning on both ends of the wire', () => {
  assert.equal(cleanInput(cleanInput(cleanInput({ pitch: null }))).look, false);
  const sent = cleanInput(cleanInput({ pitch: .3 })); assert.equal(sent.look, true); assert.equal(sent.pitch, .3);
  const { g } = duel([], 200); shoot(g, cleanInput(cleanInput({ ax: 1, az: 0, fire: true, pitch: null })));
  assert.equal(g.balls[0].y, SHOT_HEIGHT);
});

test('aiming over a pana misses them and aiming at them hits', () => {
  const at = pitch => { const { g, b } = duel(); shoot(g, { pitch }); fly(g); return hits(b); };
  assert.ok(at(0) > 0, 'level at the eye line');
  assert.ok(at(Math.atan2(1.1 - EYE, 20)) > 0, 'at the chest');
  assert.equal(at(.4), 0, 'over the head');
});

test('aiming down paints the ground in front, short of a pana further on', () => {
  const pitch = -.3, { g, b } = duel(); shoot(g, { pitch }); fly(g);
  assert.equal(hits(b), 0);
  const mark = g.splats.at(-1), expected = EYE / Math.tan(-pitch);
  assert.ok(Math.abs(mark.x - expected) < .01, `lands at ${mark.x}, the ray meets the ground at ${expected}`);
  assert.ok(Math.abs(mark.hy) < 1e-6);
});

test('a jump lifts the pana a shot must reach', () => {
  const shot = { x: 0, y: 2.2, z: 0, vx: 85, vy: 0, vz: 0 }, at = jumpHeight => sweepShot(shot, .1, [], [{ id: 2, x: 5, z: 0, jumpHeight }]).victim?.id;
  assert.equal(at(0), undefined, 'over a standing head');
  assert.equal(at(.5), 2, 'meets the jump');
});

test('a wall takes the paint at the height the ray meets it', () => {
  const wall = { x: 10, z: 0, w: 1, d: 20, h: 6, height: 6 }, { g } = duel([wall]), pitch = .2; shoot(g, { pitch }); fly(g);
  const mark = g.splats.at(-1), flown = mark.x;
  assert.ok(Math.abs(mark.hy - (EYE + Math.tan(pitch) * flown)) < 1e-6, `at ${mark.hy}`);
  assert.ok(mark.hy > 2.5, 'well over the old flat line');
});

test('a look over a low wall clears it; a look at it stops there', () => {
  const wall = { x: 10, z: 0, w: 1, d: 20, h: 2, height: 2 };
  const over = duel([wall]); shoot(over.g, { pitch: .2 }); fly(over.g, 3); assert.ok(over.g.balls.length === 0 || over.g.balls[0].x > 10.6, 'flew over');
  assert.ok(!over.g.splats.some(s => Math.abs(s.x - 10) < 1), 'no mark on the wall');
  const at = duel([wall]); shoot(at.g, { pitch: 0 }); fly(at.g, 3); assert.ok(at.g.splats.some(s => Math.abs(s.x - 9.38) < .01), 'stopped on its face');
});

test('coming down on a low box lands on its top', () => {
  const box = { x: 3, z: 0, w: 2, d: 2, h: 1, height: 1 }, { g } = duel([box]); shoot(g, { pitch: Math.atan2(1 - EYE, 3) }); fly(g, 3);
  const mark = g.splats.at(-1);
  assert.ok(Math.abs(mark.hy - 1) < 1e-6 && mark.x > 2 && mark.x < 3.2, `on top at ${mark.x}, ${mark.hy}`);
});

test('a ball over the fence leaves the court without a mark', () => {
  const { g } = duel([], 200); g.players[0].x = 24; shoot(g, { pitch: .55 }); fly(g, 30);
  assert.equal(g.splats.length, 0);
});

test('a rocket bursting high stays in the air, harmless under it; one on the floor paints', () => {
  const burst = y => { const { g, b } = duel([], 6); g.blast({ id: 99, owner: 1, color: '#fff', x: 6, y, z: 0, rocket: true, kind: 'rocket' }, 5); return { g, b }; };
  const air = burst(30); assert.equal(hits(air.b), 0); assert.equal(air.g.booms[0].y, 30); assert.equal(air.g.splats.length, 0);
  const floor = burst(.2); assert.ok(hits(floor.b) > 0); assert.equal(floor.g.booms[0].y, 0); assert.equal(floor.g.splats[0].blast, true);
});

test('sweepShot skips boxes a level shot clears, and those with shots off', () => {
  const low = { x: 5, z: 0, w: 1, d: 1, h: SHOT_HEIGHT }, off = { x: 3, z: 0, w: 1, d: 1, h: 3, shots: false };
  assert.ok(sweepShot({ x: 0, y: SHOT_HEIGHT, z: 0, vx: 85, vy: 0, vz: 0 }, .1, [low, off], []).t > 1);
});
