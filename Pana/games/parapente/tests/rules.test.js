import test from 'node:test';
import assert from 'node:assert/strict';
import { Race, fly, cleanInput, standings, WING, BOOST, DOWN, LANDING, COUNTDOWN, SLOTS } from '../public/rules.js';
import { buildCourse, airAt, remaining, SIZES } from '../public/course.js';

// Flat ground at 0 with the deck lifted to 400 m: every rule without the map.
function flatCourse(options) {
  const course = buildCourse(() => 0, options);
  course.launch.y = 400;
  for (const b of course.beacons) b.ref = 120;
  return course;
}
const pilotAt = (race, x, y, z, h = 0) => Object.assign(race.pilots[0], { x, y, z, h, v: WING.trim, steer: 0 });
function started(course = flatCourse(), rivals = 'none') {
  const race = new Race(course, 7); race.options.rivals = rivals;
  race.addPlayer(1, 'Ana'); race.start(); race.update(COUNTDOWN + .01);
  return race;
}
// Far from every thermal, beacon and ring.
const still = { x: 450, z: 400 };

test('trim glides about 11:1, the bar is faster and steeper, brakes slower', () => {
  const glide = input => {
    const race = started(), p = pilotAt(race, still.x, 300, still.z, Math.PI);
    for (let i = 0; i < 200; i++) fly(race.course, p, .05, input);
    const x0 = p.z, y0 = p.y, v = p.v;
    for (let i = 0; i < 200; i++) fly(race.course, p, .05, input);
    return { ratio: (x0 - p.z) / (y0 - p.y), v };
  };
  const trim = glide({}), bar = glide({ bar: true }), brake = glide({ brake: true });
  assert.ok(trim.ratio > 10.5 && trim.ratio < 11.6, `trim ${trim.ratio}`);
  assert.ok(bar.v > trim.v + 4 && bar.ratio < trim.ratio - 2, `bar ${bar.v} ${bar.ratio}`);
  assert.ok(brake.v < trim.v - 3, `brake ${brake.v}`);
});

test('big ears and a hard turn sink much faster than trim', () => {
  const sink = input => { const race = started(), p = pilotAt(race, still.x, 300, still.z, Math.PI); for (let i = 0; i < 100; i++) fly(race.course, p, .05, input); return 300 - p.y; };
  assert.ok(sink({ ears: true }) > sink({}) * 2.5);
  assert.ok(sink({ steer: 1 }) > sink({}) * 2);
});

test('circling in a thermal core climbs; it fades at the top', () => {
  const race = started(), t = race.course.thermals[0], p = pilotAt(race, t.x + 10, 150, t.z, Math.PI / 2);
  for (let i = 0; i < 300; i++) fly(race.course, p, .05, { steer: .8, brake: true });
  assert.ok(p.y > 165, `climbed to ${p.y}`);
  assert.ok(airAt(race.course, t.x, t.top + 5, t.z) < .1);
  assert.ok(airAt(race.course, t.x, 100, t.z) > t.lift * .9);
});

test('beacons count only in order, inside their cylinder at any height', () => {
  const race = started(), [first, second] = race.course.beacons, p = race.pilots[0];
  pilotAt(race, second.x, 380, second.z); fly(race.course, p, .05, {});
  assert.equal(p.beacon, 0, 'the second beacon first does not count');
  pilotAt(race, first.x, 390, first.z); fly(race.course, p, .05, {}, 12);
  assert.equal(p.beacon, 1); assert.deepEqual(p.splits, [12]);
  pilotAt(race, second.x + SIZES.beacon - 2, 60, second.z); fly(race.course, p, .05, {});
  assert.equal(p.beacon, 2);
});

test('a ring boosts once', () => {
  const race = started(), ring = race.course.rings[0], p = pilotAt(race, ring.x, ring.y, ring.z - 1);
  fly(race.course, p, .05, {});
  assert.deepEqual(p.rings, [ring.id]); assert.ok(p.boost > BOOST.seconds - .1);
  for (let i = 0; i < 40; i++) fly(race.course, p, .05, {});
  assert.ok(p.v > WING.trim + 2, 'faster while boosted');
  pilotAt(race, ring.x, ring.y, ring.z); p.boost = 0; fly(race.course, p, .05, {});
  assert.equal(p.boost, 0); assert.equal(p.rings.length, 1);
});

