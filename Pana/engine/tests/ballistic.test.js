import test from 'node:test';
import assert from 'node:assert/strict';
import { aimVelocity, stepFlight, simulateFlight, stepBounce, simulateBounce, FLIGHT } from '../play/ballistic.js';

const flatGround = (x, y) => y < 0;

test('without wind a 45 degree shot lands at v²/g, like the textbook', () => {
  const v = 20, end = simulateFlight({ x: 0, y: 0.001, ...aimVelocity(Math.PI / 4, 1, v) }, { solid: flatGround }, { dt: 1 / 240 });
  assert.equal(end.hit, 'ground');
  assert.ok(Math.abs(end.x - v * v / FLIGHT.gravity) < .3, `landed at ${end.x}`);
});

test('wind pushes the shell downwind; facing flips the shot', () => {
  const start = { x: 0, y: .01, ...aimVelocity(Math.PI / 4, 1, 20) };
  const calm = simulateFlight(start, { solid: flatGround }).x;
  assert.ok(simulateFlight(start, { solid: flatGround, wind: 1 }).x > calm + 3);
  assert.ok(simulateFlight(start, { solid: flatGround, wind: -1 }).x < calm - 3);
  const left = simulateFlight({ x: 0, y: .01, ...aimVelocity(Math.PI / 4, -1, 20) }, { solid: flatGround });
  assert.ok(Math.abs(left.x + calm) < 1e-9);
});

test('a fast shell cannot pass a thin wall between two steps', () => {
  const wall = (x, y) => x > 5 && x < 5.1;
  const ball = { x: 0, y: 1, vx: 300, vy: 0 };
  const r = stepFlight(ball, 1 / 30, { gravity: 0, solid: wall });
  assert.equal(r.hit, 'ground'); assert.ok(ball.x > 4.9 && ball.x < 5.15, `stopped at ${ball.x}`);
});

test('a target in front of the ground is hit first', () => {
  const ball = { x: 0, y: 1, vx: 60, vy: 0 }, capy = { x: 2, y: 1, radius: .7 };
  const r = stepFlight(ball, .1, { gravity: 0, solid: (x) => x > 4, targets: [capy] });
  assert.equal(r.hit, 'target'); assert.equal(r.victim, capy);
  assert.ok(Math.abs(ball.x - 1.3) < 1e-6);
});

test('falling into the river or off the map ends the flight', () => {
  const bounds = { water: 2, left: -10, right: 10 };
  assert.equal(simulateFlight({ x: 0, y: 5, vx: 0, vy: 0 }, { bounds }).hit, 'water');
  assert.equal(simulateFlight({ x: 0, y: 50, vx: 30, vy: 0 }, { bounds }).hit, 'out');
  const flying = simulateFlight({ x: 0, y: 5, vx: 0, vy: 100 }, {}, { maxTime: .5 });
  assert.equal(flying.hit, null); assert.ok(flying.points.length > 2);
});

test('a bouncing throw loses speed into the ground, keeps going along it, then rests', () => {
  const ball = { x: 0, y: 1, vx: 4, vy: -10 };
  let r = null;
  for (let i = 0; i < 20 && r?.hit !== 'bounce'; i++) r = stepBounce(ball, 1 / 60, { solid: flatGround, restitution: .5, friction: .8 });
  assert.equal(r.hit, 'bounce');
  assert.ok(ball.vy > 0 && ball.vy < 7, `bounced up at ${ball.vy}`);
  assert.ok(Math.abs(ball.vx - 3.2) < .01, 'friction keeps 80 % along the ground');
  assert.ok(ball.y >= 0, 'never left inside the ground');
  const end = simulateBounce({ x: 0, y: 1, vx: 4, vy: 0 }, { solid: flatGround, restitution: .5, friction: .8 }, { fuse: 5 });
  assert.equal(end.hit, 'fuse'); assert.ok(end.rested && end.bounces >= 2, `${end.bounces} bounces, rested ${end.rested}`);
  assert.ok(end.y >= 0 && end.y < .2 && end.x > 1, `came to rest on the ground at ${end.x.toFixed(2)}, ${end.y.toFixed(2)}`);
});

test('a bounce off a wall sends it back; off a round target too; water ends it', () => {
  const wall = (x, y) => x > 3 || y < 0;
  const end = simulateBounce({ x: 0, y: 2, vx: 12, vy: 2 }, { solid: wall, restitution: .5, friction: .8, normal: (x, y) => (x > 2.9 ? { x: -1, y: 0 } : { x: 0, y: 1 }) }, { fuse: 3 });
  assert.ok(end.x < 3 && end.points.some(p => p.x > 2.5), `came back off the wall to ${end.x.toFixed(2)}`);
  const ball = { x: 0, y: 5, vx: 10, vy: 0 }, capi = { x: 1.2, y: 5, radius: .7 };
  const r = stepBounce(ball, .1, { gravity: 0, targets: [capi] });
  assert.equal(r.hit, 'bounce'); assert.equal(r.victim, capi); assert.ok(ball.vx < 0, 'it bounced back off the capi');
  assert.equal(simulateBounce({ x: 0, y: 5, vx: 0, vy: 0 }, { bounds: { water: 2, left: -9, right: 9 } }).hit, 'water');
});

test('a throw wedged in a crevice stops after maxBounces instead of jittering for ever', () => {
  const vee = (x, y) => y < Math.abs(x) * 3;   // walls far steeper than a floor it could rest on
  const end = simulateBounce({ x: 0, y: 2, vx: 0, vy: 0 }, { solid: vee, normal: x => ({ x: -Math.sign(x) * .95, y: .3 }), maxBounces: 10 }, { fuse: 8 });
  assert.equal(end.hit, 'fuse'); assert.ok(end.rested && end.bounces <= 10, `${end.bounces} bounces`);
});
