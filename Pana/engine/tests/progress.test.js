import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, progressKey, rankAt, nextRank, progressInRank, unlocksAt } from '../progress.js';
import { rankUpToast } from '../progress-ui.js';

const RANKS = [
  { id: 'a', title: 'A', xp: 0, unlocks: [] },
  { id: 'b', title: 'B', xp: 100, unlocks: ['x'] },
  { id: 'c', title: 'C', xp: 300, unlocks: ['y', 'z'] },
];
function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, getItem: key => data.get(key) ?? null, setItem(key, value) { data.set(key, value); } };
}
const open = (storage = fakeStorage()) => createProgress({ game: 'g', ranks: RANKS, storage });

test('rankAt, nextRank and progressInRank read the table', () => {
  assert.equal(rankAt(RANKS, 0).id, 'a');
  assert.equal(rankAt(RANKS, 99).id, 'a');
  assert.equal(rankAt(RANKS, 100).id, 'b');
  assert.equal(rankAt(RANKS, 9999).id, 'c');
  assert.equal(nextRank(RANKS, 0).id, 'b');
  assert.equal(nextRank(RANKS, 300), null);
  assert.equal(progressInRank(RANKS, 50), .5);
  assert.equal(progressInRank(RANKS, 200), .5);
  assert.equal(progressInRank(RANKS, 300), 1);
  assert.deepEqual(unlocksAt(RANKS, 300), ['x', 'y', 'z']);
  assert.equal(rankAt([], 5), null);
});

test('a rank table that does not start at zero never divides by nothing', () => {
  const late = [{ id: 'l', title: 'L', xp: 10, unlocks: [] }];
  assert.equal(rankAt(late, 0).id, 'l');
  assert.equal(progressInRank(late, 0), 0);
});

test('award pays, counts a dive and persists under the game key', () => {
  const storage = fakeStorage(), p = open(storage);
  const r = p.award(40, 'run1');
  assert.deepEqual(r, { gained: 40, xp: 40, rank: RANKS[0], rankedUp: false, newUnlocks: [] });
  assert.equal(p.dives(), 1);
  assert.deepEqual(JSON.parse(storage.data.get(progressKey('g'))), { xp: 40, dives: 1, receipts: ['run1'] });
  assert.equal(open(storage).xp(), 40, 'a later visit reads it back');
});

test('a receipt never pays twice, even after a reload', () => {
  const storage = fakeStorage(), p = open(storage);
  p.award(150, 'run1');
  assert.deepEqual(open(storage).award(150, 'run1'), { gained: 0, xp: 150, rank: RANKS[1], rankedUp: false, newUnlocks: [] });
  assert.equal(p.xp(), 150);
  assert.equal(p.dives(), 1);
  assert.equal(p.paid('run1'), true);
  assert.equal(p.paid('run2'), false);
});

test('a rank-up reports the rank and only what it newly unlocks', () => {
  const p = open();
  const first = p.award(120, 'one');
  assert.equal(first.rankedUp, true);
  assert.equal(first.rank.id, 'b');
  assert.deepEqual(first.newUnlocks, ['x']);
  assert.equal(p.isUnlocked('x'), true);
  assert.equal(p.isUnlocked('y'), false);
  assert.deepEqual(p.award(10, 'two').newUnlocks, []);
  const jump = open().award(500, 'big');
  assert.deepEqual(jump.newUnlocks, ['x', 'y', 'z'], 'two ranks at once pay both');
  assert.deepEqual(p.unlocked(), ['x']);
});

test('receipts keep the last 60, and bad amounts pay nothing', () => {
  const p = open(), storage = fakeStorage(), q = open(storage);
  for (let i = 0; i < 65; i++) q.award(1, `r${i}`);
  const saved = JSON.parse(storage.data.get(progressKey('g')));
  assert.equal(saved.receipts.length, 60);
  assert.equal(saved.receipts[0], 'r5');
  for (const bad of [-5, NaN, 'x', undefined]) assert.equal(p.award(bad, `bad${bad}`).gained, 0);
  assert.equal(p.xp(), 0);
  assert.equal(p.award(2.9, 'floor').gained, 2);
});

test('malformed saves start clean', () => {
  for (const raw of ['{nope', 'null', '{"xp":-4,"dives":"many","receipts":[1,"ok"]}']) {
    const p = open(fakeStorage({ [progressKey('g')]: raw }));
    assert.equal(p.xp(), 0, raw);
    assert.equal(p.dives(), 0, raw);
  }
  assert.equal(open(fakeStorage({ [progressKey('g')]: '{"receipts":[1,"ok"]}' })).paid('ok'), true);
});

test('with storage off or failing, progress lives in memory and still dedupes', () => {
  const off = createProgress({ game: 'g', ranks: RANKS, storage: null });
  off.award(40, 'a'); off.award(40, 'a');
  assert.equal(off.xp(), 40);
  const throws = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const blocked = open(throws);
  blocked.award(40, 'a'); blocked.award(40, 'a');
  assert.equal(blocked.xp(), 40);
  // Full storage: reads still work but hold the older save.
  const full = fakeStorage({ [progressKey('g')]: '{"xp":10,"dives":1,"receipts":[]}' });
  full.setItem = () => { throw new Error('quota'); };
  const stuck = open(full);
  stuck.award(40, 'a'); stuck.award(40, 'a');
  assert.equal(stuck.xp(), 50);
  assert.equal(stuck.dives(), 2);
});

test('games keep separate saves', () => {
  const storage = fakeStorage();
  createProgress({ game: 'one', ranks: RANKS, storage }).award(5, 'r');
  assert.equal(createProgress({ game: 'two', ranks: RANKS, storage }).xp(), 0);
});

test('onChange fires on a paid award only, until unsubscribed', () => {
  const p = open(), seen = [], off = p.onChange(s => seen.push(s));
  p.award(120, 'r'); p.award(120, 'r');
  assert.deepEqual(seen, [{ xp: 120, dives: 1, rank: RANKS[1] }]);
  off(); p.award(1, 's');
  assert.equal(seen.length, 1);
});

test('rankUpToast speaks only on a rank-up', () => {
  const said = [], show = text => said.push(text);
  assert.equal(rankUpToast({ rankedUp: false, rank: RANKS[0] }, show), false);
  assert.equal(rankUpToast(null, show), false);
  assert.equal(rankUpToast({ rankedUp: true, rank: RANKS[1] }, show), true);
  assert.equal(said.length, 1);
  assert.match(said[0], /B/);
});
