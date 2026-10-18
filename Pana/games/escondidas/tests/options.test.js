import test from 'node:test';
import assert from 'node:assert/strict';
import { HuntRound } from '../public/rules.js';
const setup = options => { const g = new HuntRound(); assert.ok(g.configure(options)); for (let id = 1; id <= 6; id++) g.addPlayer(id, `Pana ${id}`, {}); g.start(1, 'seek'); return g; };
test('two seekers freeze together, cannot disguise or capture each other, and both can capture', () => {
  const g = setup({ seekers: 2, hideSeconds: 20, huntSeconds: 120, rounds: 3 }), [a, b, c] = g.players;
  assert.deepEqual(g.seekers, [1, 2]); const x = b.x;
  g.update(.1, new Map([[2, { x: 1 }]])); assert.equal(b.x, x); assert.match(g.transform(2, 'barrel'), /no puedes/);
  g.remaining = .01; g.update(.05); assert.equal(g.remaining, 120);
  Object.assign(a, { x: -4, z: 14 }); Object.assign(b, { x: -2, z: 14 }); Object.assign(c, { x: 0, z: 14 });
  assert.equal(g.check(2), true); assert.equal(a.caught, false); assert.equal(c.caught, true); assert.equal(b.score, 1);
  assert.equal(g.totalRounds, 3); assert.equal(g.configure({ rounds: 6 }), false);
});
test('barrels-only and immobile disguises are authoritative; hints expire and settings survive a fresh host', () => {
  const g = setup({ disguises: 'barrels', moveDisguised: false, hints: 'whistle', seekerMap: true }), p = g.players[2];
  Object.assign(p, { x: -4, z: 14 }); assert.match(g.transform(p.id, 'crate'), /Solo barriles/); assert.equal(g.transform(p.id, 'barrel'), null);
  g.update(.1, new Map([[p.id, { x: 1 }]])); assert.equal(p.x, -4);
  g.remaining = .01; g.update(.05); g.hintAt = 0; g.update(.05); assert.equal(g.hint.kind, 'whistle');
  const fresh = new HuntRound(g.mapId, g.snapshot()); assert.deepEqual(fresh.options, g.options);
  g.elapsed = g.hint.until + .1; g.update(.05); assert.equal(g.hint, null);
  assert.equal(fresh.configure({ seekers: 8 }), false); assert.equal(fresh.configure({ invented: true }), false);
});

test('a human co-seeker never cancels a bot seeker suspicion', () => {
  const g = setup({ seekers: 2 }), bot = g.players[1], hider = g.players[2]; bot.bot = true;
  Object.assign(bot, { x: -4, z: 14 }); Object.assign(hider, { x: -2, z: 14, prop: 'barrel' });
  g.phase = 'hunt'; g.remaining = 100; g.botInput = () => ({});
  for (let i = 0; i < 60; i++) g.update(.05);
  assert.equal(hider.caught, true); assert.equal(bot.score, 1);
});

test('one departing co-seeker leaves the other searching until both leave', () => {
  const g = setup({ seekers: 2 });
  g.removePlayer(1); assert.equal(g.phase, 'hide'); assert.deepEqual(g.seekers, [2]); assert.equal(g.seeker, 2);
  g.removePlayer(2); assert.equal(g.phase, 'results'); assert.equal(g.winner, 'hiders');
});
