// The day's dive: one cave and one set of pacts per date, back to the host's own
// options afterwards, what counts for the streak, and the day's best.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition } from '../public/rules.js';
import { DEFAULT_OPTIONS, validOptions } from '../public/options.js';
import { PACTOS, pactosOf, calorOfOptions } from '../public/pactos.js';
import { xpFor, receiptFor, createFosaProgress } from '../public/progress.js';
import { dailyPlan, dailyPactos, startDive, countsForStreak, reportBest, bestLine, BEST_KEY } from '../public/daily.js';

const DAY = '2026-11-04', NEXT = '2026-11-05';
const fakeStorage = () => { const data = new Map(); return { data, getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, v) }; };
const room = (options = {}) => { const g = new Expedition(1, options); g.addPlayer(1, 'Ana'); return g; };
const nthDay = n => { const d = new Date(Date.UTC(2026, 0, 1 + n)); return d.toISOString().slice(0, 10); };
const cave = g => JSON.stringify(g.layout.run.rooms.map(r => [r.kind, r.x, r.z]));

test('the same day gives the same seed and pacts, the next day others', () => {
  assert.deepEqual(dailyPlan(DAY), dailyPlan(DAY));
  assert.notEqual(dailyPlan(DAY).seed, dailyPlan(NEXT).seed);
  assert.notDeepEqual(dailyPactos(DAY), dailyPactos(NEXT));
});

test('a year of days: one or two real pacts, valid options, every set in rotation', () => {
  const real = new Set(PACTOS.map(p => p.id)), seen = new Set();
  for (let n = 0; n < 365; n++) {
    const day = nthDay(n), plan = dailyPlan(day);
    assert.ok(plan.pactos.length >= 1 && plan.pactos.length <= 2, day);
    assert.ok(plan.pactos.every(id => real.has(id)), day);
    assert.ok(validOptions(plan.options), day);
    assert.deepEqual(pactosOf(plan.options), PACTOS.filter(p => plan.pactos.includes(p.id)).map(p => p.id), day);
    assert.notDeepEqual(plan.pactos, dailyPactos(nthDay(n + 1)), day);
    seen.add(plan.pactos.join());
  }
  assert.equal(seen.size, 21, 'six singles and fifteen pairs');
});

test('two rooms with different settings dive the same cave with the same rules', () => {
  const a = room({ place: 'biblioteca', difficulty: 'hard', greed: 'fierce', map: false, wipeShare: 50 }), b = room();
  b.addPlayer(2, 'Beto');
  startDive(a, DAY, 111); startDive(b, DAY, 222);
  assert.equal(a.seed, dailyPlan(DAY).seed); assert.equal(b.seed, a.seed);
  assert.equal(cave(a), cave(b));
  const rules = g => { const { crude, ...rest } = g.options; return rest; };
  assert.deepEqual(rules(a), rules(b));
  assert.equal(a.daily, DAY);
  const c = room(); startDive(c, NEXT, 333);
  assert.notEqual(cave(c), cave(a), 'another day, another cave');
});

test('rank does not gate the day: every pact goes through, whoever hosts', () => {
  for (let n = 0; n < 40; n++) {
    const day = nthDay(n), g = room(); startDive(g, day, 5);
    assert.deepEqual(pactosOf(g.options).sort(), [...dailyPactos(day)].sort());
    assert.equal(g.phase, 'playing');
  }
});

test('the host\'s phrases stay; no other pact from the host\'s settings survives', () => {
  const pick = dailyPactos(DAY), other = PACTOS.find(p => !pick.includes(p.id)).id;
  const g = room({ crude: true, [`pacto:${other}`]: true }); startDive(g, DAY, 5);
  assert.equal(g.options.crude, true);
  assert.equal(g.options[`pacto:${other}`], false);
});

test('the next plain dive gets the host\'s own options and a new seed back', () => {
  const own = { place: 'mina', difficulty: 'hard' }, g = room(own);
  const before = { ...g.options };
  startDive(g, DAY, 5); g.finish('wipe');
  startDive(g, undefined, 999);
  assert.deepEqual(g.options, before); assert.equal(g.seed, 999);
  assert.equal(g.daily, ''); assert.equal(g.plainOptions, null);
  assert.equal(calorOfOptions(g.options), 0);
});

test('a daily after a daily still remembers the host\'s own options', () => {
  const g = room({ place: 'mina' }), before = { ...g.options };
  startDive(g, DAY, 5); g.finish('wipe');
  startDive(g, NEXT, 5); assert.equal(g.daily, NEXT);
  assert.deepEqual(g.plainOptions, before);
  g.finish('wipe'); startDive(g, undefined, 9);
  assert.deepEqual(g.options, before);
});

