import test from 'node:test';
import assert from 'node:assert/strict';
import { diffState, patchState, createDeltaSender, createDeltaReceiver } from '../state-delta.js';
import { rng } from '../random.js';

// What the wire does to a message (msgpack or JSON): a fresh copy.
const wire = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const roundTrip = (a, b) => assert.deepEqual(patchState(wire(a), wire(diffState(a, b))), wire(b));

test('nothing changed is no delta at all', () => {
  const s = { phase: 'playing', players: [{ id: 'a', x: 1 }], open: {} };
  assert.equal(diffState(s, structuredClone(s)), undefined);
});

test('only what changed travels, and patching rebuilds the whole state', () => {
  const a = { time: 1, players: [{ id: 'a', name: 'Juan', avatar: { fur: '#fff' }, x: 1, z: 2 }, { id: 'b', name: 'Ana', avatar: { fur: '#000' }, x: 5, z: 5 }], options: { map: true }, lift: { floor: 0 } };
  const b = structuredClone(a); b.time = 1.05; b.players[0].x = 1.2;
  const d = diffState(a, b);
  assert.deepEqual(d, { time: 1.05, players: { $ids: 1, $set: { a: { x: 1.2 } } } });
  roundTrip(a, b);
});

test('keyed lists add, remove and reorder; keys come and go; types change', () => {
  const a = { enemies: [{ id: 1, hp: 3 }, { id: 2, hp: 5 }], items: [1, 2, 3], gone: 1, box: { a: 1 }, n: null, list: [{ id: 1 }] };
  const b = { enemies: [{ id: 3, hp: 9, home: { x: 1 } }, { id: 1, hp: 2 }], items: [1, 2], box: 'flat', n: { now: 'object' }, list: [], fresh: [{ id: 'x' }] };
  roundTrip(a, b);
  roundTrip(b, a);
  roundTrip({ x: [1] }, { x: [2] });
});

test('patching leaves the base untouched', () => {
  const a = { players: [{ id: 'a', x: 1, hands: [null, { kind: 'farol' }] }] }, keep = structuredClone(a);
  const b = structuredClone(a); b.players[0].hands[0] = { kind: 'machete' };
  patchState(a, wire(diffState(a, b)));
  assert.deepEqual(a, keep);
});

test('random states round-trip', () => {
  const R = rng(5);
  const value = depth => {
    const k = R();
    if (depth > 2 || k < .35) return R() < .5 ? Math.round(R() * 100) / 10 : R() < .5 ? ['a', 'b', 'c'][Math.floor(R() * 3)] : R() < .5 ? null : R() < .5;
    if (k < .55) return Array.from({ length: Math.floor(R() * 4) }, () => value(depth + 1));
    if (k < .75) return Array.from({ length: Math.floor(R() * 4) }, (_, i) => ({ id: i * 2 + Math.floor(R() * 2), v: value(depth + 1) }));
    return Object.fromEntries(Array.from({ length: Math.floor(R() * 4) }, (_, i) => [`k${Math.floor(R() * 5)}`, value(depth + 1)]));
  };
  for (let i = 0; i < 400; i++) roundTrip(wire(value(0)), wire(value(0)));
});

test('a guest follows a host through deltas, keyframes and a new host', () => {
  const host = createDeltaSender({ keyframe: 5 }), guest = createDeltaReceiver();
  let state = { t: 0, players: [{ id: 'a', x: 0 }] }, got;
  // A guest that joins mid-stream has no base until the next whole state.
  host.encode(state);
  state = { ...state, t: 1 };
  assert.equal(guest.decode('h', wire(host.encode(state))), null);
  host.reset();
  for (let i = 2; i < 14; i++) {
    state = { t: i, players: [{ id: 'a', x: i * .5 }, ...(i > 6 ? [{ id: 'b', x: -i }] : [])] };
    const message = wire(host.encode(state));
    assert.equal('state' in message, i === 2 || (i - 2) % 5 === 0, `keyframe at ${i}`);
    got = guest.decode('h', message);
    assert.deepEqual(got, state);
  }
  // The guest's copy is its own: changing it never corrupts the next patch.
  got.players[0].x = 999;
  state = { ...state, t: 99 };
  assert.deepEqual(guest.decode('h', wire(host.encode(state))), state);
  // A new host's deltas need its own keyframe first.
  const next = createDeltaSender();
  next.encode(state);
  assert.equal(guest.decode('other', wire(next.encode({ ...state, t: 100 }))), null);
  next.reset();
  assert.deepEqual(guest.decode('other', wire(next.encode({ ...state, t: 101 }))), { ...state, t: 101 });
});
