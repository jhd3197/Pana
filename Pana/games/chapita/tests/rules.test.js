import test from 'node:test';
import assert from 'node:assert/strict';
import { ChapitaGame, SEATS, STRIKES, teamSeats, roleOf, DERBY_PITCHES } from '../public/rules.js';
import { PITCHES, FIELD, pitchPoint, pitchTarget, arrivalRow, hitVelocity, traceHit } from '../public/field.js';

const act = (game, id, action, seq, extra = {}) => game.accept(id, { action, seq, revision: game.revision, ...extra }, 1);
const run = (game, seconds) => { for (let t = 0; t < seconds; t += .05) game.advance(.05); };
const until = (game, check, limit = 600) => { for (let t = 0; t < limit && !check(game); t += .05) game.advance(.05); return check(game); };
// A started game where the pana (id 1, seat 0) pitches or bats as asked.
function setup(role, seed = 9) {
  const game = new ChapitaGame(seed); game.addPlayer(1, 'Ana'); game.options.houseRules = 'ninguna';
  game.start();
  if (role === 'pitcher') { game.half = 1; game.startHalf(); game.armPitch(); }
  return game;
}

test('two teams of four alternate seats, so the first two panas face each other', () => {
  const game = new ChapitaGame(1); game.addPlayer(1, 'Ana'); game.addPlayer(2, 'Bruno');
  assert.deepEqual(teamSeats(0), [0, 2, 4, 6]);
  assert.notEqual(game.players[0].team, game.players[1].team);
  assert(act(game, 2, 'switch', 1), 'a pana can change sides in the lobby');
  assert.equal(game.players.find(p => p.id === 2).team, 0);
  assert.equal(game.players.filter(p => p.id !== null).length, 2);
  assert.equal(game.players.length, SEATS);
});

test('room options are host-only and validated', () => {
  const game = new ChapitaGame(5); game.addPlayer(1, 'Ana'); game.addPlayer(2, 'Bruno');
  const configure = (id, options, seq) => game.accept(id, { action: 'options', options, seq, revision: game.revision }, 1);
  assert.equal(configure(2, { innings: 5 }, 1), false);
  assert.equal(configure(1, { innings: 4 }, 1), false);
  assert(configure(1, { innings: 5, mode: 'derby' }, 2));
  assert.deepEqual(ChapitaGame.restore(game.snapshot(), new Map()).options, game.options);
});

test('the pitch path starts in the hand, breaks late and lands on its target', () => {
  const base = { row: 1, col: 1, side: 1, miss: [0, 0], wobble: { a: 0, f: 3, ph: 0, tilt: 0 } };
  const drop = { ...base, kind: 'cae' }, curve = { ...base, kind: 'curva' }, float = { ...base, kind: 'planea' };
  assert.equal(pitchPoint(drop, 0).d, 10.5);
  const end = pitchPoint(drop, 1), target = pitchTarget(drop);
  assert(Math.abs(end.y - target.y) < 1e-9 && Math.abs(end.x - target.x) < 1e-9);
  assert(pitchPoint(drop, .5).y > target.y + .3, 'a drop still looks normal halfway');
  assert.equal(arrivalRow(target), 'bajo', 'a drop thrown to the middle arrives low');
  assert(pitchTarget(curve).x > .4, 'the curve breaks to the chosen side');
  assert.equal(arrivalRow(pitchTarget(float)), 'alto', 'a float rises at the end');
  assert(PITCHES.planea.time > PITCHES.cae.time);
});

test('where the chapita lands is the hit', () => {
  const at = (v, launch, dir) => traceHit({ from: { x: 0, y: 1, d: .3 }, vel: hitVelocity(v, launch, dir) }, []).kind;
  assert.equal(at(6, .2, 0), 'short', 'ni a la acera llegó');
  assert.equal(at(13, .3, 0), 'sencillo');
  assert.equal(at(24, .7, 0), 'jonron');
  assert.equal(at(14, .4, .9), 'foul');
  const car = (FIELD.car.x0 + FIELD.car.x1) / 2, carD = (FIELD.car.d0 + FIELD.car.d1) / 2;
  const kinds = new Set();
  for (let v = 12; v < 22; v += .25) kinds.add(at(v, .25, Math.atan2(car, carD)));
  assert(kinds.has('car'), 'a low liner to the parked car is a double');
  const fielded = traceHit({ from: { x: 0, y: 1, d: .3 }, vel: hitVelocity(16, .3, Math.atan2(-2.4, 15.4)) });
  assert.equal(fielded.chance?.fielder, 0, 'a liner at the sidewalk fielder is a chance to catch');
});

