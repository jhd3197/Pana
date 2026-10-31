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
test('the host picks four to six seats; panas keep theirs and extra seats are bots', () => {
  const g = new LudoGame(1); g.addPlayer(1, 'Uno'); g.addPlayer(2, 'Dos');
  let seq = 0;
  const configure = (id, options) => g.accept(id, { action: 'options', options, seq: ++seq, revision: g.revision }, 1);
  assert.equal(configure(1, { seats: 7 }), false); assert.equal(configure(1, { seats: '6' }), false);
  assert(configure(1, { seats: 6 }));
  assert.equal(g.players.length, 6); assert.equal(g.options.seats, 6);
  assert.deepEqual(g.players.map(p => p.id), [1, 2, null, null, null, null]);
  assert.deepEqual(g.players.map(p => p.seat), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([g.entryMisses.length, g.entryLimits.length, g.captures.length], [6, 6, 6]);
  for (const id of [3, 4, 5, 6]) g.addPlayer(id, `P${id}`);
  assert.equal(configure(1, { seats: 5 }), false, 'never fewer seats than panas'); assert.equal(g.players.length, 6);
  g.removePlayer(3); g.removePlayer(4);
  assert(configure(1, { seats: 4 }));
  assert.deepEqual(g.players.map(p => p.id), [1, 2, 5, 6], 'panas beyond the count move into bot seats');
  const restored = LudoGame.restore(g.snapshot(), new Map([[1, { id: 1, name: 'Uno' }]]));
  assert.equal(restored.players.length, 4); assert.equal(restored.options.seats, 4);
  g.start(); assert.deepEqual(g.starter.contenders, [0, 1, 2, 3]); assert.equal(configure(1, { seats: 6 }), false, 'lobby only');
});
test('a fifth pana at a full lobby pulls up a chair; mid-match they watch', () => {
  const g = new LudoGame(1);
  for (let id = 1; id <= 6; id++) g.addPlayer(id, `P${id}`);
  assert.equal(g.players.length, 6); assert.equal(g.options.seats, 6); g.addPlayer(7, 'P7');
  assert.equal(g.players.length, 6, 'six is the most');
  const match = new LudoGame(2); match.start();
  for (let id = 1; id <= 5; id++) match.addPlayer(id, `P${id}`);
  assert.equal(match.players.length, 4);
});
test('old four-seat snapshots without a seat option restore as four seats', () => {
  const old = new LudoGame(3).snapshot(); delete old.options.seats;
  const g = LudoGame.restore(old, new Map()); assert.equal(g.options.seats, 4); assert.equal(g.players.length, 4);
  const six = new LudoGame(3, 6); assert.equal(six.players.length, 6); assert.equal(six.players[5].name, 'Cheo');
  assert.equal(new LudoGame(3, 9).players.length, 4);
});
