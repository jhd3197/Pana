import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveStore, createAutosave, findSlot, sameName } from '../save-game.js';

function memStorage(limit = Infinity) {
  const map = new Map();
  return { getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => { if (String(v).length > limit) throw new Error('full'); map.set(k, String(v)); } };
}
const make = (options = {}) => {
  const clock = { t: 100 };
  return { clock, store: createSaveStore({ game: 'demo', storage: memStorage(), now: () => clock.t, ...options }) };
};

test('a save comes back, newest first, one per id', () => {
  const { store, clock } = make();
  assert.equal(store.save('a', { level: 1 }, { level: 1 }), true);
  clock.t = 200; store.save('b', { level: 5 }, { level: 5 });
  clock.t = 300; store.save('a', { level: 2 }, { level: 2 });
  assert.deepEqual(store.list(), [{ id: 'a', at: 300, meta: { level: 2 } }, { id: 'b', at: 200, meta: { level: 5 } }]);
  assert.deepEqual(store.load('a'), { level: 2 });
  assert.equal(store.load('nope'), null);
});

test('saves survive a new store on the same storage, and removal sticks', () => {
  const storage = memStorage(), a = createSaveStore({ game: 'demo', storage });
  a.save('x', { n: 1 });
  const b = createSaveStore({ game: 'demo', storage });
  assert.deepEqual(b.load('x'), { n: 1 });
  b.remove('x');
  assert.deepEqual(a.list(), []);
  b.remove('x');   // nothing to forget: no throw
});

test('only the newest few are kept', () => {
  const { store, clock } = make({ keep: 2 });
  for (const id of ['a', 'b', 'c']) { clock.t++; store.save(id, {}); }
  assert.deepEqual(store.list().map(s => s.id), ['c', 'b']);
});

test('a new version hides old saves; games do not share', () => {
  const storage = memStorage();
  createSaveStore({ game: 'demo', version: 1, storage }).save('x', {});
  assert.deepEqual(createSaveStore({ game: 'demo', version: 2, storage }).list(), []);
  assert.deepEqual(createSaveStore({ game: 'other', version: 1, storage }).list(), []);
});

test('out of room, the oldest saves go first; a save that cannot fit is a false', () => {
  const big = 'x'.repeat(200), { store } = make({ storage: memStorage(450) });
  store.save('old', { big });
  assert.equal(store.save('new', { big }), true);
  assert.deepEqual(store.list().map(s => s.id), ['new']);
  assert.equal(store.save('huge', { big: 'x'.repeat(900) }), false);
  assert.deepEqual(store.list().map(s => s.id), ['new'], 'the last good save stays');
});

test('broken or missing storage never throws', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  for (const storage of [broken, null]) {
    const store = createSaveStore({ game: 'demo', storage });
    assert.equal(store.save('x', {}), false);
    assert.deepEqual(store.list(), []);
    assert.equal(store.load('x'), null);
    store.remove('x');
  }
  const malformed = memStorage(); malformed.setItem('pana:save:demo', '{nope');
  assert.deepEqual(createSaveStore({ game: 'demo', storage: malformed }).list(), []);
});

test('autosave: at once on a new key, then on a timer, never when not ready', () => {
  const written = [];
  let t = 0, key = 1, ready = false;
  const auto = createAutosave({ store: { save: (id, data) => { written.push(data); return true; } }, every: 1000, now: () => t, key: () => key, ready: () => ready, make: () => ({ id: 1, data: t, meta: {} }) });
  assert.equal(auto.tick(), false);
  ready = true;
  assert.equal(auto.tick(), true);
  t = 500; assert.equal(auto.tick(), false);
  t = 1000; assert.equal(auto.tick(), true);
  t = 1100; key = 2; assert.equal(auto.tick(), true);
  assert.deepEqual(written, [0, 1000, 1100]);
});

test('autosave tries again when a write failed', () => {
  let ok = false, tries = 0;
  const auto = createAutosave({ store: { save: () => { tries++; return ok; } }, ready: () => true, make: () => ({ id: 1, data: 1 }), now: () => 0 });
  auto.tick(); ok = true; assert.equal(auto.tick(), true); assert.equal(tries, 2);
});

test('a returning player finds their free slot by name', () => {
  const slots = [{ name: 'Ana', held: false }, { name: 'ana ', held: true }, { name: 'Beto', held: true }];
  assert.equal(findSlot(slots, ' ANA'), slots[1]);
  assert.equal(findSlot(slots, 'Caro'), null);
  assert.ok(sameName('Ñ', 'ñ'));
});
