// Crates: they come down on a schedule, walking into one takes it without
// standing on it, blasts smash or throw them and hurt whoever is going for them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents, explode, drill, activeCapy, ammoLeft, CRATE_REACH, RULES } from '../public/rules.js';
import { createBot } from '../public/bot.js';
import { matchView, mirror } from '../public/online.js';
import { dropProp } from '../../../engine/play/loose-prop.js';
import { fillHeights } from '../../../engine/play/terrain-mask.js';

const DT = 1 / 60;
const wire = x => JSON.parse(JSON.stringify(x));
function flat(xs = [[10, 24, 30], [50, 56, 62]]) {
  const m = createMatch({ seed: 5 });
  fillHeights(m.mask, () => 10);
  m.capys.forEach(c => { c.x = xs[c.team][c.slot]; c.y = 10; c.grounded = true; c.vx = c.vy = 0; });
  m.wind = 0; takeEvents(m);
  return m;
}
const lay = (m, x, fields = {}) => { const k = dropProp({ id: ++m.crateN, x, y: 10, grounded: true, weapon: 'bazooka', shots: 1, ...fields }); m.crates.push(k); return k; };
const events = (m, type) => takeEvents(m).filter(e => e.type === type);

test('crates come down on schedule under a parachute, onto dry ground, the same on every replay', () => {
  const play = () => {
    const m = createMatch({ seed: 6 }), seen = [], winds = [];
    for (let turn = 0; turn < 12; turn++) {
      const n = m.turn.n; winds.push(m.wind);
      for (const e of takeEvents(m)) if (e.type === 'crate') seen.push({ n, ...e });
      // Straight to the next turn: nobody shoots.
      m.turn.time = 0;
      for (let i = 0; i < 60 * 8 && m.turn.n === n; i++) tickMatch(m, DT, {});
    }
    return { m, seen, winds };
  };
  const a = play(), b = play();
  assert.deepEqual(a.seen, b.seen, 'a replay drops the same crates');
  assert.deepEqual(a.seen.map(e => e.n).slice(0, 2), [RULES.crate.first, RULES.crate.first + RULES.crate.every]);
  assert.ok(a.m.crates.length >= 1 && a.m.crates.length <= RULES.crate.max);
  for (const k of a.m.crates.filter(k => k.grounded)) assert.ok(k.y > a.m.map.water, `crate on dry ground at ${k.y}`);
});

test('a crate under a parachute lands on the ground and stops', () => {
  const m = flat(), k = lay(m, 40, { y: 30, grounded: false, chute: RULES.crate.chute });
  for (let i = 0; i < 300; i++) tickMatch(m, DT, {});
  assert.ok(k.grounded && Math.abs(k.y - 10) < .2 && k.chute === 0, `lies at ${k.y}`);
  assert.equal(events(m, 'crate-land').length, 1);
});

test('walking into a crate takes it well before the capi stands on it, and gives shots to its team', () => {
  const m = flat(), me = activeCapy(m), k = lay(m, me.x + 4), before = ammoLeft(m, me.team, 'bazooka');
  let at = null;
  for (let i = 0; i < 180 && m.crates.length; i++) { tickMatch(m, DT, { x: 1 }); at = me.x; }
  assert.equal(m.crates.length, 0, 'taken');
  assert.ok(k.x - at > CRATE_REACH * .8, `taken from ${(k.x - at).toFixed(2)} away, not at its centre`);
  assert.equal(ammoLeft(m, me.team, 'bazooka'), before + 1);
  assert.deepEqual(events(m, 'pickup').map(e => [e.capy, e.weapon, e.shots]), [[me.id, 'bazooka', 1]]);
});

test('the one-move-short case: stopping a body width short of a crate still takes it; further away does not', () => {
  const m = flat(), me = activeCapy(m);
  lay(m, me.x + CRATE_REACH + .2);
  tickMatch(m, DT, {});
  assert.equal(m.crates.length, 1, 'still out of reach');
  // The last little step that used to leave it just out of reach.
  for (let i = 0; i < 6; i++) tickMatch(m, DT, { x: 1 });
  assert.equal(m.crates.length, 0, 'one short step closer and it is taken');
});

