import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileStore, migrateProfile } from '../public/cup-profile.js';
import { rewardCupCompletion, rewardCupStage } from '../public/cup-rewards.js';

test('race and cup receipts pay once into the same profile', () => {
  const profile = migrateProfile({});
  const first = rewardCupStage(profile, { sessionId: 'cup-1', stage: 0, collected: 7, place: 0 });
  assert.equal(first, 17);
  assert.equal(profile.wallet.coins, 17);
  assert.equal(rewardCupStage(profile, { sessionId: 'cup-1', stage: 0, collected: 7, place: 0 }), 0);
  assert.equal(profile.wallet.coins, 17);
  assert.equal(rewardCupCompletion(profile, { sessionId: 'cup-1', trophy: 'oro' }), 40);
  assert.equal(profile.wallet.coins, 57);
  assert.equal(rewardCupCompletion(profile, { sessionId: 'cup-1', trophy: 'oro' }), 0);
  assert.equal(profile.wallet.coins, 57);
});

test('a new session is independent and a trophy-less cup has no bonus', () => {
  const profile = migrateProfile({});
  assert.equal(rewardCupStage(profile, { sessionId: 'cup-1', stage: 3, place: 2 }), 3);
  assert.equal(rewardCupStage(profile, { sessionId: 'cup-2', stage: 0, place: 1 }), 6);
  assert.equal(rewardCupCompletion(profile, { sessionId: 'cup-2', trophy: null }), 0);
  assert.equal(profile.wallet.coins, 9);
});

test('persisted receipts survive a reload without a second cup bonus', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const first = createProfileStore(storage);
  const profile = first.load();
  rewardCupStage(profile, { sessionId: 'persistent-cup', stage: 3, collected: 5, place: 0 });
  rewardCupCompletion(profile, { sessionId: 'persistent-cup', trophy: 'plata' });
  first.save(profile);
  const coins = profile.wallet.coins;
  const reloaded = createProfileStore(storage).load();
  assert.equal(rewardCupStage(reloaded, { sessionId: 'persistent-cup', stage: 3, collected: 5, place: 0 }), 0);
  assert.equal(rewardCupCompletion(reloaded, { sessionId: 'persistent-cup', trophy: 'plata' }), 0);
  assert.equal(reloaded.wallet.coins, coins);
});
