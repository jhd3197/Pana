import test from 'node:test';
import assert from 'node:assert/strict';
import { Kitchen, STATIONS, RECIPES, PREP_TIME, BURN_TIME, DURATION, blocked, move } from '../public/rules.js';
const advance = (g, seconds) => { for (let i = 0; i < seconds; i += 0.05) g.update(Math.min(0.05, seconds - i)); };
function fresh(helpers = false) { const g = new Kitchen(); g.addPlayer(1, 'Juan'); g.start(helpers); return g; }
function use(g, station, id = 1) { const s = STATIONS.find(s => s.id === station), p = g.players.find(p => p.id === id); p.x = s.x; p.z = s.z + s.d / 2 + 0.65; p.cooldown = 0; return g.interact(id, station); }

for (const r of RECIPES) test(`${r.name}: ingredients → prep → stove → serving scores exactly once`, () => {
  const g = fresh(), p = g.players[0];
  use(g, `supply-${r.id}`); assert.deepEqual(p.held, { recipe: r.id, stage: 'raw' });
  use(g, 'stove-1'); assert.equal(p.held.stage, 'raw');
  use(g, 'prep-1'); assert.equal(p.held, null); use(g, 'prep-1'); assert.equal(p.held, null);
  advance(g, PREP_TIME + 0.1); use(g, 'prep-1'); assert.equal(p.held.stage, 'prepared');
  use(g, 'stove-1'); advance(g, r.cook + 0.1); use(g, 'stove-1'); assert.equal(p.held.stage, 'cooked');
  use(g, 'serve'); assert.equal(g.score, r.points); assert.equal(g.served, 1); assert.equal(g.orders.length, 4);
  use(g, 'serve'); assert.equal(g.score, r.points); assert.equal(p.held, null);
});
test('remote interactions cannot reach distant stations or act outside a turn', () => {
  const g = fresh(); assert.match(g.interact(1, 'supply-arepa'), /Acércate/); assert.equal(g.players[0].held, null);
  g.phase = 'results'; use(g, 'supply-arepa'); assert.equal(g.players[0].held, null);
});
test('counter passes a dish between two players without duplicating it', () => {
  const g = fresh(); g.addPlayer(2, 'Ana'); use(g, 'supply-empanada'); use(g, 'counter-1');
  assert.equal(g.players[0].held, null); use(g, 'counter-1', 2);
  assert.equal(g.players[1].held.recipe, 'empanada'); assert.equal(g.stations.find(s => s.id === 'counter-1').item, null);
});
test('a neglected stove burns and two actions recover it', () => {
  const g = fresh(); use(g, 'supply-arepa'); use(g, 'prep-1'); advance(g, 2.5); use(g, 'prep-1'); use(g, 'stove-1');
  advance(g, 6 + BURN_TIME + 0.1); const s = g.stations.find(s => s.id === 'stove-1');
  assert.equal(s.fire, 2); assert.equal(g.burnt, 1); use(g, 'stove-1'); assert.equal(s.fire, 1);
  use(g, 'stove-1'); assert.equal(s.fire, 0); assert.equal(s.item, null);
});
test('expiration resets combo and replenishes orders; replay resets the kitchen', () => {
  const g = fresh(); g.combo = 4; g.orders[0].remaining = 0.01; advance(g, 0.1);
  assert.equal(g.missed, 1); assert.equal(g.combo, 0); assert.equal(g.orders.length, 4);
  advance(g, DURATION); assert.equal(g.phase, 'results'); g.start(false);
  assert.equal(g.remaining, DURATION); assert.equal(g.score, 0); assert.equal(g.missed, 0); assert.equal(g.phase, 'playing');
});
test('collision prevents crossing tables and kitchen bounds', () => {
  const p = { x: -9, z: 6 }; move(p, 0, -10); assert.ok(p.z > 4.5); assert.equal(blocked(p.x, p.z), false);
  move(p, 100, 0); assert.ok(p.x <= 10.52); assert.equal(blocked(p.x, p.z), false);
});
test('solo helpers navigate the real kitchen and serve multiple meals', () => {
  const g = fresh(true); advance(g, 179);
  assert.ok(g.served >= 6, `served ${g.served}`); assert.ok(g.players.filter(p => p.bot).every(p => p.deliveries > 0));
  assert.ok(g.players.every(p => !blocked(p.x, p.z))); assert.equal(g.burnt, 0);
});
test('late joins replace a helper; host migration retains food, score and time', () => {
  const g = fresh(true); advance(g, 40); g.addPlayer(2, 'Ana'); assert.equal(g.players.length, 3);
  const saved = g.snapshot(), recovered = new Kitchen(); recovered.restore(saved, new Map([[2, { name: 'Ana' }]]));
  assert.equal(recovered.score, saved.score); assert.equal(recovered.remaining, saved.remaining);
  assert.ok(recovered.players.some(p => p.id === 2)); assert.ok(!recovered.players.some(p => p.id === 1));
  assert.deepEqual(recovered.orders, saved.orders); advance(recovered, 50); assert.ok(recovered.served > saved.served);
});
test('all eight players spawn clear of kitchen counters', () => {
  const g = new Kitchen(); for (let i = 1; i <= 8; i++) g.addPlayer(i, `Pana ${i}`);
  g.start(); assert.equal(g.players.length, 8); assert.ok(g.players.every(p => !blocked(p.x, p.z)));
  assert.equal(new Set(g.players.map(p => `${p.x}:${p.z}`)).size, 8);
});
