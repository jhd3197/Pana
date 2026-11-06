import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogbook, logbookKey, completion } from '../logbook.js';
import { createDiscoveryQueue } from '../logbook-ui.js';

const ENTRIES = [{ id: 'a', group: 'x', title: 'A' }, { id: 'b', group: 'x', title: 'B' }, { id: 'c', group: 'y', title: 'C' }];
function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, getItem: key => data.get(key) ?? null, setItem(key, value) { data.set(key, value); } };
}
const open = (storage = fakeStorage(), entries = ENTRIES) => createLogbook({ game: 'g', entries, storage });

test('discover is new once, per game, and survives a reload', () => {
  const storage = fakeStorage(), log = open(storage);
  const first = log.discover('a');
  assert.equal(first.isNew, true); assert.equal(first.entry.title, 'A');
  assert.equal(first.owned, 1); assert.equal(first.total, 3); assert.equal(first.percent, 33);
  assert.equal(log.discover('a').isNew, false);
  assert.ok(storage.data.has(logbookKey('g')));
  const again = open(storage);
  assert.equal(again.discover('a').isNew, false);
  assert.deepEqual(again.owned(), ['a']);
  assert.equal(createLogbook({ game: 'other', entries: ENTRIES, storage }).has('a'), false);
});

test('an id outside the catalog is never new and never counts', () => {
  const log = open();
  const unknown = log.discover('nope');
  assert.equal(unknown.isNew, false); assert.equal(unknown.entry, null);
  assert.equal(log.percent(), 0); assert.equal(log.has('nope'), false);
});

test('list, newest and percent read the catalog', () => {
  const log = open();
  assert.equal(log.newest(), null);
  log.discover('c'); log.discover('a');
  assert.equal(log.newest().id, 'a');
  assert.deepEqual(log.list().map(e => [e.id, e.found]), [['a', true], ['b', false], ['c', true]]);
  assert.equal(log.percent(), 66);
  log.discover('b');
  assert.equal(log.percent(), 100);
});

test('completion rounds down, so 100 means everything', () => {
  assert.equal(completion(199, 200), 99);
  assert.equal(completion(0, 0), 0);
  assert.equal(completion(5, 3), 100);
});

test('an entry the catalog dropped stays saved but stops counting', () => {
  const storage = fakeStorage({ [logbookKey('g')]: JSON.stringify({ found: ['gone', 'a'] }) }), log = open(storage);
  assert.deepEqual(log.owned(), ['a']); assert.equal(log.percent(), 33);
  log.discover('b');
  assert.deepEqual(JSON.parse(storage.data.get(logbookKey('g'))).found, ['gone', 'a', 'b']);
});

test('malformed saves read as empty and repeats are dropped', () => {
  assert.deepEqual(open(fakeStorage({ [logbookKey('g')]: '{oops' })).owned(), []);
  assert.deepEqual(open(fakeStorage({ [logbookKey('g')]: JSON.stringify({ found: 'a' }) })).owned(), []);
  assert.deepEqual(open(fakeStorage({ [logbookKey('g')]: JSON.stringify({ found: ['a', 'a', 3, null] }) })).owned(), ['a']);
});

test('blocked storage still remembers in memory, without paying twice', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const log = open(blocked);
  assert.equal(log.discover('a').isNew, true);
  assert.equal(log.discover('a').isNew, false);
  assert.equal(log.percent(), 33);
  const none = createLogbook({ game: 'g', entries: ENTRIES, storage: null });
  assert.equal(none.discover('a').isNew, true); assert.equal(none.discover('a').isNew, false);
});

test('a failed write does not lose the entry to an older save', () => {
  const data = new Map([[logbookKey('g'), JSON.stringify({ found: ['b'] })]]);
  const log = open({ getItem: key => data.get(key) ?? null, setItem() { throw new Error('full'); } });
  assert.equal(log.discover('a').isNew, true);
  assert.equal(log.has('a'), true); assert.deepEqual(log.owned(), ['b', 'a']);
});

test('onChange hears a discovery once and can stop', () => {
  const log = open(), heard = [];
  const off = log.onChange(s => heard.push(s.owned));
  log.discover('a'); log.discover('a');
  assert.deepEqual(heard, [1]);
  off(); log.discover('b');
  assert.deepEqual(heard, [1]);
});

test('the queue spaces discoveries made together and clears on dispose', () => {
  const pending = [], shown = [];
  const timers = { setTimeout: fn => { pending.push(fn); return pending.length; }, clearTimeout() { pending.length = 0; } };
  const say = createDiscoveryQueue(text => shown.push(text), { timers });
  say('uno'); say('dos'); say('tres');
  assert.deepEqual(shown, ['uno']);
  pending.shift()();
  assert.deepEqual(shown, ['uno', 'dos']);
  say.dispose();
  assert.equal(pending.length, 0);
  say('cuatro');
  assert.deepEqual(shown, ['uno', 'dos', 'cuatro']);
});
