import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, READY_TIMEOUT, COUNTDOWN } from '../public/rules.js';
// Two people face to face on the open plaza lane, plus an optional bot.
const round = ({ bot = false } = {}) => {
  const g = new Arena('plaza', 'normal', { toughness: 1 }); g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} });
  if (bot) g.add(3, { name: 'Bot', avatar: {}, bot: true });
  g.start(); Object.assign(g.players[0], { x: -3, z: -4, shield: 0 }); Object.assign(g.players[1], { x: 3, z: -4, shield: 0 }); return g;
};
const run = (g, seconds, inputs) => { for (let i = 0; i < Math.round(seconds / .05); i++) g.step(.05, inputs); };
const attack = new Map([[1, { x: 1, ax: 1, az: 0, fire: true, grenade: true }]]);

test('before ¡YA! nobody moves, shoots, throws, gets painted or runs the clock', () => {
  const g = round({ bot: true }), [a, b] = g.players;
  assert.equal(g.view().loading, READY_TIMEOUT); assert.equal(g.view().countdown, 0); assert.equal(g.live, false);
  run(g, 2, attack); g.hit = () => assert.fail('nobody is hit while loading');
  g.markReady(1, g.round); g.markReady(2, g.round); run(g, COUNTDOWN - .1, attack);
  assert.ok(g.countdown > 0); assert.equal(g.time, g.options.duration); assert.equal(a.x, -3); assert.equal(a.ammo, 12); assert.equal(a.grenadeReady, true);
  assert.deepEqual(g.balls, []); assert.deepEqual(g.grenades, []); assert.equal(b.paint, 0); assert.equal(g.players[2].ammo, 12, 'bots hold their fire too');
});

test('the countdown starts once every connected person is ready; bots never wait', () => {
  const g = round({ bot: true });
  assert.equal(g.markReady(1, g.round), true); run(g, .5); assert.ok(g.loading > 0, 'still waiting for B');
  assert.equal(g.markReady(2, g.round + 1), false, 'a stale or future round does not count');
  assert.equal(g.markReady(2, 'x'), false); assert.equal(g.markReady(3, g.round), false, 'bots are already ready');
  assert.equal(g.markReady(2, g.round), true); assert.equal(g.loading, 0); assert.equal(g.countdown, COUNTDOWN);
  const bots = new Arena(); bots.add(1, { name: 'Bot', bot: true }); bots.add(2, { name: 'Bot 2', bot: true }); bots.start();
  assert.equal(bots.countdown, COUNTDOWN, 'a round of bots counts down at once');
});

test('a stuck client cannot hold the round: the countdown starts after the timeout', () => {
  const g = round(); g.markReady(1, g.round); run(g, READY_TIMEOUT - .1); assert.ok(g.loading > 0);
  run(g, .15); assert.equal(g.loading, 0); assert.ok(g.countdown > COUNTDOWN - .1);
  const left = round(); left.markReady(1, left.round); left.players[1].connected = false; left.step(.05);
  assert.equal(left.loading, 0, 'someone who left is not waited for');
});

test('practice waits only for the local pana; late arrivals count as ready', () => {
  const g = new Arena(); g.add(1, { name: 'Yo' }); ['Coco', 'Lola'].forEach((name, i) => g.add(1000 + i, { name, bot: true })); g.start();
  assert.ok(g.loading > 0); g.markReady(1, g.round); assert.equal(g.countdown, COUNTDOWN);
  g.add(7, { name: 'Tarde' }); assert.equal(g.ready.has(7), true, 'joining mid-countdown');
  run(g, COUNTDOWN + .05); assert.equal(g.live, true); g.add(8, { name: 'Más tarde' }); assert.equal(g.ready.has(8), true);
});

test('after ¡YA! shots fly and land', () => {
  const g = round(), [a, b] = g.players; g.markReady(1, g.round); g.markReady(2, g.round); run(g, COUNTDOWN + .05);
  assert.equal(g.live, true); g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true }]])); assert.equal(a.ammo, 11);
  run(g, .5); assert.equal(a.score, 1); assert.ok(g.time < g.options.duration);
});
