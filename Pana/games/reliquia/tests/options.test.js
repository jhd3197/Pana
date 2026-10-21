import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, interaction } from '../public/rules.js';
import { spawnEnemy } from '../public/enemies.js';
import { layoutFor } from '../public/layout.js';
import { validOptions, DEFAULT_OPTIONS } from '../public/options.js';

function setup(options = {}, n = 2) { const g = new Expedition(31, options); for (let i = 1; i <= n; i++) g.addPlayer(i, `Pana ${i}`); g.start(31); return g; }

test('only valid options apply, and only outside a run', () => {
  assert.equal(validOptions({ difficulty: 'hard' }), true); assert.equal(validOptions({ difficulty: 'impossible' }), false);
  const g = new Expedition(1); assert.equal(g.configure({ greed: 'fierce' }), true); assert.equal(g.options.greed, 'fierce');
  g.addPlayer(1, 'Ana'); g.start(); assert.equal(g.configure({ greed: 'soft' }), false);
  const restored = new Expedition(); restored.restore(g.snapshot(), new Map([[1, { id: 1, name: 'Ana' }]])); assert.deepEqual(restored.options, g.options);
  assert.equal(DEFAULT_OPTIONS.difficulty, 'normal');
});

test('each jornada is one floor, deeper and richer; the vault every third', () => {
  for (const depth of [1, 2, 3, 4]) {
    const run = layoutFor(8, depth).run;
    assert.equal(Math.max(...run.rooms.map(r => r.floor)), 1);
    assert.equal(run.rooms.some(r => r.kind === 'boveda'), depth % 3 === 0);
    assert.equal(run.seals.length, depth % 3 === 0 ? 0 : 1);
  }
  assert.ok(layoutFor(8, 4).run.sleepers.length > layoutFor(8, 1).run.sleepers.length, 'more sleepers deeper');
});

test('difficulty scales enemy health and damage; greed scales la codicia', () => {
  const easy = setup({ difficulty: 'easy' }), hard = setup({ difficulty: 'hard' });
  const at = g => { const s = g.layout.run.lifts.find(l => l.floor === 1); return { x: s.x, z: s.z - 5 }; };
  const a = spawnEnemy(easy, 'mummy', at(easy).x, at(easy).z - 6), b = spawnEnemy(hard, 'mummy', at(hard).x, at(hard).z - 6);
  assert.ok(b.hp > a.hp);
  const soft = setup({ greed: 'soft' }), fierce = setup({ greed: 'fierce' });
  soft.greed(10); fierce.greed(10); assert.ok(fierce.codicia > soft.codicia * 2);
});

test('without revives a fallen pana stays out; the wipe share and crude barks follow the room', () => {
  const g = setup({ revive: false, wipeShare: 50, crude: true });
  const [a, b] = g.players; Object.assign(b, { x: a.x + 1, z: a.z });
  g.damage(a, 100); assert.equal(interaction(g, b)?.kind === 'revive', false);
  g.haul = 1000; Object.assign(a, { x: 0, z: 4 }); Object.assign(b, { x: 1, z: 4 }); b.invulnerable = 0; g.damage(b, 100);
  for (let i = 0; i < 70; i++) g.update(.05);
  assert.equal(g.outcome, 'wipe'); assert.equal(g.payout, 500); assert.match(g.events.at(-1).text, /pajúos/);
  const clean = setup({ wipeShare: 0 }); clean.players.forEach(p => { Object.assign(p, { x: 0, z: 4 }); clean.damage(p, 100); });
  for (let i = 0; i < 70; i++) clean.update(.05);
  assert.equal(clean.payout, 0); assert.doesNotMatch(clean.events.at(-1).text, /pajúo/);
});
