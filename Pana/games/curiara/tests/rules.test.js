import test from 'node:test';
import assert from 'node:assert/strict';
import { Race, standings, cleanInput } from '../public/rules.js';
import { RIVER, GREYBOX } from '../public/river.js';

// A solo race (no bots) past the countdown. `pana(t)` returns strokes to send.
export function solo(river = RIVER, seed = 3) {
  const r = new Race(river); r.addPlayer(1, 'Pana'); r.start(false, seed);
  for (let t = 0; t < 3.1; t += .05) r.update(.05);
  return r;
}
// Drives player 1 with exact stroke times, `gap(i)` seconds apart.
export function row(r, seconds, { gap = () => .4, side = i => i % 2 ? 1 : -1, extra = {} } = {}) {
  const strokes = [], start = r.time;
  let next = r.time, i = 0;
  for (let t = 0; t < seconds; t += .05) {
    while (gap && next <= r.time + .05) { strokes.push([i + 1, side(i), next]); next += gap(i++); }
    r.update(.05, new Map([[1, { strokes: strokes.slice(-8), ...(typeof extra === 'function' ? extra(r.time - start) : extra) }]]));
  }
  return r.boats[0];
}

test('grey box: rhythm carries the canoe, mashing does not', () => {
  const a = row(solo(GREYBOX), 12), b = row(solo(GREYBOX), 12, { gap: () => .1 });
  assert.ok(a.progress > b.progress + 20, `${a.progress} vs ${b.progress}`);
  assert.ok(a.remazos > 20);
});

test('the current carries a stopped canoe downstream', () => {
  const r = solo(GREYBOX), b = r.boats[0], s = b.progress;
  row(r, 6, { gap: null });
  assert.ok(b.progress - s > 6 * 1.2, `drifted ${b.progress - s}`);
  assert.ok(Math.abs(b.v) < .01);
});

test('the countdown holds the canoes and swallows early strokes', () => {
  const r = new Race(GREYBOX); r.addPlayer(1, 'Pana'); r.start(false, 1);
  const b = r.boats[0], s = b.s;
  for (let t = 0; t < 2.9; t += .05) r.update(.05, new Map([[1, { strokes: [[1, -1, 0], [2, 1, .1], [3, -1, .2]] }]]));
  assert.equal(b.s, s); assert.equal(r.phase, 'countdown');
  r.update(.25, new Map([[1, { strokes: [[1, -1, 0], [2, 1, .1], [3, -1, .2]] }]]));
  assert.equal(b.strokes, 0);
});

test('back-paddling brakes', () => {
  const r = solo(GREYBOX), b = row(r, 4);
  const v = b.v; row(r, .6, { gap: null, extra: { back: true } });
  assert.ok(b.v < v - 1.2, `${v} → ${b.v}`);
});

test('banks keep the canoe in the river', () => {
  const r = solo(GREYBOX), b = row(r, 8, { side: () => 1, gap: () => .5 });
  assert.ok(Math.abs(r.river.locate(b.x, b.z).offset) <= r.river.halfWidth(b.s));
});

test('inputs are cleaned', () => {
  assert.deepEqual(cleanInput({ strokes: [[1, 5, .2], ['x', 1, 2], [2, -3, NaN]], steer: 9, back: 1, splash: '2' }), { strokes: [[1, 1, .2]], back: true, steer: 1, splash: 2 });
});

test('a grey-box race finishes, orders and replays from a snapshot', () => {
  const r = new Race(GREYBOX); r.addPlayer(1, 'Pana'); r.start(true, 9);
  assert.equal(r.boats.length, 8);
  for (let t = 0; t < 200 && r.phase !== 'finished'; t += .05) r.update(.05, new Map());
  assert.equal(r.phase, 'finished');
  assert.ok(r.boats.filter(b => b.finish !== null).length >= 7, 'bots finish');
  const ordered = standings(r); assert.ok(ordered[0].finish <= ordered[1].finish);
  const restored = Race.restore(r.snapshot(), new Map([[1, {}]]), GREYBOX);
  assert.deepEqual(restored.snapshot(), r.snapshot());
});

test('bots run the Amazonas in about two minutes and nobody gets stuck', () => {
  const r = new Race(); r.start(true, 21);
  for (let t = 0; t < 250 && r.phase !== 'finished'; t += .05) r.update(.05, new Map());
  assert.equal(r.phase, 'finished');
  const times = r.boats.map(b => b.finish);
  assert.ok(times.every(t => t !== null), 'every bot reaches the churuata');
  assert.ok(Math.min(...times) > 105 && Math.max(...times) < 145, times.map(t => t.toFixed(1)).join(' '));
});

