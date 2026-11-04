// The shared day: dates, seeds, the rotation, and the streak with its freezes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, dayNumber, isDayKey, dailySeed, pickDaily, createStreak, streakKey, MILESTONES } from '../daily.js';

const fakeStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return { data, getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, v) };
};
// The n-th day from a fixed start, across a month end.
const nth = n => dayKey(new Date(2026, 9, 25 + n));
const open = (storage = fakeStorage(), now) => createStreak({ game: 'g', storage, ...(now ? { now } : {}) });
const played = (streak, days) => days.map(n => streak.record(nth(n))).at(-1);

test('dayKey is the local calendar date, padded', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 0)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 11, 31, 12)), '2026-12-31');
});

test('dayNumber counts whole days and refuses what is not a date', () => {
  assert.equal(dayNumber('2026-03-01') - dayNumber('2026-02-28'), 1);
  assert.equal(dayNumber('2028-03-01') - dayNumber('2028-02-29'), 1);
  assert.equal(dayNumber('2027-01-01') - dayNumber('2026-12-31'), 1);
  for (const bad of ['2026-02-30', '2026-13-01', 'hoy', '', null, undefined, 20261104]) assert.equal(isDayKey(bad), false, String(bad));
  assert.equal(isDayKey('2026-11-04'), true);
});

test('every day of a year has its own key, daylight saving included', () => {
  const keys = new Set(); for (let i = 0; i < 365; i++) keys.add(nth(i));
  assert.equal(keys.size, 365);
  for (let i = 1; i < 365; i++) assert.equal(dayNumber(nth(i)) - dayNumber(nth(i - 1)), 1);
});

test('a daily seed is a stable uint32 per game and day', () => {
  const seed = dailySeed('reliquia', '2026-11-04');
  assert.equal(seed, dailySeed('reliquia', '2026-11-04'));
  assert.notEqual(seed, dailySeed('reliquia', '2026-11-05'));
  assert.notEqual(seed, dailySeed('pepazo', '2026-11-04'));
  const seeds = new Set();
  for (let i = 0; i < 365; i++) { const s = dailySeed('reliquia', nth(i)); assert.ok(Number.isInteger(s) && s > 0 && s <= 0xffffffff); seeds.add(s); }
  assert.equal(seeds.size, 365);
});

test('pickDaily is fixed for a day and walks the whole list before repeating', () => {
  for (const size of [2, 3, 6, 10, 21]) {
    const list = Array.from({ length: size }, (_, i) => i);
    assert.equal(pickDaily(list, nth(4)), pickDaily([...list], nth(4)));
    assert.equal(new Set(Array.from({ length: size }, (_, i) => pickDaily(list, nth(i)))).size, size, `size ${size}`);
    for (let i = 1; i < 100; i++) assert.notEqual(pickDaily(list, nth(i)), pickDaily(list, nth(i - 1)));
  }
});

test('pickDaily with nothing to pick from', () => {
  assert.equal(pickDaily([], nth(0)), undefined);
  assert.equal(pickDaily(null, nth(0)), undefined);
  assert.equal(pickDaily(['a'], 'hoy'), undefined);
  assert.equal(pickDaily(['a'], nth(0)), 'a');
});

test('the first day starts the streak and persists under the game key', () => {
  const storage = fakeStorage();
  assert.deepEqual(open(storage).record(nth(0)), { days: 1, best: 1, freezesLeft: 0, usedFreeze: false, milestone: 0 });
  assert.deepEqual(JSON.parse(storage.data.get(streakKey('g'))), { days: 1, best: 1, freezes: 0, last: nth(0) });
  assert.equal(open(storage).peek(nth(0)).days, 1, 'a later visit reads it back');
});

test('the same day counts once, and a repeat celebrates nothing', () => {
  const s = open();
  played(s, [0, 1]);
  assert.equal(s.record(nth(2)).milestone, 3);
  assert.deepEqual(s.record(nth(2)), { days: 3, best: 3, freezesLeft: 0, usedFreeze: false, milestone: 0 });
});

