import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileStore, migrateProfile } from '../public/cup-profile.js';
import { rewardCupCompletion, rewardCupStage, settleRace } from '../public/cup-rewards.js';

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

test('race settlement includes real bonuses and cannot pay twice',()=>{
 const profile=migrateProfile({}),def={tune:{top:30,accel:20,turn:2,mass:1,grip:5}},player={def,done:true,coinsCollected:7};
 const rival={def:{tune:{top:38,accel:28,turn:2.8,mass:1,grip:7}}},race={};
 const args={race,profile,player,order:[player,rival],track:{},myId:'local',record:true};
 assert(settleRace(args));assert.equal(profile.wallet.coins,27);assert.equal(race.rewardDetail.giant,5);assert.equal(race.rewardDetail.record,5);
 assert.equal(settleRace(args),false);assert.equal(profile.wallet.coins,27);
});
test('v2 migration retains paid receipts and the wallet with new kit defaults',()=>{
 const profile=migrateProfile({profile:{version:2,wallet:{coins:42},receipts:{paid:true},trophies:{}}});
 assert.equal(profile.wallet.coins,42);assert.equal(profile.wallet.boat,'penero');assert.equal(profile.receipts.paid,true);assert.equal(profile.version,3);
});
