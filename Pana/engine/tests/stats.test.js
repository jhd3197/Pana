import test from 'node:test';
import assert from 'node:assert/strict';
import { createStats } from '../stats.js';

// An in-memory localStorage stand-in; `broken` throws on every touch.
function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.has(k) ? map.get(k) : null,
    setItem: (k, v) => map.set(k, String(v)),
    dump: () => Object.fromEntries(map),
  };
}
const brokenStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };

test('counters accumulate and persist under pana:stats', () => {
  const storage = memStorage();
  const stats = createStats({ storage, send: () => {} });
  assert.equal(stats.statCount('derrape.drift-meters', 350), 350);
  assert.equal(stats.statCount('derrape.drift-meters', 12.5), 362.5);
  assert.equal(stats.statCount('pintura.paint-hits'), 1);   // n defaults to 1
  const saved = JSON.parse(storage.dump()['pana:stats']);
  assert.equal(saved.counters['derrape.drift-meters'], 362.5);
  // A second pipe on the same storage picks the counters up.
  assert.equal(createStats({ storage, send: () => {} }).snapshot().counters['derrape.drift-meters'], 362.5);
});

test('events append with a timestamp', () => {
  let t = 1000;
  const stats = createStats({ storage: memStorage(), now: () => t, send: () => {} });
  stats.statEvent('pintura.paint-hits');
  t = 1600;
  stats.statEvent('pintura.paint-hits');
  assert.deepEqual(stats.snapshot().events, [
    { id: 'pintura.paint-hits', t: 1000 },
    { id: 'pintura.paint-hits', t: 1600 },
  ]);
});

test('the event log is capped, dropping the oldest', () => {
  const stats = createStats({ storage: memStorage(), now: () => 0, send: () => {}, maxEvents: 3 });
  for (let i = 0; i < 5; i++) stats.statEvent(`g.e${i}`);
  assert.deepEqual(stats.snapshot().events.map(e => e.id), ['g.e2', 'g.e3', 'g.e4']);
});

test('each report is handed to the bridge when one is present', () => {
  const sent = [];
  const stats = createStats({ storage: memStorage(), now: () => 42, send: (e) => sent.push(e) });
  stats.statCount('derrape.drift-meters', 10);
  stats.statEvent('pintura.paint-hits');
  assert.deepEqual(sent, [
    { type: 'count', id: 'derrape.drift-meters', n: 10, t: 42 },
    { type: 'event', id: 'pintura.paint-hits', t: 42 },
  ]);
});

test('the default bridge calls window.PanaSh.stats and ignores its absence', () => {
  const sent = [];
  globalThis.PanaSh = { stats: (e) => sent.push(e) };
  try {
    const stats = createStats({ storage: memStorage(), now: () => 7 });
    stats.statEvent('pintura.paint-hits');
    assert.deepEqual(sent, [{ type: 'event', id: 'pintura.paint-hits', t: 7 }]);
  } finally { delete globalThis.PanaSh; }
  assert.doesNotThrow(() => createStats({ storage: memStorage() }).statEvent('pintura.paint-hits'));
});

test('no storage and a throwing storage never crash a report', () => {
  const stats = createStats({ storage: null, send: () => {} });
  assert.equal(stats.statCount('derrape.drift-meters', 5), 5);
  stats.statEvent('pintura.paint-hits');
  assert.equal(stats.snapshot().counters['derrape.drift-meters'], 5);
  const broken = createStats({ storage: brokenStorage, send: () => { throw new Error('gateway down'); } });
  assert.equal(broken.statCount('derrape.drift-meters', 3), 3);   // still counted in memory
});

test('malformed stored data starts fresh', () => {
  const storage = memStorage();
  storage.setItem('pana:stats', 'not json');
  const stats = createStats({ storage, send: () => {} });
  assert.deepEqual(stats.snapshot(), { counters: {}, events: [] });
});
