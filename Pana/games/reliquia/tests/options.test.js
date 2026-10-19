import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, interaction, trapPositions, trapActive } from '../public/rules.js';
import { CAMP } from '../public/layout.js';
test('mummy count, difficulty and revive rules govern the host simulation and survive migration', () => {
  const g = new Expedition(1, { mummies: 1, difficulty: 'hard', revive: false }); g.addPlayer(1, 'Ana'); g.addPlayer(2, 'Luis'); g.start();
  const mummy = g.spawn(0, -12); assert.equal(mummy.hp, 81); assert.equal(g.spawn(2, -12), null);
  const [a, b] = g.players; g.damage(a, 20); assert.equal(a.hp, 70); b.downed = true; assert.equal(interaction(g, a), null);
  const restored = new Expedition(); restored.restore(g.snapshot(), new Map(g.players.map(p => [p.id, p]))); assert.deepEqual(restored.options, g.options);
  assert.equal(g.configure({ mummies: 3 }), false); assert.equal(new Expedition().configure({ difficulty: 'impossible' }), false);
});
test('trap density and temple select actual plates; red plates damage but idle plates do not', () => {
  assert.equal(trapPositions({ traps: 'few' }).length, 3); assert.equal(trapPositions({ traps: 'many' }).length, 9);
  assert.notEqual(trapPositions({ temple: 'tepuy' })[0].x, trapPositions({ temple: 'selva' })[0].x);
  const g = new Expedition(1, { traps: 'few' }); g.addPlayer(1, 'Ana'); g.start(); const p = g.players[0], trap = g.traps[0];
  Object.assign(p, { x: trap.x, z: trap.z }); g.update(.05); assert.equal(p.hp, 100);
  g.time = 3; assert.equal(trapActive(g.time, trap), true); g.update(.05); assert.equal(p.hp, 82);
});

test('no-revive expeditions can extract survivors but never abandon living teammates', () => {
  for (const revive of [true, false]) {
    const g = new Expedition(1, { revive }); g.addPlayer(1, 'Ana'); g.addPlayer(2, 'Luis'); g.start();
    Object.assign(g, { gateOpen: true, guardianDefeated: true, relicTaken: true, carrier: 1 });
    const [a, b] = g.players; Object.assign(a, CAMP); Object.assign(b, { x: 20, z: -50 });
    for (let i = 0; i < 65; i++) g.update(.05, new Map([[1, { hold: true }]]));
    assert.equal(g.phase, 'playing', 'living teammates must return even without revives');
    b.downed = true;
    for (let i = 0; i < 65; i++) g.update(.05, new Map([[1, { hold: true }]]));
    assert.equal(g.phase, revive ? 'playing' : 'results');
    if (!revive) assert.equal(g.outcome, 'win');
  }
});
