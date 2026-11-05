// Conuco's tables make a fair game: nobody gets stuck, every crop is worth its seed,
// and every decoration has a rank. The mechanics are tested in engine/tests/plot.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS, DECOR, RANKS, SHOP, TIERS, formatLeft, rankOfDecor } from '../public/rules.js';
import { CONUCO_CROPS, CONUCO_HOUSE_TIERS } from '../../../engine/models/props/conuco.data.js';
import { createPlot } from '../../../engine/plot/plot.js';
import { HOUR, WILT, scaled } from '../../../engine/plot/growth.js';
import { rotatingStock } from '../../../engine/plot/rotation.js';

test('one crop is always free, so a player with nothing can still play', () => {
  const free = CROPS.filter(crop => crop.free);
  assert.equal(free.length, 1);
  assert.equal(free[0].seedCost, 0);
  assert.ok(free[0].mangos > 0);
});

test('every paid crop is worth its seed, even wilted', () => {
  for (const crop of CROPS.filter(c => !c.free)) {
    assert.ok(crop.mangos > crop.seedCost, `${crop.id} pays more than its seed`);
    assert.ok(scaled(crop.mangos, WILT.floor) >= crop.seedCost, `${crop.id} wilted still repays its seed`);
  }
});

test('longer crops pay more', () => {
  for (let i = 1; i < CROPS.length; i++) {
    assert.ok(CROPS[i].growMs > CROPS[i - 1].growMs, CROPS[i].id);
    assert.ok(CROPS[i].mangos > CROPS[i - 1].mangos, CROPS[i].id);
  }
});

test('the house starts ruined, gets dearer and never loses a bed', () => {
  assert.equal(TIERS[0].cost, 0);
  for (let i = 1; i < TIERS.length; i++) {
    assert.ok(TIERS[i].cost > TIERS[i - 1].cost);
    assert.ok(TIERS[i].beds >= TIERS[i - 1].beds);
  }
});

test('the first repair is a short session away with the free crop alone', () => {
  const free = CROPS.find(crop => crop.free), rounds = Math.ceil(TIERS[1].cost / (free.mangos * TIERS[0].beds));
  assert.ok(rounds * free.growMs <= HOUR, `${rounds} rounds of ${free.id}`);
});

test('every crop and tier has a model, and no more beds than the scene has places', () => {
  assert.deepEqual([...CONUCO_CROPS].sort(), CROPS.map(crop => crop.id).sort());
  assert.equal(CONUCO_HOUSE_TIERS, TIERS.length);
  assert.ok(TIERS.at(-1).beds <= 9);
});

test('every decoration is unlocked by exactly one rank, past the first', () => {
  const unlocks = RANKS.flatMap(rank => rank.unlocks);
  for (const item of DECOR) {
    assert.equal(unlocks.filter(id => id === item.unlock).length, 1, item.id);
    assert.ok(rankOfDecor(item.id).xp > 0, item.id);
  }
  assert.equal(unlocks.length, DECOR.length, 'no unlock without its decoration');
});

test('every seed for sale comes up on the shelf within a day or two', () => {
  const seen = new Set(), forSale = CROPS.filter(crop => !crop.free);
  for (let window = 5000; window < 5000 + 12; window++) for (const { item } of rotatingStock(forSale, { ...SHOP, window })) seen.add(item.id);
  assert.equal(seen.size, forSale.length);
});

test('the shelf is the same on any two pages at the same moment', () => {
  const make = () => createPlot({ game: 'conuco', crops: CROPS, tiers: TIERS, shop: SHOP, storage: null, now: () => 1_800_000_000_000 });
  assert.deepEqual(make().stock().items.map(i => [i.id, i.qty]), make().stock().items.map(i => [i.id, i.qty]));
});

test('the bed clock stays short', () => {
  assert.equal(formatLeft(0), '0 s');
  assert.equal(formatLeft(45_000), '45 s');
  assert.equal(formatLeft(60_000), '1 min');
  assert.equal(formatLeft(12 * 60_000 - 1), '12 min');
  assert.equal(formatLeft(HOUR), '1 h');
  assert.equal(formatLeft(3 * HOUR + 20 * 60_000), '3 h 20');
  assert.equal(formatLeft(3 * HOUR + 5 * 60_000), '3 h 05');
});
