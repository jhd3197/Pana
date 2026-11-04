// Pactos: the table, the Calor number, what each pact does in the real rules, and
// that a room with none plays as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PACTOS, PACTO, MAX_CALOR, pactoKey, pactosOf, validPactos, calorOf, calorOfOptions, payoutMult, xpMult, bonusPercent, pactoQuota } from '../public/pactos.js';
import { DEFAULT_OPTIONS, FIELDS, fieldsFor, validOptions } from '../public/options.js';
import { Expedition, interaction, quotaFor, turnoSeconds, floorWorth, SHOP, shopSpot } from '../public/rules.js';
import { swarmSize, swarmDue, SWARM } from '../public/swarm.js';
import { RANKS, xpFor } from '../public/progress.js';
import { floorOf, THEMES } from '../public/deck.js';
import { layoutFor } from '../public/layout.js';
import { createProgress } from '../../../engine/progress.js';
import { isRoomFieldVisible } from '../../../engine/room-option-fields.js';

const on = (...ids) => Object.fromEntries(ids.map(id => [pactoKey(id), true]));
function setup(options = {}, { n = 2, seed = 4242, place = 'mina' } = {}) {
  const g = new Expedition(seed, { place, ...options }); for (let i = 1; i <= n; i++) g.addPlayer(i, `Pana ${i}`); g.start(seed);
  return g;
}
const step = (g, seconds) => { for (let t = 0; t < seconds - 1e-4; t += .05) { g.director.duration = 1e6; g.sucesoIn = 1e6; g.update(.05, new Map()); } };
// The cage finishing its first trip down, with the first pana inside.
function ride(g) {
  const stop = g.layout.run.lifts.find(l => l.floor === 1), a = g.players[0];
  Object.assign(g.lift, { floor: 0, from: 0, to: 1, t: 0, duration: .1, moving: true, switched: true, riders: [a.id] });
  Object.assign(a, { x: stop.x, z: stop.z, riding: true, invulnerable: 999 });
  step(g, .2);
}
const silbones = g => g.enemies.filter(e => e.kind === 'silbon');

test('the table: stable ids, Calor 1 to 3, short names and labels', () => {
  assert.deepEqual(PACTOS.map(p => p.id), ['cuota', 'turno', 'tienda', 'codicia', 'enjambre', 'silbon']);
  for (const p of PACTOS) {
    assert.ok(p.calor >= 1 && p.calor <= 3, p.id);
    assert.ok(p.name.split(' ').length <= 3, p.name); assert.ok(p.label.length <= 20, p.label);
  }
  assert.equal(MAX_CALOR, 10);
});

test('validPactos keeps real ids once; calorOf sums them', () => {
  assert.deepEqual(validPactos(['silbon', 'nope', 'cuota', 'cuota', 7]), ['cuota', 'silbon']);
  assert.deepEqual(validPactos('cuota'), []); assert.deepEqual(validPactos(null), []);
  assert.equal(calorOf([]), 0); assert.equal(calorOf(['cuota', 'cuota', 'nope']), 1); assert.equal(calorOf(['cuota', 'enjambre', 'silbon']), 6);
  assert.equal(calorOf(PACTOS.map(p => p.id)), MAX_CALOR);
  assert.deepEqual(pactosOf({ ...on('turno'), [pactoKey('cuota')]: false, [pactoKey('nope')]: true }), ['turno']);
});

test('each Calor adds 10 %, capped at the most a room can take', () => {
  for (const mult of [payoutMult, xpMult]) {
    assert.equal(mult(0), 1); assert.equal(mult(3), 1.3); assert.equal(mult(MAX_CALOR), 2); assert.equal(mult(99), 2); assert.equal(mult(-4), 1); assert.equal(mult(undefined), 1);
  }
  assert.equal(bonusPercent(0), 0); assert.equal(bonusPercent(3), 30); assert.equal(bonusPercent(7), 70);
});

test('no pacts by default; every pact is a room option the rules accept', () => {
  assert.deepEqual(pactosOf(DEFAULT_OPTIONS), []); assert.equal(calorOfOptions(DEFAULT_OPTIONS), 0); assert.equal(calorOfOptions(undefined), 0);
  for (const p of PACTOS) { assert.equal(validOptions({ [pactoKey(p.id)]: true }), true, p.id); assert.equal(validOptions({ [pactoKey(p.id)]: 'yes' }), false, p.id); }
  assert.equal(validOptions({ [pactoKey('nope')]: true }), false);
  const g = new Expedition(1); assert.equal(g.configure(on('silbon')), true, 'any real pact, whatever the rank'); assert.equal(g.configure({ [pactoKey('nope')]: true }), false);
  g.addPlayer(1, 'Ana'); g.start(); assert.equal(g.configure(on('cuota')), false, 'not during a dive');
  assert.deepEqual(pactosOf(g.options), ['silbon'], 'kept into the dive');
  const next = new Expedition(); next.restore(g.snapshot(), new Map([[1, { id: 1, name: 'Ana' }]])); assert.deepEqual(pactosOf(next.options), ['silbon'], 'and by a new host');
});

