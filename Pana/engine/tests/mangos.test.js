import test from 'node:test';
import assert from 'node:assert/strict';
import { createMangoWallet, MANGO_KEY } from '../mangos.js';

const memoryStorage = () => { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; };

test('a new wallet adopts the seed once, then keeps its own balance', () => {
  const storage = memoryStorage(), wallet = createMangoWallet(storage);
  assert.equal(wallet.balance(40), 40);
  assert.equal(createMangoWallet(storage).balance(999), 40, 'the seed only counts for a device with no wallet');
  wallet.set(25); assert.equal(createMangoWallet(storage).balance(), 25);
});

test('a payout before the hand-over keeps the old Carreritas coins', () => {
  const storage = memoryStorage();
  createMangoWallet(storage).credit(25, 'bochinche:sala:1:7');
  assert.equal(createMangoWallet(storage).balance(140), 165);
  assert.equal(createMangoWallet(storage).balance(165), 165, 'the seed is adopted only once');
});

test('credits pay once per receipt and survive a reload', () => {
  const storage = memoryStorage(), wallet = createMangoWallet(storage);
  assert.equal(wallet.credit(12, 'bochinche:abc:1:7'), true);
  assert.equal(wallet.credit(12, 'bochinche:abc:1:7'), false);
  assert.equal(createMangoWallet(storage).balance(), 12);
  assert(createMangoWallet(storage).paid('bochinche:abc:1:7'));
  for (let i = 0; i < 80; i++) wallet.credit(1, 'r' + i);
  assert(JSON.parse(storage.values.get(MANGO_KEY)).receipts.length <= 60);
});

test('malformed and blocked storage fall back safely', () => {
  const bad = memoryStorage(); bad.setItem(MANGO_KEY, '{"balance":-5,"receipts":[3]}');
  assert.equal(createMangoWallet(bad).balance(10), 0);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const wallet = createMangoWallet(blocked);
  assert.equal(wallet.balance(7), 7); wallet.credit(3, 'x');
  assert.equal(wallet.balance(), 10); assert.equal(wallet.credit(3, 'x'), false);
});
