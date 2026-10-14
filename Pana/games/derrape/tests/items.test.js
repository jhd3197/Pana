import test from 'node:test';
import assert from 'node:assert/strict';
import { addItem, activeItem, consumeItem, selectItem, canBlock, coinMultiplier, segmentDistanceSq } from '../public/item-rules.js';

const racer = () => ({ inventory: [null, null], selected: 0, done: false, coins: 0 });

test('two crates may open at once; a full inventory cannot overwrite either item', () => {
  const c = racer();
  assert.equal(addItem(c, 'mango'), true);
  assert.equal(addItem(c, 'jugo'), true);
  assert.equal(addItem(c, 'concha'), false);
  assert.deepEqual(c.inventory.map(i => i.kind), ['mango', 'jugo']);
  assert.equal(consumeItem(c), false, 'cannot fire an unopened item');
  c.inventory[0].rolling = 0;
  assert.equal(canBlock(c), true, 'reserve roulette cannot disable active defense');
  assert.equal(consumeItem(c), true);
  assert.equal(activeItem(c).kind, 'jugo', 'reserve becomes active automatically');
  assert.equal(consumeItem(c), false, 'promotion preserves the reserve opening timer');
});

test('selection determines defense; a triple mango spends one charge per block', () => {
  const c = racer();
  addItem(c, 'jugo', 0); addItem(c, 'mango3', 0);
  assert.equal(canBlock(c), false);
  assert.equal(selectItem(c, 1), true);
  for (let n = 3; n > 0; n--) {
    assert.equal(canBlock(c), true);
    assert.equal(activeItem(c).n, n);
    consumeItem(c);
  }
  assert.equal(activeItem(c).kind, 'jugo');
  assert.equal(canBlock(c), false);
  assert.equal(selectItem(c, 1), false, 'empty slots are not selectable');
  assert.equal(selectItem(c, -1), false);
  assert.equal(selectItem(c, 2), false);
});

test('finished racers cannot switch into a defensive item', () => {
  const c = racer(); addItem(c, 'mango', 0); c.done = true;
  assert.equal(canBlock(c), false);
  assert.equal(selectItem(c, 0), false);
});

test('coins add a bounded eight-percent top-speed bonus', () => {
  const c = racer();
  assert.equal(coinMultiplier(c), 1);
  c.coins = 5; assert.equal(coinMultiplier(c), 1.04);
  c.coins = 10; assert.equal(coinMultiplier(c), 1.08);
  c.coins = 100; assert.equal(coinMultiplier(c), 1.08);
});

test('swept collisions catch a pickup between frames and reject nearby misses', () => {
  assert.equal(segmentDistanceSq(0, 0, -8, 0, 8, 0), 0);
  assert.equal(segmentDistanceSq(0, 3, -8, 0, 8, 0), 9);
  assert.equal(segmentDistanceSq(10, 0, -8, 0, 8, 0), 4);
  assert.equal(segmentDistanceSq(1, 1, 0, 0, 0, 0), 2);
});
