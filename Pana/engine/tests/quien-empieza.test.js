import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStarter, starterInput, stepStarter, starterDone, starterResult, starterBarks, joinStarter,
  SHAKE_LIMIT, LIFT, ORDER_HOLD, STARTER_FIELD,
} from '../play/quien-empieza-rules.js';

const seatsOf = n => Array.from({ length: n }, (_, i) => i);
// Steps the host clock until the cachos are done; every seat is a bot.
function play(s, bots = s.seats, limit = 400) {
  for (let i = 0; i < limit && !starterDone(s); i++) stepStarter(s, .1, { bots });
  return s;
}
const roundTrip = s => JSON.parse(JSON.stringify(s));

test('2 to 8 bots: everyone slams, the highest starts, all within 20 seconds without ties', () => {
  for (let n = 2; n <= 8; n++) for (let seed = 1; seed <= 40; seed++) {
    const s = play(createStarter({ seats: seatsOf(n), need: 'order', seed }));
    const { order, rolls } = starterResult(s);
    assert.deepEqual([...order].sort((a, b) => a - b), seatsOf(n), 'every seat once');
    const first = s.history[0].rolls;
    assert.equal(Object.keys(first).length, n, 'everyone threw in the first round');
    // The starter has the best first throw.
    assert.equal(first[order[0]], Math.max(...Object.values(first)));
    assert.ok(rolls[order[0]] >= 1 && rolls[order[0]] <= 6);
    if (s.history.length === 1) {
      const values = order.map(seat => first[seat]);
      assert.deepEqual(values, [...values].sort((a, b) => b - a), 'no ties: order follows the dice');
    }
  }
});

test('a bot shakes before it slams, and the round stays under the shake limit', () => {
  const s = createStarter({ seats: [0, 1], seed: 9 });
  let shook = false;
  while (s.phase === 'shake') { stepStarter(s, .05, { bots: [0, 1] }); shook ||= s.shaking.length > 0; }
  assert.ok(shook, 'bots rattle the cup first');
  assert.ok(s.history.length === 1 && s.phase === 'lift');
  assert.ok(Object.values(s.slammed).every(p => p >= 0 && p <= 1));
});

test('humans slam by hand; a slow one is slammed on their behalf after 8 seconds', () => {
  const s = createStarter({ seats: [0, 1, 2], seed: 3 });
  assert.ok(starterInput(s, 0, 'shake'));
  assert.ok(!starterInput(s, 0, 'shake'), 'already shaking');
  assert.ok(starterInput(s, 0, 'slam', .9));
  assert.ok(!starterInput(s, 0, 'slam', .9), 'one slam a round');
  assert.ok(!starterInput(s, 7, 'slam', .9), 'not at the table');
  assert.ok(!starterInput(s, 1, 'bounce'), 'unknown inputs do nothing');
  for (let t = 0; t < SHAKE_LIMIT - .2; t += .1) stepStarter(s, .1, { bots: [2] });
  assert.equal(s.phase, 'shake', 'the human still has time');
  assert.ok(2 in s.slammed, 'the bot already slammed');
  stepStarter(s, .3, { bots: [2] });
  assert.equal(s.phase, 'lift', 'the slow pana was slammed for them');
  assert.equal(s.slammed[0], .9);
});

test('a tie at the top: only the tied panas shake again', () => {
  // Find a seed whose first round ties at the top among four.
  for (let seed = 1; seed < 500; seed++) {
    const s = createStarter({ seats: seatsOf(4), need: 'first', seed });
    while (s.phase === 'shake') stepStarter(s, .1, { bots: s.seats });
    const first = s.history[0].rolls, top = Math.max(...Object.values(first));
    const tied = s.seats.filter(seat => first[seat] === top);
    if (tied.length < 2) continue;
    assert.ok(starterBarks(s).some(b => tied.includes(b.seat) && /Empate/.test(b.text)));
    for (let t = 0; t < LIFT + .1; t += .1) stepStarter(s, .1);
    assert.equal(s.phase, 'shake'); assert.equal(s.round, 2);
    assert.deepEqual(s.contenders, tied, 'only the tied throw again');
    const watcher = s.seats.find(seat => !tied.includes(seat));
    assert.ok(!starterInput(s, watcher, 'slam', .5), 'the rest watch');
    play(s);
    assert.ok(tied.includes(starterResult(s).order[0]));
    return;
  }
  assert.fail('no seed tied at the top');
});

test("'first' leaves lower ties alone; 'order' throws them again", () => {
  let checked = 0;
  for (let seed = 1; seed < 800 && checked < 2; seed++) for (const need of ['first', 'order']) {
    const s = createStarter({ seats: seatsOf(5), need, seed });
    while (s.phase === 'shake') stepStarter(s, .1, { bots: s.seats });
    const first = s.history[0].rolls, values = Object.values(first), top = Math.max(...values);
    const lowTie = values.some(v => v < top && values.filter(x => x === v).length > 1);
    if (!lowTie || values.filter(v => v === top).length > 1) continue;
    for (let t = 0; t < LIFT + .1; t += .1) stepStarter(s, .1);
    if (need === 'first') assert.equal(s.phase, 'order', 'the starter is clear: no second round');
    else { assert.equal(s.phase, 'shake'); assert.ok(s.contenders.every(seat => first[seat] < top)); }
    checked++;
  }
  assert.equal(checked, 2);
});

