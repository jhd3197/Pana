import assert from 'node:assert/strict';
import { CaidaGame, deck, canto, previewPlay, chooseMove, MODES } from '../public/rules.js';
const c = (rank, suit = 'oros') => ({ id: `${suit}-${rank}`, rank, suit });
const check = (name, run) => { run(); console.log(`PASS ${name}`); };
function fixture() {
  const g = new CaidaGame(10); g.start(); g.players.forEach(p => { p.hand = []; p.captured = []; });
  g.stock = [c(12, 'bastos')]; g.table = []; g.scores = [0, 0]; g.turn = 0; g.last = null; g.history = []; g.phase = 'playing'; return g;
}
check('40 unique cards; no 8 or 9', () => { assert.equal(deck().length, 40); assert.equal(new Set(deck().map(c => c.id)).size, 40); assert.ok(deck().every(c => ![8, 9].includes(c.rank))); });
check('capture continues through 7 → sota; stops at a missing rank', () => {
  const g = fixture(); g.table = [c(7), c(10), c(11), c(3)];
  assert.deepEqual(previewPlay(g, c(7, 'copas')).capture, ['oros-7', 'oros-10', 'oros-11']);
  g.table = [c(7), c(11)]; assert.deepEqual(previewPlay(g, c(7, 'copas')).capture, ['oros-7']);
});
check('old-card capture is not a caída; immediate fall has rank-dependent points', () => {
  for (const [rank, points] of [[1, 1], [7, 1], [10, 2], [11, 3], [12, 4]]) {
    const g = fixture(); g.table = [c(rank), c(rank === 1 ? 5 : 1)]; assert.equal(previewPlay(g, c(rank, 'copas')).fall, 0);
    g.last = { id: `oros-${rank}`, seat: 1 }; assert.equal(previewPlay(g, c(rank, 'copas')).fall, points);
  }
});
check('mesa limpia stacks with caída and never scores in últimas', () => {
  const g = fixture(); g.table = [c(12)]; g.last = { id: 'oros-12', seat: 1 };
  assert.equal(previewPlay(g, c(12, 'copas')).points, 8); g.stock = [];
  assert.equal(previewPlay(g, c(12, 'copas')).points, 4); assert.equal(previewPlay(g, c(12, 'copas')).clean, 0);
});
check('all five classic cantos and precedence', () => {
  for (const [ranks, name, points] of [[[1, 11, 12], 'Registro', 8], [[3, 3, 4], 'Vigía', 7], [[4, 4, 3], 'Vigía', 7], [[7, 10, 11], 'Patria', 6], [[2, 2, 2], 'Rondín', 5], [[12, 12, 5], 'Ronda', 4]]) {
    const value = canto(ranks.map((rank, i) => c(rank, ['oros', 'copas', 'espadas'][i]))); assert.equal(value.name, name); assert.equal(value.points, points);
  }
  assert.equal(canto([c(1), c(5), c(7)]), null); assert.equal(canto([c(2), c(2, 'copas')]), null);
});
check('cantos are once per hand, before the first card, only on own turn', () => {
  const g = fixture(); g.players[0].hand = [c(1), c(2), c(3)]; g.players[1].hand = [c(5), c(6), c(7)];
  assert.equal(g.chant(1), false); assert.equal(g.chant(0), true); assert.equal(g.scores[0], 6); assert.equal(g.chant(0), false);
  g.play(0, 'oros-1'); g.turn = 0; g.players[0].announced = null; assert.equal(g.chant(0), false);
});
check('24 ends immediately, even during a canto', () => {
  const g = fixture(); g.scores[0] = 20; g.players[0].hand = [c(1), c(2), c(3)]; assert.ok(g.chant(0)); assert.equal(g.phase, 'finished'); assert.equal(g.result.winner, 0); assert.equal(g.play(0, 'oros-1'), false);
});
check('leftovers belong to last capturer; card bonuses use 20 baseline', () => {
  const g = fixture(); g.stock = []; g.lastCapture = 0; const all = deck(); g.players[0].captured = all.slice(0, 20); g.players[1].captured = all.slice(20, 37); g.table = all.slice(37); g.finishRound();
  assert.deepEqual(g.result.counts, [23, 17]); assert.deepEqual(g.result.bonuses, [3, 0]); assert.deepEqual(g.scores, [3, 0]); assert.equal(g.table.length, 0);
});
check('sequence ledger rejects duplicate, out-of-turn, stale and foreign actions', () => {
  const g = new CaidaGame(6); g.addPlayer(1, 'A'); g.addPlayer(2, 'B');
  assert.equal(g.accept(2, { action: 'start', seq: 1, revision: g.revision }, 1), false);
  assert.ok(g.accept(1, { action: 'start', seq: 1, revision: g.revision }, 1));
  const card = g.players[g.turn].hand[0].id;
  assert.equal(g.accept(99, { action: 'play', card, seq: 1, revision: g.revision }, 1), false);
  const message = { action: 'play', card, seq: 2, revision: g.revision };
  assert.ok(g.accept(g.players[g.turn].id, message, 1)); assert.equal(g.accept(1, message, 1), false);
});
check('bot decisions do not depend on other private hands or stock identities', () => {
  const g = new CaidaGame(23); g.start(); const before = chooseMove(g); g.players[1].hand = [c(12), c(12, 'copas'), c(12, 'bastos')]; g.stock.reverse(); assert.deepEqual(chooseMove(g), before);
});
check('snapshot restore preserves RNG, cards, scores and late join seats', () => {
  const g = new CaidaGame(12); g.addPlayer(1, 'A'); g.addPlayer(2, 'B'); g.start(); g.play(g.turn, chooseMove(g).card);
  const restored = CaidaGame.restore(g.snapshot(), new Map([[2, { id: 2, name: 'B' }], [3, { id: 3, name: 'C' }]]));
  assert.deepEqual(restored.players.map(p => p.hand), g.players.map(p => p.hand)); assert.deepEqual(restored.scores, g.scores); assert.equal(restored.rng, g.rng); assert.equal(restored.players[0].id, 3);
});
check('400 seeded complete matches across all modes conserve every card', () => {
  for (const mode of Object.keys(MODES)) for (let seed = 1; seed <= 100; seed++) {
    const g = new CaidaGame(seed); g.configure({ mode, cantos: seed % 2 === 0 }); g.start(); let actions = 0;
    while (g.phase !== 'finished' && actions++ < 3000) {
      const cards = [...g.stock, ...g.table, ...g.players.flatMap(p => [...p.hand, ...p.captured])]; assert.equal(cards.length, 40); assert.equal(new Set(cards.map(c => c.id)).size, 40);
      assert.equal(new Set(g.table.map(c => c.rank)).size, g.table.length);
      if (g.phase === 'round-over') { g.start(); continue; }
      const p = g.players[g.turn]; if (g.options.cantos && !p.announced && canto(p.hand)) g.chant(g.turn); else { const move = chooseMove(g); assert.ok(move); assert.ok(g.play(g.turn, move.card)); }
    }
    assert.equal(g.phase, 'finished', `${mode} seed ${seed}`); assert.ok(g.scores[g.result.winner] >= 24);
  }
});
