import test from 'node:test';
import assert from 'node:assert/strict';
import { CaidaGame, teamOf, deck } from '../public/rules.js';
for (const mode of ['six', 'sixTeams']) test(`${mode} deals exactly two hands and preserves every card through migration`, () => {
  const g = new CaidaGame(32); assert.ok(g.configure({ mode, cantos: false }));
  const members = new Map(); for (let id = 1; id <= 6; id++) { members.set(id, { id, name: `Pana ${id}` }); g.addPlayer(id, `Pana ${id}`); }
  assert.equal(g.players.length, 6); assert.equal(g.scores.length, mode === 'six' ? 6 : 2);
  g.start(); g.setCall(g.dealer, 'up'); g.dealOpening(g.dealer); assert.equal(g.stock.length, 18); assert.ok(g.players.every(p => p.hand.length === 3));
  let turns = 0;
  while (g.phase === 'playing') { g.play(g.turn, g.players[g.turn].hand[0].id); turns++; }
  assert.equal(turns, 36); assert.equal(g.handNumber, 2); assert.equal(g.result.baseline, mode === 'six' ? 6 : 20);
  assert.equal(new Set(g.players.flatMap(p => p.captured).map(c => c.id)).size, 40);
  const restored = CaidaGame.restore(g.snapshot(), members); assert.deepEqual(restored.snapshot(), g.snapshot());
});
test('six-seat teams share scoring only with alternate seats and host patches stay atomic', () => {
  const g = new CaidaGame(); g.configure({ mode: 'sixTeams' }); assert.deepEqual(g.players.map(p => teamOf(g, p.seat)), [0, 1, 0, 1, 0, 1]);
  const before = g.snapshot(); assert.equal(g.configure({ mode: 'six', difficulty: 'broken' }), false); assert.deepEqual(g.snapshot(), before);
  g.players.forEach((p, i) => { p.captured = deck().slice(i * 6, i * 6 + 6); }); g.players[0].captured.push(...deck().slice(36)); g.phase = 'playing'; g.finishRound();
  assert.deepEqual(g.result.counts, [22, 18]); assert.deepEqual(g.scores, [2, 0]);
});