test('a pana pitches in secret: only the pitcher throws, and only once per pitch', () => {
  const game = setup('pitcher');
  assert.equal(game.pitcher, 0); assert.equal(roleOf(game, 0), 'pitcher');
  const pitch = { kind: 'curva', row: 0, col: 2, side: -1, cap: 'doblada' };
  assert.equal(game.accept(2, { action: 'throw', pitch, seq: 1 }, 1), false);
  assert.equal(game.pitch, null, 'nothing about the pitch is in the snapshot before the throw');
  assert(game.accept(1, { action: 'throw', pitch, seq: 1 }, 1));
  assert.equal(game.phase, 'flight'); assert.equal(game.pitch.kind, 'curva'); assert.equal(game.pitch.cap, 'doblada');
  assert.equal(game.accept(1, { action: 'throw', pitch, seq: 2 }, 1), false);
});

test('a pana who never throws gets a pitch thrown for them', () => {
  const game = setup('pitcher');
  assert(until(game, g => g.phase === 'flight', 30));
  assert(game.clock >= 15);
});

test('the batter reads the cap: timing and height decide strike, foul or contact', () => {
  const game = setup('batter'); game.pitcher = 1;
  assert.equal(game.batter, 0); assert.equal(roleOf(game, 0), 'batter');
  game.throw({ kind: 'planea', row: 1, col: 1, side: 1, cap: 'plana' });
  const pitch = game.pitch;
  assert(act(game, 1, 'swing', 1, { pitch: pitch.id, height: pitch.arrives, t: pitch.time }));
  assert.equal(game.phase, 'hit', 'a perfect read makes contact');
  assert(game.hit.q > .99);
  until(game, g => g.phase === 'pitch');
  game.newBatter(0);
  game.throw({ kind: 'cae', row: 1, col: 1, side: 1, cap: 'plana' });
  const strikes = game.strikes;
  assert(act(game, 1, 'swing', 2, { pitch: game.pitch.id, height: 'alto', t: game.pitch.time }));
  assert.equal(game.strikes, strikes + 1, 'swinging high at a drop misses');
  assert.equal(game.result.text, '¡Me agarró fuera de base!');
});

test('three strikes is an out and the pitcher gets the strikeout', () => {
  const game = setup('batter'); game.pitcher = 1;
  for (let i = 0; i < STRIKES; i++) {
    until(game, g => g.phase === 'pitch');
    game.throw({ kind: 'planea', row: 1, col: 1, side: 1, cap: 'plana' });
    act(game, 1, 'swing', i + 1, { pitch: game.pitch.id, height: 'medio', t: game.pitch.time + 1 });
  }
  assert.equal(game.outs, 1); assert.equal(game.players[1].stats.k, 1);
  assert.deepEqual(game.players[0].atBats, ['k']);
  assert.equal(game.lineup[0], 1, 'the next batter steps up');
});

test('virtual bases: runners move on their own and score', () => {
  const game = setup('batter');
  game.bases = [2, null, 4]; game.batter = 6; game.moveRunners(2);
  assert.deepEqual(game.bases, [null, 6, 2]); assert.equal(game.teams[0].runs, 1);
  game.batter = 0; game.moveRunners(4);
  assert.deepEqual(game.bases, [null, null, null]); assert.equal(game.teams[0].runs, 4);
  game.bases = [2, 4, 6]; game.batter = 0; game.moveRunners(0, true);
  assert.deepEqual(game.bases, [0, 2, 4]); assert.equal(game.teams[0].runs, 5, 'a walk with the bases loaded forces a run');
});

