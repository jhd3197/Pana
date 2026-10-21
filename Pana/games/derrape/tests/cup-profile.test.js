import test from 'node:test';
import assert from 'node:assert/strict';
import { CUP_DEFINITIONS, CUPS, STANDALONE_TRACKS, cupById, cupDuration, validateCups } from '../public/cup-definitions.js';
import {
  PROFILE_KEY, PROFILE_VERSION, claimReceipt, cleanSetup, createProfileStore,
  migrateProfile, receiptKey, recordCupTrophy, trophyCredits,
} from '../public/cup-profile.js';
import { TRACK_IDS } from '../public/online-rules.js';
import { LEGACY_PROFILE_FIXTURES } from './cup-profile-fixtures.js';

const fixture = (id) => LEGACY_PROFILE_FIXTURES.find(item => item.id === id);

test('available cups have four unique stages; every other circuit is explicitly standalone', () => {
  assert.equal(CUPS.length, 3);
  const { errors, covered, standalone } = validateCups(TRACK_IDS);
  assert.deepEqual(errors, []);
  assert.deepEqual(standalone, STANDALONE_TRACKS);
  assert.deepEqual([...covered, ...standalone].sort(), [...TRACK_IDS].sort());
  assert.ok(validateCups([...TRACK_IDS, 'unregistered']).errors.some(e=>e.includes('unregistered')));
  assert.ok(validateCups(TRACK_IDS.filter(id=>id!=='puerto')).errors.some(e=>e.includes('unknown standalone')));
  assert.equal(CUP_DEFINITIONS.find(cup => cup.id === 'agua').available, true);
  assert.equal(cupById('agua').id, 'agua');
  assert.equal(cupById('agua', { includeUnavailable: true }).stages.length, 4);
  assert.ok(cupDuration(CUPS[0]).minutes >= 10 && cupDuration(CUPS[0]).minutes <= 15);
});

test('legacy setup choices resolve only to their canonical successor cups', () => {
  assert.equal(cupById('mango').id, 'pana');
  assert.equal(cupById('arepa').id, 'aventura');
  assert.equal(cleanSetup({ mode: 'mango', laps: 2 }).mode, 'pana');
  assert.equal(cleanSetup({ mode: 'arepa', laps: 2 }).mode, 'aventura');
  assert.equal(cleanSetup({ mode: 'battle', laps: 2 }).mode, 'battle');
  assert.equal(cleanSetup({ mode: 'agua', laps: 2 }).mode, 'agua');
  assert.equal(cleanSetup({ mode: 'not-a-mode', laps: 2 }).mode, 'race');
});

test('every legacy fixture preserves earnings and earns only earlier-edition credit', () => {
  for (const item of LEGACY_PROFILE_FIXTURES.filter(item => !item.raw && !item.blocked)) {
    const profile = migrateProfile(item);
    assert.equal(profile.version, PROFILE_VERSION, item.id);
    assert.equal(profile.wallet.coins, item.wallet?.coins ?? 0, `${item.id}: coins unchanged`);
    for (const owned of item.wallet?.owned ?? []) assert.ok(profile.wallet.owned.includes(owned), `${item.id}: ${owned} preserved`);
    assert.deepEqual(profile.trophies, {}, `${item.id}: old route order is not a new-edition win`);
    for (const [oldId, trophy] of Object.entries(item.trophies)) {
      const canonical = cupById(oldId).id;
      assert.equal(profile.legacyTrophies[canonical].trophy, trophy);
      assert.equal(profile.legacyTrophies[canonical].source, oldId);
      assert.equal(profile.legacyTrophies[canonical].label, 'Edición anterior');
    }
    assert.deepEqual(migrateProfile({ profile }), profile, `${item.id}: repeatable migration`);
  }
});

test('old and new results share canonical cup identity and never downgrade', () => {
  const both = migrateProfile(fixture('both-legacy-cups'));
  assert.deepEqual(trophyCredits(both), { pana: 'oro', aventura: 'bronce' });
  assert.equal(Object.keys(trophyCredits(both)).length, 2);

  const profile = migrateProfile(fixture('mango-bronze'));
  assert.equal(recordCupTrophy(profile, 'pana', 'plata'), true);
  assert.equal(recordCupTrophy(profile, 'pana', 'bronce'), false);
  assert.equal(profile.trophies.pana, 'plata');
  assert.deepEqual(trophyCredits(profile), { pana: 'plata' }, 'Mango plus Pana is still one cup');
  assert.equal(recordCupTrophy(profile, 'unknown', 'oro'), false);
});

test('mixed current and legacy data keeps the best result without minting coins', () => {
  const old = fixture('mango-gold');
  const current = migrateProfile(old);
  current.trophies.pana = 'bronce';
  current.receipts[receiptKey('old-session', 0)] = true;
  const coins = current.wallet.coins;
  const mixed = migrateProfile({ profile: current, trophies: old.trophies, wallet: old.wallet });
  assert.equal(mixed.trophies.pana, 'bronce');
  assert.equal(mixed.legacyTrophies.pana.trophy, 'oro');
  assert.equal(trophyCredits(mixed).pana, 'oro');
  assert.equal(mixed.wallet.coins, coins);
  assert.deepEqual(mixed.receipts, current.receipts);
});

test('malformed legacy storage migrates to a usable profile and retains original keys', () => {
  const values = new Map(Object.entries({
    'derrape:setup': fixture('malformed').raw.setup,
    'derrape:trophies': fixture('malformed').raw.trophies,
    'derrape:wallet': fixture('malformed').raw.wallet,
  }));
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = createProfileStore(storage);
  const profile = store.load();
  assert.equal(profile.setup.mode, 'race');
  assert.deepEqual(profile.trophies, {});
  assert.equal(profile.wallet.coins, 0);
  assert.equal(values.get('derrape:setup'), fixture('malformed').raw.setup);
  assert.ok(values.has(PROFILE_KEY));
});

test('blocked storage still supports play and one-time receipts in memory', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const store = createProfileStore(storage);
  const profile = store.load();
  const key = receiptKey('cup-session', 0);
  assert.equal(claimReceipt(profile, key), true);
  assert.equal(claimReceipt(profile, key), false);
  profile.wallet.coins = 12;
  store.save(profile);
  assert.equal(store.load().wallet.coins, 12);
  assert.equal(store.load().receipts[key], true);
});
