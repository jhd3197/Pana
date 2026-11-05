import test from 'node:test';
import assert from 'node:assert/strict';
import { createMangoWallet, MANGO_KEY, SENT_KEY } from '../mangos.js';

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

// A server the test answers by hand: calls wait in `calls` until replied to.
function fakeBridge(start = 100) {
  const listeners = new Set(), calls = [];
  let balance = start, open;
  const ready = new Promise(resolve => { open = resolve; });
  const call = kind => (amount, source, receipt) => new Promise((resolve, reject) => calls.push({ kind, amount, source, receipt, reject,
    reply(result) { balance = result.balance; resolve(result); return tick(); } }));
  return {
    calls,
    wallet: {
      ready,
      balance: () => balance,
      credit: call('credit'),
      spend: call('spend'),
      onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    },
    push(value) { balance = value; for (const fn of listeners) fn(); },
    load(value) { balance = value; open(); return tick(); },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const spiedStorage = () => {
  const storage = memoryStorage(), touched = new Set();
  return { ...storage, touched, getItem(k) { touched.add(k); return storage.getItem(k); }, setItem(k, v) { touched.add(k); storage.setItem(k, v); } };
};
function remote(start, storage = spiedStorage()) {
  const bridge = fakeBridge(start);
  globalThis.PanaSh = { wallet: bridge.wallet };
  try { return { bridge, storage, wallet: createMangoWallet(storage, { source: 'conuco' }) }; } finally { delete globalThis.PanaSh; }
}

test('remote: the server balance is the truth and the local balance is never used', async () => {
  const storage = spiedStorage();
  storage.values.set(MANGO_KEY, JSON.stringify({ balance: 999, receipts: ['old'] }));
  const { wallet, bridge } = remote(100, storage);
  assert.equal(wallet.remote, true);
  assert.equal(wallet.balance(5000), 100, 'a seed is never imported');
  assert.equal(wallet.peek(), 100);
  assert.equal(wallet.paid('old'), false);
  wallet.spend(10); wallet.credit(5, 'a'); wallet.set(50);
  await Promise.all(bridge.calls.map(c => c.reply({ ok: true, balance: 50, credited: c.amount })));
  assert.deepEqual([...storage.touched], [SENT_KEY], 'only the sent receipts are stored');
  assert.deepEqual(JSON.parse(storage.values.get(MANGO_KEY)), { balance: 999, receipts: ['old'] });
  assert.deepEqual(JSON.parse(storage.values.get(SENT_KEY)), ['a'], 'no balance in the receipts list');
});

test('remote: ready waits for the first balance and tells listeners', async () => {
  const { wallet, bridge } = remote(0), seen = [];
  wallet.onChange(balance => seen.push(balance));
  let ready = false; wallet.ready.then(() => { ready = true; });
  await tick();
  assert.equal(ready, false);
  await bridge.load(800);
  assert.equal(ready, true);
  assert.equal(wallet.peek(), 800);
  assert.deepEqual(seen, [800]);
  bridge.push(810);
  assert.deepEqual(seen, [800, 810], 'the bridge\'s changes reach the page');
});

test('remote: a failed first fetch still resolves ready', async () => {
  const bridge = fakeBridge(0);
  globalThis.PanaSh = { wallet: { ...bridge.wallet, ready: Promise.reject(new Error('down')) } };
  const wallet = createMangoWallet(memoryStorage());
  delete globalThis.PanaSh;
  await wallet.ready;
  assert.equal(wallet.peek(), 0);
});

test('remote: a spend deducts at once and keeps it when the server agrees', async () => {
  const { wallet, bridge } = remote(100), seen = [];
  wallet.onChange(balance => seen.push(balance));
  assert.equal(wallet.spend(150), false, 'the cache refuses first');
  assert.equal(bridge.calls.length, 0);
  assert.equal(wallet.spend(30), true);
  assert.equal(wallet.peek(), 70);
  const [call] = bridge.calls;
  assert.equal(call.kind, 'spend'); assert.equal(call.amount, 30); assert.equal(call.source, 'conuco'); assert.ok(call.receipt);
  await call.reply({ ok: true, balance: 70 });
  assert.equal(wallet.peek(), 70);
  assert.deepEqual(seen, [], 'nothing to correct');
  wallet.spend(1);
  assert.notEqual(bridge.calls[1].receipt, call.receipt, 'each spend has its own receipt');
});

test('remote: a refused spend rolls back and tells listeners', async () => {
  const { wallet, bridge } = remote(100), seen = [];
  wallet.onChange(balance => seen.push(balance));
  wallet.spend(30);
  await bridge.calls[0].reply({ ok: false, balance: 100, error: 'funds' });
  assert.equal(wallet.peek(), 100);
  assert.deepEqual(seen, [100]);
  // The server knows of a spend made elsewhere: its number wins over the rollback.
  wallet.spend(30);
  await bridge.calls[1].reply({ ok: false, balance: 20, error: 'funds' });
  assert.equal(wallet.peek(), 20);
});

test('remote: a lost connection rolls back to the cached balance', async () => {
  const { wallet, bridge } = remote(100);
  wallet.spend(30);
  bridge.calls[0].reject(new Error('offline'));
  await tick();
  assert.equal(wallet.peek(), 100);
});

test('remote: overlapping calls stay optimistic until the last answer', async () => {
  const { wallet, bridge } = remote(100);
  wallet.spend(30); wallet.spend(20);
  assert.equal(wallet.peek(), 50);
  bridge.push(70);                                     // a bridge that updates mid-flight
  assert.equal(wallet.peek(), 50, 'one call still out: not trusted yet');
  await bridge.calls[0].reply({ ok: false, balance: 100, error: 'funds' });
  assert.equal(wallet.peek(), 80, 'the refusal alone is undone');
  await bridge.calls[1].reply({ ok: true, balance: 80 });
  assert.equal(wallet.peek(), 80);
});

test('remote: a credit pays once per receipt and takes what the server credited', async () => {
  const storage = spiedStorage(), { wallet, bridge } = remote(100, storage), seen = [];
  wallet.onChange(balance => seen.push(balance));
  assert.equal(wallet.credit(50, 'r1'), true);
  assert.equal(wallet.peek(), 150);
  assert.equal(wallet.credit(50, 'r1'), false, 'sent in this session');
  assert.equal(bridge.calls.length, 1);
  const [call] = bridge.calls;
  assert.equal(call.kind, 'credit'); assert.equal(call.amount, 50); assert.equal(call.source, 'conuco'); assert.equal(call.receipt, 'r1');
  await call.reply({ ok: true, balance: 120, credited: 20 });  // the daily cap let 20 through
  assert.equal(wallet.peek(), 120);
  assert.deepEqual(seen, [120]);
  assert.ok(wallet.paid('r1'));
  const reloaded = remote(120, storage);
  assert.equal(reloaded.wallet.credit(50, 'r1'), false, 'still known after a reload');
  assert.equal(reloaded.bridge.calls.length, 0);
});

test('remote: a credit the server never took can be sent again', async () => {
  const { wallet, bridge } = remote(100);
  wallet.credit(10, 'r1');
  bridge.calls[0].reject(new Error('offline'));
  await tick();
  assert.equal(wallet.peek(), 100);
  assert.equal(wallet.paid('r1'), false);
  assert.equal(wallet.credit(10, 'r1'), true);
  assert.equal(bridge.calls[1].receipt, 'r1', 'the same receipt: the server stays idempotent');
});

test('remote: the receipts list stays small', async () => {
  const storage = spiedStorage(), { wallet, bridge } = remote(0, storage);
  for (let i = 0; i < 80; i++) wallet.credit(1, 'r' + i);
  await Promise.all(bridge.calls.map(c => c.reply({ ok: true, balance: 80, credited: 1 })));
  assert(JSON.parse(storage.values.get(SENT_KEY)).length <= 60);
  assert.equal(wallet.credit(1, 'r0'), false, 'this session still remembers it');
});

test('remote: set() becomes a spend or a credit of the difference', () => {
  const { wallet, bridge } = remote(100);
  assert.equal(wallet.set(100), 100);
  assert.equal(bridge.calls.length, 0, 'no difference, no call');
  assert.equal(wallet.set(70), 70);
  assert.equal(bridge.calls[0].kind, 'spend'); assert.equal(bridge.calls[0].amount, 30);
  assert.equal(wallet.set(85), 85);
  assert.equal(bridge.calls[1].kind, 'credit'); assert.equal(bridge.calls[1].amount, 15); assert.ok(bridge.calls[1].receipt);
  wallet.set(90);
  assert.notEqual(bridge.calls[2].receipt, bridge.calls[1].receipt, 'a fresh receipt each time');
  assert.equal(wallet.set(NaN), 90, 'a broken number spends nothing');
  assert.equal(wallet.set(-5), 90);
  assert.equal(bridge.calls.length, 3);
});

test('without a bridge the wallet stays local', async () => {
  const storage = memoryStorage(), wallet = createMangoWallet(storage, { source: 'conuco' });
  assert.equal(wallet.remote, false);
  await wallet.ready;
  wallet.credit(5, 'r1');
  assert.equal(JSON.parse(storage.values.get(MANGO_KEY)).balance, 5);
  assert.equal(storage.values.has(SENT_KEY), false);
});
