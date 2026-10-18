import test from 'node:test';
import assert from 'node:assert/strict';
import { Kitchen } from '../public/rules.js';
test('orders, duration, impatience, kitchen switching and options survive start and recovery', () => {
  const g = new Kitchen(); g.addPlayer(1, 'Ana');
  assert.ok(g.configure({ duration: 300, orders: 'arepa', impatient: false, kitchen: 'playa', switchKitchen: true })); g.start(false);
  assert.equal(g.remaining, 300); assert.ok(g.orders.every(o => o.recipe === 'arepa'));
  const patience = g.orders[0].remaining; g.update(.1); assert.equal(g.orders[0].remaining, patience);
  g.remaining = 150; g.update(.05); assert.equal(g.kitchen, 'mercado'); assert.equal(g.switched, true);
  const restored = new Kitchen(); restored.restore(g.snapshot(), new Map([[1, {}]])); assert.deepEqual(restored.options, g.options); assert.equal(restored.kitchen, 'mercado');
  assert.equal(g.configure({ duration: 180 }), false); assert.equal(new Kitchen().configure({ duration: 1 }), false);
});
test('difficulty changes customer patience, fast fire burns earlier and disabled tips remove combo points', () => {
  const easy = new Kitchen({ difficulty: 'easy' }), hard = new Kitchen({ difficulty: 'chaos' }); easy.start(false); hard.start(false); assert.ok(easy.orders[0].total > hard.orders[0].total);
  const g = new Kitchen({ fire: 'fast', tips: false }); g.addPlayer(1, 'Ana'); g.start(false);
  const stove = g.stations.find(s => s.id === 'stove-1'); stove.item = { recipe: 'arepa', stage: 'cooked' }; stove.progress = 11; g.update(.05); assert.equal(stove.fire, 2);
  const p = g.players[0]; Object.assign(p, { x: 4, z: 7.8, held: { recipe: 'arepa', stage: 'cooked' }, cooldown: 0 }); g.combo = 4; g.interact(1, 'serve'); assert.equal(g.score, 80);
});
