import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, acceptAction, finishShot, step, rack, legalTarget, canPlace, advanceShotClock, botShot } from '../public/rules.js';
import { poolConnected, defaultPoolOptions, poolOptions } from '../public/match-rules.js';

function table(count = 6, options = {}) {
  const s = createGame(); for (let i = 0; i < count; i++) s.players[i].id = i + 10;
  assert.ok(act(s, 'options', { options: { ...defaultPoolOptions(), starter: 'anfitrion', ...options } }, 10));
  assert.ok(act(s, 'start', {}, 10)); return s;
}
const act = (s, action, values = {}, id = s.players[s.turn].id) => acceptAction(s, id, { action, revision: s.revision, ...values }, 10);
function outcome(s, values = {}) {
  const shot = { first: 1, pocketed: [], rail: true, eligible: false, breaking: false, pockets: {}, ...values };
  for (const id of shot.pocketed) s.balls[id].pocketed = true;
  s.shot = shot; s.phase = 'rolling'; finishShot(s);
}

test('six players form two teams and all six receive turns in order', () => {
  const s = table(), turns = [];
  for (let i = 0; i < 12; i++) { turns.push(s.turn); outcome(s); }
  assert.deepEqual(turns, [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5]);
});
test('successful teammates rotate shots while retaining their group', () => {
  const s = table(); outcome(s, { pocketed: [1] });
  assert.equal(s.turn, 2); assert.deepEqual(s.groups, ['solids', 'stripes']);
  assert.equal(legalTarget(s, 2), true); assert.equal(legalTarget(s, 10), false);
  outcome(s, { first: 2, pocketed: [2] }); assert.equal(s.turn, 4);
  outcome(s, { first: 3, pocketed: [3] }); assert.equal(s.turn, 0);
  outcome(s, { first: 4 }); assert.equal(s.turn, 1);
});
test('disconnection blocks the enrolled roster, replacement and late spectators are distinct', () => {
  const s = table(); s.players[4].id = null;
  assert.equal(poolConnected(s), false); assert.equal(act(s, 'shoot', { angle: 0, power: .5 }), false);
  s.players[4].id = 99; assert.equal(poolConnected(s), true);
  const duel = table(2); duel.players[2].id = 32;
  assert.deepEqual(duel.activeSeats, [0, 1]); outcome(duel); outcome(duel); assert.equal(duel.turn, 0);
});
test('guests move themselves, hosts arrange seats, and live swaps are rejected', () => {
  const s = createGame(); s.players[0].id = 10; s.players[1].id = 11;
  assert.ok(act(s, 'swap', { from: 1, to: 4 }, 11)); assert.equal(s.players[4].id, 11);
  assert.ok(act(s, 'swap', { from: 4, to: 1 }, 11));
  assert.equal(act(s, 'swap', { from: 0, to: 3 }, 11), false);
  assert.ok(act(s, 'swap', { from: 1, to: 5 }, 10)); assert.equal(s.players[5].id, 11);
  assert.ok(act(s, 'start', {}, 10)); assert.equal(act(s, 'swap', { from: 0, to: 1 }, 10), false);
});
test('options reject wrong authority, invalid patches and live mutations', () => {
  const s = createGame(); s.players[0].id = 10; s.players[1].id = 11;
  assert.equal(act(s, 'options', { options: { bestOf: 3 } }, 11), false);
  for (const patch of [{ bestOf: 2 }, { calledPocket: 'true' }, { bestOf: 3, cheat: 1 }, null, []]) assert.equal(poolOptions(s.options, patch), null);
  assert.ok(act(s, 'options', { options: { bestOf: 5 } }, 10)); assert.equal(s.options.bestOf, 5);
  assert.ok(act(s, 'start', {}, 10)); assert.equal(act(s, 'options', { options: { bestOf: 1 } }, 10), false);
});

