import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOptions, cleanOptions, DEFAULT_OPTIONS, OPTION_FIELDS, configuredTileKind, minigamePool, cpuPace, stealMango, awardFinalBonus, rulesSummary } from '../public/options.js';
import { rollDice } from '../public/rules.js';
import { seeded } from '../public/online-rules.js';
import { chinazoSim } from '../public/minigames/chinazo-sim.js';
import { remadaSim, raudalSim, remolinoSim } from '../public/minigames/river-sims.js';
import { createCriollasMini } from '../public/minigames/criollas-sim.js';

test('every lobby choice survives validation; unsupported values cannot enter a checkpoint', () => {
  for (const f of OPTION_FIELDS) for (const [value] of f.choices) assert.equal(cleanOptions({ [f.id]: value })[f.id], value);
  assert.deepEqual(cleanOptions({ rounds: 999, dice: 0, startCoins: -1, cpu: 'evil', stealing: 'false' }), DEFAULT_OPTIONS);
  assert.deepEqual(cleanOptions(null), DEFAULT_OPTIONS);
  assert.equal(applyOptions(DEFAULT_OPTIONS, { dice: 1, rounds: 999 }), null);
  assert.equal(applyOptions(DEFAULT_OPTIONS, { unknown: 6 }), null);
  assert.equal(applyOptions(DEFAULT_OPTIONS, {}), null);
  assert.equal(applyOptions(DEFAULT_OPTIONS, { dice: 1 }).dice, 1);
});

test('one die yields 1–6 and never doubles; two dice retain the existing bonus rule', () => {
  for (const r of [0, .25, .5, .999]) {
    const one = rollDice(() => r, 1), two = rollDice(() => r, 2);
    assert.equal(one.n, one.a); assert.equal(one.b, 0); assert.equal(one.doubles, false);
    assert.equal(two.n, one.n * 2); assert.equal(two.doubles, true);
  }
});

test('surprise choices change actual tile density and preserve special tiles', () => {
  const original = Array.from({ length: 80 }, (_, i) => i === 0 ? 'start' : i % 5 === 3 ? 'event' : i % 6 === 5 ? 'red' : 'blue');
  const counts = ['few', 'normal', 'many'].map(frequency => original.filter((kind, i) => configuredTileKind(i, kind, frequency) === 'event').length);
  assert(counts[0] < counts[1] && counts[1] < counts[2]);
  assert.equal(configuredTileKind(1, 'tree', 'many'), 'tree');
  assert.equal(configuredTileKind(0, 'start', 'few'), 'start');
});

test('calm games exclude movement races; CPU pacing never accelerates a human turn', () => {
  const list = ['caida', 'embuste', 'criollas', 'atrapa', 'coleo'].map(id => ({ id }));
  assert.deepEqual(minigamePool(list, { minigames: 'calm' }).map(m => m.id), ['caida', 'embuste', 'criollas']);
  assert.equal(cpuPace({ cpu: 'fast' }, true), 1);
  assert(cpuPace({ cpu: 'fast' }, false) > cpuPace({ cpu: 'normal' }, false));
  assert(cpuPace({ cpu: 'normal' }, false) > 1, 'bots move faster than a human turn even at Normal');
  assert.equal(cpuPace({ cpu: 'normal' }, true), 1);
});

test('stealing conserves mangos and the toggle prevents all transfers', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({ i, mangos: i, coins: 10 }));
  assert.equal(stealMango(players, players[0], false), null);
  assert.equal(players[0].mangos, 0);
  assert.equal(stealMango(players, players[0], true).i, 5);
  assert.equal(players[0].mangos, 1); assert.equal(players[5].mangos, 4);
  assert.equal(players.reduce((n, p) => n + p.mangos, 0), 15);
});

test('final bonus awards tied minigame leaders only, and can be disabled', () => {
  const players = [1, 3, 2, 0, 3, 1].map((miniWins, i) => ({ i, miniWins, mangos: 0 }));
  assert.deepEqual(awardFinalBonus(players, false), []);
  assert.deepEqual(awardFinalBonus(players, true), [1, 4]);
  assert.deepEqual(players.map(p => p.mangos), [0, 1, 0, 0, 1, 0]);
});

test('all pure minigame simulations include six finite scores and independent last-seat input', () => {
  for (const make of [chinazoSim, remadaSim, raudalSim, remolinoSim]) {
    const sim = make({ count: 6, humans: new Set([5]), random: seeded(83) });
    for (let frame = 0; frame < 200; frame++) {
      const input = Array.from({ length: 6 }, (_, i) => i === 5 ? { x: frame % 12 < 6 ? -1 : 1, jump: frame % 8 === 0, aim: { x: .3, y: .3 }, pull: frame % 12 < 5, fire: frame % 12 === 5 } : {});
      sim.update(.05, input);
    }
    assert.equal(sim.scores().length, 6, make.name);
    assert(sim.scores().every(Number.isFinite), make.name);
    if (sim.shooters) assert(sim.shooters[5].shots > 0);
    if (sim.racers) assert(sim.racers[5].strokes > 0);
  }
  const bowls = createCriollasMini(Array(6).fill(true), seeded(99));
  bowls.update(.05, Array.from({ length: 6 }, (_, i) => ({ pull: i === 5 })));
  bowls.update(.05, Array.from({ length: 6 }, () => ({})));
  assert.deepEqual(bowls.players.map(p => p.left), [2, 2, 2, 2, 2, 1]);
  assert.equal(bowls.scores().length, 6);
});

test('the lobby explains the bonus, stealing and the minigame-only party', () => {
  const board = rulesSummary(DEFAULT_OPTIONS, 10).join(' ');
  assert.match(board, /Mango de oro extra/); assert.match(board, /robarle/);
  assert.equal(rulesSummary({ ...DEFAULT_OPTIONS, finalBonus: false, stealing: false }, 10).length, 0);
  const minis = rulesSummary({ ...DEFAULT_OPTIONS, mode: 'minis', stealing: true }, 5).join(' ');
  assert.match(minis, /^5 minijuegos seguidos/); assert.doesNotMatch(minis, /robarle/);
  assert.equal(cleanOptions({ mode: 'minis', rounds: 5 }).rounds, 5);
});
