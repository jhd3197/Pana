import test from 'node:test';
import assert from 'node:assert/strict';
import { createPitch, throwBall, stepPitch, moving, landing, aimAt, measure, copy, STEP } from '/engine/play/bolas-criollas.js';
import { createGame, acceptAction, shoot, step, nextHand } from '../public/rules.js';
import { FLIP, ORDER_HOLD } from '../../../engine/play/quien-empieza-rules.js';

function settle(pitch) { for (let n = 0; n < 2000 && moving(pitch); n++) stepPitch(pitch); assert.equal(moving(pitch), false); }
function ball(pitch, owner, x, z) { pitch.balls.push({ id: pitch.nextId++, owner, x, z, vx: 0, vz: 0, radius: .25, out: false }); }
// Skips the coin: with the table's order the Rojos throw the mingo.
function start() { const g = createGame(); g.opener = 'anfitrion'; g.players[0].id = 10; g.players[1].id = 20; assert(acceptAction(g, 10, { action: 'start', revision: g.revision }, 10)); return g; }
const flip = g => { for (let i = 0; i < 120 * 10 && g.phase === 'opening'; i++) step(g); };
test('six seats rotate across both teams and short hands allocate two balls each', () => {
  const g = createGame(); g.players.forEach((p, i) => p.id = i + 1);
  const action = (id, options) => acceptAction(g, id, { action: 'options', options, revision: g.revision }, 1);
  assert.equal(action(2, { ballsPerPlayer: 2 }), false);
  assert.equal(action(1, { ballsPerPlayer: 3 }), false);
  assert(action(1, { ballsPerPlayer: 2 })); nextHand(g);
  assert.deepEqual(g.remaining, Array(6).fill(2));
  const visited = new Set();
  for (let n = 0; n < 12; n++) {
    assert.equal(g.phase, 'aiming'); visited.add(g.turn);
    assert(shoot(g, { angle: 0, power: .1 })); while (g.phase === 'rolling') step(g);
  }
  assert.equal(visited.size, 6); assert.equal(g.phase, 'hand');
  assert.deepEqual(g.remaining, Array(6).fill(0));
  assert.equal(action(1, { ballsPerPlayer: 4 }), false);
});
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
  assert.equal(g.phase, 'opening'); flip(g);
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
  const { throwBall: put } = await import('/engine/play/bolas-criollas.js');
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
  const { previewThrow } = await import('/engine/play/bolas-criollas.js');
  const pitch = createPitch(0, -5), shot = { ...aimAt(0, -5), mode: 'boche' };
  const preview = previewThrow(pitch, 0, shot); const b = throwBall(pitch, 0, shot); settle(pitch);
  const end = preview.path.at(-1); assert(Math.hypot(end.x - b.x, end.z - b.z) < 1e-9);
  const mingo = preview.moved.find(m => m.id === 0); assert(Math.hypot(mingo.x - pitch.balls[0].x, mingo.z - pitch.balls[0].z) < 1e-9);
});

test('team roster authorizes self swaps and host arrangements only before a hand', () => {
 const g=createGame();g.players[0].id=1;g.players[1].id=2;g.players[2].id=3;
 const swap=(actor,from,to,revision=g.revision)=>acceptAction(g,actor,{action:'swap',from,to,revision},1);
 assert.equal(swap(2,0,2),false);assert.equal(swap(2,1,0),true);assert.equal(g.players[0].id,2);
 assert.equal(swap(2,0,3,0),false,'stale revision');assert.equal(swap(1,2,5),true);assert.equal(g.players[5].id,3);
 const order=g.players.map(p=>p.id);assert(acceptAction(g,1,{action:'start',revision:g.revision},1));
 assert.deepEqual(g.players.map(p=>p.id),order);assert.equal(swap(2,0,1),false);
 assert.deepEqual(copy(g).players.map(p=>p.id),order);
});