test('reset restores all room settings atomically and preserves seats', () => {
  const s = createGame(); s.players[0].id = 10; s.players[1].id = 11;
  act(s, 'options', { options: { variant: 'nine', bestOf: 5 } }, 10);
  assert.ok(act(s, 'difficulty', { difficulty: 'experto' }, 10));
  assert.ok(act(s, 'map', { mapId: 'puerto' }, 10));
  const seats = structuredClone(s.players), revision = s.revision;
  assert.equal(act(s, 'reset-options', {}, 11), false);
  assert.ok(act(s, 'reset-options', {}, 10));
  assert.deepEqual(s.options, createGame().options); assert.equal(s.mapId, 'plaza');
  assert.equal(s.difficulty, createGame().difficulty); assert.equal(s.balls.filter(b => !b.pocketed).length, 16);
  assert.deepEqual(s.players, seats); assert.equal(s.revision, revision + 1);
  act(s, 'start', {}, 10); assert.equal(act(s, 'reset-options', {}, 10), false);
});
test('nine-ball racks nine numbered balls without overlap and requires the lowest first', () => {
  const balls = rack('nine').filter(b => !b.pocketed); assert.equal(balls.length, 10);
  for (const a of balls) for (const b of balls) if (a.id !== b.id) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 22);
  const s = table(2, { variant: 'nine' }); assert.ok(legalTarget(s, 1)); assert.equal(legalTarget(s, 2), false);
  outcome(s, { first: 2, lowest: 1, pocketed: [2] }); assert.equal(s.ballInHand, true); assert.equal(s.turn, 1);
});
test('a legal nine-ball combination wins; foul nines are respotted', () => {
  const s = table(6, { variant: 'nine' }); outcome(s, { first: 1, lowest: 1, pocketed: [9] });
  assert.equal(s.result.team, 0); assert.equal(s.phase, 'finished');
  const foul = table(2, { variant: 'nine' }); outcome(foul, { first: 2, lowest: 1, pocketed: [9] });
  assert.equal(foul.phase, 'aiming'); assert.equal(foul.balls[9].pocketed, false);
});
test('called pockets validate input and determine own pots and winning balls', () => {
  const s = table(2, { calledPocket: true }); assert.equal(act(s, 'shoot', { angle: 0, power: .5 }), false);
  assert.ok(act(s, 'shoot', { angle: 0, power: .5, pocket: 1 }));
  outcome(s, { pocketed: [1], called: 1, pockets: { 1: 2 } }); assert.equal(s.turn, 1); assert.deepEqual(s.groups, [null, null]);
  outcome(s, { first: 8, eligible: true, pocketed: [8], called: 1, pockets: { 8: 2 } }); assert.equal(s.result.team, 0);
  const nine = table(2, { variant: 'nine', calledPocket: true });
  outcome(nine, { first: 1, lowest: 1, pocketed: [9], called: 1, pockets: { 9: 2 } }); assert.equal(nine.phase, 'aiming'); assert.equal(nine.balls[9].pocketed, false);
});
test('kitchen placement restricts the cue ball and prohibits contact before leaving it', () => {
  const s = table(2, { foulPlacement: 'kitchen' }); outcome(s, { first: null });
  assert.equal(canPlace(s, 400, 100), false); assert.ok(act(s, 'place', { x: 100, y: 100 }));
  s.balls.forEach(b => { b.pocketed = ![0, 1, 8, 9].includes(b.id); });
  Object.assign(s.balls[1], { x: 160, y: 100 });
  assert.ok(act(s, 'shoot', { angle: 0, power: .05 }));
  for (let i = 0; i < 4000 && s.phase === 'rolling'; i++) step(s);
  assert.equal(s.ballInHand, true); assert.match(s.message, /cocina/);
});
test('shot clock passes to the next team and survives snapshot restore without reset', () => {
  const s = table(6, { shotSeconds: 30 }); advanceShotClock(s, 29);
  const copy = structuredClone(s); assert.ok(advanceShotClock(copy, 1)); assert.equal(copy.turn, 1); assert.equal(copy.ballInHand, true);
  assert.equal(copy.turnElapsed, 0); assert.equal(advanceShotClock(s, .5), false);
  s.players[4].id = null; advanceShotClock(s, 100); assert.equal(s.turn, 0);
});
test('best-of scores and break policies persist until the match ends', () => {
  for (const [breakPolicy, next] of [['alternate', 1], ['winner', 0], ['loser', 1]]) {
    const s = table(2, { bestOf: 3, breakPolicy }); outcome(s, { first: 8, eligible: true, pocketed: [8] });
    assert.equal(s.result.matchFinished, false); assert.ok(act(s, 'start', {}, 10)); assert.equal(s.turn, next); assert.deepEqual(s.scores, [1, 0]);
    s.turn = 0; outcome(s, { first: 8, eligible: true, pocketed: [8] }); assert.equal(s.result.matchFinished, true);
    assert.ok(act(s, 'start', {}, 10)); assert.deepEqual(s.scores, [0, 0]);
  }
});
test('bots produce valid called-pocket shots in either variant', () => {
  for (const variant of ['eight', 'nine']) {
    const s = table(2, { variant, calledPocket: true }); assert.ok(act(s, 'shoot', botShot(s)));
  }
});
test('host can return to room settings after results without losing players or options', () => {
  const s = table(6, { bestOf: 3, variant: 'nine' });
  const players = structuredClone(s.players), options = structuredClone(s.options);
  outcome(s, { first: 1, lowest: 1, pocketed: [9] });
  assert.equal(act(s, 'setup', {}, 11), false);
  assert(act(s, 'setup', {}, 10)); assert.equal(s.phase, 'lobby');
  assert.deepEqual(s.players, players); assert.deepEqual(s.options, options);
  assert.deepEqual(s.scores, [0, 0]); assert.equal(s.balls.filter(b => !b.pocketed).length, 10);
});
