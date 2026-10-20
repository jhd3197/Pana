import test from 'node:test';
import assert from 'node:assert/strict';
import { Trifulca, cleanInput, INTRO, AFTER, STAKE, START_DOLITAS, titlesFor } from '../public/rules.js';
import { T, edge, arenaOf } from '../public/fight-rules.js';

// A night between Ana (1) and Bruno (2) with no bots, already at the bell.
function fight({ seconds = 60, arena = 'toldo' } = {}) {
  const game = new Trifulca(7);
  game.configure({ seconds, arena, rivales: 0 });
  game.addPlayer(1, 'Ana'); game.addPlayer(2, 'Bruno');
  game.start();
  game.update(INTRO + .05, new Map());
  assert.equal(game.phase, 'fight');
  return game;
}
// Inputs keep their counters between ticks, like a real client.
function pad() {
  const state = { x: 0, z: 0, g: false, b: false, gp: 0, e: 0, a: 0, t: 0 };
  return { state, tap(k) { state[k] = (state[k] + 1) % 256; return state; }, get: () => cleanInput(state) };
}
function run(game, seconds, inputs) {
  for (let t = 0; t < seconds; t += .05) game.update(.05, new Map(Object.entries(inputs).map(([id, p]) => [Number(id), p.get()])));
}
const face = (game, gap = 1.1) => {
  const [a, b] = game.bodies; Object.assign(a, { x: -gap / 2, z: 0, h: Math.PI / 2 }); Object.assign(b, { x: gap / 2, z: 0, h: -Math.PI / 2 });
  return [a, b];
};

test('room choices are validated and a solo night gets a bot ladder', () => {
  const game = new Trifulca(3);
  assert.equal(game.configure({ peleas: 7 }), false);
  assert(game.configure({ peleas: 5, arena: 'mercado' }));
  game.addPlayer(1, 'Ana'); game.start();
  assert.equal(game.players.length, 4);
  assert.equal(game.phase, 'intro');
  assert.equal(game.bodies.length, 2);
  assert.equal(game.configure({ peleas: 8 }), false, 'options lock once the night starts');
});

test('a tap is a jab, a hold is a trompón with a visible windup', () => {
  const game = fight(), [a] = face(game);
  const ana = pad(), bruno = pad();
  ana.tap('gp'); run(game, .1, { 1: ana, 2: bruno });
  assert.equal(a.act, 'jab');
  run(game, .6, { 1: ana, 2: bruno });
  ana.state.g = true; ana.tap('gp'); run(game, .3, { 1: ana, 2: bruno });
  assert.equal(a.act, 'wind', 'held golpe winds up first');
  run(game, T.wind, { 1: ana, 2: bruno });
  assert.notEqual(a.act, 'wind');
});

test('a clean jab fills mareo and pushes; blocking takes only chip', () => {
  const game = fight(), [, b] = face(game);
  const ana = pad(), bruno = pad();
  ana.tap('gp'); run(game, .4, { 1: ana, 2: bruno });
  assert.ok(b.mareo >= T.jab.mareo - 1, `mareo ${b.mareo}`);
  assert.ok(b.x > .6, 'the jab pushes back');
  const before = b.mareo; face(game); b.lastHit = 0;
  bruno.state.b = true; run(game, .1, { 1: ana, 2: bruno });
  assert.equal(b.act, 'block');
  ana.tap('gp'); run(game, .4, { 1: ana, 2: bruno });
  assert.ok(b.mareo - before <= T.chip.jab + .01, 'blocked jab is chip damage');
  assert.ok(game.events.some(e => e.type === 'block'));
});

test('a jab beats a trompón still winding up', () => {
  const game = fight(), [a, b] = face(game);
  const ana = pad(), bruno = pad();
  bruno.state.g = true; bruno.tap('gp'); run(game, .25, { 1: ana, 2: bruno });
  assert.equal(b.act, 'wind');
  ana.tap('gp'); run(game, .2, { 1: ana, 2: bruno });
  assert.equal(b.act, 'stun', 'the windup is interrupted');
  assert.ok(game.events.some(e => e.type === 'hit' && e.counter));
  void a;
});

