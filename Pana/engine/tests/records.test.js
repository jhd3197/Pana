import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordBoard, createTitleTally } from '../records.js';

function memStorage() {
  const map = new Map();
  return { getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), dump: () => Object.fromEntries(map) };
}
const METRICS = [{ id: 'rounds', label: 'Rounds' }, { id: 'comebacks', label: 'Comebacks' }];
const make = (options = {}) => {
  const clock = { t: 1000 };
  const board = createRecordBoard({ game: 'demo', metrics: METRICS, storage: memStorage(), now: () => clock.t, stat: () => {}, ...options });
  return { board, clock };
};
const row = (name, rounds, comebacks = 0, me = false) => ({ name, me, values: { rounds, comebacks } });

test('the first report takes the record and it survives a new board', () => {
  const storage = memStorage();
  const { board } = make({ storage });
  assert.equal(board.holder('rounds'), null);
  const broke = board.submit([row('Ana', 3, 1)]);
  assert.deepEqual(broke.map(b => [b.id, b.value, b.names, b.previous]), [['rounds', 3, ['Ana'], null], ['comebacks', 1, ['Ana'], null]]);
  assert.ok(storage.dump()['pana:records:demo']);
  const again = createRecordBoard({ game: 'demo', metrics: METRICS, storage, stat: () => {} });
  assert.deepEqual(again.holder('rounds'), { names: ['Ana'], value: 3, t: 1000 });
});

test('a tie keeps the older holder; beating it takes the record', () => {
  const { board, clock } = make();
  board.submit([row('Ana', 3)]);
  clock.t = 2000;
  assert.deepEqual(board.submit([row('Beto', 3)]), []);
  assert.deepEqual(board.holder('rounds').names, ['Ana']);
  clock.t = 3000;
  const [broke] = board.submit([row('Beto', 4)]);
  assert.deepEqual(broke.names, ['Beto']);
  assert.equal(broke.previous.value, 3);
  assert.deepEqual(broke.previous.names, ['Ana']);
});

test('panas who reach it in the same report hold it together', () => {
  const { board } = make();
  board.submit([row('Ana', 5), row('Beto', 5), row('Caro', 2)]);
  assert.deepEqual(board.holder('rounds').names.sort(), ['Ana', 'Beto']);
});

test('metrics are held separately', () => {
  const { board } = make();
  board.submit([row('Ana', 5, 0), row('Beto', 1, 2)]);
  assert.deepEqual(board.holder('rounds').names, ['Ana']);
  assert.deepEqual(board.holder('comebacks').names, ['Beto']);
});

test('reporting the same numbers twice changes nothing', () => {
  const { board, clock } = make();
  board.submit([row('Ana', 3)]);
  clock.t = 9000;
  assert.deepEqual(board.submit([row('Ana', 3)]), []);
  assert.equal(board.holder('rounds').t, 1000);
  assert.deepEqual(board.submit([row('Ana', 2)]), []);
  assert.equal(board.holder('rounds').value, 3);
});

test('names match without case or spaces, and bad rows are ignored', () => {
  const { board } = make();
  board.submit([row(' ana ', 2)]);
  board.submit([row('ANA', 4), row('', 9), { name: 'Beto', values: { rounds: NaN } }, { name: 'Caro', values: { rounds: -1 } }, { name: 'Dani' }]);
  assert.deepEqual(board.holder('rounds'), { names: ['ANA'], value: 4, t: 1000 });
  assert.equal(board.table().length, 1);
});

test('a run tells what fell since it started', () => {
  const { board, clock } = make();
  board.submit([row('Ana', 3, 1)]);
  const run = board.startRun();
  clock.t = 2000;
  assert.deepEqual(run.report([row('Ana', 2, 0), row('Beto', 3, 1)]), []);
  assert.ok(run.summary('Beto').every(s => !s.broken && !s.first && !s.mine));
  const reported = run.report([row('Beto', 4, 1)]);
  assert.deepEqual(reported.map(r => r.id), ['rounds']);
  assert.deepEqual(run.report([row('Beto', 4, 1)]), []);   // told once
  const [rounds, comebacks] = run.summary('beto');
  assert.equal(rounds.broken, true); assert.equal(rounds.mine, true);
  assert.deepEqual(rounds.previous.names, ['Ana']);
  assert.equal(comebacks.broken, false); assert.deepEqual(comebacks.holder.names, ['Ana']);
});

