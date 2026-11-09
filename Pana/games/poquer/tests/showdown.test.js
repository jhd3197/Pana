import test from 'node:test';
import assert from 'node:assert/strict';
import { Poker, bestHand, reason, explain, settle, HANDS, messageText } from '../public/rules.js';
const c = (rank, suit = 0) => suit * 13 + rank - 2;
const P = (id, hole, total = 100, folded = false) => ({ id, hole, total, folded });
const showdown = (players, board) => { const { pots } = settle(players, board, 0); return { pots, explain: explain(players, board, pots) }; };

test('flush beats a lower flush on the top card', () => {
  const board = [c(2, 1), c(7, 1), c(9, 1), c(13, 3), c(4, 1)];
  const { explain: [pot] } = showdown([P(1, [c(14, 1), c(3, 2)]), P(2, [c(12, 1), c(10, 1)])], board);
  assert.deepEqual(pot.winners, [1]); assert.equal(pot.hand, HANDS[5]);
  assert.ok(pot.best[1].includes(c(14, 1)) && pot.best[1].every(x => Math.floor(x / 13) === 1), 'best five are the five hearts');
  assert.match(messageText([pot.why]), /pero más alto: A contra Q/);
});
test('two pair decided by the kicker', () => {
  const board = [c(13, 0), c(13, 1), c(9, 2), c(9, 3), c(3, 0)];
  const { explain: [pot] } = showdown([P(1, [c(14, 2), c(4, 1)]), P(2, [c(12, 0), c(5, 1)])], board);
  assert.deepEqual(pot.winners, [1]); assert.equal(pot.hand, HANDS[2]);
  assert.match(messageText([pot.why]), /carta alta: A contra Q/);
});
test('different categories name both hands', () => {
  assert.match(messageText([reason([5, 14, 9, 7, 3, 2], [4, 9])]), /Color le gana a Escalera/);
});
test('board plays: a split pot says so', () => {
  const board = [c(10, 0), c(11, 1), c(12, 2), c(13, 3), c(14, 0)];
  const { pots, explain: [pot] } = showdown([P(1, [c(2, 1), c(3, 2)]), P(2, [c(4, 1), c(5, 2)])], board);
  assert.deepEqual(pots[0].winners.sort(), [1, 2]); assert.match(messageText([pot.why]), /La mesa juega/);
});
test('side pots explain each contested pot; refunds are skipped', () => {
  const board = [c(2, 0), c(7, 1), c(9, 2), c(13, 3), c(4, 1)];
  const players = [P(1, [c(14, 0), c(14, 1)], 50), P(2, [c(13, 0), c(12, 1)], 150), P(3, [c(12, 2), c(11, 3)], 150), P(4, [c(3, 3), c(3, 2)], 200)];
  const { explain: pots } = showdown(players, board);
  assert.equal(pots.length, 2); assert.deepEqual(pots[0].winners, [1]); assert.deepEqual(pots[1].winners, [2]);
  assert.equal(pots[1].rival, 4); assert.ok(!pots.some(p => p.winners.includes(4) && p.amount === 50));
});
test('all but one fold: no showdown, no explanation, nothing revealed', () => {
  const g = new Poker(); g.configure({ starter: 'anfitrion' }); for (const i of [1, 2, 3]) g.add(i, { name: `P${i}`, avatar: {}, bot: false }); g.start();
  while (g.phase !== 'finished') g.act(g.turn, 'fold');
  const winner = g.live[0].id, folder = g.players.find(p => p.id !== winner);
  for (const id of [1, 2, 3]) {
    const v = g.view(id); assert.equal(v.result.showdown, false); assert.equal(v.result.explain, undefined);
    for (const p of v.players) if (p.id !== id) assert.ok(p.hole.every(x => x === null), `seat ${id} cannot see ${p.id}`);
  }
  const own = g.view(folder.id).result.folded; assert.equal(own.wouldWin, false, 'no board, no claim'); assert.deepEqual(own.hole, folder.hole);
});
function rigged() {
  // P1 folds the nuts preflop; P2 and P3 check it down.
  const g = new Poker(); g.configure({ starter: 'anfitrion', showCards: true }); for (const i of [1, 2, 3]) g.add(i, { name: `P${i}`, avatar: {}, bot: false }); g.start();
  g.players.find(p => p.id === 1).hole = [c(14, 0), c(14, 1)]; g.players.find(p => p.id === 2).hole = [c(3, 2), c(8, 3)]; g.players.find(p => p.id === 3).hole = [c(4, 2), c(9, 3)];
  const top = [c(12, 3), c(14, 2), c(13, 0), c(13, 1), c(2, 0), c(6, 1), c(7, 0), c(10, 2)]; // burn, flop, burn, turn, burn, river
  g.deck = g.deck.filter(x => !top.includes(x) && ![c(3, 2), c(8, 3), c(4, 2), c(9, 3), c(14, 0), c(14, 1)].includes(x)).concat(top.reverse());
  while (g.phase !== 'finished') g.act(g.turn, g.turn === 1 ? 'fold' : 'call');
  return g;
}
test('folded cards stay private to their owner at a showdown', () => {
  const g = rigged(); assert.equal(g.result.showdown, true);
  for (const id of [2, 3]) {
    const v = g.view(id); assert.deepEqual(v.players.find(p => p.id === 1).hole, [null, null]); assert.equal(v.result.folded, undefined);
    assert.ok(!JSON.stringify(v).includes('"folded":{'), 'no folded summary for others');
  }
  const spectator = g.view(99); assert.deepEqual(spectator.players.find(p => p.id === 1).hole, [null, null]); assert.equal(spectator.result.folded, undefined);
  const mine = g.view(1).result.folded; assert.equal(mine.wouldWin, true); assert.equal(mine.hand, HANDS[6]);
});
test('no "you would have won" on a tie or a loss', () => {
  const g = rigged(); g.players.find(p => p.id === 1).hole = [c(3, 0), c(8, 0)];
  assert.equal(g.resultFor(1).folded.wouldWin, false);
});
test('face-down end hides the winners best five from the others', () => {
  const g = rigged(); g.options.showCards = false; const win = g.result.explain[0].winners[0], other = [2, 3].find(id => id !== win);
  assert.deepEqual(g.view(other).result.explain[0].best, {}); assert.ok(g.view(win).result.explain[0].best[win].length === 5);
});