// Puts boat `b` at (s, offset), heading downstream, at rest.
function put(r, b, s, offset = 0, extra = {}) {
  const q = r.river.at(s, offset);
  Object.assign(b, { x: q.x, z: q.z, h: q.h, s, progress: s, checkpoint: r.river.gates.filter(g => g <= s).length, v: 0, lat: 0, w: 0, y: r.river.levelAt(s, offset), vy: 0, air: 0, tip: 0, capsized: 0, grace: 0, channel: 'main', ...extra });
  return b;
}
function duo(seed = 4) {
  const r = new Race(); r.addPlayer(1, 'A'); r.addPlayer(2, 'B'); r.start(false, seed);
  for (let t = 0; t < 3.1; t += .05) r.update(.05);
  return r;
}

test('a full tip meter capsizes the canoe; the panas climb back in after 1.8 s', () => {
  const r = solo(), b = put(r, r.boats[0], 120);
  r.tip(b, 60, 'test'); assert.equal(b.capsized, 0);
  r.tip(b, 45, 'test'); assert.ok(b.capsized > 0); assert.equal(b.capsizes, 1);
  const strokes = b.strokes;
  row(r, 1.7); assert.ok(b.capsized > 0, 'still swimming'); assert.equal(b.strokes, strokes, 'no paddling upside down');
  row(r, .2, { gap: null }); assert.equal(b.capsized, 0); assert.equal(b.tip, 0);
  r.tip(b, 100, 'test'); assert.equal(b.capsized, 0, 'a moment of grace after climbing back in');
});

test('the tip meter drains while paddling straight', () => {
  const r = solo(), b = put(r, r.boats[0], 120);
  r.tip(b, 50, 'test'); row(r, 2);
  assert.ok(b.tip < 25, `${b.tip}`);
});

test('the fast lane of a raudal drops hard: airtime, then a splash landing', () => {
  const r = solo(), d = r.river.drops[0], lane = d.lanes.find(l => l.fast), b = put(r, r.boats[0], d.s - 8, (lane.from + lane.to) / 2, { v: 4 });
  let air = 0;
  for (let t = 0; t < 3; t += .05) { r.update(.05); air = Math.max(air, b.air); }
  assert.ok(air > .3, `airtime ${air}`); assert.equal(b.drops, 1);
  assert.ok(b.y < r.river.levelAt(d.s - 8, 0) - 1.2, 'down the drop');
});

test('a crooked landing in the fast lane can roll the canoe', () => {
  const r = solo(), d = r.river.drops[0], lane = d.lanes.find(l => l.fast), b = put(r, r.boats[0], d.s - 6, (lane.from + lane.to) / 2, { v: 3 });
  b.h += .9; b.tip = 40;
  for (let t = 0; t < 2.5; t += .05) r.update(.05);
  assert.ok(b.capsizes >= 1);
});

test('rocks stop a canoe and knock its balance; leaning on them does not', () => {
  const r = solo(), rock = r.river.rocks.find(k => k.s > 600), b = put(r, r.boats[0], rock.s - 6, rock.offset, { v: 5 });
  for (let t = 0; t < 1.5; t += .05) r.update(.05);
  assert.ok(b.hits >= 1); assert.ok(b.tip > 10 || b.capsizes > 0);
  const tip = b.tip, hits = b.hits; for (let t = 0; t < .3; t += .05) r.update(.05);
  assert.ok(b.hits === hits && b.tip <= tip + 1e-9);
});

test('canoes bump with mass instead of passing through each other', () => {
  const r = duo(), [a, c] = r.boats;
  put(r, a, 200, -1.2, { v: 0 }); put(r, c, 200, 1.2, { v: 0 }); a.h -= .6;
  a.v = 4;
  for (let t = 0; t < 1; t += .05) r.update(.05);
  const gap = Math.min(...r.hull(a).flatMap(p => r.hull(c).map(q => Math.hypot(p.x - q.x, p.z - q.z))));
  assert.ok(gap > 1.1, `hulls overlap: ${gap}`);
  assert.ok(a.bumps >= 1 && c.bumps >= 1);
});

test('¡Salpicón! shoves and sprays a canoe within 2.5 m, then cools down for 4 s', () => {
  const r = duo(), [a, c] = r.boats;
  put(r, a, 620, -1.6); put(r, c, 620, 1.6);
  const before = r.river.locate(c.x, c.z).offset;
  r.update(.05, new Map([[1, { splash: 1 }]]));
  assert.equal(a.splashes, 1); assert.ok(c.sprayed > 0); assert.ok(c.tip > 5);
  for (let t = 0; t < .5; t += .05) r.update(.05, new Map([[1, { splash: 1 }]]));
  assert.ok(r.river.locate(c.x, c.z).offset > before + .3, 'pushed away');
  r.update(.05, new Map([[1, { splash: 2 }]]));
  assert.equal(a.splashes, 1, 'cooling down');
  put(r, c, 620, 12); for (let t = 0; t < 4; t += .05) r.update(.05, new Map([[1, { splash: 2 }]]));
  r.update(.05, new Map([[1, { splash: 3 }]]));
  assert.equal(a.splashes, 2); assert.equal(c.sprayed > .5, false, 'nobody within reach this time');
});