test('the first mark ever is a first, not a broken record', () => {
  const { board } = make();
  const run = board.startRun();
  run.report([row('Ana', 1)]);
  const [rounds, comebacks] = run.summary('Ana');
  assert.equal(rounds.first, true); assert.equal(rounds.broken, false); assert.equal(rounds.previous, null);
  assert.equal(comebacks.first, false); assert.equal(comebacks.holder, null);
});

test('the table sorts by the metrics in order', () => {
  const { board } = make();
  board.submit([row('Ana', 2, 5), row('Beto', 4, 0), row('Caro', 2, 7)]);
  assert.deepEqual(board.table().map(r => r.name), ['Beto', 'Caro', 'Ana']);
  assert.equal(board.table(1).length, 1);
  assert.deepEqual(board.table()[1].values, { rounds: 2, comebacks: 7 });
});

test('only the player\'s own marks go to the stats pipe', () => {
  const sent = [];
  const { board } = make({ stat: (id, value) => sent.push([id, value]) });
  board.submit([row('Ana', 3, 1, true), row('Beto', 9, 0)]);
  assert.deepEqual(sent, [['demo.rounds', 3], ['demo.comebacks', 1]]);
});

test('a big board forgets the bottom and keeps every holder', () => {
  const { board } = make({ maxPlayers: 3 });
  board.submit([row('Ana', 9), row('Beto', 8), row('Caro', 7), row('Dani', 6), { name: 'Eli', values: { comebacks: 4 } }]);
  assert.equal(board.table(9).length, 3);
  assert.deepEqual(board.holder('rounds').names, ['Ana']);
  assert.deepEqual(board.holder('comebacks').names, ['Eli']);
});

test('broken or missing storage and a throwing pipe never throw', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  const a = make({ storage: broken, stat: () => { throw new Error('gateway'); } }).board;
  a.submit([row('Ana', 2, 0, true)]);
  assert.equal(a.holder('rounds').value, 2);
  const b = make({ storage: null }).board;
  b.submit([row('Ana', 2)]);
  assert.equal(b.holder('rounds').value, 2);
  const malformed = memStorage(); malformed.setItem('pana:records:demo', '{nope');
  assert.equal(make({ storage: malformed }).board.holder('rounds'), null);
});

test('a tally counts a match once, by its receipt, and survives a reload', () => {
  const storage = memStorage();
  const tally = createTitleTally({ game: 'x', storage });
  assert.equal(tally.add('dive-1', [{ name: 'Ana', id: 'unaMas' }, { name: 'Beto', id: 'banked' }]), true);
  assert.equal(tally.add('dive-1', [{ name: 'Ana', id: 'unaMas' }]), false);
  tally.add('dive-2', [{ name: ' ana ', id: 'unaMas' }, { name: 'Ana', id: 'dropped' }]);
  assert.deepEqual(tally.of('ANA'), [{ id: 'unaMas', count: 2 }, { id: 'dropped', count: 1 }]);
  assert.ok(storage.getItem('pana:titles:x'));
  const again = createTitleTally({ game: 'x', storage });
  assert.deepEqual(again.of('Beto'), [{ id: 'banked', count: 1 }]);
  assert.equal(again.add('dive-2', [{ name: 'Ana', id: 'unaMas' }]), false);
  assert.deepEqual(again.of('Nadie'), []);
});

test('a tally forgets the longest idle player and shrugs off bad storage', () => {
  let t = 0;
  const tally = createTitleTally({ game: 'x', storage: memStorage(), now: () => ++t, maxPlayers: 2 });
  for (const name of ['Ana', 'Beto', 'Cris']) tally.add(name, [{ name, id: 'a' }]);
  assert.deepEqual(tally.of('Ana'), []);
  assert.equal(tally.of('Cris').length, 1);

  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  const offline = createTitleTally({ game: 'x', storage: broken });
  offline.add('d', [{ name: 'Ana', id: 'a' }]);
  assert.deepEqual(offline.of('Ana'), [{ id: 'a', count: 1 }]);

  const junk = memStorage(); junk.setItem('pana:titles:x', '{"players":{"ana":{"name":"Ana","counts":{"a":"x","b":2}}},"receipts":"no"}');
  const read = createTitleTally({ game: 'x', storage: junk });
  assert.deepEqual(read.of('Ana'), [{ id: 'b', count: 2 }]);
  assert.equal(read.add('d', [{ name: 'Ana', id: 'a' }]), true);
  assert.deepEqual(read.of('Ana'), [{ id: 'b', count: 2 }, { id: 'a', count: 1 }]);
});