test('a dodge beats the trompón and leaves the puncher open', () => {
  const game = fight(), [a] = face(game);
  const ana = pad(), bruno = pad();
  ana.state.g = true; ana.tap('gp'); run(game, .2 + T.wind - .1, { 1: ana, 2: bruno });
  bruno.state.z = 1; bruno.tap('e'); run(game, .3, { 1: ana, 2: bruno });
  assert.equal(game.bodies[1].mareo, 0);
  assert.ok(game.events.some(e => e.type === 'dodged'));
  assert.equal(a.act, 'open');
});

test('a grab beats blocking and shoves toward the crowd', () => {
  const game = fight({ arena: 'calle' }), [, b] = face(game);
  const ana = pad(), bruno = pad();
  bruno.state.b = true; run(game, .1, { 1: ana, 2: bruno });
  ana.tap('a'); run(game, .4, { 1: ana, 2: bruno });
  assert.ok(game.events.some(e => e.type === 'shove' && e.broke));
  assert.ok(b.vx > 0 || b.x > 1, 'shoved away');
});

test('full mareo makes you dizzy, a clean hit then is a caída and the count runs', () => {
  const game = fight(), [, b] = face(game);
  const ana = pad(), bruno = pad();
  b.mareo = 95; ana.tap('gp'); run(game, .3, { 1: ana, 2: bruno });
  assert.equal(b.act, 'dizzy');
  face(game); ana.tap('gp'); run(game, .3, { 1: ana, 2: bruno });
  assert.equal(b.act, 'down'); assert.equal(b.caidas, 1);
  // Mash to get up before ten.
  for (let i = 0; i < 9; i++) { bruno.tap('gp'); run(game, .1, { 1: ana, 2: bruno }); }
  assert.equal(b.act, 'rise');
  assert.ok(game.events.some(e => e.type === 'rise'));
});

test('the ten count is a knockout; the winner stays and the loser queues', () => {
  const game = fight();
  game.addPlayer(3, 'Cata');
  const [, b] = face(game);
  b.mareo = 100; b.act = 'dizzy'; b.at = 0;
  const ana = pad(), bruno = pad(); ana.tap('gp');
  run(game, 10, { 1: ana, 2: bruno });
  assert.equal(game.phase, 'after');
  assert.equal(game.result.how, 'cuenta');
  assert.equal(game.result.winner, 1);
  assert.equal(game.queue.at(-1), 2);
  run(game, AFTER + INTRO, { 1: ana, 2: bruno });
  assert.deepEqual(game.bodies.map(x => x.id), [1, 3], 'ganador se queda against the next in line');
});

test('three caídas end it at once', () => {
  const game = fight(), [, b] = face(game);
  b.caidas = 2; b.act = 'dizzy'; b.at = 0;
  const ana = pad(); ana.tap('gp');
  run(game, .5, { 1: ana, 2: pad() });
  assert.equal(game.result?.how, 'ko');
});

test('the bell reads the scorecard', () => {
  const game = fight({ seconds: 45 });
  const [a] = game.bodies; a.score.trompones = 3;
  run(game, 46, {});
  assert.equal(game.result.how, 'puntos');
  assert.equal(game.result.winner, 1);
  assert.ok(game.events.some(e => e.type === 'campana'));
});

test('the crowd shoves a fighter back in and gets dolitas; neighbours do it otherwise', () => {
  const game = fight({ arena: 'calle' });
  game.addPlayer(3, 'Cata');
  const cata = game.player(3), [, b] = face(game);
  Object.assign(b, { x: 4.6, z: 0 });
  cata.angle = Math.PI / 2;   // standing at +x, right by the edge
  const c = pad(); c.tap('gp');
  run(game, .1, { 3: c });
  assert.ok(b.vx < 0, 'pushed back toward the middle');
  assert.equal(cata.dolitas, START_DOLITAS + 2);
  assert.equal(cata.stats.shoves, 1);
  // Nobody near: a neighbour shoves after half a second.
  Object.assign(b, { x: -4.8, z: 0, vx: 0, act: 'idle' }); cata.angle = Math.PI / 2;
  run(game, .8, {});
  assert.ok(game.events.some(e => e.type === 'vecino'));
  assert.ok(edge(arenaOf('calle'), b.x, b.z).out < 1.2);
});