test('a human fielder catches on the timing circle; a bad miss is a chapazo', () => {
  const make = () => {
    const game = setup('batter', 3); game.half = 1; game.startHalf(); game.armPitch();
    game.fielders = [0, 2, 4];
    game.throw({ kind: 'planea', row: 1, col: 1, side: 1, cap: 'plana' });
    const hit = { id: game.pitch.id, from: { x: 0, y: 1, d: .3 }, vel: hitVelocity(16, .25, Math.atan2(-2.4, 15.4)), at: game.clock, q: .8 };
    const trace = traceHit(hit, [{ x: -2.4, d: 15.4 }]);
    Object.assign(hit, { end: { kind: trace.kind, t: trace.t, point: trace.point }, chance: { ...trace.chance, seat: 0 }, caught: null, chapazo: false });
    game.hit = hit; game.phase = 'hit';
    return game;
  };
  const good = make(), t = good.hit.chance.t;
  assert(act(good, 1, 'catch', 1, { hit: good.hit.id, t }));
  assert.equal(good.hit.caught, true);
  until(good, g => g.phase === 'result');
  assert.equal(good.result.kind, 'caught'); assert.equal(good.outs, 1); assert.equal(good.players[0].stats.catches, 1);
  const bad = make();
  assert(act(bad, 1, 'catch', 1, { hit: bad.hit.id, t: bad.hit.chance.t + .3 }));
  assert.equal(bad.hit.chapazo, true);
  until(bad, g => g.phase === 'result');
  assert.equal(bad.result.kind, 'chapazo'); assert.equal(bad.players[0].tuyuyo, true);
});

test('a window shot brings out the señora: the next pitch waits five seconds', () => {
  const game = setup('batter'); game.pitcher = 1;
  game.throw({ kind: 'planea', row: 1, col: 1, side: 1, cap: 'plana' });
  game.hit = { id: 1, end: { kind: 'window', t: 1 }, chance: null, caught: null, at: game.clock }; game.phase = 'hit';
  until(game, g => g.phase === 'pitch');
  assert.equal(game.hold, 'senora');
  assert.equal(game.result, null);
  assert.equal(game.throw({ kind: 'cae', row: 1, col: 1, side: 1, cap: 'plana' }), false, 'no pitch while she yells');
  run(game, 5.1);
  assert.equal(game.hold, null);
});

test('cuarto bate and Willy Mays change the at-bat', () => {
  const game = setup('batter');
  game.lineup[0] = 3; game.newBatter(6);
  assert.equal(game.event.kind, 'cuarto');
  game.pitch = { kind: 'planea', side: 1, target: { x: 0, y: 1 } };
  const wide = game.window(6), normal = game.window(0);
  assert(wide > normal, 'the fourth bat gets a bigger window');
  game.players[2].atBats = ['k', 'k']; game.newBatter(2);
  assert.equal(game.willy, true); assert.equal(game.event.kind, 'willy');
});

test('a full bot game ends after the innings with a winner or a tie and titles', () => {
  for (const seed of [1, 2, 3]) {
    const game = new ChapitaGame(seed); game.start();
    assert(until(game, g => g.phase === 'finished', 3600), 'the game ends');
    assert(game.inning >= game.options.innings);
    const [away, home] = game.teams.map(t => t.runs);
    assert.equal(game.winner, away === home ? null : home > away ? 1 : 0);
    assert(game.titles.length > 0);
  }
});

test('derby: every pana gets ten pitches and the most jonrones wins', () => {
  const game = new ChapitaGame(4); game.addPlayer(1, 'Ana'); game.addPlayer(2, 'Bruno'); game.options.mode = 'derby';
  game.start();
  assert.deepEqual(game.derby.order, [0, 1]); assert.equal(game.pitcher, null);
  const seen = [];
  while (game.phase !== 'finished') {
    if (game.phase === 'flight') { const p = game.pitch; seen.push(game.batter); game.swingAt({ height: p.arrives || 'medio', t: p.time + .02 }); }
    game.advance(.05);
  }
  assert.equal(seen.length, DERBY_PITCHES * 2);
  const hr = [0, 1].map(s => game.players[s].stats.hr);
  assert.equal(game.winner, hr[0] === hr[1] ? null : hr[0] > hr[1] ? 0 : 1);
});

test('a restored snapshot plays on the same way and drops departed panas to bots', () => {
  const game = new ChapitaGame(11); game.addPlayer(1, 'Ana'); game.start();
  run(game, 20);
  const copy = ChapitaGame.restore(game.snapshot(), new Map([[1, {}]]));
  run(game, 30); run(copy, 30);
  assert.equal(copy.revision, game.revision); assert.deepEqual(copy.teams, game.teams);
  const gone = ChapitaGame.restore(game.snapshot(), new Map());
  assert.equal(gone.players[0].id, null);
});
