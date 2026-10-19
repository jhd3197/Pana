import test from 'node:test';
import assert from 'node:assert/strict';
import { CaidaGame } from '../../games/caida/public/rules.js';
import { DominoGame } from '../../games/domino/public/rules.js';
import { Poker } from '../../games/poquer/public/rules.js';
import { createGame, acceptAction } from '../../games/billar/public/rules.js';

for (const Game of [CaidaGame, DominoGame]) {
  test(`${Game.name}: host swaps partners, migration preserves seats, and active deals cannot change`, () => {
    const g = new Game(42);
    if (g.configure) g.configure({ mode: 'teams' });
    const members = new Map([1, 2, 3, 4].map(id => [id, { id, name: `Pana ${id}`, avatar: { hat: 'gorra' } }]));
    for (const p of members.values()) g.addPlayer(p.id, p.name, p.avatar);
    const action = (id, from, to, extra = {}) => g.accept(id, { action: 'seat', from, to, seq: 1, revision: g.revision, ...extra }, 1);
    const original = g.snapshot();
    assert.equal(action(2, 0, 2), false, 'guest cannot swap two other panas');
    for (const pair of [[-1, 2], [1, 8], [1.5, 2], ['1', 2], [1, 1], [null, 2]]) assert.equal(action(1, ...pair), false);
    assert.deepEqual(g.snapshot(), original);
    assert.equal(action(1, 1, 2), true);
    assert.deepEqual(g.players.map(p => p.id), [1, 3, 2, 4]);
    assert.deepEqual(g.players.map(p => p.seat), [0, 1, 2, 3]);
    assert.equal(action(1, 1, 2, { seq: 2, revision: original.revision }), false);
    assert.equal(action(1, 1, 2), false, 'duplicate sequence');
    const migrated = Game.restore(g.snapshot(), members);
    assert.deepEqual(migrated.snapshot(), g.snapshot());
    assert.equal(g.start(), true);
    const playing = g.snapshot();
    assert.equal(g.reseat(1, 2), false);
    assert.equal(g.setup(), false);
    assert.deepEqual(g.snapshot(), playing);
  });

  test(`${Game.name}: changing partners after results resets scores without resetting action ledger or options`, () => {
    const g = new Game(43);
    if (g.configure) assert(g.configure(Game.name === 'CaidaGame' ? { mode: 'teams', cantos: false } : { mode: 'teams', capicua: 'double' }));
    const options = g.options ? structuredClone(g.options) : null;
    g.addPlayer(1, 'Ana'); g.addPlayer(2, 'Luis'); g.reseat(1, 2); g.start();
    g.phase = 'round-over'; g.scores = [12, 8]; g.ledger = { 1: 9 }; g.mapId = 'plaza';
    const revision = g.revision, seats = g.players.map(p => p.id);
    assert.equal(g.accept(2, { action: 'setup', seq: 1, revision }, 1), false);
    assert.equal(g.accept(1, { action: 'setup', seq: 10, revision }, 1), true);
    assert.equal(g.phase, 'lobby'); assert.equal(g.round, 0); assert.equal(g.result, null);
    assert.deepEqual(g.scores, [0, 0]); assert.deepEqual(g.players.map(p => p.id), seats);
    assert.ok(g.players.every(p => !p.hand.length)); assert.equal(g.ledger[1], 10);
    assert.equal(g.revision, revision + 1); assert.equal(g.mapId, 'plaza');
    if (options) assert.deepEqual(g.options, options);
    assert.equal(g.accept(1, { action: 'seat', from: 1, to: 2, seq: 11, revision }, 1), false);
    assert.equal(g.reseat(1, 2), true); assert.equal(g.start(), true);
    assert.equal(g.round, 1);
  });
}

for (const Game of [CaidaGame, DominoGame]) test(`${Game.name}: guests change their own seat only before play`, () => {
  const g = new Game(45); if (g.configure) g.configure({ mode: 'teams' });
  for (let id = 1; id <= 4; id++) g.addPlayer(id, `Pana ${id}`);
  const act = (from, to, seq = 1) => g.accept(2, { action: 'seat', from, to, seq, revision: g.revision }, 1);
  assert.equal(act(1, 2), true); assert.deepEqual(g.players.map(p => p.id), [1, 3, 2, 4]);
  assert.equal(act(0, 1, 2), false); assert.equal(act(0, 2, 2), true);
  g.start(); const before = g.snapshot(); assert.equal(act(0, 1, 3), false); assert.deepEqual(g.snapshot(), before);
});

test('Billar: guest changes teams without rearranging two other seats or live shots', () => {
  const g = createGame(); [1, 2, 3].forEach((id, i) => { g.players[i].id = id; });
  const swap = (from, to, id = 2) => acceptAction(g, id, { action: 'swap', from, to, revision: g.revision }, 1);
  assert.equal(swap(0, 2), false); assert.equal(swap(1, 4), true); assert.equal(g.players[4].id, 2);
  assert.equal(swap(0, 2, 1), true); g.phase = 'aim'; assert.equal(swap(4, 1), false);
});

test('Poker: guests swap only their own connected lobby seat', () => {
  const g = new Poker(); for (let id = 1; id <= 3; id++) g.add(id, { name: `Pana ${id}` });
  assert.equal(g.reseat(0, 2, 2, 1), false); assert.equal(g.reseat(1, 2, 2, 1), true);
  assert.deepEqual(g.players.map(p => p.id), [1, 3, 2]); assert.equal(g.reseat(0, 1, 1, 1), true);
  g.start(); assert.equal(g.reseat(2, 1, 2, 1), false);
});

test('Poker: seating preserves bankrolls and dealer identity; setup removes old private hands', () => {
  const g = new Poker();
  for (let id = 1; id <= 3; id++) g.add(id, { name: `Pana ${id}`, bot: false });
  assert.equal(g.reseat(0, 2), true);
  assert.equal(g.start(() => .5), true);
  assert.equal(g.reseat(0, 1), false); assert.equal(g.setup(), false);
  for (let i = 0; g.phase !== 'finished' && i < 30; i++) assert.equal(g.act(g.turn, 'call'), true);
  assert.equal(g.phase, 'finished');
  const chips = Object.fromEntries(g.players.map(p => [p.id, p.chips])), dealer = g.players[g.dealer].id;
  assert.equal(g.setup(), true); assert.equal(g.view(1).pot, 0);
  assert.equal(g.reseat(0, 1), true); assert.equal(g.players[g.dealer].id, dealer);
  assert.deepEqual(Object.fromEntries(g.players.map(p => [p.id, p.chips])), chips);
  assert.ok(g.view(1).players.every(p => !p.hole.length)); assert.equal('deck' in g.view(1), false);
  g.drop(2); assert.equal(g.reseat(g.players.findIndex(p => p.id === 2), g.players.findIndex(p => p.id === 1)), false);
  assert.equal(g.start(() => .5), true);
  assert.deepEqual(g.view(1).players.find(p => p.id === 3).hole, [null, null]);
});