test('bets pay on the winner, upsets pay more, ¡cálmate! ends the fight without a caída', () => {
  const game = new Trifulca(9); game.configure({ rivales: 0, arena: 'toldo' });
  for (const [id, n] of [[1, 'Ana'], [2, 'Bruno'], [3, 'Cata']]) game.addPlayer(id, n);
  game.start();
  const watcher = game.players.find(p => !game.fighting(p.id));
  assert(game.bet(watcher.id, 'red'));
  assert.equal(watcher.dolitas, START_DOLITAS - STAKE);
  assert.equal(game.bet(game.bodies[0].id, 'blue'), false, 'fighters do not bet');
  game.update(INTRO + .05);
  const [red, blue] = game.bodies; face(game);
  blue.mareo = 80; Object.assign(red, { x: 1.4 }); Object.assign(blue, { x: 2.5 });
  watcher.angle = Math.atan2(blue.x, blue.z);
  const w = pad(); w.tap('a');
  run(game, .1, { [watcher.id]: w });
  assert.equal(game.result.how, 'calma');
  assert.equal(game.result.winner, red.id);
  assert.equal(blue.caidas, 0);
  assert.equal(watcher.dolitas, START_DOLITAS - STAKE + STAKE * 2 + 4);
});

test('mano de caballero pays both; skipping it is noticed', () => {
  const game = fight();
  const [, b] = game.bodies; b.act = 'dizzy'; b.caidas = 2; face(game);
  const ana = pad(), bruno = pad(); ana.tap('gp'); run(game, .4, { 1: ana, 2: bruno });
  assert.equal(game.phase, 'after');
  const before = game.player(2).dolitas;
  ana.tap('a'); bruno.tap('a'); run(game, .1, { 1: ana, 2: bruno });
  assert.equal(game.player(2).dolitas, before + 3);
  assert(game.events.some(e => e.type === 'mano'));
});

test('the night ends after its fights with the richest pana and titles', () => {
  const game = new Trifulca(4); game.configure({ peleas: 5, seconds: 45 });
  game.addPlayer(1, 'Ana'); game.start();
  for (let i = 0; i < 5 * (INTRO + 45 + AFTER) / .05 + 100 && game.phase !== 'finished'; i++) game.update(.05, new Map());
  assert.equal(game.phase, 'finished');
  assert.equal(game.fightNo, 5);
  assert.ok(game.titles.length > 0);
  assert.ok(game.players.some(p => p.id === game.winner));
});

test('bots fight each other to real results', () => {
  const game = new Trifulca(12); game.configure({ peleas: 5, nivel: 2 });
  game.addPlayer(1, 'Ana'); game.start();
  let hits = 0;
  for (let i = 0; i < 3000 && game.phase !== 'finished'; i++) { game.update(.05, new Map()); }
  hits = game.players.reduce((n, p) => n + p.stats.trompones, 0);
  assert.ok(hits > 0, 'bots throw trompones');
  assert.ok(game.players.some(p => p.stats.wins > 0));
});

test('a restore drops panas who left; a fighter who leaves loses', () => {
  const game = fight();
  game.addPlayer(3, 'Cata');
  const copy = Trifulca.restore(game.snapshot(), new Map([[1, {}], [3, {}]]));
  assert.equal(copy.phase, 'after');
  assert.equal(copy.result.how, 'abandono');
  assert.equal(copy.result.winner, 1);
  assert.equal(copy.players.some(p => p.id === 2), false);
});

test('junk input is a released stick and no presses', () => {
  assert.deepEqual(cleanInput({ x: 9, z: 'up', g: 1, gp: 300, e: -1 }), { x: 1, z: 0, g: false, b: false, gp: 44, e: 255, a: 0, t: 0 });
  assert.equal(titlesFor([]).length, 0);
});
