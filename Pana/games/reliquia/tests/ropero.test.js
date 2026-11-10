// The camp wardrobe: which earned trims a pana wears. With no pick the highest
// earned of each kind, a pick honoured only while it is earned, and the picks
// kept on this device (or in memory when storage is blocked).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROPERO, ROPERO_KINDS, TRAJES, CASCOS, FAROLES, chosenLook, lookFor } from '../public/suit-look.js';
import { LOOK_KEY, createLookPicks } from '../public/ropero.js';
import { RANKS } from '../public/progress.js';

// Everything up to and including the Capataz rank: franja, remiendo, ámbar, cobre, capataz.
const earned = new Set(RANKS.slice(0, 6).flatMap(r => r.unlocks));
const isUnlocked = id => earned.has(id);
const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

test('every option of each kind is a real trim, plain first, and unlocked by some rank', () => {
  const tables = { traje: TRAJES, casco: CASCOS, farol: FAROLES };
  assert.deepEqual(ROPERO_KINDS.map(([k]) => k), ['traje', 'casco', 'farol']);
  for (const [kind, options] of Object.entries(ROPERO)) {
    assert.equal(options[0].id, null); assert.equal(options[0].unlock, null);
    assert.deepEqual(options.slice(1).map(o => o.id), Object.keys(tables[kind]));
    for (const o of options.slice(1)) assert.ok(RANKS.some(r => r.unlocks.includes(o.unlock)), o.unlock);
  }
});

test('with no pick, the look is the highest earned, as before', () => {
  assert.deepEqual(chosenLook(isUnlocked), lookFor(isUnlocked));
  assert.deepEqual(chosenLook(isUnlocked, {}), { traje: 'capataz', casco: 'cobre', farol: 'ambar' });
  assert.deepEqual(chosenLook(() => false, {}), { traje: null, casco: null, farol: null });
});

test('an earned pick is honoured, and plain is always allowed', () => {
  assert.deepEqual(chosenLook(isUnlocked, { traje: 'franja' }), { traje: 'franja', casco: 'cobre', farol: 'ambar' });
  assert.deepEqual(chosenLook(isUnlocked, { traje: null, casco: null, farol: null }), { traje: null, casco: null, farol: null });
  assert.deepEqual(chosenLook(() => false, { traje: null }), { traje: null, casco: null, farol: null });
});

test('an unearned, unknown or malformed pick falls back to the highest earned', () => {
  const best = { traje: 'capataz', casco: 'cobre', farol: 'ambar' };
  assert.deepEqual(chosenLook(isUnlocked, { traje: 'leyenda', casco: 'oro' }), best);
  assert.deepEqual(chosenLook(isUnlocked, { traje: 'pijama', casco: 5, farol: {} }), best);
  for (const junk of [null, 'franja', 7, ['traje'], { traje: undefined }]) assert.deepEqual(chosenLook(isUnlocked, junk), best, JSON.stringify(junk));
  // A pick that was earned once and is not any more (another device's progress).
  assert.deepEqual(chosenLook(id => id === 'traje:franja', { traje: 'remiendo' }), { traje: 'franja', casco: null, farol: null });
});

test('picks persist under pana:reliquia:look and drop anything malformed', () => {
  const storage = memoryStorage();
  const picks = createLookPicks({ storage });
  assert.deepEqual(picks.get(), {});
  assert.deepEqual(picks.set('traje', 'franja'), { traje: 'franja' });
  assert.deepEqual(picks.set('casco', null), { traje: 'franja', casco: null });
  assert.deepEqual(picks.set('casco', 'bronce'), { traje: 'franja', casco: null }, 'an unknown id changes nothing');
  assert.deepEqual(picks.set('sombrero', 'x'), { traje: 'franja', casco: null }, 'an unknown kind changes nothing');
  assert.deepEqual(JSON.parse(storage.getItem(LOOK_KEY)), { traje: 'franja', casco: null });
  assert.deepEqual(createLookPicks({ storage }).get(), { traje: 'franja', casco: null }, 'a reload reads them back');
  for (const raw of ['{', '"franja"', '[1]', 'null', JSON.stringify({ traje: 'pijama', casco: 3, farol: 'ambar' })]) {
    storage.setItem(LOOK_KEY, raw);
    const read = createLookPicks({ storage }).get();
    assert.deepEqual(read, raw.includes('ambar') ? { farol: 'ambar' } : {}, raw);
  }
});

test('blocked storage keeps the picks in memory', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const picks = createLookPicks({ storage: blocked });
  assert.deepEqual(picks.set('farol', null), { farol: null });
  assert.deepEqual(picks.get(), { farol: null });
  assert.deepEqual(chosenLook(isUnlocked, picks.get()), { traje: 'capataz', casco: 'cobre', farol: null });
  const none = createLookPicks({ storage: null });
  assert.deepEqual(none.set('traje', 'remiendo'), { traje: 'remiendo' });
  assert.deepEqual(none.get(), { traje: 'remiendo' });
});
