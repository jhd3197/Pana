import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, rack, acceptAction, step, finishShot, canPlace, remaining, legalTarget, aimGuide, RADIUS } from '../public/rules.js';

function game(practice = false) {
  const s = createGame(practice); s.players[0].id = 11; if (!practice) s.players[1].id = 22;
  assert.ok(acceptAction(s, 11, { action: 'start', revision: 0 }, 11)); return s;
}
function action(s, action, values = {}, id = s.players[s.turn].id) { return acceptAction(s, id, { action, revision: s.revision, ...values }, 11); }
function settle(s) { let n = 0; while (s.phase === 'rolling' && n++ < 4000) step(s); assert.notEqual(s.phase, 'rolling'); }
function outcome(s, { first = 1, pocketed = [], rail = true, eligible = false, breaking = false } = {}) {
  pocketed.forEach(id => { s.balls[id].pocketed = true; });
  s.shot = { first, pocketed, rail, eligible, breaking, elapsed: 1 }; s.phase = 'rolling'; finishShot(s); return s;
}

test('rack has 16 distinct balls, the eight in the center and no overlaps', () => {
  const balls = rack(); assert.deepEqual(balls.map(b => b.id), Array.from({ length: 16 }, (_, i) => i));
  assert.equal(balls[8].y, 250); assert.ok(balls[8].x > balls[1].x);
  for (const a of balls) for (const b of balls) if (a.id !== b.id) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 2 * RADIUS);
});
test('only the host starts with two players; solo practice can start alone', () => {
  const s = createGame(); s.players[0].id = 11;
  assert.equal(action(s, 'start'), false); s.players[1].id = 22;
  assert.equal(action(s, 'start', {}, 22), false); assert.ok(action(s, 'start')); assert.equal(action(s, 'start'), false);
  assert.equal(game(true).phase, 'aiming');
});
test('rejects wrong seat, stale, duplicate, malformed and out-of-range shots', () => {
  const s = game(), shot = { action: 'shoot', revision: 1, angle: 0, power: .7 };
  assert.equal(acceptAction(s, 22, shot, 11), false);
  for (const values of [{ angle: NaN }, { angle: Infinity }, { power: Infinity }, { power: 2 }, { power: -.1 }, { power: '1' }]) assert.equal(acceptAction(s, 11, { ...shot, ...values }, 11), false);
  assert.equal(acceptAction(s, 11, { ...shot, revision: 0 }, 11), false);
  assert.ok(acceptAction(s, 11, shot, 11)); assert.equal(acceptAction(s, 11, shot, 11), false);
});
test('fixed-step break resolves deterministically and moves the rack', () => {
  const a = game(), b = game(); action(a, 'shoot', { angle: 0, power: 1 }); action(b, 'shoot', { angle: 0, power: 1 });
  settle(a); settle(b); assert.deepEqual(a, b); assert.ok(Math.abs(a.balls[1].x - 690) > 20);
  assert.ok(a.balls.every(b => Number.isFinite(b.x) && Number.isFinite(b.y) && b.vx === 0 && b.vy === 0));
});
test('a copied mid-shot snapshot finishes identically after host migration', () => {
  const a = game(); action(a, 'shoot', { angle: .02, power: .9 }); for (let i = 0; i < 150; i++) step(a);
  const b = structuredClone(a); settle(a); settle(b); assert.deepEqual(a, b);
});
test('real collision sends an object ball into a corner pocket', () => {
  const s = game(); s.shots = 1; s.balls.forEach(b => { b.pocketed = ![0, 1, 8, 9].includes(b.id); });
  Object.assign(s.balls[0], { x: 140, y: 140 }); Object.assign(s.balls[1], { x: 70, y: 70 });
  action(s, 'shoot', { angle: -Math.PI * .75, power: .22 }); settle(s);
  assert.equal(s.balls[1].pocketed, true); assert.equal(s.balls[0].pocketed, false); assert.deepEqual(s.groups, ['solids', 'stripes']); assert.equal(s.turn, 0);
});
test('first legal pot assigns groups, even on the break; own pots retain turn', () => {
  const s = outcome(game(), { pocketed: [10, 2], breaking: true });
  assert.deepEqual(s.groups, ['stripes', 'solids']); assert.equal(s.turn, 0);
  outcome(s, { first: 9, pocketed: [9] }); assert.equal(s.turn, 0);
});
test('foul pots stay down and never assign an open table', () => {
  const s = outcome(game(), { pocketed: [1, 0] }); assert.deepEqual(s.groups, [null, null]); assert.equal(s.turn, 1);
  assert.equal(s.balls[1].pocketed, true); assert.equal(s.balls[0].pocketed, false); assert.equal(s.ballInHand, true);
});
test('no contact, wrong first contact and no rail after contact are fouls', () => {
  for (const event of [{ first: null }, { first: 9 }, { first: 8 }, { first: 1, rail: false }]) {
    const s = game(); s.groups = ['solids', 'stripes']; outcome(s, event); assert.equal(s.turn, 1); assert.equal(s.ballInHand, true);
  }
});
test('potting only a rival ball passes the turn without a foul when contact was legal', () => {
  const s = game(); s.groups = ['solids', 'stripes']; outcome(s, { first: 1, pocketed: [9] });
  assert.equal(s.turn, 1); assert.equal(s.ballInHand, false);
});
test('ball in hand refuses rails, pockets, overlaps and shots before valid placement', () => {
  const s = outcome(game(), { first: null });
  for (const [x, y] of [[-1, 100], [10, 10], [500, 12], [690, 250], [NaN, 100], [100, Infinity]]) assert.equal(canPlace(s, x, y), false);
  assert.equal(action(s, 'shoot', { angle: 0, power: .5 }), false);
  assert.equal(action(s, 'place', { x: 690, y: 250 }), false); assert.ok(action(s, 'place', { x: 200, y: 150 }));
  assert.equal(s.ballInHand, false); assert.ok(action(s, 'shoot', { angle: 0, power: .5 }));
});
test('eight is a legal target only after clearing the group', () => {
  const s = game(); s.groups = ['solids', 'stripes']; assert.equal(legalTarget(s, 8), false); assert.equal(legalTarget(s, 9), false);
  s.balls.filter(b => b.id > 0 && b.id < 8).forEach(b => { b.pocketed = true; });
  assert.equal(remaining(s, 0).length, 0); assert.equal(legalTarget(s, 8), true);
});
test('clean eight wins, early eight and eight plus scratch lose', () => {
  for (const [eligible, pocketed, winner] of [[true, [8], 0], [false, [8], 1], [true, [8, 0], 1], [false, [7, 8], 1]]) {
    const s = outcome(game(), { first: eligible ? 8 : 7, pocketed, eligible });
    assert.equal(s.phase, 'finished'); assert.equal(s.result.winner, winner);
  }
});
test('eight on the break is respotted instead of ending the round', () => {
  const s = outcome(game(), { first: 1, pocketed: [8], breaking: true });
  assert.equal(s.phase, 'aiming'); assert.equal(s.balls[8].pocketed, false);
  assert.ok(s.balls.every(b => b.id === 8 || b.pocketed || Math.hypot(b.x - s.balls[8].x, b.y - s.balls[8].y) > RADIUS * 2));
});
test('practice keeps the same player, all groups are targets, and fouls can be recovered', () => {
  const s = game(true); assert.equal(legalTarget(s, 9), true); outcome(s, { first: null });
  assert.equal(s.turn, 0); assert.equal(s.ballInHand, true); assert.equal(remaining(s, 0).length, 14);
  assert.ok(action(s, 'place', { x: 200, y: 150 }));
});
test('rematch resets rack, fouls and groups and keeps avatars and players', () => {
  const s = game(); s.players[0].avatar = { hat: 'chef' }; outcome(s, { pocketed: [8] }); const revision = s.revision;
  assert.ok(action(s, 'start', {}, 11)); assert.equal(s.round, 2); assert.equal(s.revision, revision + 1);
  assert.deepEqual(s.balls, rack()); assert.deepEqual(s.groups, [null, null]); assert.deepEqual(s.players[0].avatar, { hat: 'chef' });
});
test('aim guide stops at first ball or cushion, including axis-aligned directions', () => {
  const s = game(); const right = aimGuide(s, 0); assert.equal(right.target.id, 1); assert.equal(right.x, 690 - 2 * RADIUS);
  const up = aimGuide(s, -Math.PI / 2); assert.equal(up.target, null); assert.ok(Math.abs(up.y - RADIUS) < .001);
});
test('a disconnected opponent prevents shots until their seat is occupied', () => {
  const s = game(); s.players[1].id = null; assert.equal(action(s, 'shoot', { angle: 0, power: 1 }), false);
  s.players[1].id = 33; assert.ok(action(s, 'shoot', { angle: 0, power: 1 }));
});