test('a caimán snaps once at a passing canoe: +40% tip and a jolt; logs do nothing', () => {
  const r = solo(), log = r.river.logs.find(l => l.caiman), b = put(r, r.boats[0], log.s - 1.5, log.offset * .7);
  r.update(.05);
  assert.equal(b.bitten, 1); assert.ok(b.tip >= 35); assert.ok(b.jolt > 0);
  r.update(.05); assert.equal(b.bitten, 1, 'once');
  const plain = r.river.logs.find(l => !l.caiman), c = put(r, b, plain.s - 1.5, plain.offset * .7);
  r.update(.05); assert.equal(c.bitten, 1);
});

test('the toninas leave a two-second strip of fast water', () => {
  const r = solo(), b = r.boats[0], T = r.river;
  const pod = T.toninasAt(40.1).find(p => p.age < .2) || T.toninasAt(T.toninaSpots.length ? 3.2 * 12 + .1 : 0)[0];
  r.time = pod.t0 + .7; put(r, b, pod.s, pod.offset);
  r.update(.05); assert.ok(b.boost > 0); assert.equal(b.toninas, 1);
  r.time = pod.t0 + 2.8; put(r, b, pod.s, pod.offset); r.update(.05); assert.equal(b.boost, 0, 'the wake fades');
});

test('the remolino pulls you in and spins you; paddling hard gets you out', () => {
  const r = solo(), w = r.river.whirl, b = put(r, r.boats[0], w.s, w.offset - w.r * .6);
  const h0 = b.h;
  for (let t = 0; t < 2; t += .05) r.update(.05);
  assert.ok(Math.abs(Math.atan2(Math.sin(b.h - h0), Math.cos(b.h - h0))) > .3, 'spun');
  const c = put(r, b, w.s - 3, w.offset - 2);
  row(r, 8, { side: i => (i % 2 ? 1 : -1) });
  assert.ok(Math.hypot(c.x - w.x, c.z - w.z) > w.r || c.progress > w.s + 15, 'escaped');
});

test('eddies hold a drifting canoe back', () => {
  const r = solo(), e = r.river.eddies.find(x => x.s < 300), b = r.boats[0];
  put(r, b, e.s, e.offset); const inEddy = b.progress; row(r, 1.5, { gap: null });
  const held = b.progress - inEddy;
  put(r, b, e.s, -Math.sign(e.offset) * 1.5); const open = b.progress; row(r, 1.5, { gap: null });
  assert.ok(b.progress - open > held + 1.5, `eddy ${held} vs open ${b.progress - open}`);
});

test('the igapó trunks snag canoes', () => {
  const r = solo(), sn = r.river.snags[3], p = r.river.branch.path.at(sn.u - 5, r.river.branch.path.nearest(sn.x, sn.z).offset), b = r.boats[0];
  Object.assign(b, { x: p.x, z: p.z, h: p.h, s: r.river.locate(p.x, p.z).s, progress: r.river.locate(p.x, p.z).s, v: 5, lat: 0, w: 0, channel: 'branch', u: sn.u - 5, tip: 0, capsized: 0, y: r.river.levelAt(160) });
  for (let t = 0; t < 1.5; t += .05) r.update(.05);
  assert.ok(b.hits >= 1);
});

test('snapshots carry hazards across host migration', () => {
  const r = new Race(); r.addPlayer(1, 'A'); r.start(true, 8);
  for (let t = 0; t < 40; t += .05) r.update(.05, new Map());
  const restored = Race.restore(r.snapshot(), new Map([[1, {}]]));
  assert.deepEqual(restored.snapshot(), r.snapshot());
  for (let t = 0; t < 2; t += .05) { r.update(.05, new Map()); restored.update(.05, new Map()); }
  assert.deepEqual(restored.snapshot(), r.snapshot(), 'and replay the same afterwards');
});

test('a photo finish slows the race clock for everyone, once', () => {
  const r = duo(), [a, c] = r.boats, L = r.river.LENGTH;
  put(r, a, L - 6.5, -1.5, { v: 5 }); put(r, c, L - 7.2, 1.5, { v: 5 });
  const t0 = r.time; r.update(.05);
  assert.ok(r.photo && r.slowmo > 0);
  assert.ok(r.time - t0 < .05 * .5, 'race time runs slow');
  for (let t = 0; t < 2; t += .05) r.update(.05);
  assert.equal(r.slowmo, 0); const photo = r.photo;
  r.update(.05); assert.equal(r.photo, photo, 'only once a race');
});