test('touching down early relaunches over the last beacon passed', () => {
  const race = started(), p = race.pilots[0], first = race.course.beacons[0];
  pilotAt(race, first.x, 300, first.z); fly(race.course, p, .05, {});
  pilotAt(race, still.x, .2, still.z); fly(race.course, p, .05, {});
  assert.equal(p.downs, 1); assert.equal(p.finish, null); assert.ok(p.down > 0);
  for (let t = 0; t < DOWN.seconds + .1 && p.down > 0; t += .05) fly(race.course, p, .05, {});
  assert.equal(p.down, 0);
  assert.ok(Math.hypot(p.x - first.x, p.z - first.z) < 1 && p.y >= DOWN.above);
});

test('flying far off the course counts as out and relaunches', () => {
  const race = started(), p = race.pilots[0], b = race.course.bounds;
  pilotAt(race, b.maxX + 5, 300, 0); fly(race.course, p, .05, {});
  assert.equal(p.outs, 1); assert.ok(p.down > 0); assert.equal(p.finish, null);
});

test('after the last beacon the diana finishes; a near miss costs seconds, a far one relaunches', () => {
  const land = (dx, beacons) => {
    const race = started(), p = race.pilots[0], L = race.course.landing;
    p.beacon = beacons; pilotAt(race, L.x + dx, .3, L.z); fly(race.course, p, .05, {}, 100);
    return p;
  };
  const all = flatCourse().beacons.length;
  assert.equal(land(3, all).finish, 100); assert.equal(land(3, all).penalty, 0);
  const near = land(SIZES.landing + 50, all);
  assert.equal(near.penalty, 50 * LANDING.perMetre); assert.equal(near.finish, 100 + near.penalty);
  assert.equal(land(LANDING.near + 20, all).finish, null);
  assert.equal(land(0, all - 1).finish, null, 'beacons first');
});

test('a race fills with bots, counts down, and its snapshot carries no course', () => {
  const race = new Race(flatCourse(), 3);
  race.addPlayer(1, 'Ana'); race.addPlayer(2, 'Bruno');
  assert.ok(race.start());
  assert.equal(race.pilots.length, SLOTS); assert.equal(race.pilots.filter(p => p.bot).length, SLOTS - 2);
  assert.equal(race.phase, 'countdown');
  assert.equal(race.configure({ rivals: 'hard' }), false, 'options lock during a race');
  race.update(COUNTDOWN + .01); assert.equal(race.phase, 'racing');
  const snap = race.snapshot();
  assert.equal(snap.course, undefined); assert.equal(snap.pilots.length, SLOTS);
  const copy = Race.restore(snap, new Map([[1, {}]]), race.course);
  assert.equal(copy.pilots.some(p => p.id === 2), false);
  assert.equal(copy.pilots.length, SLOTS - 1); assert.equal(copy.course, race.course);
});

test('bots fly the whole course and land on the diana', () => {
  const race = new Race(flatCourse(), 11); race.options.rivals = 'normal';
  race.addPlayer(1, 'Ana'); race.start();
  for (let t = 0; t < 300 && race.phase !== 'finished'; t += .05) race.update(.05, new Map([[1, { ears: true }]]));
  const bots = race.pilots.filter(p => p.bot);
  assert.ok(bots.every(p => p.finish !== null), bots.map(p => `${p.name} b${p.beacon} ${p.finish}`).join(', '));
  assert.ok(bots.every(p => p.miss < LANDING.near));
  const order = standings(race);
  assert.ok(order.findIndex(p => !p.bot) > 0, 'a pana who only sinks is not first');
});

test('remaining distance shrinks as beacons pass, and junk input is a released wing', () => {
  const course = flatCourse(), at = { x: course.launch.x, z: course.launch.z };
  assert.ok(Math.abs(remaining(course, { ...at, beacon: 0 }) - course.length) < 1);
  assert.ok(remaining(course, { ...course.beacons[0], beacon: 1 }) < course.length);
  assert.deepEqual(cleanInput({ steer: 9, bar: 'yes', brake: 0, ears: null }), { steer: 1, bar: true, brake: false, ears: false });
  assert.deepEqual(cleanInput(null ?? undefined), { steer: 0, bar: false, brake: false, ears: false });
});
