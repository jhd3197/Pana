import test from 'node:test';
import assert from 'node:assert/strict';
import { createPitch, throwBall, stepPitch, moving, landing, aimAt, measure, copy, STEP } from '/engine/bolas-criollas.js';
import { createGame, acceptAction, shoot, step, nextHand } from '../public/rules.js';

function settle(pitch) { for (let n = 0; n < 2000 && moving(pitch); n++) stepPitch(pitch); assert.equal(moving(pitch), false); }
function ball(pitch, owner, x, z) { pitch.balls.push({ id: pitch.nextId++, owner, x, z, vx: 0, vz: 0, radius: .25, out: false }); }
function start() { const g = createGame(); g.players[0].id = 10; g.players[1].id = 20; assert(acceptAction(g, 10, { action: 'start', revision: g.revision }, 10)); return g; }
test('an unobstructed arrime stops at the guide point at fixed steps', () => {
  const pitch = createPitch(-4, -8), shot = { angle: .12, power: .55, mode: 'arrime' };
  const b = throwBall(pitch, 0, shot); settle(pitch); const target = landing(shot);
  assert(Math.hypot(b.x - target.x, b.z - target.z) < .001); assert(!b.out);
});
test('ball contacts transfer momentum and can move the mingo', () => {
  const pitch = createPitch(0, -5), b = throwBall(pitch, 0, { ...aimAt(0, -5), mode: 'boche' });
  settle(pitch); assert(pitch.balls[0].z < -5.4); assert(b.z < 0);
});
test('out balls stop and do not score; a mingo out voids measurement', () => {
  const pitch = createPitch(); const b = throwBall(pitch, 0, { angle: .6, power: 1 }); settle(pitch);
  assert(b.out); assert.equal(b.vx, 0); assert.equal(measure(pitch).team, null);
  ball(pitch, 0, .5, -6); pitch.balls[0].out = true; assert.equal(measure(pitch).points, 0);
});
test('only balls closer than the best opponent score; near ties score nothing', () => {
  const pitch = createPitch(); ball(pitch, 0, .6, -6); ball(pitch, 2, .9, -6); ball(pitch, 1, 1.4, -6); ball(pitch, 0, 2, -6);
  assert.deepEqual(measure(pitch), { team: 0, points: 2, ids: [1, 2] });
  pitch.balls[3].x = .603; assert.equal(measure(pitch).points, 0);
});
test('reject wrong player, stale/duplicate turns and invalid shot values', () => {
  const g = start(), revision = g.revision, data = { action: 'shoot', revision, angle: 0, power: .6 };
  assert.equal(acceptAction(g, 20, data, 10), false);
  for (const bad of [{ power: NaN }, { angle: Infinity }, { power: 4 }, { angle: 1 }, { mode: 'air' }]) assert.equal(acceptAction(g, 10, { ...data, ...bad }, 10), false);
  assert(acceptAction(g, 10, data, 10)); assert.equal(acceptAction(g, 10, data, 10), false); assert.equal(g.remaining[0], 3);
});
test('the losing team plays next and teammates alternate', () => {
  const g = start(); shoot(g, { angle: 0, power: .1 });
  while (g.phase === 'rolling') step(g); assert.equal(g.turn, 1);
  shoot(g, aimAt(g.pitch.balls[0].x, g.pitch.balls[0].z + .8));
  while (g.phase === 'rolling') step(g); assert.equal(g.turn, 2);
});
test('restoring a rolling snapshot produces the same completed throw', () => {
  const g = start(); shoot(g, aimAt(g.pitch.balls[0].x, g.pitch.balls[0].z));
  for (let i = 0; i < 120; i++) step(g); const restored = copy(g);
  while (g.phase === 'rolling') { step(g); step(restored); } assert.deepEqual(g, restored);
});
test('a complete bot match terminates, honors per-player ammunition and can rematch', () => {
  const g = createGame(); nextHand(g); let steps = 0;
  while (g.phase !== 'finished' && steps++ < 120 * 1800) {
    if (g.phase === 'hand') nextHand(g); else step(g);
    assert(g.remaining.every(n => n >= 0 && n <= 4));
  }
  assert.equal(g.phase, 'finished'); assert(g.scores.some(s => s >= 12));
  const revision = g.revision; assert(acceptAction(g, 9, { action: 'start', revision }, 9));
  assert.deepEqual(g.scores, [0, 0]); assert.equal(g.hand, 1); assert(g.revision > revision);
});
test('mingo out closes a hand without awarding points', () => {
  const g = start(); shoot(g, { angle: 0, power: .1 }); g.pitch.balls[0].out = true;
  while (g.phase === 'rolling') step(g); assert.equal(g.phase, 'hand'); assert.equal(g.result.void, true); assert.deepEqual(g.scores, [0, 0]);
});
test('fixed physics is independent of cosmetic randomness', () => {
  const a = createPitch(), b = copy(a), shot = { angle: .04, power: .71, mode: 'boche' };
  throwBall(a, 1, shot); throwBall(b, 1, shot);
  for (let t = 0; t < 8; t += STEP) { stepPitch(a); Math.random(); stepPitch(b); }
  assert.deepEqual(a, b);
});

