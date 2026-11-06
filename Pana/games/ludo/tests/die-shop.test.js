import assert from 'node:assert/strict';
import test from 'node:test';
import { createMangoWallet } from '../../../engine/mangos.js';
import { createDieShop, dieLook, DIE_SHOP_KEY, DEFAULT_DIE, MANGO_DIE } from '../public/die-shop.js';

const COST = dieLook(MANGO_DIE).cost;
const fakeStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
};
function open(mangos = 0, storage = fakeStorage()) {
  const wallet = createMangoWallet(storage, { source: 'ludo' });
  if (mangos) wallet.credit(mangos);
  return { storage, wallet, shop: createDieShop({ wallet, storage }) };
}

test('the cream die is free, owned and worn from the start', () => {
  const { shop, wallet } = open();
  assert.equal(shop.equipped(), DEFAULT_DIE);
  assert.equal(shop.owns(DEFAULT_DIE), true);
  assert.equal(shop.owns(MANGO_DIE), false);
  assert.equal(shop.equip(DEFAULT_DIE), true);
  assert.equal(wallet.peek(), 0);
  assert.equal(dieLook(DEFAULT_DIE).cost, 0);
});

test('buying spends the mangos once and wears the die', () => {
  const { shop, wallet } = open(COST + 40);
  assert.deepEqual(shop.offer(MANGO_DIE), { action: 'buy', cost: COST });
  assert.equal(shop.buy(MANGO_DIE), true);
  assert.equal(wallet.peek(), 40);
  assert.equal(shop.owns(MANGO_DIE), true);
  assert.equal(shop.equipped(), MANGO_DIE);
  assert.equal(shop.buy(MANGO_DIE), true);
  assert.equal(wallet.peek(), 40, 'a second buy is free');
});

test('a short wallet buys nothing and loses nothing', () => {
  const { shop, wallet } = open(COST - 1);
  assert.deepEqual(shop.offer(MANGO_DIE), { action: 'short', cost: COST, missing: 1 });
  assert.equal(shop.buy(MANGO_DIE), false);
  assert.equal(wallet.peek(), COST - 1);
  assert.equal(shop.owns(MANGO_DIE), false);
  assert.equal(shop.equipped(), DEFAULT_DIE);
});

test('a die not owned cannot be equipped', () => {
  const { shop } = open(COST);
  assert.equal(shop.equip(MANGO_DIE), false);
  assert.equal(shop.equipped(), DEFAULT_DIE);
});

test('putting the mango die away shows the cream die and keeps ownership', () => {
  const { shop, wallet } = open(COST);
  shop.buy(MANGO_DIE);
  assert.deepEqual(shop.offer(MANGO_DIE), { action: 'unequip' });
  assert.equal(shop.equip(DEFAULT_DIE), true);
  assert.equal(shop.equipped(), DEFAULT_DIE);
  assert.equal(dieLook(shop.equipped()).id, DEFAULT_DIE);
  assert.deepEqual(shop.offer(MANGO_DIE), { action: 'equip' });
  assert.equal(shop.equip(MANGO_DIE), true);
  assert.equal(shop.equipped(), MANGO_DIE);
  assert.equal(wallet.peek(), 0, 'swapping costs nothing');
});

test('ownership and the worn die survive a reload', () => {
  const { shop, storage } = open(COST);
  shop.buy(MANGO_DIE);
  const again = open(0, storage);
  assert.equal(again.shop.owns(MANGO_DIE), true);
  assert.equal(again.shop.equipped(), MANGO_DIE);
  assert.equal(again.shop.buy(MANGO_DIE), true);
  assert.equal(again.wallet.peek(), 0);
});

test('a purchase in another tab is not paid twice', () => {
  const { shop, storage } = open(COST * 2);
  const other = createDieShop({ wallet: createMangoWallet(storage, { source: 'ludo' }), storage });
  other.buy(MANGO_DIE);
  assert.equal(shop.buy(MANGO_DIE), true);
  assert.equal(createMangoWallet(storage).peek(), COST);
});

test('a bad save falls back to the cream die', () => {
  for (const raw of ['not json', 'null', '{"owned":"mango","equipped":"mango"}', '{"owned":[],"equipped":"mango"}', '{"owned":["oro"],"equipped":"oro"}']) {
    const storage = fakeStorage();
    storage.setItem(DIE_SHOP_KEY, raw);
    const { shop } = open(0, storage);
    assert.equal(shop.equipped(), DEFAULT_DIE, raw);
    assert.equal(shop.owns(MANGO_DIE), false, raw);
  }
  assert.equal(dieLook('nope').id, DEFAULT_DIE);
});

test('blocked storage still sells for the session', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const { shop, wallet } = open(COST, blocked);
  assert.equal(shop.buy(MANGO_DIE), true);
  assert.equal(shop.equipped(), MANGO_DIE);
  assert.equal(shop.buy(MANGO_DIE), true);
  assert.equal(wallet.peek(), 0);
});
