import test from 'node:test';
import assert from 'node:assert/strict';
import { Poker, evaluate, compare, settle, shuffle, tablePlayers, messageText } from '../public/rules.js';
import { starterResult } from '../../../engine/play/quien-empieza-rules.js';
const c = (rank, suit = 0) => suit * 13 + rank - 2;
const cards = (ranks, suits) => ranks.map((r, i) => c(r, suits?.[i] ?? i % 4));
// 'anfitrion' skips the cachos: seat order, so the first seat deals.
function table(n = 2) { const g = new Poker(); g.configure({ starter: 'anfitrion' }); for (let i = 1; i <= n; i++) g.add(i, { name: `Pana ${i}`, avatar: {}, bot: false }); g.start(); return g; }
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
  const h = new Poker(); h.configure({ starter: 'anfitrion' }); h.add(1, { name: 'A' }); h.add(2, { name: 'B' }); h.players[1].chips = 5;
  h.start(); assert.equal(h.phase, 'finished'); assert.equal(h.board.length, 5); assert.equal(h.players.reduce((n, p) => n + p.chips, 0), 1005);
});
test('late arrivals wait off-table and disconnected seats cannot overflow the six chairs', () => {
  const g = table(6); g.players[1].allin = true; g.players[1].chips = 0; g.drop(2);
  g.add(7, { name: 'Waiting' }); assert.equal(tablePlayers(g).length, 6); assert.ok(tablePlayers(g).some(p => p.id === 2)); assert.ok(!tablePlayers(g).some(p => p.id === 7));
  g.drop(4); assert.equal(tablePlayers(g).length, 5);
  g.phase = 'finished'; assert.equal(tablePlayers(g).length, 5); assert.ok(tablePlayers(g).some(p => p.id === 7));
});

test('a match opens with the cachos: the highest takes the dealer button, later hands deal at once', () => {
  const g = new Poker(); g.add(1, { name: 'Ana', avatar: {} }); g.add(2, { name: 'Beto', avatar: {}, bot: true }); g.add(3, { name: 'Cheo', avatar: {} });
  assert.ok(g.start(() => .42)); assert.equal(g.phase, 'starter'); assert.equal(g.turn, null);
  assert.deepEqual(tablePlayers(g).map(p => p.id), [1, 2, 3], 'everyone sits at the table while the cachos roll');
  assert.equal(g.view(1).starter.phase, 'shake'); assert.equal(g.act(1, 'call'), false);
  const revision = g.revision;
  assert.ok(g.cacho(1, 'shake')); assert.ok(g.cacho(1, 'slam', .7)); assert.equal(g.cacho(1, 'slam', .7), false, 'one slam a round');
  assert.equal(g.cacho(9, 'slam', .7), false, 'not at the table'); assert.ok(g.revision > revision);
  g.drop(3); // a pana who leaves mid-roll is slammed for them
  for (let i = 0; i < 400 && g.phase === 'starter'; i++) g.stepStarter(.1);
  assert.equal(g.phase, 'preflop'); assert.equal(g.view(1).starter, null);
  const { order } = starterResult(g.starter), first = [1, 2, 3][order[0]];
  if (first !== 3) assert.equal(g.players[g.dealer].id, first, 'the cacho winner deals');
  assert.match(messageText(g.message), /reparte con un [1-6]/);
  while (g.phase !== 'finished') g.act(g.turn, 'fold');
  assert.ok(g.start()); assert.equal(g.phase, 'preflop', 'the next hand deals straight away');
});
test('room options: al azar deals at once; revancha gives the button to whoever busted first', () => {
  const g = new Poker(); g.configure({ starter: 'azar' }); g.add(1, { name: 'A' }); g.add(2, { name: 'B' });
  g.start(); assert.equal(g.phase, 'preflop'); assert.match(messageText(g.message), /^Orden al azar: /);
  g.act(g.turn, 'raise', 1000); g.act(g.turn, 'call');
  assert.equal(g.phase, 'finished'); const loser = g.players.find(p => p.chips === 0)?.id;
  if (loser === undefined) return; // a split pot busts nobody
  g.setup(); assert.equal(g.lastPlace, loser);
  g.options.starter = 'revancha'; g.start(); assert.equal(g.phase, 'preflop'); assert.equal(g.players[g.dealer].id, loser);
});

test("a name never claims a dropped pana's stack; their own device does", () => {
  const g = new Poker();
  g.add(1, { name: 'Ana', avatar: {}, bot: false, key: 'device-ana-1' }); g.add(2, { name: 'Beto', avatar: {}, bot: false, key: 'device-beto-1' });
  g.players[0].chips = 140; g.drop(1);
  g.add(3, { name: 'Ana', avatar: {}, bot: false, key: 'device-other' });
  assert.equal(g.players.find(p => p.id === 3).chips, g.options.stack, 'same name, other device: a fresh stack');
  assert.equal(g.players.find(p => p.id === 1).chips, 140);
  g.add(4, { name: 'Ana', avatar: {}, bot: false });
  assert.equal(g.players.find(p => p.id === 4).chips, g.options.stack, 'no key: a name cannot claim a keyed chair');
  g.add(5, { name: 'Ana', avatar: {}, bot: false, key: 'device-ana-1' });
  assert.equal(g.players.find(p => p.id === 5).chips, 140, 'her own device gets her stack back');
  assert.ok(g.view(2).players.every(p => !('key' in p)), 'keys never reach a view');
});

test('leaving and coming back keeps your stack instead of a fresh one', () => {
  const g = table(3), ana = g.players.find(p => p.id === 1);
  ana.chips = 140;
  g.drop(1); g.add(9, { name: 'Pana 1', avatar: {}, bot: false });
  assert.equal(g.players.find(p => p.id === 9).chips, 140, 'chair still listed: the stack moves to the new seat');
  assert.equal(ana.chips, 0);
  const bruno = g.players.find(p => p.id === 2); bruno.chips = 0;
  g.drop(2); g.prune(p => p.connected);
  g.add(12, { name: ' pana 2 ', avatar: {}, bot: false });
  assert.equal(g.players.find(p => p.id === 12).chips, 0, 'a busted pana does not refill by rejoining');
  g.add(13, { name: 'Nueva', avatar: {}, bot: false });
  assert.equal(g.players.find(p => p.id === 13).chips, g.options.stack, 'a new name starts with the table stack');
  g.configure({ stack: g.options.stack * 2 });
  assert.deepEqual(g.banked, {});
});
