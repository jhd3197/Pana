import test from 'node:test';
import assert from 'node:assert/strict';
import { CUPS, awardPoints, cupStandings, trophyFor, rubberBand, DIFFICULTY, cleanLaps, battleOrder, battleOver, BATTLE_TIME } from '../public/modes.js';
import { TRACK_IDS } from '../public/online-rules.js';

test('two cups of four real tracks cover the whole circuit list', () => {
  const all = CUPS.flatMap(c => c.tracks);
  assert.equal(all.length, 8);
  assert.deepEqual([...all].sort(), [...TRACK_IDS].sort());
});

test('cup points add up across races; ties go to the last race', () => {
  const table = {};
  awardPoints(table, ['Ana', 'Beto', 'Caro']);
  awardPoints(table, ['Beto', 'Ana', 'Caro']);
  assert.equal(table.Ana, table.Beto);
  assert.deepEqual(cupStandings(table, ['Beto', 'Ana', 'Caro']).map(r => r.name), ['Beto', 'Ana', 'Caro']);
  assert.equal(trophyFor(0), 'oro');
  assert.equal(trophyFor(3), null);
});

test('rivals far behind speed up, far ahead slow down, harder on difícil', () => {
  assert.equal(rubberBand(0), 1);
  assert.ok(rubberBand(-200) > 1);
  assert.ok(rubberBand(300) < 1);
  assert.ok(rubberBand(-200, DIFFICULTY.dificil) > rubberBand(-200, DIFFICULTY.facil));
  assert.ok(rubberBand(-9999) <= 1.17);
});

test('lap choices stay in range', () => {
  assert.equal(cleanLaps(5), 5);
  assert.equal(cleanLaps(9), 3);
  assert.equal(cleanLaps('2'), 3);
});

test('battle: most balloons first, the last car standing ends it', () => {
  const cars = [{ name: 'a', balloons: 0, outAt: 30 }, { name: 'b', balloons: 2 }, { name: 'c', balloons: 0, outAt: 50 }];
  assert.deepEqual(battleOrder(cars).map(c => c.name), ['b', 'c', 'a']);
  assert.equal(battleOver(cars, 10), true);
  assert.equal(battleOver([{ balloons: 1 }, { balloons: 2 }], 10), false);
  assert.equal(battleOver([{ balloons: 1 }, { balloons: 2 }], BATTLE_TIME), true);
});
