import test from 'node:test';
import assert from 'node:assert/strict';
import { CUPS, POINTS, trophyFor, rubberBand, DIFFICULTY, cleanLaps, battleOrder, battleOver, BATTLE_TIME } from '../public/modes.js';
import { TRACK_IDS } from '../public/online-rules.js';
import { STANDALONE_TRACKS } from '../public/cup-definitions.js';

test('four-race cups and explicitly standalone tracks cover the circuit list', () => {
  const all = CUPS.flatMap(c => c.stages.map(stage => stage.track));
  assert.equal(all.length, CUPS.length * 4);
  assert.deepEqual([...all, ...STANDALONE_TRACKS].sort(), [...TRACK_IDS].sort());
});

test('championship points and podium trophies keep the established scale', () => {
  assert.deepEqual(POINTS, [15, 12, 10, 8, 6, 4, 2, 1]);
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
