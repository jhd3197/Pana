import test from 'node:test';
import assert from 'node:assert/strict';
import { dealHidingSpots, searchStep, decaySearches, searchesStarted } from '../play/hiding-spots.js';
import { rng } from '../random.js';

const places = n => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, hard: i / Math.max(1, n - 1) }));

test('the same seed deals the same spots', () => {
  const deal = seed => dealHidingSpots(rng(seed), places(8), { treasures: ['mask', 'cup', 'cup'], lesser: ['coins'], junk: ['book'], traps: ['spider'] });
  assert.deepEqual(deal(7), deal(7));
  assert.notDeepEqual(deal(7).spots.map(s => s.content), deal(8).spots.map(s => s.content));
});

test('every treasure is dealt; with too few places they share one', () => {
  const treasures = ['a', 'b', 'c', 'd', 'e'];
  const { spots, left } = dealHidingSpots(rng(3), places(3), { treasures });
  assert.equal(left.length, 0);
  assert.deepEqual(spots.flatMap(s => s.content).sort(), treasures);
  assert.deepEqual(dealHidingSpots(rng(3), [], { treasures }).left, treasures, 'no places: all of it comes back');
});

test('leftover places are junk, lesser finds, traps or empty; treasures lean to hard places', () => {
  let decoys = 0, empty = 0, traps = 0, lesser = 0, hardSum = 0, treasures = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const { spots } = dealHidingSpots(rng(seed), places(10), { treasures: ['t1', 't2', 't3'], lesser: ['coin'], junk: ['book'], traps: ['spider'] });
    for (const s of spots) {
      if (s.decoy) { decoys++; assert.deepEqual(s.content, ['book']); }
      else if (s.trap) { traps++; assert.equal(s.content.length, 0); }
      else if (s.content[0] === 'coin') lesser++;
      else if (!s.content.length) empty++;
      else { treasures++; hardSum += s.hard; }
    }
  }
  assert.ok(decoys > 0 && empty > 0 && traps > 0 && lesser > 0, `${decoys} ${empty} ${traps} ${lesser}`);
  assert.ok(hardSum / treasures > .5, `treasure sits deeper than average (${(hardSum / treasures).toFixed(2)})`);
});

test('a search completes once, and fades when nobody holds it', () => {
  const store = {};
  let done = 0;
  for (let i = 0; i < 30; i++) if (searchStep(store, 's1', .05, 1)) done++;
  assert.equal(done, 1);
  assert.equal(searchStep(store, 's1', .05, 1), false);
  searchStep(store, 's2', .5, 1);
  decaySearches(store, new Set(), .2, { done: id => id === 's1' });
  assert.equal(store.s1, undefined, 'finished searches are dropped');
  assert.ok(store.s2 < .5 && store.s2 > 0);
  decaySearches(store, new Set(['s2']), 1);
  assert.ok(store.s2 > 0, 'a held search does not fade');
  decaySearches(store, new Set(), 1);
  assert.equal(store.s2, undefined);
});

test('searchesStarted reports each search once, and again only after it ended', () => {
  const seen = new Set(), started = [];
  const look = store => searchesStarted(store, seen, id => started.push(id));
  look({ s1: .1 }); look({ s1: .4 }); look({ s1: .6, s2: .1 });
  assert.deepEqual(started, ['s1', 's2']);
  look({ s2: .3 }); look({ s1: .05, s2: .5 });
  assert.deepEqual(started, ['s1', 's2', 's1']);
  look(undefined); assert.equal(seen.size, 0);
});