test('ranks unlock every pact once, the first at rank 2, spaced one a rank', () => {
  const pacts = RANKS.map(r => r.unlocks.filter(id => id.startsWith('pacto:')));
  assert.deepEqual(pacts.flat().sort(), PACTOS.map(p => pactoKey(p.id)).sort());
  assert.deepEqual(pacts[0], []); assert.equal(pacts[1].length, 1);
  assert.ok(pacts.every(list => list.length <= 1));
});

test('the menu offers what the rank unlocked; a locked pact only shows once it is on', () => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const p = createProgress({ game: 'reliquia', ranks: RANKS, storage });
  const shown = values => fieldsFor(p.isUnlocked).filter(f => f.pacto && isRoomFieldVisible(f, values)).map(f => f.pacto);
  assert.deepEqual(shown(DEFAULT_OPTIONS), [], 'a new diver has none');
  p.award(RANKS[1].xp, 'a'); assert.deepEqual(shown(DEFAULT_OPTIONS), ['cuota'], 'rank 2 has the first');
  p.award(RANKS[2].xp, 'b'); assert.deepEqual(shown(DEFAULT_OPTIONS), ['cuota', 'turno']);
  assert.deepEqual(shown({ ...DEFAULT_OPTIONS, ...on('silbon') }), ['cuota', 'turno', 'silbon'], 'the host has it on');
  p.award(RANKS.at(-1).xp, 'c'); assert.equal(shown(DEFAULT_OPTIONS).length, PACTOS.length);
  assert.equal(fieldsFor(() => false).filter(f => !f.pacto).length, FIELDS.filter(f => !f.pacto).length, 'other options stay');
});

test('Cuota apretada asks for more, every jornada, and never more than the floor can pay', () => {
  const plain = setup(), tight = setup(on('cuota'));
  assert.equal(plain.quota, quotaFor(1, 2));
  assert.equal(tight.quota, pactoQuota(on('cuota'), quotaFor(1, 2)));
  assert.ok(tight.quota > plain.quota);
  plain.completeLevel(); tight.completeLevel(); assert.ok(tight.quota > plain.quota, 'next jornada too');
  assert.equal(pactoQuota(on('cuota'), 1000, 1000), 1000, 'a thin floor: back to the plain quota, never lower');
  assert.equal(pactoQuota(on('cuota'), 1000, 1400), 1100, 'a fair share of the floor');
  assert.equal(pactoQuota({}, 1000, 10), 1000);
  // Wherever the plain quota was payable, the pact keeps it payable.
  for (const theme of THEMES) for (const depth of [1, 2, 3, 5, 8]) for (let seed = 1; seed <= 12; seed++) {
    const worth = floorWorth(layoutFor(seed, depth, theme).run), plainQuota = quotaFor(depth, 8), quota = pactoQuota(on('cuota'), plainQuota, worth);
    if (worth >= plainQuota / PACTO.quotaShare) assert.ok(quota <= worth * PACTO.quotaShare, `${theme} ${depth}/${seed}: ${quota} of ${worth}`);
    assert.ok(quota >= plainQuota);
  }
});

test('Turno corto makes every jornada\'s job the timed one, on a shorter clock', () => {
  const g = setup(on('turno')), level = g.level;
  assert.equal(g.encargo.kind, 'turno');
  ride(g); const clock = g.encargo.until - g.time;
  assert.ok(clock <= Math.round(turnoSeconds(level) * PACTO.turno) && clock > turnoSeconds(level) * PACTO.turno - 1, `${clock} s`);
  g.completeLevel(); assert.equal(g.encargo.kind, 'turno', 'and on the next one');
  g.encargo.until = g.time + .1; Object.assign(g.players[0], { x: g.layout.run.lifts[1].x, z: g.layout.run.lifts[1].z - 5 }); step(g, .3);
  assert.equal(g.encargo.state, 'lost', 'late is lost, as ever');
  const kinds = new Set(); for (let seed = 1; seed < 40; seed++) kinds.add(setup({}, { seed }).encargo.kind);
  assert.ok(kinds.size > 1, 'without the pact the deck decides');
});

