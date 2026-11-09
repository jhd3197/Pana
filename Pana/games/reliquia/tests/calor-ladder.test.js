// The Escalera de Calor: a counted dive at a new Calor raises the record and pays
// its rung once; anything else leaves both alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition } from '../public/rules.js';
import { RANKS, receiptFor, createCalorLadder, LADDER_KEY, RUNG_XP, rungReceipt } from '../public/progress.js';
import { MAX_CALOR } from '../public/pactos.js';
import { createProgress } from '../../../engine/progress.js';

const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
// A finished dive at these pacts; `counts` clears a jornada (the streak's test).
function dive({ pacts = [], seed = 77, counts = true, outcome = 'wipe' } = {}) {
  const options = { place: 'mina', ...Object.fromEntries(pacts.map(id => [`pacto:${id}`, true])) };
  const g = new Expedition(seed, options); g.addPlayer(1, 'Ana'); g.start(seed);
  if (counts) g.level = 2;
  g.finish(outcome); return g.snapshot();
}
const climbOn = (ladder, state, id = 1) => ladder.climb(state, id, receiptFor(state));

test('a counted dive at a higher Calor is the new best', () => {
  const storage = memoryStorage(), ladder = createCalorLadder({ storage });
  assert.equal(ladder.best(), 0);
  const first = climbOn(ladder, dive({ pacts: ['cuota', 'turno'] }));
  assert.deepEqual(first, { from: 0, best: 2, rungs: 2 });
  assert.equal(createCalorLadder({ storage }).best(), 2, 'kept on the device');
  assert.deepEqual(climbOn(ladder, dive({ pacts: ['silbon'], seed: 78 })), { from: 2, best: 3, rungs: 1 });
});

test('an equal or lower Calor changes nothing', () => {
  const ladder = createCalorLadder({ storage: memoryStorage() });
  climbOn(ladder, dive({ pacts: ['codicia'] }));
  assert.equal(climbOn(ladder, dive({ pacts: ['enjambre'], seed: 78 })).rungs, 0);
  assert.equal(climbOn(ladder, dive({ pacts: ['cuota'], seed: 79 })).rungs, 0);
  assert.equal(climbOn(ladder, dive({ seed: 80 })).rungs, 0);
  assert.equal(ladder.best(), 2);
});

test('spectators and dives that do not count are ignored', () => {
  const ladder = createCalorLadder({ storage: memoryStorage() });
  assert.equal(climbOn(ladder, dive({ pacts: ['silbon'], counts: false })).rungs, 0, 'an empty wipe at the first jornada');
  assert.equal(climbOn(ladder, dive({ pacts: ['silbon'], counts: false, outcome: 'extracted' })).rungs, 0, 'an empty extraction');
  const g = new Expedition(81, { place: 'mina', 'pacto:silbon': true }); g.addPlayer(1, 'Ana'); g.start(81); g.level = 2; g.finish('wipe'); g.addPlayer(9, 'Late');
  const late = g.snapshot();
  assert.equal(late.players.find(p => p.id === 9).spectator, true);
  assert.equal(climbOn(ladder, late, 9).rungs, 0, 'a late spectator');
  assert.equal(climbOn(ladder, late, 404).rungs, 0, 'someone not in the room');
  assert.equal(ladder.best(), 0);
  assert.equal(climbOn(ladder, late, 1).rungs, 3, 'the one who dived climbs');
});

test('a reload or another tab never climbs twice', () => {
  const storage = memoryStorage(), ladder = createCalorLadder({ storage }), s = dive({ pacts: ['tienda'] });
  assert.equal(climbOn(ladder, s).rungs, 1);
  assert.equal(climbOn(ladder, s).rungs, 0, 'a reload of the results');
  assert.equal(createCalorLadder({ storage }).climb(s, 1, receiptFor(s)).rungs, 0, 'another tab');
  assert.equal(ladder.climb(dive({ pacts: ['silbon'], seed: 90 }), 1, '').rungs, 0, 'no receipt, no climb');
});

test('malformed or blocked storage falls back safely', () => {
  for (const raw of ['{', '"x"', 'null', JSON.stringify({ best: -3 }), JSON.stringify({ best: 2.5 }), JSON.stringify({ best: 'nine' })]) {
    const storage = memoryStorage(); storage.setItem(LADDER_KEY, raw);
    assert.equal(createCalorLadder({ storage }).best(), 0, raw);
  }
  const storage = memoryStorage(); storage.setItem(LADDER_KEY, JSON.stringify({ best: 999 }));
  assert.equal(createCalorLadder({ storage }).best(), MAX_CALOR, 'capped at the table');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const ladder = createCalorLadder({ storage: blocked });
  assert.equal(climbOn(ladder, dive({ pacts: ['cuota'] })).rungs, 1);
  assert.equal(ladder.best(), 1, 'remembered in memory');
  assert.equal(createCalorLadder({ storage: null }).best(), 0);
});

test('each new rung pays its XP once, as a bonus on the dive', () => {
  const storage = memoryStorage(), ladder = createCalorLadder({ storage });
  const progress = createProgress({ game: 'reliquia', ranks: RANKS, storage });
  const s = dive({ pacts: ['codicia', 'cuota'] });
  progress.award(5, receiptFor(s));
  const climbed = climbOn(ladder, s), paid = ladder.reward(progress, climbed);
  assert.equal(paid.gained, 3 * RUNG_XP);
  assert.equal(progress.paid(rungReceipt(3)), true);
  assert.equal(progress.dives(), 1, 'the bonus is not another dive');
  assert.equal(ladder.reward(progress, climbed).gained, 0, 'the same rung never pays twice');
  assert.equal(ladder.reward(progress, climbOn(ladder, s)), null, 'a reload pays nothing');
  assert.equal(progress.xp(), 5 + 3 * RUNG_XP);
});
