import test from 'node:test';
import assert from 'node:assert/strict';
import { DominoGame, deck, legalMoves, legalEnds, chooseMove, pips } from '../public/rules.js';
import { chainLayout } from '../public/tiles.js';
const setup = seed => { const g = new DominoGame(seed); g.addPlayer(1, 'Juan'); g.start(); return g; };
function integrity(g) {
  const all = [...g.chain, ...g.players.flatMap(p => p.hand)];
  assert.equal(all.length, 28); assert.equal(new Set(all.map(t => t.id)).size, 28); assert.equal(pips(all), 168);
  for (let i = 1; i < g.chain.length; i++) assert.equal(g.chain[i - 1].b, g.chain[i].a);
}

test('the complete double-six deck deals seven unique pieces per seat', () => {
  const g = setup(2); assert.equal(deck().length, 28); g.players.forEach(p => assert.equal(p.hand.length, 7)); integrity(g);
  assert.ok(g.players[g.turn].hand.some(t => t.id === '6-6'));
  assert.deepEqual(legalMoves(g), [{ tile: '6-6', end: 'right' }]);
  assert.equal(g.pass(g.turn), false); assert.equal(g.play((g.turn + 1) % 4, '6-6', 'right'), false);
});

test('both ends orient correctly and invalid moves leave the state unchanged', () => {
  const g = new DominoGame(); g.phase = 'playing'; g.round = 2; g.chain = [{ id: '2-5', a: 2, b: 5 }];
  g.players[0].hand = [{ id: '2-4', a: 2, b: 4 }, { id: '0-0', a: 0, b: 0 }];
  assert.equal(g.play(0, '2-4', 'left'), true); assert.deepEqual([g.chain[0].a, g.chain[0].b], [4, 2]);
  g.players[1].hand = [{ id: '3-5', a: 3, b: 5 }, { id: '1-1', a: 1, b: 1 }];
  assert.equal(g.play(1, '3-5', 'right'), true); assert.deepEqual([g.chain.at(-1).a, g.chain.at(-1).b], [5, 3]);
  const before = g.snapshot(); assert.equal(g.play(2, '6-6', 'right'), false); assert.deepEqual(g.snapshot(), before);
  assert.deepEqual(legalEnds(g, { id: '3-4', a: 3, b: 4 }), ['left', 'right']);
});

test('going out scores only opposing hands and the winner opens the next round', () => {
  const g = new DominoGame(); g.phase = 'playing'; g.round = 2; g.chain = [{ id: '2-5', a: 2, b: 5 }];
  g.players.forEach((p, i) => { p.hand = [{ id: `${i}-${i}`, a: i, b: i }]; });
  g.players[0].hand = [{ id: '0-2', a: 0, b: 2 }];
  assert.equal(g.play(0, '0-2', 'left'), true); assert.equal(g.phase, 'round-over'); assert.equal(g.scores[0], 8);
  g.start(); assert.equal(g.round, 3); assert.equal(g.turn, 0); assert.equal(legalMoves(g).length, 7); integrity(g);
});

test('four legal passes resolve a block; equal team totals score nothing', () => {
  for (const tie of [false, true]) {
    const g = new DominoGame(); g.phase = 'playing'; g.round = 2; g.chain = [{ id: '6-6', a: 6, b: 6 }];
    g.players.forEach((p, i) => { p.hand = [{ id: `${i}-${i}`, a: i, b: i }]; });
    if (tie) g.players[3].hand = [{ id: '1-1', a: 1, b: 1 }];
    for (let i = 0; i < 4; i++) assert.equal(g.pass(i), true);
    assert.equal(g.phase, 'round-over'); assert.equal(g.result.reason, 'blocked');
    assert.equal(g.result.winner, tie ? null : 0); assert.equal(g.scores[0], tie ? 0 : 8);
  }
});

test('match completion and replay reset points without replacing seated players', () => {
  const g = setup(5); g.scores = [99, 0]; g.finish(0, 'out', 0); assert.equal(g.phase, 'finished');
  g.start(); assert.equal(g.round, 1); assert.deepEqual(g.scores, [0, 0]); assert.equal(g.players[0].id, 1); integrity(g);
});

test('late join, spectator overflow and replacement bots preserve hands', () => {
  const g = setup(42), hands = g.players.map(p => p.hand.map(t => t.id));
  for (let id = 2; id <= 4; id++) assert.equal(g.addPlayer(id, `Pana ${id}`), true);
  assert.equal(g.addPlayer(5, 'Mirando'), false); g.removePlayer(2);
  assert.equal(g.players[1].id, null); g.addPlayer(5, 'Mirando');
  assert.equal(g.players[1].id, 5); assert.deepEqual(g.players.map(p => p.hand.map(t => t.id)), hands);
});

test('host migration preserves chain, deal, RNG, score and replay protection', () => {
  const g = setup(88); g.addPlayer(2, 'María');
  const move = chooseMove(g); g.play(g.turn, move.tile, move.end); g.ledger[2] = 7; g.scores = [22, 15];
  const before = g.snapshot(), restored = DominoGame.restore(before, new Map([[2, { id: 2, name: 'María' }]]));
  assert.deepEqual(restored.chain, before.chain); assert.deepEqual(restored.scores, before.scores);
  assert.equal(restored.rng, before.rng); assert.equal(restored.ledger[2], 7); assert.equal(restored.players[0].id, null); integrity(restored);
  assert.equal(restored.accept(2, { seq: 7, revision: restored.revision, action: 'pass' }, 2), false);
});

test('the host rejects stale, duplicate, spectator and unauthorized actions', () => {
  const g = new DominoGame(9); g.addPlayer(1, 'Juan'); g.addPlayer(2, 'María');
  assert.equal(g.accept(2, { seq: 1, revision: g.revision, action: 'start' }, 1), false);
  assert.equal(g.accept(1, { seq: 1, revision: g.revision - 1, action: 'start' }, 1), false);
  assert.equal(g.accept(1, { seq: 1, revision: g.revision, action: 'start' }, 1), true);
  assert.equal(g.accept(1, { seq: 1, revision: g.revision, action: 'start' }, 1), false);
  assert.equal(g.accept(500, { seq: 1, revision: g.revision, action: 'play', tile: '6-6', end: 'right' }, 1), false);
});

test('500 seeded bot rounds always terminate, conserve all tiles and keep matching ends', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const g = setup(seed); let count = 0;
    while (g.phase === 'playing' && count++ < 120) {
      const move = chooseMove(g); move ? g.play(g.turn, move.tile, move.end) : g.pass(g.turn); integrity(g);
    }
    assert.notEqual(g.phase, 'playing', `seed ${seed} stalled`);
    assert.ok(g.result); assert.ok(g.scores.every(s => s >= 0));
  }
});

test('all 28 rendered dominoes have distinct, non-overlapping table positions', () => {
  const positions = chainLayout(28);
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    const a = positions[i], b = positions[j];
    const ax = a.angle === 90 ? 19 : 38, az = a.angle === 90 ? 38 : 19;
    const bx = b.angle === 90 ? 19 : 38, bz = b.angle === 90 ? 38 : 19;
    assert.ok(Math.abs(a.x - b.x) >= ax + bx || Math.abs(a.y - b.y) >= az + bz, `tiles ${i}, ${j} overlap`);
  }
});
