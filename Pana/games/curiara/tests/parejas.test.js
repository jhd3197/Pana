import test from 'node:test';
import assert from 'node:assert/strict';
import { Race, FORMATS } from '../public/rules.js';
import { GREYBOX } from '../public/river.js';

function pairs(n, seats = {}, bots = true, river) {
  const r = new Race(river); r.setFormat('parejas');
  for (let i = 1; i <= n; i++) { r.addPlayer(i, `P${i}`); if (seats[i]) assert.equal(r.chooseSeat(i, seats[i]), true); }
  r.start(bots, 5);
  for (let t = 0; t < 3.1; t += .05) r.update(.05);
  return r;
}
// Drives a canoe from the proa (strokes) and the popa (input per tick).
function paddle(r, seconds, { front = 1, back = 2, popa = () => ({}) } = {}) {
  const strokes = [], taps = []; let next = r.time, i = 0;
  for (let t = 0; t < seconds; t += .05) {
    while (next <= r.time + .05) { strokes.push([i + 1, i % 2 ? 1 : -1, next]); i++; next += .4; }
    const extra = popa(r.time, strokes.at(-1), taps);
    r.update(.05, new Map([[front, { strokes: strokes.slice(-8) }], [back, { strokes: taps.slice(-8), ...extra }]]));
  }
}

test('four canoes of two; friends without a pick share a canoe, bots fill the rest', () => {
  const r = pairs(3);
  assert.equal(r.boats.length, FORMATS.parejas.boats);
  assert.deepEqual(r.boats[0].crew.map(c => c.id), [1, 2]);
  assert.deepEqual(r.boats[1].crew.map(c => [c.id, c.bot]), [[3, false], ['bot-c1-1', true]]);
  assert.ok(r.boats.slice(2).every(b => b.crew.every(c => c.bot)));
});

test('seat picks are honoured and never shared', () => {
  const r = new Race(); r.setFormat('parejas'); r.addPlayer(1, 'A'); r.addPlayer(2, 'B'); r.addPlayer(3, 'C');
  assert.equal(r.chooseSeat(1, { boat: 2, pos: 1 }), true);
  assert.equal(r.chooseSeat(2, { boat: 2, pos: 1 }), false, 'taken');
  assert.equal(r.chooseSeat(2, { boat: 2, pos: 0 }), true);
  r.start(true, 3);
  assert.deepEqual(r.boats[2].crew.map(c => c.id), [2, 1]);
  assert.equal(r.boats[0].crew[0].id, 3);
  const lobby = new Race(); lobby.setFormat('parejas'); lobby.addPlayer(1, 'A'); lobby.chooseSeat(1, { boat: 1, pos: 0 });
  lobby.setFormat('todos'); assert.equal(lobby.players[0].seat, null, 'seats reset with the format');
});

test('the popa steers with the rudder; the proa supplies the power', () => {
  const straight = pairs(2), left = pairs(2);
  paddle(straight, 4); paddle(left, 4, { popa: () => ({ steer: -1 }) });
  const [s, l] = [straight.boats[0], left.boats[0]];
  const turn = (r, b) => Math.atan2(Math.sin(b.h - r.river.at(b.s).h), Math.cos(b.h - r.river.at(b.s).h));
  assert.ok(turn(left, l) > turn(straight, s) + .2, 'A held on the helm turns left');
  assert.ok(s.strokes >= 9 && s.remazos >= 5);
});

test('¡Ahora!: the popa tapping with the stroke adds 15%', () => {
  const plain = pairs(2, {}, false, GREYBOX), synced = pairs(2, {}, false, GREYBOX);
  paddle(plain, 6);
  paddle(synced, 6, { popa: (t, last, taps) => { if (last && (!taps.length || taps.at(-1)[2] < last[2]) && t >= last[2]) taps.push([taps.length + 1, 1, last[2] + .04]); return {}; } });
  const [a, b] = [plain.boats[0], synced.boats[0]];
  assert.ok(b.paddle.syncs >= 10, `syncs ${b.paddle.syncs}`);
  assert.ok(b.progress > a.progress + 3, `${b.progress} vs ${a.progress}`);
});

test('the popa back-paddles and throws the salpicón; the proa cannot', () => {
  const r = pairs(4), [a, c] = r.boats;
  const q = r.river.at(620, -1.6), w = r.river.at(620, 1.6);
  Object.assign(a, { x: q.x, z: q.z, h: q.h, s: 620, progress: 620 }); Object.assign(c, { x: w.x, z: w.z, h: w.h, s: 620, progress: 620 });
  r.update(.05, new Map([[1, { splash: 1 }]])); assert.equal(a.splashes, 0);
  r.update(.05, new Map([[2, { splash: 1 }]])); assert.equal(a.splashes, 1); assert.ok(c.sprayed > 0);
  r.update(.05, new Map([[2, { back: true }]])); assert.equal(a.paddle.back, true);
});

test('a parejas race with bots in every seat finishes', () => {
  const r = pairs(0);
  for (let t = 0; t < 250 && r.phase !== 'finished'; t += .05) r.update(.05, new Map());
  assert.ok(r.boats.filter(b => b.finish !== null).length >= 3);
  assert.ok(r.boats.some(b => b.paddle.syncs > 0), 'bot crews call ¡Ahora! too');
});