test('milestones fall exactly on their days', () => {
  const s = open(), hit = [];
  for (let i = 0; i < 31; i++) { const r = s.record(nth(i)); assert.equal(r.days, i + 1); if (r.milestone) hit.push(r.milestone); }
  assert.deepEqual(hit, MILESTONES);
});

test('the clock comes from the injected source when no day is given', () => {
  let at = new Date(2026, 10, 4, 22);
  const s = open(fakeStorage(), () => at);
  assert.equal(s.record().days, 1);
  at = new Date(2026, 10, 4, 23, 59);
  assert.equal(s.record().days, 1, 'still the same day');
  at = new Date(2026, 10, 5, 0, 1);
  assert.equal(s.record().days, 2, 'past midnight it is the next');
  assert.equal(s.peek().days, 2);
});

test('a freeze is earned every 7 days, at most 2', () => {
  const s = open();
  const at = n => played(s, Array.from({ length: n }, (_, i) => i)).freezesLeft;
  assert.equal(at(6), 0);
  assert.equal(s.record(nth(6)).freezesLeft, 1);
  for (let i = 7; i < 14; i++) s.record(nth(i));
  assert.equal(s.peek(nth(13)).freezesLeft, 2);
  for (let i = 14; i < 21; i++) s.record(nth(i));
  assert.equal(s.peek(nth(20)).freezesLeft, 2, 'never a third');
});

test('one missed day spends a freeze and keeps the streak', () => {
  const s = open();
  played(s, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(s.record(nth(8)), { days: 8, best: 8, freezesLeft: 0, usedFreeze: true, milestone: 0 });
  assert.equal(s.record(nth(9)).usedFreeze, false);
});

test('one missed day with no freeze starts over at 1', () => {
  const s = open();
  played(s, [0, 1, 2]);
  assert.deepEqual(s.record(nth(4)), { days: 1, best: 3, freezesLeft: 0, usedFreeze: false, milestone: 0 });
});

test('two missed days start over even with freezes, and the freezes stay', () => {
  const s = open();
  played(s, Array.from({ length: 14 }, (_, i) => i));
  assert.deepEqual(s.record(nth(16)), { days: 1, best: 14, freezesLeft: 2, usedFreeze: false, milestone: 0 });
});

test('a day reaching a multiple of 7 through a freeze still earns one', () => {
  const s = open(fakeStorage({ [streakKey('g')]: JSON.stringify({ days: 6, best: 6, freezes: 1, last: nth(0) }) }));
  assert.deepEqual(s.record(nth(2)), { days: 7, best: 7, freezesLeft: 1, usedFreeze: true, milestone: 7 });
});

test('a clock set back or a bad day changes nothing', () => {
  const storage = fakeStorage(), s = open(storage);
  played(s, [5, 6]);
  const before = storage.data.get(streakKey('g'));
  assert.equal(s.record(nth(2)).days, 2);
  assert.equal(s.record('hoy').days, 2);
  assert.equal(storage.data.get(streakKey('g')), before);
});

test('peek shows the streak while it can still be kept and never counts', () => {
  const s = open();
  played(s, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(s.peek(nth(7)).days, 7);
  assert.equal(s.peek(nth(8)).days, 7, 'a freeze would cover it');
  assert.equal(s.peek(nth(9)).days, 0);
  assert.equal(s.peek(nth(9)).best, 7);
  assert.equal(s.record(nth(7)).days, 8, 'peeking counted nothing');
  assert.equal(open().peek(nth(0)).days, 0);
});

test('malformed or hostile storage reads as a fresh start', () => {
  for (const raw of ['{', 'null', '[]', '{"days":-4,"best":"x","freezes":99,"last":"ayer"}']) {
    const s = open(fakeStorage({ [streakKey('g')]: raw }));
    const seen = s.peek(nth(0));
    assert.equal(seen.days, 0, raw);
    assert.ok(seen.freezesLeft <= 2, raw);
    assert.equal(s.record(nth(0)).days, 1, raw);
  }
});

test('blocked storage still counts for the session', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = open(broken);
  played(s, [0, 1]);
  assert.equal(s.peek(nth(1)).days, 2);
  const none = createStreak({ game: 'g', storage: null });
  assert.equal(none.record(nth(0)).days, 1);
});