test('a junk day from the wire is a plain dive', () => {
  for (const junk of ['hoy', 7, null, '2026-02-30', { day: DAY }]) {
    const g = room(); startDive(g, junk, 42);
    assert.equal(g.seed, 42); assert.equal(g.daily, '');
    assert.deepEqual(g.options, DEFAULT_OPTIONS);
  }
});

test('a new host keeps the day and the options to restore', () => {
  const g = room({ place: 'mina' }); startDive(g, DAY, 5);
  const next = new Expedition(g.seed, g.options); next.restore(g.snapshot(), new Map([[1, { id: 1, name: 'Ana' }]]));
  assert.equal(next.daily, DAY);
  assert.equal(next.plainOptions.place, 'mina');
  next.finish('wipe'); startDive(next, undefined, 9);
  assert.equal(next.options.place, 'mina');
});

test('retrying the day is a new receipt, and a plain dive\'s receipt is unchanged', () => {
  const dive = time => { const g = room(); startDive(g, DAY, 5); g.time = time; g.finish('wipe'); return g.snapshot(); };
  assert.notEqual(receiptFor(dive(60)), receiptFor(dive(61)));
  assert.equal(receiptFor(dive(60)), receiptFor(dive(60)));
  const plain = room(); plain.start(77); plain.finish('wipe');
  assert.equal(receiptFor(plain.snapshot()), '77:1:wipe');
});

test('another try at the day pays its own XP, and the bonus only once', () => {
  const storage = fakeStorage(), { progress } = createFosaProgress({ storage });
  const dive = time => { const g = room(); startDive(g, DAY, 5); g.time = time; g.finish('wipe'); return g.snapshot(); };
  const first = dive(120), second = dive(180);
  const paid = progress.award(xpFor(first, 1), receiptFor(first));
  assert.ok(paid.gained > 0);
  const bonus = progress.award(Math.round(paid.gained * .25), `daily:${DAY}`, { dive: false });
  assert.ok(bonus.gained > 0);
  assert.ok(progress.award(xpFor(second, 1), receiptFor(second)).gained > 0, 'the retry is paid');
  assert.equal(progress.award(99, `daily:${DAY}`, { dive: false }).gained, 0);
  assert.equal(progress.dives(), 2, 'the bonus is not a dive');
});

test('what counts as a day played', () => {
  const at = (outcome, level, haul) => ({ outcome, level, haul });
  assert.equal(countsForStreak(at('wipe', 1, 500)), false, 'wiped on the first jornada');
  assert.equal(countsForStreak(at('extracted', 1, 0)), false, 'left at once with an empty truck');
  assert.equal(countsForStreak(at('extracted', 1, 50)), true);
  assert.equal(countsForStreak(at('wipe', 2, 0)), true, 'a jornada cleared counts, however it ended');
  assert.equal(countsForStreak(at('extracted', 3, 900)), true);
});

test('the day\'s best keeps more jornadas first, then the payout, and only today\'s', () => {
  const storage = fakeStorage(), report = (day, jornadas, payout) => reportBest(day, { jornadas, payout }, storage);
  assert.deepEqual(report(DAY, 1, 500), { day: DAY, jornadas: 1, payout: 500 });
  assert.deepEqual(report(DAY, 1, 400), { day: DAY, jornadas: 1, payout: 500 }, 'less pay stays');
  assert.deepEqual(report(DAY, 1, 600), { day: DAY, jornadas: 1, payout: 600 });
  assert.deepEqual(report(DAY, 0, 9000), { day: DAY, jornadas: 1, payout: 600 }, 'fewer jornadas stay');
  assert.deepEqual(report(DAY, 2, 100), { day: DAY, jornadas: 2, payout: 100 });
  assert.deepEqual(report(NEXT, 0, 10), { day: NEXT, jornadas: 0, payout: 10 }, 'a new day starts over');
  assert.deepEqual(JSON.parse(storage.data.get(BEST_KEY)), { day: NEXT, jornadas: 0, payout: 10 });
});

test('the best survives junk and blocked storage', () => {
  for (const raw of ['{', '[]', 'null', '{"day":"2026-11-04"}']) {
    const storage = fakeStorage(); storage.data.set(BEST_KEY, raw);
    assert.equal(reportBest(DAY, { jornadas: 1, payout: 5 }, storage).payout, 5, raw);
  }
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(reportBest(DAY, { jornadas: 1, payout: 5 }, broken).payout, 5);
  assert.equal(reportBest(DAY, { jornadas: 1, payout: 5 }, null).payout, 5);
});

test('the best line says it in one line', () => {
  const line = bestLine({ jornadas: 2, payout: 1100 });
  assert.match(line, /2 jornadas/); assert.doesNotMatch(line, /\n/);
  assert.match(bestLine({ jornadas: 1, payout: 0 }), /1 jornada /);
});
