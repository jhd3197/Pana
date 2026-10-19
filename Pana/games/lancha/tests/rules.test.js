import test from 'node:test';
import assert from 'node:assert/strict';
import { Race, standings, cleanInput, TURBO, SLOTS } from '../public/rules.js';
import { RIVER, courseRiver } from '../public/course.js';
import { angle } from '../../../engine/river/river.js';

// A solo race (no rivals) past the countdown.
function solo(options = {}, seed = 3) {
  const r = new Race(); r.configure({ rivals: 'none', ...options }); r.addPlayer(1, 'Pana'); r.start(seed);
  for (let t = 0; t < 3.1; t += .05) r.update(.05);
  return r;
}
const drive = (r, seconds, control) => { for (let t = 0; t < seconds; t += .05) r.update(.05, new Map([[1, typeof control === 'function' ? control(r, r.boats[0]) : control]])); return r.boats[0]; };
// Steers at the guide line, the way a pana following the gold arrows would.
const follow = (r, b) => { const s = Math.min(r.river.LENGTH, b.s + 20), t = r.river.at(s, r.river.guideAt(s, r.time)); return Math.max(-1, Math.min(1, -angle(Math.atan2(t.x - b.x, t.z - b.z) - b.h) * 2.4)); };
const toEnd = (r, control) => { while (r.phase !== 'finished' && r.time < 300) r.update(.05, new Map([[1, control(r, r.boats[0])]])); return r.boats[0]; };

test('a 1.8 km course in four tramos, downhill to Puerto Ayacucho', () => {
  assert.ok(RIVER.LENGTH > 1700 && RIVER.LENGTH < 1950, `${RIVER.LENGTH}`);
  assert.deepEqual(RIVER.def.sectors.map(([, n]) => n), ['Caño del Sipapo', 'Raudales de Atures', 'El Orinoco', 'Puerto Ayacucho']);
  assert.ok(RIVER.levelAt(RIVER.LENGTH) < RIVER.levelAt(0) - 4);
  assert.ok(RIVER.halfWidth(1300) > 2.5 * RIVER.halfWidth(300), 'the Orinoco opens right up');
  const S = RIVER.main.samples;
  for (let i = 0; i < S.length; i += 6) for (let j = i + 6; j < S.length; j += 6) if (S[j].s - S[i].s > 140) assert.ok(Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) > RIVER.halfWidth(S[i].s) + RIVER.halfWidth(S[j].s) + 10, `${S[i].s | 0} vs ${S[j].s | 0}`);
});

test('holding the throttle is fastest; mashing it is slower', () => {
  const held = drive(solo(), 8, (r, b) => ({ throttle: 1, steer: follow(r, b) })), mashed = drive(solo(), 8, (r, b) => ({ throttle: Math.floor(r.time * 6) % 2, steer: follow(r, b) }));
  assert.ok(held.progress > mashed.progress + 25, `${held.progress} vs ${mashed.progress}`);
  assert.ok(held.v > 12, `${held.v}`);
});

test('the automatic throttle drives without any key', () => {
  const auto = drive(solo({ throttle: 'auto' }), 6, {}), hold = drive(solo(), 6, {});
  assert.ok(auto.progress > hold.progress + 30);
});

test('A and D swing the outboard; S brakes then reverses', () => {
  const left = drive(solo(), .8, { throttle: 1, steer: -1 }), right = drive(solo(), .8, { throttle: 1, steer: 1 });
  assert.ok(angle(left.h - right.h) > .5, `${left.h} vs ${right.h}`);
  const r = solo(), b = drive(r, 4, { throttle: 1 }), v = b.v;
  drive(r, .5, { back: true }); assert.ok(b.v < v - 3);
  drive(r, 3, { back: true }); assert.ok(b.v < -1, 'backing up');
});

test('steering help keeps a hands-off lancha in the river all the way down', () => {
  const helped = toEnd(solo(), () => ({ throttle: 1 }));
  assert.ok(helped.finish !== null && helped.finish < 140, `finished in ${helped.finish}`);
  assert.ok(helped.bumps <= 2, `${helped.bumps} bank knocks`);
});

test('turbo: the chorro and clean jumps fill it; Espacio spends half for a burst', () => {
  const r = solo(), b = r.boats[0];
  b.meter = TURBO.cost; drive(r, 1, { throttle: 1, turbo: 1 });
  assert.equal(b.turbos, 1); assert.ok(b.meter < TURBO.cost);
  const v = b.v; drive(r, .5, { throttle: 1, turbo: 1 }); assert.ok(b.v > v, 'the burst pushes past cruising speed');
  drive(r, 2, { throttle: 1, turbo: 2 }); assert.equal(b.turbos, 1, 'not enough left for another');
  const ride = solo(), c = ride.boats[0], s = 300, q = ride.river.at(s, ride.river.def.chorro(s));
  Object.assign(c, { x: q.x, z: q.z, h: q.h, s, progress: s, meter: 0 }); ride.update(.05, new Map([[1, { throttle: 1 }]]));
  for (let i = 0; i < 20; i++) { const p = ride.river.at(c.s, ride.river.def.chorro(c.s)); Object.assign(c, { x: p.x, z: p.z }); ride.update(.05, new Map([[1, { throttle: 1 }]])); }
  assert.ok(c.meter > TURBO.chorro * .8, `${c.meter}`);
});

test('the fast lane of a raudal launches the lancha; landing straight is a clean jump', () => {
  const r = solo(), b = r.boats[0], d = r.river.drops[0], fast = d.lanes.find(l => l.fast), off = (fast.from + fast.to) / 2, s = d.s - 30, q = r.river.at(s, off);
  Object.assign(b, { x: q.x, z: q.z, h: q.h, s, progress: s, checkpoint: r.river.gates.filter(g => g <= s).length, y: r.river.levelAt(s, off), v: 14 });
  let air = 0;
  drive(r, 4, (race, boat) => { air = Math.max(air, boat.air); return { throttle: 1, steer: follow(race, boat) }; });
  assert.ok(air > .5, `airtime ${air}`); assert.ok(b.jumps >= 1); assert.equal(b.stalled, 0);
});

