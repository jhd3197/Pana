// What an expedition pays in XP, from real finished states, and the rank table's pace.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition } from '../public/rules.js';
import { RANKS, xpFor, receiptFor } from '../public/progress.js';
import { createProgress, rankAt } from '../../../engine/progress.js';

function finished(outcome, edit = () => {}) {
  const g = new Expedition(77, { place: 'mina' }); g.addPlayer(1, 'Ana'); g.addPlayer(2, 'Beto'); g.start(77);
  edit(g); g.finish(outcome); return g.snapshot();
}
const typical = g => { g.time = 600; g.level = 3; g.haul = 1500; g.encargosWon = 1; g.players[0].stats.revives = 1; };

test('every dive pays, even a wipe with nothing in the truck', () => {
  const s = finished('wipe', g => { g.time = 60; });
  assert.equal(xpFor(s, 1), 14);
});

test('jornadas, haul, encargos, revives and extracting each add', () => {
  const base = g => { g.time = 300; };
  const pay = edit => xpFor(finished('wipe', g => { base(g); edit(g); }), 1);
  const none = pay(() => {});
  assert.equal(none, 30);
  assert.equal(pay(g => { g.level = 3; }), none + 30);
  assert.equal(pay(g => { g.haul = 1000; }), none + 10);
  assert.equal(pay(g => { g.encargosWon = 2; }), none + 20);
  assert.equal(pay(g => { g.players[0].stats.revives = 2; }), none + 10);
  assert.equal(xpFor(finished('extracted', g => { base(g); g.haul = 1000; }), 1), none + 10 + 20);
});

test('caps: a huge haul, many revives and a long dive stay modest', () => {
  const s = finished('wipe', g => { g.time = 99999; g.haul = 999999; g.players[0].stats.revives = 99; });
  assert.equal(xpFor(s, 1), 30 + 60 + 20);
});

test('leaving at once with an empty truck is not worth farming', () => {
  assert.equal(xpFor(finished('extracted', g => { g.time = 5; }), 1), 10);
});

test('revives are personal; the rest is the team\'s', () => {
  const s = finished('extracted', typical);
  assert.equal(xpFor(s, 1) - xpFor(s, 2), 5);
});

test('someone who only watched the results earns nothing', () => {
  const g = new Expedition(77, { place: 'mina' }); g.addPlayer(1, 'Ana'); g.start(77); g.finish('wipe'); g.addPlayer(9, 'Late');
  const s = g.snapshot();
  assert.equal(xpFor(s, 9), 0);
  assert.equal(xpFor(s, 404), 0);
  assert.ok(xpFor(s, 1) > 0);
});

test('a won encargo counts once toward the expedition, a lost one never', () => {
  const g = new Expedition(77, { place: 'mina' }); g.addPlayer(1, 'Ana'); g.start(77);
  g.settleEncargo(true); g.settleEncargo(true);
  assert.equal(g.encargosWon, 1);
  g.completeLevel(); g.settleEncargo(false);
  assert.equal(g.encargosWon, 1);
  g.completeLevel(); g.settleEncargo(true);
  assert.equal(g.encargosWon, 2, 'kept across jornadas');
  g.start(78);
  assert.equal(g.encargosWon, 0, 'a new expedition starts over');
});

test('the receipt names the expedition and survives a host snapshot', () => {
  const s = finished('wipe');
  assert.equal(receiptFor(s), `${s.seed}:${s.level}:wipe`);
  assert.equal(receiptFor(JSON.parse(JSON.stringify(s))), receiptFor(s));
  assert.notEqual(receiptFor(s), receiptFor(finished('extracted')));
});

test('the table is sorted, ids unique, unlocks never given twice', () => {
  assert.equal(RANKS[0].xp, 0);
  assert.equal(RANKS.length, 8);
  for (let i = 1; i < RANKS.length; i++) assert.ok(RANKS[i].xp > RANKS[i - 1].xp, RANKS[i].id);
  const unlocks = RANKS.flatMap(r => r.unlocks);
  assert.equal(new Set(unlocks).size, unlocks.length);
  assert.equal(new Set(RANKS.map(r => r.id)).size, RANKS.length);
  for (const id of unlocks) assert.match(id, /^[a-z]+:[a-zA-Z]+$/);
});

test('pace: rank 2 after about one dive, the top after 40 to 60', () => {
  const shortWipe = xpFor(finished('wipe', g => { g.time = 180; g.haul = 300; }), 1);
  assert.ok(shortWipe >= RANKS[1].xp, `a short first wipe pays ${shortWipe}`);
  // A career mixes a good run, a modest one and a wipe on the second jornada.
  const good = xpFor(finished('extracted', typical), 1);
  const modest = xpFor(finished('extracted', g => { g.time = 420; g.level = 2; g.haul = 800; }), 1);
  const wipe = xpFor(finished('wipe', g => { g.time = 300; g.level = 2; g.haul = 500; }), 1);
  const dives = RANKS.at(-1).xp / ((good + modest + wipe) / 3);
  assert.ok(dives >= 40 && dives <= 60, `${dives} dives`);
});

test('a whole career on the real progress reaches the top without double pay', () => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const p = createProgress({ game: 'reliquia', ranks: RANKS, storage }), s = finished('extracted', typical);
  let dives = 0;
  while (p.rank().id !== 'leyenda' && dives < 200) { dives++; const state = { ...s, seed: dives }; p.award(xpFor(state, 1), receiptFor(state)); p.award(xpFor(state, 1), receiptFor(state)); }
  assert.equal(rankAt(RANKS, p.xp()).id, 'leyenda');
  assert.equal(p.dives(), dives);
  assert.ok(dives >= 35 && dives <= 60, `${dives} dives`);
  assert.equal(p.isUnlocked('casco:oro'), true);
});