test('host reset restores the primary map and rule defaults atomically',()=>{
 const g=createGame();g.mapId='hato';g.target=24;g.difficulty='experto';g.ballsPerPlayer=2;
 const action={action:'options',options:{target:12,difficulty:'normal',ballsPerPlayer:4},resetMap:true,revision:0};
 assert.equal(acceptAction(g,2,action,1),false);assert.equal(g.mapId,'hato');
 assert(acceptAction(g,1,action,1));assert.equal(g.mapId,'plaza');assert.equal(g.target,12);assert.equal(g.difficulty,'normal');assert.deepEqual(g.remaining,Array(6).fill(4));assert.equal(g.revision,1);
});

test('a coin decides which team throws the mingo; everyone watches, nobody acts', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const g = createGame(); g.players[0].id = 10;
    assert(acceptAction(g, 10, { action: 'start', revision: g.revision, seed }, 10));
    assert.equal(g.phase, 'opening'); assert.equal(g.opening.flavour, 'moneda');
    assert.equal(acceptAction(g, 10, { action: 'shoot', revision: g.revision, angle: 0, power: .5 }, 10), false, 'no throws while it spins');
    let steps = 0; flip(g); steps = g.opening.t;
    const team = g.opening.coin === 'cara' ? 0 : 1; seen.add(team);
    assert.equal(g.phase, 'aiming'); assert.equal(g.hand, 1);
    assert.equal(g.starter, team); assert.equal(g.turn % 2, team, 'the winning team throws first');
    assert.ok(steps <= FLIP + ORDER_HOLD);
  }
  assert.deepEqual([...seen].sort(), [0, 1]);
});
test('room option: al azar and the table skip the coin; revancha opens with the losing team', () => {
  const g = createGame(); g.players[0].id = 10;
  const set = options => acceptAction(g, 10, { action: 'options', options, revision: g.revision }, 10);
  assert.equal(set({ opener: 'trampa' }), false);
  assert(set({ opener: 'azar' })); assert.equal(g.starter, 0, 'the option never overwrites the starting team');
  assert(acceptAction(g, 10, { action: 'start', revision: g.revision }, 10));
  assert.equal(g.phase, 'aiming', 'no coin'); assert.equal(g.opener, 'azar');
  g.phase = 'lobby'; assert(set({ opener: 'revancha' }));
  g.scores = [12, 3]; g.remaining.fill(0); g.remaining[0] = 1; g.turn = 0; g.phase = 'aiming';
  g.pitch.balls.push({ id: 1, owner: 0, x: g.pitch.balls[0].x + .3, z: g.pitch.balls[0].z, vx: 0, vz: 0, radius: .25, out: false });
  g.remaining[0] = 0; g.phase = 'rolling'; step(g);
  assert.equal(g.phase, 'finished'); assert.equal(g.lastLoser, 1);
  assert(acceptAction(g, 10, { action: 'start', revision: g.revision }, 10));
  assert.equal(g.phase, 'aiming'); assert.equal(g.starter, 1, 'the Verdes lost and throw the mingo');
  const restored = JSON.parse(JSON.stringify(g)); assert.equal(restored.opener, 'revancha');
});

test('an idle pana gets the bot throw after their turn time; local play waits', () => {
  const g = createGame();
  g.players[0] = { id: 7, name: 'Ana', avatar: {} };
  Object.assign(g, { phase: 'aiming', turn: 0, botTime: 0 });
  for (let t = 0; t < 59; t += STEP) step(g);
  assert.equal(g.phase, 'aiming', 'still Ana’s throw');
  for (let t = 0; t < 2 && g.phase === 'aiming'; t += STEP) step(g);
  assert.equal(g.phase, 'rolling', 'the bot threw for her');
  for (const [local, turnSeconds] of [[true, 60], [false, 0]]) {
    const h = createGame(); h.players[0] = { id: 7, name: 'Ana', avatar: {} };
    Object.assign(h, { phase: 'aiming', turn: 0, botTime: 0, local, turnSeconds });
    for (let t = 0; t < 120; t += STEP) step(h);
    assert.equal(h.phase, 'aiming', `local=${local} limit=${turnSeconds}: the table waits`);
  }
});
