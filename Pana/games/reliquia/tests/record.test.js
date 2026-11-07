import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, recordRows, titleEntries, titleName } from '../public/rules.js';
import { createRecordBoard } from '../../../engine/records.js';

function setup(n = 2) {
  const g = new Expedition(4242); for (let i = 1; i <= n; i++) g.addPlayer(i, `Pana ${i}`); g.start(4242); return g;
}
const stats = (g, id) => g.players.find(p => p.id === id).stats;

test('a completed jornada counts for whoever is standing', () => {
  const g = setup();
  g.completeLevel(); g.completeLevel();
  assert.equal(stats(g, 1).rounds, 2); assert.equal(stats(g, 2).rounds, 2);
  assert.equal(stats(g, 1).comebacks, 0);
});

test('falling, getting up and finishing the jornada is a comeback', () => {
  const g = setup(), [a, b] = g.players;
  g.down(a); g.getUp(a, b);
  g.completeLevel();
  assert.equal(a.stats.rounds, 1); assert.equal(a.stats.comebacks, 1);
  assert.equal(b.stats.comebacks, 0);
});

test('the truck\'s botiquín counts as getting back up', () => {
  const g = setup(), [a] = g.players;
  g.down(a); g.getUp(a, null, 60);
  g.completeLevel();
  assert.equal(a.stats.comebacks, 1);
});

test('hauled up while still down is neither a round nor a comeback', () => {
  const g = setup(), [a, b] = g.players, stop = g.layout.run.lifts.find(l => l.floor === 1);
  Object.assign(a, { x: stop.x, z: stop.z - 5 });
  g.down(a);
  g.completeLevel();
  assert.equal(a.downed, false, 'the lift still brings them to the camp');
  assert.equal(a.stats.rounds, 0); assert.equal(a.stats.comebacks, 0);
  assert.equal(b.stats.rounds, 1);
  g.completeLevel();
  assert.equal(a.stats.rounds, 1); assert.equal(a.stats.comebacks, 0, 'the fall belonged to the jornada before');
});

test('a jornada gives one comeback however many falls', () => {
  const g = setup(), [a, b] = g.players;
  g.down(a); g.getUp(a, b); g.down(a); g.getUp(a, b);
  g.completeLevel();
  assert.equal(a.stats.comebacks, 1);
  g.down(a); g.getUp(a, b);
  g.completeLevel();
  assert.equal(a.stats.comebacks, 2);
});

test('spectators get no numbers and no row', () => {
  const g = setup(), [a] = g.players;
  a.spectator = true;
  g.completeLevel();
  assert.equal(a.stats.rounds, 0);
  assert.deepEqual(recordRows(g, 2).map(r => [r.name, r.me]), [['Pana 2', true]]);
});

test('the numbers survive a new host (a snapshot and a restore)', () => {
  const g = setup(), [a, b] = g.players;
  g.down(a); g.getUp(a, b); g.completeLevel();
  g.down(b);
  const snap = g.snapshot(), next = new Expedition(snap.seed, snap.options);
  next.restore(snap, new Map([[1, { id: 1, name: 'Pana 1' }], [2, { id: 2, name: 'Pana 2' }]]));
  assert.equal(next.players[0].stats.comebacks, 1);
  assert.equal(next.players[1].fell, true);
});

test('an expedition\'s rows feed the shared board', () => {
  const g = setup(), [a, b] = g.players;
  const storage = new Map(), board = createRecordBoard({ game: 'reliquia', metrics: [{ id: 'rounds' }, { id: 'comebacks' }], stat: () => {}, storage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } });
  g.down(a); g.getUp(a, b); g.completeLevel(); g.completeLevel();
  g.finish('extracted');
  board.submit(recordRows(g, 1));
  assert.deepEqual(board.holder('rounds').names.sort(), ['Pana 1', 'Pana 2']);
  assert.deepEqual(board.holder('comebacks'), { names: ['Pana 1'], value: 1, t: board.holder('comebacks').t });
});

test('a dive\'s titles become tally entries, and every id has a name', () => {
  const g = setup(), [a, b] = g.players;
  a.stats.unaMas = 2; b.stats.banked = 900;
  assert.deepEqual(titleEntries(g), [{ name: 'Pana 1', id: 'unaMas' }, { name: 'Pana 2', id: 'banked' }]);
  for (const stat of ['unaMas', 'dropped', 'banked', 'curses', 'last']) assert.ok(titleName(stat));
  assert.equal(titleName('gone'), '');
});