test('the host picks the place and the difficulty; both survive the next game', async () => {
  const g = createGame(); g.players[0].id = 10; g.players[1].id = 20;
  assert.equal(acceptAction(g, 20, { action: 'map', mapId: 'hato', revision: g.revision }, 10), false);
  assert.equal(acceptAction(g, 10, { action: 'map', mapId: 'luna', revision: g.revision }, 10), false);
  assert(acceptAction(g, 10, { action: 'map', mapId: 'estadio', revision: g.revision }, 10), 'the stadium is a court venue');
  assert(acceptAction(g, 10, { action: 'map', mapId: 'hato', revision: g.revision }, 10));
  assert(acceptAction(g, 10, { action: 'difficulty', difficulty: 'experto', revision: g.revision }, 10));
  assert(acceptAction(g, 10, { action: 'start', revision: g.revision }, 10));
  assert.equal(g.mapId, 'hato'); assert.equal(g.difficulty, 'experto');
  assert.equal(acceptAction(g, 10, { action: 'difficulty', difficulty: 'facil', revision: g.revision }, 10), false, 'not mid-hand');
});
test('rival bots arrime closer on harder settings; your own team keeps Normal', async () => {
  const { botThrow, BOT_ERROR } = await import('../public/rules.js');
  const { throwBall: put } = await import('/engine/bolas-criollas.js');
  function mean(difficulty, team) {
    let sum = 0;
    for (let n = 0; n < 40; n++) {
      const g = createGame(); g.players[0].id = 10; g.difficulty = difficulty; g.turn = team; g.shots = n; g.hand = n % 5; g.phase = 'aiming';
      g.pitch = createPitch(Math.sin(n) * 1.2, -6); const b = put(g.pitch, team, botThrow(g)); settle(g.pitch);
      sum += Math.hypot(b.x - g.pitch.balls[0].x, b.z - g.pitch.balls[0].z);
    }
    return sum / 40;
  }
  assert(mean('experto', 1) < mean('normal', 1) && mean('normal', 1) < mean('facil', 1));
  assert(Math.abs(mean('experto', 0) - mean('normal', 0)) < 1e-9, 'a human team plays with Normal bots');
  assert.equal(Object.keys(BOT_ERROR).length, 4);
});
test('a sharp bot plays a boche at a rival ball kissing the mingo', async () => {
  const { botThrow } = await import('../public/rules.js');
  const g = createGame(); g.players[0].id = 10; g.difficulty = 'experto'; g.turn = 1; g.phase = 'aiming';
  g.pitch = createPitch(0, -6); ball(g.pitch, 0, .1, -5.6);
  assert.equal(botThrow(g).mode, 'boche');
  g.difficulty = 'facil'; assert.equal(botThrow(g).mode, 'arrime');
});
test('the Fácil preview matches the real throw, collisions included', async () => {
  const { previewThrow } = await import('/engine/bolas-criollas.js');
  const pitch = createPitch(0, -5), shot = { ...aimAt(0, -5), mode: 'boche' };
  const preview = previewThrow(pitch, 0, shot); const b = throwBall(pitch, 0, shot); settle(pitch);
  const end = preview.path.at(-1); assert(Math.hypot(end.x - b.x, end.z - b.z) < 1e-9);
  const mingo = preview.moved.find(m => m.id === 0); assert(Math.hypot(mingo.x - pitch.balls[0].x, mingo.z - pitch.balls[0].z) < 1e-9);
});
