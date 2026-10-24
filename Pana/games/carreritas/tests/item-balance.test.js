import test from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../../../engine/random.js';
import { itemWeights, drawItem, pickupEligibility, incomingThreat, reactToThreat, reactionDelay } from '../public/item-rules.js';

const racer = (prog, extra = {}) => ({ lap: 1, prog, vf: 30, ...extra });
const probability = (weights, kinds) => kinds.reduce((n, k) => n + (weights[k] || 0), 0) / Object.values(weights).reduce((a, b) => a + b, 0);

test('real separation earns recovery supplies without granting major attacks to a tight pack', () => {
  const leader = racer(800), near = racer(790), far = racer(400);
  const close = itemWeights(near, [leader, near], 1000, { elapsed: 30 });
  const distant = itemWeights(far, [leader, far], 1000, { elapsed: 30 });
  assert.equal(close.chancleta + close.aguacero, 0);
  assert.ok(probability(distant, ['jugo', 'jugo3', 'totuma']) > probability(close, ['jugo', 'jugo3', 'totuma']) + 0.2);
  assert.ok(probability(distant, ['chancleta', 'aguacero']) < 0.09);
  assert.equal(itemWeights(leader, [leader, far], 1000, { elapsed: 90 }).chancleta, 0);
});

test('lap wrap, absent racers, opening seconds and large lobbies keep eligibility honest', () => {
  const leader = racer(20, { lap: 2 }), last = racer(990);
  assert.equal(itemWeights(last, [leader, last], 1000, { elapsed: 30 }).aguacero, 0, 'only 30 metres apart across the line');
  last.lap = 0;
  assert.ok(itemWeights(last, [leader, last], 1000, { elapsed: 30 }).aguacero > 0, 'a full lap behind deserves help');
  assert.equal(itemWeights(last, [leader, last], 1000, { elapsed: 11.9 }).aguacero, 0);
  const four = [racer(900), racer(800), racer(700), racer(100)];
  const eight = [four[0], ...Array.from({ length: 6 }, (_, i) => racer(800 - i * 80)), four[3]];
  const a = itemWeights(four[3], four, 1000, { elapsed: 30 });
  const b = itemWeights(four[3], eight, 1000, { elapsed: 30 });
  assert.equal(b.chancleta, a.chancleta / 2);
  const absent = [racer(3000, { done: true }), racer(2500, { dns: true }), racer(2200, { ghost: true }), racer(2000, { retired: true })];
  assert.deepEqual(itemWeights(four[3], [...absent, ...four], 1000, { elapsed: 30 }), a);
});

test('stopping, reversing and revisiting a crate cannot farm comeback items; next lap can', () => {
  const c = racer(100), history = new Map();
  assert.ok(pickupEligibility(c, 1000, history));
  c.prog = 80; c.vf = -10;
  assert.equal(pickupEligibility(c, 1000, history), false);
  c.prog = 100; c.vf = 30;
  assert.equal(pickupEligibility(c, 1000, history), false);
  c.prog = 200; c.vf = 0;
  assert.equal(pickupEligibility(c, 1000, history), false);
  c.prog = 250; c.vf = 30;
  assert.equal(pickupEligibility(c, 1000, history, false), false, 'driving forward while facing the wrong way');
  c.lap = 2; c.prog = 100;
  assert.ok(pickupEligibility(c, 1000, history));
  const weights = itemWeights(c, [racer(600, { lap: 3 }), c], 1000, { elapsed: 60, eligible: false });
  assert.equal(weights.chancleta + weights.aguacero + weights.jugo3, 0);
  assert.ok(weights.jugo > 0, 'basic supplies still work');
});

test('seeded item streams repeat and sampled recovery odds match their intended range', () => {
  const c = racer(100), weights = itemWeights(c, [racer(900), c], 1000, { elapsed: 60 });
  const sample = seed => { const random = rng(seed); return Array.from({ length: 10000 }, () => drawItem(weights, random)); };
  const a = sample(42);
  assert.deepEqual(a, sample(42));
  const recovery = a.filter(k => ['jugo', 'jugo3', 'totuma'].includes(k)).length / a.length;
  assert.ok(recovery > 0.49 && recovery < 0.56, String(recovery));
  assert.equal(drawItem({ mango: 0, jugo: 1 }, () => 0), 'jugo', 'zero probability really excludes an item');
  const battle = itemWeights(c, [], 0, { battle: true, eligible: false });
  assert.equal(battle.chancleta, undefined);
  assert.deepEqual(battle, itemWeights(c, [c], 1000, { battle: true, elapsed: 100 }));
});

test('bots distinguish approaching shots from misses, departing shots and other decks', () => {
  const c = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  const shot = { id: 'a', kind: 'mango', h: 0, speed: 40, m: { position: { x: 0, y: 1, z: -30 } } };
  assert.ok(incomingThreat(c, shot));
  assert.equal(incomingThreat(c, { ...shot, h: Math.PI }), false);
  assert.equal(incomingThreat(c, { ...shot, m: { position: { x: 8, y: 1, z: -30 } } }), false);
  assert.equal(incomingThreat(c, { ...shot, m: { position: { x: 0, y: 15, z: -30 } } }), false);
  assert.equal(incomingThreat(c, { ...shot, owner: c }), false);
  assert.equal(incomingThreat(c, { ...shot, dead: true }), false);
  assert.ok(incomingThreat(c, { ...shot, kind: 'chancleta', target: c, m: { position: { x: 0, y: 8, z: -30 } } }));
});

test('reaction time is difficulty-dependent, frame-rate independent and resets for a new threat', () => {
  assert.equal(reactionDelay(1.8), 0.54);
  assert.equal(reactionDelay(1), 0.3);
  assert.equal(reactionDelay(0.6), 0.18);
  for (const hz of [30, 60, 120]) {
    const state = {};
    for (let i = 1; i < hz * 0.3; i++) assert.equal(reactToThreat(state, 'a', 1 / hz, 0.3), false);
    assert.equal(reactToThreat(state, 'a', 1 / hz, 0.3), true);
    assert.equal(reactToThreat(state, 'b', 1 / hz, 0.3), false);
    assert.equal(reactToThreat(state, null, 1 / hz, 0.3), false);
    assert.equal(state.time, 0);
  }
});
