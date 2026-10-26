import test from 'node:test';
import assert from 'node:assert/strict';
import { Bash } from '../public/rules.js';
import { PANAS, fighterId, panaOfFighter, costumeLook, poderStats } from '../public/panas.js';
import { getFighterDefinition } from '../public/combat/roster.js';
import { createEmptyInput } from '../public/combat/engine.js';
import { normalizeWardrobe } from '../../../engine/wardrobe.js';

function duel(pana, target = 'trueno') {
  const g = new Bash(5); g.configure({ seats: 2, items: false });
  g.addPlayer(1, 'Ana'); g.addPlayer(2, 'Bruno');
  assert(g.choosePana(1, pana)); assert(g.choosePana(2, target));
  g.start(); g.combat.countdownFrames = 0; g.update(1 / 60);
  g.combat.fighters.forEach((f, i) => Object.assign(f, { state: 'idle', grounded: true, invulnerableFrames: 0, velocity: { x: 0, y: 0 }, facing: i ? -1 : 1 }));
  g.combat.fighters[0].position.x = -40; g.combat.fighters[1].position.x = 40;
  return g;
}
const press = (taps) => new Map([[1, { held: ['special'], taps: { special: taps } }]]);
const run = (g, n, inputs = new Map()) => { for (let i = 0; i < n; i++) g.update(1 / 60, inputs); };

test('every pana has a costume, three trajes and a registered poder per style', () => {
  assert.equal(PANAS.length, 13);
  assert.equal(new Set(PANAS.map(p => p.key)).size, 13);
  for (const p of PANAS) {
    assert.equal(p.trajes.length, 3, p.id);
    const look = normalizeWardrobe(costumeLook(p.id, 2, { fur: '#cf7d22' }));
    for (const slot of ['hat', 'top', 'back', 'neck', 'glasses', 'print']) if (p.look[slot]) assert.equal(look[slot], p.look[slot], `${p.id} ${slot}`);
    for (const key of p.paint) assert.equal(look.colors[key], p.trajes[2], `${p.id} ${key}`);
    for (const style of ['kaykit-knight', 'platformer', 'yeti']) {
      const def = getFighterDefinition(fighterId(style, p.id));
      assert.equal(def.attacks['neutral-special'].damage, p.move.damage, p.id);
      assert.equal(def.weight, getFighterDefinition(style).weight);
      assert.deepEqual(def.attacks['up-special'], getFighterDefinition(style).attacks['up-special']);
    }
    assert.equal(panaOfFighter(fighterId('yeti', p.id)).id, p.id);
    assert(poderStats(p.id).every(([, v]) => v >= 1 && v <= 5));
  }
});

test('each poder lands its damage and status through normal hit resolution', () => {
  for (const p of PANAS) {
    const g = duel(p.id), [a, b] = g.combat.fighters, move = a.definition.attacks['neutral-special'];
    if (p.move.requiresFacingTarget) b.facing = -1;
    g.combat.resolveAttackHit(a, b, move, 'neutral-special', createEmptyInput());
    assert(Math.abs(b.percent - p.move.damage) < 1e-6, p.id);
    if (p.move.statusEffect) assert.equal(b.statusEffect, p.move.statusEffect, p.id);
  }
});

test('poderes fire from real input: lunges travel, shots fly, Medusa needs eye contact', () => {
  const bull = duel('minotauro'), x = bull.combat.fighters[0].position.x;
  run(bull, 40, press(1));
  assert(bull.combat.fighters[0].position.x > x + 60, 'Embestida charges forward');
  assert(bull.combat.fighters[1].percent > 0, 'Embestida connects');

  const ice = duel('raspadero'); ice.combat.fighters[1].position.x = 260;
  run(ice, 24, press(1));
  assert.equal(ice.combat.projectiles[0]?.kind, 'raspado');
  run(ice, 60); assert.equal(ice.combat.fighters[1].statusEffect, 'freeze');

  const drum = duel('tamborero');
  run(drum, 60, press(1));
  assert(Math.abs(drum.combat.fighters[1].percent - 12) < 1e-6, 'four beats add to the full Tambor');

  const away = duel('medusa'); away.combat.fighters[1].facing = 1;
  run(away, 40, press(1));
  assert.equal(away.combat.fighters[1].percent, 0, 'a pana looking away is safe');
  const eyes = duel('medusa');
  run(eyes, 40, press(1));
  assert.equal(eyes.combat.fighters[1].statusEffect, 'stone');
});

test('stats tally hits, best hit, falls and KOs and survive a checkpoint', () => {
  const g = duel('pelotero');
  run(g, 50, press(1));
  const [ana] = g.snapshot().stats;
  assert.equal(ana.dealt, 24); assert.equal(ana.best, 24);
  g.combat.fighters[1].position.x = 4000; run(g, 2);
  const restored = Bash.restore(JSON.parse(JSON.stringify(g.snapshot())), new Map([[1, {}], [2, {}]]));
  assert.deepEqual(restored.snapshot().stats, g.snapshot().stats);
  assert.equal(g.snapshot().stats[1].falls, 1); assert.equal(g.snapshot().stats[0].kos, 1);
});

test('pana choice is personal, validated and locked once the fight starts', () => {
  const g = new Bash(9); g.addPlayer(1, 'Ana');
  assert.equal(g.choosePana(1, 'nadie'), false); assert.equal(g.choosePana(1, 'medusa', 3), false);
  assert(g.choosePana(1, 'silbon', 1)); g.start();
  assert.equal(g.choosePana(1, 'medusa'), false);
  assert.equal(g.combat.fighters[0].fighter, 'kaykit-knight:silbon');
  assert(g.players.slice(1).every(p => p.bot && PANAS.some(q => q.id === p.pana)));
});