test('a crooked landing drowns the motor for a moment', () => {
  const r = solo(), b = r.boats[0], d = r.river.drops[0], q = r.river.at(d.s + 3, 0), w = r.river.locate(q.x, q.z);
  Object.assign(b, { x: q.x, z: q.z, h: w.h + 1.2, s: w.s, y: r.river.levelAt(w.s, 0) + .05, vy: -6, air: .6, v: 6 });
  r.update(.05, new Map([[1, { throttle: 1 }]]));
  assert.ok(b.stalled > 0); assert.equal(b.crashes, 1);
  drive(r, .5, { throttle: 1 }); assert.equal(b.throttle, 0, 'no gas while drowned');
});

test('caimanes swim across the Orinoco and bite the motor dead', () => {
  const r = solo(), b = r.boats[0], c = r.river.caimanesAt(r.time)[0], q = r.river.at(c.s, c.offset);
  Object.assign(b, { x: q.x, z: q.z, h: q.h, s: c.s, progress: c.s, checkpoint: r.river.gates.filter(g => g <= c.s).length, y: r.river.levelAt(c.s, c.offset), v: 12 });
  r.update(.05, new Map([[1, { throttle: 1 }]]));
  assert.equal(b.bitten, 1); assert.ok(b.stalled > 0); assert.ok(b.v < 8);
  assert.ok(RIVER.swimmers.length >= 4 && RIVER.buoys.length >= 16);
});

test('a hard hit on a rock stops the lancha', () => {
  const r = solo(), b = r.boats[0], rock = r.river.rocks.find(k => k.r > 2), q = r.river.at(rock.s - 8, rock.offset);
  Object.assign(b, { x: q.x, z: q.z, h: q.h, s: rock.s - 8, progress: rock.s - 8, y: r.river.levelAt(rock.s, rock.offset), v: 14, meter: 0 });
  drive(r, 1.2, { throttle: 1 });
  assert.ok(b.hits >= 1); assert.ok(b.progress < rock.s + 2, 'it stopped the lancha');
});

test('room options: no raudales, no objects, and they survive host migration', () => {
  const r = new Race(); assert.equal(r.configure({ throttle: 'nitro' }), false);
  r.configure({ falls: false, items: false, rivals: 'easy' }); r.addPlayer(1, 'Ana'); r.addPlayer(2, 'Beto'); r.start(5);
  assert.equal(r.river.drops.length, 0); assert.equal(r.river.rocks.length + r.river.swimmers.length + r.river.logs.length, 0);
  assert.equal(r.boats.length, SLOTS); assert.equal(r.configure({ falls: true }), false, 'locked while racing');
  for (let t = 0; t < 8; t += .05) r.update(.05, new Map([[1, { throttle: 1 }], [2, { throttle: 1, steer: .3 }]]));
  const copy = Race.restore(r.snapshot(), new Map([[1, {}]]));
  assert.deepEqual(copy.options, r.options); assert.equal(copy.river.drops.length, 0);
  assert.ok(copy.boatOf(1)); assert.equal(copy.boats.find(b => b.id === 'c1').driver.bot, true, 'a river driver takes the lancha of a pana who left');
  copy.update(.05); assert.ok(courseRiver({}) === RIVER);
});

test('inputs are cleaned', () => {
  assert.deepEqual(cleanInput({ throttle: 'yes', steer: 9, back: 1, turbo: '3' }), { throttle: 1, steer: 1, back: true, turbo: 3 });
  assert.deepEqual(cleanInput({ steer: NaN }), { throttle: 0, steer: 0, back: false, turbo: 0 });
});

test('river drivers run the course in under two minutes and nobody gets stuck', () => {
  for (const seed of [11, 12]) {
    const r = new Race(); r.start(seed);
    while (r.phase !== 'finished' && r.time < 300) r.update(.05);
    const order = standings(r);
    assert.ok(order.every(b => b.finish !== null), order.map(b => `${b.id}@${b.progress | 0}`).join(' '));
    assert.ok(order[0].finish > 80 && order.at(-1).finish < 130, `${order[0].finish}–${order.at(-1).finish}`);
  }
  const easy = new Race(); easy.configure({ rivals: 'easy' }); easy.start(11);
  while (easy.phase !== 'finished' && easy.time < 300) easy.update(.05);
  const pana = toEnd(solo(), (r, b) => ({ throttle: 1, steer: follow(r, b) }));
  assert.ok(pana.finish < standings(easy)[0].finish, `following the arrows (${pana.finish}) beats easy rivals (${standings(easy)[0].finish})`);
});

test('late arrivals watch; the race ends once every pana is home', () => {
  const r = new Race(); r.configure({ rivals: 'none' }); r.addPlayer(1, 'Ana'); r.start(2);
  r.addPlayer(2, 'Beto'); assert.equal(r.players.find(p => p.id === 2).spectator, true); assert.equal(r.boats.length, 1);
  for (let t = 0; t < 3.1; t += .05) r.update(.05);
  const b = r.boats[0], q = r.river.at(r.river.LENGTH - 8, 0);
  Object.assign(b, { x: q.x, z: q.z, h: q.h, s: r.river.LENGTH - 8, progress: r.river.LENGTH - 8, checkpoint: r.river.gates.length, v: 12 });
  drive(r, 2, { throttle: 1 });
  assert.ok(b.finish !== null); assert.equal(r.phase, 'finished');
});
