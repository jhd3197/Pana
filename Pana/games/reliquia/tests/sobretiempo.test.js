// Sobretiempo: bonus mangos for going past the quota, what a running clock adds,
// and how it reaches the payout, Calor and the XP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, encargoPay, sobretiempoPay, sobretiempoOf } from '../public/rules.js';
import { xpFor } from '../public/progress.js';
import { pactoKey } from '../public/pactos.js';

function setup(options = {}) {
  const g = new Expedition(4242, { place: 'mina', ...options }); g.addPlayer(1, 'Ana'); g.addPlayer(2, 'Beto'); g.start(4242);
  return g;
}
const levelEvent = g => g.events.filter(e => e.kind === 'level').at(-1);

test('the pay scales with the surplus and the time left, up to the encargo\'s pay', () => {
  assert.equal(sobretiempoPay(1, 400, 400), 0, 'the bare quota pays nothing');
  assert.equal(sobretiempoPay(1, 300, 400, 200), 0, 'below the quota nothing counts');
  assert.equal(sobretiempoPay(1, 449, 400), 0);
  assert.equal(sobretiempoPay(1, 450, 400), 1);
  assert.equal(sobretiempoPay(1, 400, 400, 90), 3);
  assert.equal(sobretiempoPay(1, 650, 400, 90), 8);
  assert.equal(sobretiempoPay(1, 99999, 400, 9999), encargoPay(1));
  assert.equal(sobretiempoPay(4, 99999, 400), encargoPay(4));
  assert.equal(sobretiempoPay(1, 900, 400, -1), 0, 'a clock that ran out forfeits it');
  assert.equal(sobretiempoPay(1, 900, 0), 0, 'no quota, no bonus');
});

test('completing a jornada pays it in mangos and says so in the level line', () => {
  const g = setup(); g.encargo = { kind: 'sinBajas', state: 'open', until: 0 };
  g.delivered = g.quota + 200; const before = g.mangos;
  g.completeLevel();
  assert.equal(g.mangos, before + 4); assert.equal(g.sobretiempo, 4);
  const e = levelEvent(g);
  assert.equal(e.extra, 4); assert.equal(e.vars.extra, 4); assert.match(e.text, /Sobretiempo: \+\{extra\} mangos/);
  assert.equal(sobretiempoOf(g), 0, 'the next jornada starts from nothing');
});

test('at the bare quota the jornada plays and reads as before', () => {
  const g = setup(); g.encargo = { kind: 'sinBajas', state: 'open', until: 0 };
  g.delivered = g.quota; const before = g.mangos;
  g.completeLevel();
  assert.equal(g.mangos, before); assert.equal(g.sobretiempo, 0);
  assert.doesNotMatch(levelEvent(g).text, /Sobretiempo/);
});

test('a skipped jornada below its quota pays nothing', () => {
  const g = setup(); g.delivered = 0; g.completeLevel();
  assert.equal(g.sobretiempo, 0); assert.equal(g.mangos, 0);
});

test('the turno clock pays for time left, and running it out loses the bonus', () => {
  const timed = (left, surplus) => {
    const g = setup(); g.encargo = { kind: 'turno', state: 'paid', until: g.time + left }; g.delivered = g.quota + surplus;
    g.completeLevel(); return g.sobretiempo;
  };
  assert.equal(timed(120, 0), 4);
  assert.equal(timed(120, 100), 6);
  assert.equal(timed(-1, 500), 0, 'past the clock nothing is paid');
});

test('it adds up across jornadas and survives a save', () => {
  const g = setup();
  for (const surplus of [100, 150]) { g.encargo = { kind: 'sinBajas', state: 'open', until: 0 }; g.delivered = g.quota + surplus; g.completeLevel(); }
  assert.equal(g.sobretiempo, 5);
  assert.equal(g.snapshot().sobretiempo, 5);
});

test('it counts in the payout at the bank\'s rate, with Calor and the wipe share', () => {
  const end = (options, outcome) => { const g = setup(options); g.haul = 1000; g.sobretiempo = 10; g.finish(outcome); return g; };
  const hot = { [pactoKey('cuota')]: true, [pactoKey('enjambre')]: true };   // Calor 3
  assert.equal(end({}, 'extracted').payout, 1100);
  assert.equal(end(hot, 'extracted').payout, 1430);
  assert.equal(end({}, 'wipe').payout, 220);
  assert.equal(end(hot, 'wipe').payout, 286);
  assert.equal(end({}, 'extracted').events.at(-1).vars.value, 1000, 'the truck line stays what is in the truck');
});

test('a save from before Sobretiempo still finishes', () => {
  const g = setup(); g.haul = 1000; delete g.sobretiempo; g.finish('extracted');
  assert.equal(g.payout, 1000);
  const s = g.snapshot(); assert.equal(s.sobretiempo, undefined); assert.ok(xpFor(s, 1) > 0);
});

test('XP pays one per two mangos, capped, and Calor multiplies it', () => {
  const xp = (sobretiempo, options = {}) => { const g = setup(options); g.time = 300; g.sobretiempo = sobretiempo; g.finish('wipe'); return xpFor(g.snapshot(), 1); };
  const none = xp(0);
  assert.equal(xp(1), none);
  assert.equal(xp(10), none + 5);
  assert.equal(xp(40), none + 20); assert.equal(xp(400), none + 20, 'capped');
  assert.equal(xp(10, { [pactoKey('cuota')]: true }), Math.round((none + 5) * 1.1));
});
