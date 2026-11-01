import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOwned, signCamos, parseSub, verifyRefresh, refreshMessage, REFRESH_WINDOW } from '../src/camo-trust.js';
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

// Mid-session refresh: what pana.sh's camosSigned(nonce) would answer for this account.
const SUB = 'acct-1234abcd';
const subHeaders = (sub = SUB) => ({ 'x-pana-sub': sub, 'x-pana-sub-sig': signCamos(`pana-sub:v1|${sub}`, SECRET) });
const refresh = (ids, nonce, exp, sub = SUB) => ({ ids, nonce, exp, sig: signCamos(refreshMessage(sub, nonce, exp, ids), SECRET) });

test('the account handle counts only when signed', () => {
  assert.equal(parseSub(subHeaders(), env), SUB);
  assert.equal(parseSub(new Headers(subHeaders()), env), SUB);
  assert.equal(parseSub({ ...subHeaders(), 'x-pana-sub': 'acct-otro-999' }, env), '', 'another handle under the same signature');
  assert.equal(parseSub({ 'x-pana-sub': SUB }, env), '', 'unsigned');
  assert.equal(parseSub(subHeaders(), {}), '', 'no secret');
  assert.equal(parseSub(subHeaders('a|b'), env), '', 'only plain handles');
});

test('a refresh holds only for its account, nonce and window', () => {
  const now = 1_000_000, expect = { sub: SUB, nonce: 'n1', issuedAt: now }, exp = now + 60000;
  const ok = refresh(VALUE + ',caribe', 'n1', exp);
  assert.deepEqual([...verifyRefresh(ok, expect, now, env)], [...START, 'selva', 'caribe']);
  const no = (data, e = expect, at = now, en = env) => assert.equal(verifyRefresh(data, e, at, en), null, JSON.stringify(data));
  no({ ...ok, ids: VALUE + ',caribe,pepazo' });               // an id added after signing
  no(refresh(VALUE, 'n2', exp));                                // another connection's nonce
  no(refresh(VALUE, 'n1', exp, 'acct-otro-999'));               // signed for another account
  no(ok, { ...expect, sub: '' });                               // this connection has no signed account
  no(ok, { ...expect, nonce: '' });                             // no nonce was issued
  no(ok, { ...expect, issuedAt: now - REFRESH_WINDOW - 1 });    // the nonce went stale
  no(ok, expect, exp + 1);                                      // expired
  no(refresh(VALUE, 'n1', now + REFRESH_WINDOW + 1));           // expiry too far ahead
  no(refresh(VALUE, 'n1', String(exp)));                        // expiry not a number
  no({ ...ok, sig: ok.sig.slice(0, 40) }); no(null); no('x');
  no(ok, expect, now, { PANA_GATEWAY_SECRET: 'otro' }); no(ok, expect, now, {});
  assert.equal(verifyRefresh(null, {}, now, { PANA_UNLOCK_ALL_CAMOS: '1' }).size, 16, 'dev mode owns everything');
});

test('a signed refresh never passes as a connect header', () => {
  const value = refreshMessage(SUB, 'n1', 5, 'selva,caribe');
  assert.equal(parseOwned({ 'x-pana-camos': value, 'x-pana-camos-sig': signCamos(value, SECRET) }, env).size, 0);
});

test('the room swaps a seat\'s camos mid-session only for a valid signed refresh', () => {
  const before = { ...process.env };
  process.env.PANA_GATEWAY_SECRET = SECRET; delete process.env.PANA_UNLOCK_ALL_CAMOS;
  try {
    const t = createTestRoom(PaintRoom, { code: 'camos-2' });
    const join = (sessionId, headers) => {
      const sent = [], client = { sessionId, send: (type, payload) => sent.push({ type, payload }) };
      client.auth = t.room.onAuth(client, {}, { headers: new Headers(headers) });
      t.room.clients.push(client); t.room.onJoin(client, { name: sessionId });
      return { client, sent, last: type => sent.filter(m => m.type === type).at(-1)?.payload };
    };
    const ana = join('ana', { ...signed, ...subHeaders() }), beto = join('beto', signed);
    const kitOf = c => t.room.game.players.find(p => p.id === t.room.seatOf(c.client)).kit;
    const wear = (c, camo) => { t.send(c.client, 'kit', { weapon: 'carbine', camo }); return kitOf(c).camo; };
    assert.equal(wear(ana, 'caribe'), 'liso-mango', 'not owned at connect');
    // Ana buys caribe: nonce, pana.sh signs it, the room takes it.
    t.send(ana.client, 'camos-nonce'); const { nonce } = ana.last('camos-nonce'); assert.match(nonce, /^[0-9a-f]{32}$/);
    const answer = refresh(VALUE + ',caribe', nonce, Date.now() + 60000);
    t.send(ana.client, 'camos-refresh', answer); assert.deepEqual(ana.last('camos-refreshed'), { ok: true });
    assert.equal(wear(ana, 'caribe'), 'caribe');
    // The same answer again (the nonce is spent), or forwarded by Beto, changes nothing.
    t.send(ana.client, 'camos-refresh', answer); assert.deepEqual(ana.last('camos-refreshed'), { ok: false });
    t.send(beto.client, 'camos-nonce'); assert.equal(beto.last('camos-nonce').nonce, '', 'no signed account, no refresh');
    t.send(beto.client, 'camos-refresh', answer); assert.deepEqual(beto.last('camos-refreshed'), { ok: false });
    assert.equal(wear(beto, 'caribe'), 'liso-mango');
    // A forged signature leaves Ana's list as it was.
    t.send(ana.client, 'camos-nonce'); const n2 = ana.last('camos-nonce').nonce;
    t.send(ana.client, 'camos-refresh', { ...refresh(VALUE, n2, Date.now() + 60000), ids: VALUE + ',caribe,pepazo' });
    assert.equal(wear(ana, 'pepazo'), 'liso-mango'); assert.equal(wear(ana, 'caribe'), 'caribe');
    // A reconnect keeps the refreshed list.
    t.drop(ana.client); ana.client.auth = undefined; t.reconnect(ana.client);
    assert.equal(wear(ana, 'caribe'), 'caribe');
    t.room.onDispose();
  } finally { process.env = before; }
});
