import test from 'node:test';
import assert from 'node:assert/strict';
import { LudoGame, legalMoves } from '../public/rules.js';
test('host settings are atomic, lobby-only and survive restore and rematches', () => {
  const g = new LudoGame(1); g.addPlayer(1, 'Uno'); g.addPlayer(2, 'Dos');
  const configure = (id, options, seq = 1) => g.accept(id, { action: 'options', options, seq, revision: g.revision }, 1);
  assert.equal(configure(2, { entry: 'one-six' }), false);
  assert.equal(configure(1, { entry: 'one-six', captureBonus: 'true' }), false);
  assert(configure(1, { entry: 'one-six', captureBonus: true, threeSixes: false }));
  g.start(); g.phase = 'playing'; assert.equal(configure(1, { entry: 'six' }, 2), false);
  g.die = 1; assert.deepEqual(legalMoves(g), [0, 1, 2, 3]); g.move(0); assert.equal(g.players[0].pieces[0], 0);
  const restored = LudoGame.restore(g.snapshot(), new Map()); assert.deepEqual(restored.options, g.options);
  g.phase = 'finished'; g.start(); assert.equal(g.options.captureBonus, true);
});
test('capture bonus gives a new roll and disabling triple-six penalty allows the move', () => {
  const g = new LudoGame(1); g.start(); g.phase = 'playing'; g.options.captureBonus = true;
  g.players[0].pieces[0] = 14; g.players[1].pieces[0] = 5; g.die = 4;
  g.move(0); assert.equal(g.turn, 0); assert.equal(g.die, 0); assert.equal(g.players[1].pieces[0], -1);
  let seed = 1;
  while (true) { const probe = new LudoGame(seed); probe.start(); probe.phase = 'playing'; probe.roll(); if (probe.lastDie === 6) break; seed++; }
  g.options.threeSixes = false; g.rng = seed; g.sixes = 2; g.roll();
  assert.equal(g.turn, 0); assert.equal(g.die, 6); assert(legalMoves(g).length);
});
