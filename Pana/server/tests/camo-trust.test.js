import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOwned, signCamos } from '../src/camo-trust.js';
import PaintRoom from '../../games/pintura/server/room.js';
import { createTestRoom } from './harness.js';

// The reference vector from pana.sh (gateway/tests/test_camos.py): the signed string is
// exactly the x-pana-camos value, the key PANA_GATEWAY_SECRET, the output lowercase hex.
const START = ['liso-mango', 'liso-caribe', 'liso-uva', 'liso-crema', 'liso-carbon', 'liso-coral'];
const SECRET = 'pana-test-secret', VALUE = [...START, 'selva'].join(',');
const DIGEST = 'd95aab0fe3df64b47db06927ab6a7081fbc0039852e1853d1c45e8554a937c02';
const env = { PANA_GATEWAY_SECRET: SECRET };
const signed = { 'x-pana-camos': VALUE, 'x-pana-camos-sig': DIGEST };

test('the signature matches the pana.sh reference vector', () => {
  assert.equal(signCamos(VALUE, SECRET), DIGEST);
});

test('a valid signature makes the ids count (plain headers and Headers alike)', () => {
  assert.deepEqual([...parseOwned(signed, env)], [...START, 'selva']);
  assert.deepEqual([...parseOwned(new Headers(signed), env)], [...START, 'selva']);
  assert.deepEqual([...parseOwned({ ...signed, 'x-pana-camos-sig': DIGEST.toUpperCase() }, env)], [...START, 'selva'], 'hex case does not matter');
});

test('tampered, missing or wrong signatures own nothing', () => {
  const none = headers => assert.equal(parseOwned(headers, env).size, 0, JSON.stringify(headers));
  none({ ...signed, 'x-pana-camos': VALUE + ',caribe' });              // a camo added after signing
  none({ ...signed, 'x-pana-camos-sig': DIGEST.replace(/^d/, 'e') });   // one digit off
  none({ ...signed, 'x-pana-camos-sig': DIGEST.slice(0, 32) });         // short
  none({ ...signed, 'x-pana-camos-sig': 'zz' + DIGEST.slice(2) });      // not hex
  none({ 'x-pana-camos': VALUE });                                     // missing signature
  none({ 'x-pana-camos-sig': DIGEST });                                // missing list
  none({}); none(undefined);
  assert.equal(parseOwned(signed, { PANA_GATEWAY_SECRET: 'otro' }).size, 0, 'another secret');
});

test('without PANA_GATEWAY_SECRET nothing is trusted', () => {
  assert.equal(parseOwned(signed, {}).size, 0);
  assert.equal(parseOwned(signed, { PANA_GATEWAY_SECRET: '' }).size, 0);
});

test('unknown ids in a signed list are dropped', () => {
  const value = 'selva,rayo-laser,caribe';
  assert.deepEqual([...parseOwned({ 'x-pana-camos': value, 'x-pana-camos-sig': signCamos(value, SECRET) }, env)], ['selva', 'caribe']);
});

test('PANA_UNLOCK_ALL_CAMOS=1 owns every camo (local screenshots and tests only)', () => {
  const all = parseOwned({}, { PANA_UNLOCK_ALL_CAMOS: '1' });
  assert.ok(all.has('pepazo') && all.has('selva') && all.has('liso-mango')); assert.equal(all.size, 16);
  assert.equal(parseOwned({}, { PANA_UNLOCK_ALL_CAMOS: 'true' }).size, 0, 'only the exact value 1');
});

test('the room keeps the signed camos per seat and swaps an unowned one, saying so', () => {
  const before = { ...process.env };
  process.env.PANA_GATEWAY_SECRET = SECRET; delete process.env.PANA_UNLOCK_ALL_CAMOS;
  try {
    const t = createTestRoom(PaintRoom, { code: 'camos-1' });
    const join = (sessionId, headers) => {
      const sent = [], client = { sessionId, send: (type, payload) => sent.push({ type, payload }) };
      client.auth = t.room.onAuth(client, {}, { headers: new Headers(headers) });
      t.room.clients.push(client); t.room.onJoin(client, { name: sessionId });
      return { client, sent };
    };
    const ana = join('ana', signed), beto = join('beto', {});
    const kitOf = seat => t.room.game.players.find(p => p.id === seat).kit;
    t.send(ana.client, 'kit', { weapon: 'carbine', camo: 'selva' });
    assert.equal(kitOf(t.room.seatOf(ana.client)).camo, 'selva');
    assert.equal(ana.sent.length, 0);
    t.send(beto.client, 'kit', { weapon: 'carbine', camo: 'selva' });
    assert.equal(kitOf(t.room.seatOf(beto.client)).camo, 'liso-mango');
    assert.deepEqual(beto.sent.at(-1), { type: 'kit-rejected', payload: { reason: 'camo', camo: 'selva' } });
    t.send(beto.client, 'kit', { camo: 'liso-coral' });
    assert.equal(kitOf(t.room.seatOf(beto.client)).camo, 'liso-coral');
    // A reconnect has no new auth and keeps what the seat was vouched for.
    t.drop(ana.client); ana.client.auth = undefined; t.reconnect(ana.client);
    t.send(ana.client, 'kit', { camo: 'selva' }); assert.equal(kitOf(t.room.seatOf(ana.client)).camo, 'selva');
    // The owned lists never reach the broadcast view.
    assert.ok(!JSON.stringify(t.broadcasts.at(-1).msg).includes('camoOwners'));
    t.room.onDispose();
  } finally { process.env = before; }
});
