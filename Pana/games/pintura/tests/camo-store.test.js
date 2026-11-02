import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamoStore, normalize } from '../public/camo-store.js';
import { START_CAMOS } from '../public/armory-data.js';

const answer = { owned: [...START_CAMOS, 'selva', 'made-up'], progress: { sniper: { hits: 3, need: 10, camo: 'bolivar' } }, prices: { caribe: 240 }, balance: 300, equipped: 'selva' };
// A fake window.PanaSh: counts calls, answers or refuses, can hang.
function fake({ fail = false, hang = false } = {}) {
  const bridge = { calls: 0, bought: [],
    camos() { bridge.calls++; return hang ? new Promise(() => {}) : fail ? Promise.reject(new Error('sin sesión')) : Promise.resolve(structuredClone(answer)); },
    buyCamo(id) { if (id === 'pepazo') return Promise.reject(new Error('Te faltan mangos para Pepazo.')); bridge.bought.push(id); return Promise.resolve({ ...structuredClone(answer), owned: [...answer.owned, id], balance: 60 }); } };
  return bridge;
}

test('without pana.sh only the start camos are owned', async () => {
  const store = createCamoStore({ bridge: () => undefined });
  assert.equal(store.available, false);
  const data = await store.load();
  assert.deepEqual(data.owned, START_CAMOS); assert.equal(data.online, false);
  assert.deepEqual(await store.buy('caribe'), { ok: false, error: '' });
});

test('the bridge answer is checked and cached', async () => {
  let t = 0; const bridge = fake(), store = createCamoStore({ bridge: () => bridge, ttl: 1000, now: () => t });
  const data = await store.load();
  assert.equal(data.online, true); assert.ok(data.owned.includes('selva')); assert.ok(!data.owned.includes('made-up'));
  assert.deepEqual(data.progress.sniper, { hits: 3, need: 10, camo: 'bolivar' }); assert.equal(data.balance, 300); assert.equal(data.equipped, 'selva');
  await store.load(); assert.equal(bridge.calls, 1, 'cached');
  t = 2000; await store.load(); assert.equal(bridge.calls, 2, 'stale after the ttl');
  await store.load({ fresh: true }); assert.equal(bridge.calls, 3, 'fresh skips the cache');
  await Promise.all([store.load({ fresh: true }), store.load({ fresh: true })]); assert.equal(bridge.calls, 4, 'one request at a time');
});

test('a refused or hung bridge falls back to the start camos', async () => {
  const refused = await createCamoStore({ bridge: () => fake({ fail: true }) }).load();
  assert.deepEqual(refused.owned, START_CAMOS); assert.equal(refused.signedOut, true);
  const hung = await createCamoStore({ bridge: () => fake({ hang: true }), timeout: 20 }).load();
  assert.deepEqual(hung.owned, START_CAMOS);
  // A good earlier answer survives a later failure.
  let fail = false; const bridge = { camos: () => fail ? Promise.reject(new Error('x')) : Promise.resolve(answer) }, store = createCamoStore({ bridge: () => bridge });
  await store.load(); fail = true; assert.ok((await store.load({ fresh: true })).owned.includes('selva'));
});

test('buying returns the fresh camos or pana.sh\'s reason', async () => {
  const bridge = fake(), store = createCamoStore({ bridge: () => bridge });
  const ok = await store.buy('caribe');
  assert.equal(ok.ok, true); assert.ok(ok.data.owned.includes('caribe')); assert.equal(store.data.balance, 60);
  assert.deepEqual(await store.buy('pepazo'), { ok: false, error: 'Te faltan mangos para Pepazo.' });
  assert.deepEqual(await store.buy('nope'), { ok: false, error: '' }); assert.deepEqual(bridge.bought, ['caribe']);
});

test('normalize never trusts shapes it does not expect', () => {
  const data = normalize({ owned: 'selva', progress: { smg: 'x', carbine: { hits: -4 } }, prices: { caribe: -1, nope: 9 }, balance: 'lots', equipped: 'nope' });
  assert.deepEqual(data.owned, START_CAMOS); assert.deepEqual(data.progress, { carbine: { hits: 0, need: 0, camo: '' } });
  assert.deepEqual(data.prices, {}); assert.equal(data.balance, 0); assert.equal(data.equipped, null);
});

test('signed forwards pana.sh\'s signed list for the room\'s nonce, or null', async () => {
  const asked = [], bridge = { camosSigned: nonce => { asked.push(nonce); return Promise.resolve({ ids: 'selva', nonce: 'otro', exp: 99, sig: 'ab' }); } };
  const store = createCamoStore({ bridge: () => bridge });
  assert.equal(store.canSign, true);
  assert.deepEqual(await store.signed('n1'), { ids: 'selva', nonce: 'n1', exp: 99, sig: 'ab' }, 'the room\'s nonce, whatever the answer says');
  assert.equal(await store.signed(''), null); assert.deepEqual(asked, ['n1']);
  const bad = createCamoStore({ bridge: () => ({ camosSigned: () => Promise.resolve({ ids: ['selva'], exp: 'x' }) }) });
  assert.equal(await bad.signed('n1'), null, 'wrong shapes');
  assert.equal(await createCamoStore({ bridge: () => ({ camosSigned: () => Promise.reject(new Error('sin sesión')) }) }).signed('n1'), null);
  assert.equal(await createCamoStore({ bridge: () => ({ camosSigned: () => new Promise(() => {}) }), timeout: 20 }).signed('n1'), null);
  const none = createCamoStore({ bridge: () => fake() });
  assert.equal(none.canSign, false); assert.equal(await none.signed('n1'), null, 'an older bridge without camosSigned');
});