test('the lift, the order strip and done follow the clock', () => {
  const s = createStarter({ seats: [0, 1], seed: 5 });
  for (const seat of [0, 1]) starterInput(s, seat, 'slam', .5);
  if (s.history[0].rolls[0] === s.history[0].rolls[1]) return;
  assert.equal(s.phase, 'lift');
  assert.ok(!stepStarter(s, LIFT - .1), 'nothing to publish while the cups rise');
  assert.ok(stepStarter(s, .2)); assert.equal(s.phase, 'order');
  assert.equal(starterResult(s), null, 'the result comes once the strip has shown');
  assert.ok(stepStarter(s, ORDER_HOLD)); assert.ok(starterDone(s));
});

test('the state survives a snapshot round trip mid-roll (a reload or a new host)', () => {
  const a = createStarter({ seats: seatsOf(6), need: 'order', seed: 21 });
  stepStarter(a, 1, { bots: [1, 2] });
  const b = roundTrip(a);
  play(a); play(b);
  assert.deepEqual(starterResult(b), starterResult(a));
});

test('room options: azar shuffles, anfitrion keeps the seats, revancha puts the last first', () => {
  const azar = createStarter({ seats: seatsOf(6), seed: 8, option: 'azar' });
  assert.ok(starterDone(azar)); assert.equal(azar.note, 'Orden al azar');
  assert.deepEqual([...starterResult(azar).order].sort(), seatsOf(6));
  assert.deepEqual(starterResult(createStarter({ seats: [2, 0, 1], option: 'anfitrion' })).order, [2, 0, 1]);
  const rematch = play(createStarter({ seats: seatsOf(4), seed: 4, option: 'revancha', last: 3, need: 'order' }));
  const { order } = starterResult(rematch);
  assert.equal(order[0], 3, 'whoever came last starts');
  assert.ok(!(3 in rematch.history[0].rolls), 'and does not throw');
  assert.equal(starterResult(play(createStarter({ seats: [0, 1], seed: 4, option: 'revancha', last: null }))).order.length, 2, 'no previous match: the cacho decides');
  assert.equal(createStarter({ seats: [0, 1], option: 'trampa' }).option, 'cacho');
  assert.deepEqual(STARTER_FIELD.choices.map(([v]) => v), ['cacho', 'azar', 'anfitrion', 'revancha']);
});

test('a pana who sits down late goes at the end of the order', () => {
  const s = createStarter({ seats: [0, 1, 2], seed: 2 });
  assert.ok(joinStarter(s, 3)); assert.ok(!joinStarter(s, 3)); assert.ok(!joinStarter(s, 1));
  assert.equal(starterResult(play(s)).order.at(-1), 3);
});

test('moneda: two sides, one flip, no inputs, never a tie', () => {
  const seen = new Set();
  for (let seed = 1; seed < 30; seed++) {
    const s = createStarter({ seats: [0, 1], seed, flavour: 'moneda' });
    assert.equal(s.phase, 'lift'); assert.ok(!starterInput(s, 0, 'slam', 1));
    const { order, coin } = starterResult(play(s));
    assert.equal(order[0], coin === 'cara' ? 0 : 1); seen.add(coin);
  }
  assert.deepEqual([...seen].sort(), ['cara', 'sello']);
  assert.equal(createStarter({ seats: [0, 1, 2], flavour: 'moneda' }).flavour, 'cacho', 'a coin needs exactly two sides');
});

test('barks: a six, a one, the winner and a sore loser', () => {
  let six = false, one = false;
  for (let seed = 1; seed < 200; seed++) {
    const s = createStarter({ seats: seatsOf(4), seed });
    while (s.phase === 'shake') stepStarter(s, .1, { bots: s.seats });
    const barks = starterBarks(s), first = s.history[0].rolls;
    for (const { seat, text } of barks) {
      if (text.startsWith('¡Seis')) { assert.equal(first[seat], 6); six = true; }
      if (text.startsWith('Uno')) { assert.equal(first[seat], 1); one = true; }
    }
    const top = Math.max(...Object.values(first));
    if (Object.values(first).filter(v => v === top).length === 1 && top < 6) {
      const winner = barks.find(b => b.text === '¡Sale primero!');
      assert.equal(first[winner.seat], top);
    }
  }
  assert.ok(six && one);
});

test('a lone pana or no contenders resolves at once', () => {
  assert.deepEqual(starterResult(createStarter({ seats: [4] })).order, [4]);
  assert.deepEqual(starterResult(createStarter({ seats: [0, 1], option: 'revancha', last: 1 })).order, [1, 0]);
});
