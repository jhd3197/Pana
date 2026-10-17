import test from 'node:test';
import assert from 'node:assert/strict';
import { Poker, evaluate, compare, settle, shuffle, tablePlayers } from '../public/rules.js';
const c = (rank, suit = 0) => suit * 13 + rank - 2;
const cards = (ranks, suits) => ranks.map((r, i) => c(r, suits?.[i] ?? i % 4));
function table(n = 2) { const g = new Poker(); for (let i = 1; i <= n; i++) g.add(i, { name: `Pana ${i}`, avatar: {}, bot: false }); g.start(); return g; }
test('all nine hand categories and best five of seven', () => {
  const hands = [
    cards([14, 11, 9, 7, 3]), cards([14, 14, 9, 7, 3]), cards([14, 14, 9, 9, 3]), cards([14, 14, 14, 7, 3]),
    cards([9, 8, 7, 6, 5]), cards([14, 11, 9, 7, 3], [2, 2, 2, 2, 2]), cards([14, 14, 14, 7, 7]), cards([14, 14, 14, 14, 3]), cards([14, 13, 12, 11, 10], [1, 1, 1, 1, 1]),
  ];
  hands.forEach((hand, i) => assert.equal(evaluate(hand)[0], i));
  assert.deepEqual(evaluate(cards([14, 2, 3, 4, 5, 9, 10])), [4, 5]);
  assert.deepEqual(evaluate(cards([14, 14, 14, 13, 13, 13, 2])), [6, 14, 13]);
  assert.ok(compare(evaluate(cards([14, 14, 12, 9, 3])), evaluate(cards([14, 14, 11, 9, 3]))) > 0);
  assert.equal(new Set(shuffle()).size, 52);
});
test('heads-up dealer posts small blind, acts first preflop and last postflop', () => {
  const g = table(); assert.equal(g.players[g.dealer].id, 1); assert.equal(g.turn, 1); assert.equal(g.legal(1).call, 10);
  assert.equal(g.act(2, 'call'), false); assert.equal(g.act(1, 'raise', 30), false); assert.equal(g.act(1, 'call'), true);
  assert.equal(g.turn, 2); assert.equal(g.phase, 'preflop'); assert.equal(g.legal(2).call, 0);
  g.act(2, 'call'); assert.equal(g.phase, 'flop'); assert.equal(g.turn, 2); assert.equal(g.board.length, 3);
  assert.equal(g.act(2, 'raise', NaN), false); assert.equal(g.act(2, 'raise', Infinity), false);
  const old = g.revision; g.act(2, 'raise', 40); assert.equal(g.legal(1).min, 80); assert.equal(g.act(1, 'call', undefined, old), false);
});
test('private view never exposes deck or opponents cards, including folded showdown hands', () => {
  const g = table(3), v = g.view(1); assert.equal(v.players[0].hole.length, 2); assert.ok(v.players[0].hole.every(Number.isInteger));
  assert.deepEqual(v.players[1].hole, [null, null]); assert.equal('deck' in v, false); assert.equal('actedAt' in v.players[0], false);
  const folded = g.turn; g.act(folded, 'fold');
  while (g.phase !== 'finished') g.act(g.turn, 'call');
  assert.deepEqual(g.view(folded === 1 ? 2 : 1).players.find(p => p.id === folded).hole, [null, null]);
  assert.ok(g.view(1).players.filter(p => !p.folded).every(p => p.hole.every(Number.isInteger)));
});
test('short all-in requires a response but does not reopen an earlier caller', () => {
  const g = table(3); g.players.find(p => p.id === 3).chips = 30;
  g.act(1, 'raise', 40); g.act(2, 'call'); g.act(3, 'raise', 50);
  assert.equal(g.turn, 1); assert.equal(g.legal(1).call, 10); assert.equal(g.legal(1).raise, false);
  assert.equal(g.act(1, 'raise', 100), false); g.act(1, 'call'); g.act(2, 'call'); assert.equal(g.phase, 'flop');
});
test('all-ins run out the board, distribute side pots and conserve chips', () => {
  const board = cards([2, 5, 8, 10, 12]);
  const players = [
    { id: 1, total: 50, folded: false, hole: [c(14), c(14, 1)] },
    { id: 2, total: 100, folded: false, hole: [c(13), c(13, 1)] },
    { id: 3, total: 200, folded: false, hole: [c(11), c(11, 1)] },
    { id: 4, total: 100, folded: true, hole: [c(3), c(3, 1)] },
  ];
  const result = settle(players, board, 0); assert.deepEqual(result.payouts, { 1: 200, 2: 150, 3: 100, 4: 0 });
  const g = table(); g.act(1, 'raise', 1000); g.act(2, 'call'); assert.equal(g.phase, 'finished'); assert.equal(g.board.length, 5);
  assert.equal(g.players.reduce((n, p) => n + p.chips, 0), 2000);
});
test('split pots give odd chips clockwise from dealer', () => {
  const board = [10, 11, 12, 13, 14].map(r => c(r, 3));
  const players = [1, 2, 3].map(id => ({ id, total: 5, folded: id === 3, hole: [c(id + 2), c(id + 5, 1)] }));
  assert.deepEqual(settle(players, board, 0).payouts, { 1: 7, 2: 8, 3: 0 });
});
test('fold wins, host departures and late arrivals cannot stall a hand', () => {
  const g = table(); g.add(3, { name: 'Late', avatar: {} }); assert.equal(g.players[2].folded, true); assert.deepEqual(g.players[2].hole, []);
  g.drop(1); assert.equal(g.phase, 'finished'); assert.equal(g.result.payouts[2], 30);
  g.start(); assert.equal(g.players.length, 2); assert.equal(g.players.some(p => p.id === 1), false);
  const h = table(3); h.act(1, 'raise', 1000); h.drop(1); assert.equal(h.players[0].folded, false);
  h.act(2, 'call'); h.act(3, 'call'); assert.equal(h.phase, 'finished'); assert.equal(h.players.reduce((n, p) => n + p.chips, 0), 3000);
});
test('200 randomized legal hands always finish and conserve chips', () => {
  let seed = 42; const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (let n = 0; n < 200; n++) {
    const g = table(2 + n % 5); const total = g.players.length * 1000; let actions = 0;
    while (g.phase !== 'finished' && actions++ < 200) {
      const id = g.turn, legal = g.legal(id), value = random(); assert.ok(legal);
      if (value < .12) g.act(id, 'fold'); else if (value > .7 && legal.raise) g.act(id, 'raise', value > .95 ? legal.max : Math.min(legal.max, legal.min)); else g.act(id, 'call');
    }
    assert.equal(g.phase, 'finished'); assert.equal(g.players.reduce((n, p) => n + p.chips, 0), total); assert.ok(g.players.every(p => p.chips >= 0));
  }
});
test('dealer advances past a departing dealer, and a short blind cannot force an uncontested bet', () => {
  const g = table(4); while (g.phase !== 'finished') g.act(g.turn, 'fold');
  g.dealer = 1; g.drop(2); g.start(); assert.equal(g.players[g.dealer].id, 3);
  const h = new Poker(); h.add(1, { name: 'A' }); h.add(2, { name: 'B' }); h.players[1].chips = 5;
  h.start(); assert.equal(h.phase, 'finished'); assert.equal(h.board.length, 5); assert.equal(h.players.reduce((n, p) => n + p.chips, 0), 1005);
});
test('late arrivals wait off-table and disconnected seats cannot overflow the six chairs', () => {
  const g = table(6); g.players[1].allin = true; g.players[1].chips = 0; g.drop(2);
  g.add(7, { name: 'Waiting' }); assert.equal(tablePlayers(g).length, 6); assert.ok(tablePlayers(g).some(p => p.id === 2)); assert.ok(!tablePlayers(g).some(p => p.id === 7));
  g.drop(4); assert.equal(tablePlayers(g).length, 5);
  g.phase = 'finished'; assert.equal(tablePlayers(g).length, 5); assert.ok(tablePlayers(g).some(p => p.id === 7));
});