test('a capi that is not on its turn takes a crate too, and a painted-out one does not', () => {
  const m = flat(), other = m.capys.find(c => c.id === '1-0');
  lay(m, other.x + 1);
  tickMatch(m, DT, {});
  assert.equal(m.crates.length, 0);
  assert.deepEqual(events(m, 'pickup').map(e => e.team), [1]);
  other.out = 'paint'; lay(m, other.x);
  tickMatch(m, DT, {});
  assert.equal(m.crates.length, 1, 'nobody standing there');
});

test('a blast smashes a crate in its crater, throws one nearby, and paints the capi going for it', () => {
  const m = flat(), me = activeCapy(m), near = lay(m, me.x + 3), far = lay(m, me.x + 28), thrown = lay(m, me.x + 6);
  // The capi is walking at the crate when the rival's shell lands by it.
  for (let i = 0; i < 12; i++) tickMatch(m, DT, { x: 1 });
  assert.equal(m.crates.includes(near), true, 'not there yet');
  const before = me.paint, from = thrown.x;
  takeEvents(m);
  explode(m, near.x, 10, 1);
  assert.equal(m.crates.includes(near), false, 'the crate in the crater is smashed');
  assert.deepEqual(events(m, 'crate-gone').map(e => [e.id, e.reason]), [[near.id, 'blast']]);
  assert.ok(me.paint > before, `the crate seeker took paint (${me.paint})`);
  assert.ok(!me.grounded && me.vx < 0, 'and is thrown back');
  // A crate a little further flies off and lands elsewhere; a far one does not notice.
  assert.ok(!thrown.grounded && thrown.chute === 0 && thrown.vx > 0, 'thrown away from the blast');
  for (let i = 0; i < 240 && !thrown.grounded; i++) tickMatch(m, DT, {});
  assert.ok(thrown.x > from + .5, `flew from ${from} to ${thrown.x}`);
  assert.ok(far.grounded, "a far crate stays");
});

test('a crate falls into a crater, sinks in the water, and La Licuadora smashes one in its way', () => {
  const m = flat(), k = lay(m, 30), rival = lay(m, 35);
  // A crater just under it (the blast itself is out of its reach), then the ground goes.
  m.mask.solid.fill(0);
  for (let i = 0; i < 300 && m.crates.length; i++) tickMatch(m, DT, {});
  assert.equal(m.crates.length, 0, 'both fall through into the water');
  assert.ok(!m.crates.includes(k) && !m.crates.includes(rival));

  const n = flat(), bored = lay(n, 30);
  takeEvents(n);
  drill(n, 28, 11, 1, 0, 0);
  assert.equal(n.crates.includes(bored), false);
  assert.deepEqual(events(n, 'crate-gone').map(e => e.reason), ['blast']);
});

test('a room\'s copy carries the crates', () => {
  const m = flat(); lay(m, 30);
  const { view } = mirror(null, wire({ match: { ...matchView(m), mapSeed: m.map.seed, size: m.map.size } }));
  assert.equal(view.crates.length, 1);
  assert.equal(view.crates[0].x, 30);
  m.crates.length = 0;
  const again = mirror(view, wire({ match: matchView(m) })).view;
  assert.equal(again.crates.length, 0);
});

test('the machine walks to a crate close by, then still fires', () => {
  const m = flat(); m.turn.time = 30;
  const me = activeCapy(m), k = lay(m, me.x + 5), bot = createBot({ team: me.team, seed: 3 });
  let took = false, fired = false;
  for (let i = 0; i < 60 * 30 && !fired; i++) {
    tickMatch(m, DT, bot.input(m));
    for (const e of takeEvents(m)) { if (e.type === 'pickup' && e.id === k.id) took = true; if (e.type === 'fire') fired = true; }
  }
  assert.ok(took, 'it took the crate');
  assert.ok(fired, 'and fired before the clock ran out');
});
