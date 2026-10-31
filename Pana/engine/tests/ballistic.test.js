import test from 'node:test';
import assert from 'node:assert/strict';
import { aimVelocity, stepFlight, simulateFlight, FLIGHT } from '../play/ballistic.js';

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