test('Tienda cara: the prompt and the till agree on the higher price', () => {
  const buy = options => {
    const g = setup(options), a = g.players[0], at = shopSpot(SHOP.findIndex(([k]) => k === 'farol'));
    g.mangos = 100; Object.assign(a, { x: at.x + 1.4, z: at.z, h: -Math.PI / 2, pitch: Math.atan2(at.y - 1.45, 1.4) });
    return { g, a, target: interaction(g, a) };
  };
  const plain = buy({}), dear = buy(on('tienda'));
  assert.equal(plain.target.kind, 'buy'); assert.equal(plain.target.vars.price, 10);
  assert.equal(dear.target.kind, 'buy'); assert.equal(dear.target.vars.price, 15);
  plain.g.buy(plain.a, 'farol'); dear.g.buy(dear.a, 'farol');
  assert.equal(plain.g.mangos, 90); assert.equal(dear.g.mangos, 85);
  const poor = setup(on('tienda')); poor.mangos = 12;
  assert.equal(poor.buy(poor.players[0], 'farol'), false, 'the list price is not enough');
});

test('Codicia voraz wakes la codicia faster', () => {
  const plain = setup(), fierce = setup(on('codicia'));
  plain.greed(10); fierce.greed(10);
  assert.ok(Math.abs(fierce.codicia - plain.codicia * PACTO.greed) < 1e-9);
});

test('Enjambre: bigger and more often, under the same cap', () => {
  const plain = setup(), many = setup(on('enjambre'));
  assert.ok(swarmSize(many) > swarmSize(plain)); assert.ok(swarmSize(many) <= SWARM.most);
  many.level = 40; assert.equal(swarmSize(many), SWARM.most);
  const rate = g => { g.time = g.swarmAt + 1; let hits = 0; for (let i = 0; i < 2000; i++) if (swarmDue(g)) hits++; return hits / 2000; };
  const a = rate(setup()), b = rate(setup(on('enjambre')));
  assert.ok(Math.abs(a - .2) < .04, `plain ${a}`); assert.ok(Math.abs(b - .4) < .04, `pact ${b}`);
});

test('Silbón madruga gets up soon after the first pana lands, once, and again next jornada', () => {
  const seed = [...Array(200).keys()].find(s => s && layoutFor(s, 1, 'mina').run.sleepers.some(q => q.kind === 'silbon'));
  const plain = setup({}, { seed }); ride(plain); step(plain, PACTO.silbonAfter + 1);
  assert.equal(silbones(plain).length, 0, 'without the pact it waits in the pit room');
  const g = setup(on('silbon'), { seed }); assert.equal(g.silbonAt, 0);
  step(g, 1); assert.equal(silbones(g).length, 0, 'nothing while everyone is at the camp');
  ride(g); step(g, PACTO.silbonAfter - 1); assert.equal(silbones(g).length, 0, 'a moment first');
  step(g, 2); assert.equal(silbones(g).length, 1); assert.equal(floorOf(silbones(g)[0].x), 1); assert.equal(g.silbonAt, -1);
  assert.ok(g.events.some(e => e.kind === 'boss' && e.boss === 'silbon'));
  // Walking into its room does not raise another, even with the first one gone.
  const s = g.layout.run.sleepers.find(q => q.kind === 'silbon'), room = g.layout.run.rooms.find(r => r.id === s.room);
  g.enemies = g.enemies.filter(e => e.kind !== 'silbon');
  Object.assign(g.players[0], { x: (room.rect[0] + room.rect[2]) / 2, z: room.rect[1] + 2 });
  const announced = g.eventId; step(g, .2);
  assert.ok(g.woke[s.room]); assert.equal(silbones(g).length, 0);
  assert.ok(!g.events.some(e => e.id > announced && e.boss === 'silbon'));
  g.completeLevel(); assert.equal(g.silbonAt, 0, 'a new jornada starts over');
  const copy = new Expedition(); copy.restore(g.snapshot(), new Map(g.players.map(p => [p.id, p]))); assert.equal(copy.silbonAt, 0);
});

test('Calor multiplies the payout on both outcomes and the XP', () => {
  const end = (options, outcome) => { const g = setup(options); g.haul = 1000; g.time = 300; g.finish(outcome); return g; };
  const hot = on('cuota', 'enjambre');   // Calor 3
  assert.equal(end({}, 'extracted').payout, 1000); assert.equal(end(hot, 'extracted').payout, 1300);
  assert.equal(end({}, 'wipe').payout, 200); assert.equal(end(hot, 'wipe').payout, 260, 'a failed dive still pays');
  assert.equal(end(hot, 'extracted').events.at(-1).vars.value, 1000, 'the line says what is in the truck');
  const plainXp = xpFor(end({}, 'extracted').snapshot(), 1);
  assert.equal(xpFor(end(hot, 'extracted').snapshot(), 1), Math.round(plainXp * 1.3));
  const all = PACTOS.map(p => p.id);
  assert.equal(xpFor(end(on(...all), 'wipe').snapshot(), 1), 2 * xpFor(end({}, 'wipe').snapshot(), 1));
  const late = end(hot, 'wipe'); late.addPlayer(9, 'Late'); assert.equal(xpFor(late.snapshot(), 9), 0);
});
