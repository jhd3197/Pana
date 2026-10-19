import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRICE, DOUBLES_BONUS, standings, ranks, addCoins, canBuy, buyMango, rollDice, tileCoins,
  treeOutcome, stepsTo, botTakesHill, standCandidates, brindis, minigameBag,
} from '../public/rules.js';

const pana = (i, coins, mangos = 0, tile = 0) => ({ i, coins, mangos, tile });
// A 10-tile loop with a two-tile shortcut from 2 to 6 (tiles 10 and 11).
const loop = Array.from({ length: 12 }, (_, i) => ({ next: [(i + 1) % 10] }));
loop[2].next = [3, 10]; loop[10].next = [11]; loop[11].next = [6];

test('golden mangos rank first, coins break ties, full ties share a place', () => {
  const ps = [pana(0, 5, 1), pana(1, 30, 0), pana(2, 9, 1), pana(3, 5, 1)];
  assert.deepEqual(standings(ps).map(p => p.i), [2, 0, 3, 1]);
  assert.deepEqual(ranks(ps), { 2: 1, 0: 2, 3: 2, 1: 4 });
});

test('coins never go negative; the real change comes back', () => {
  const p = pana(0, 3);
  assert.equal(addCoins(p, -5), -3);
  assert.equal(p.coins, 0);
  assert.equal(addCoins(p, 8), 8);
});

test('a golden mango costs PRICE, only when affordable', () => {
  const poor = pana(0, PRICE - 1), rich = pana(1, PRICE + 4);
  assert.equal(canBuy(poor), false);
  assert.equal(buyMango(poor), false);
  assert.equal(poor.coins, PRICE - 1);
  assert.equal(buyMango(rich), true);
  assert.deepEqual([rich.coins, rich.mangos], [4, 1]);
});

test('dice: two d6, doubles flagged', () => {
  const rolls = [0.99, 0.99, 0, 0.5];
  const r = () => rolls.shift();
  assert.deepEqual(rollDice(r), { a: 6, b: 6, n: 12, doubles: true });
  assert.deepEqual(rollDice(r), { a: 1, b: 4, n: 5, doubles: false });
  assert.ok(DOUBLES_BONUS > 0);
});

test('tiles: blue and start pay, red costs, tree and event have their own effect', () => {
  assert.equal(tileCoins('blue'), 3);
  assert.equal(tileCoins('start'), 3);
  assert.equal(tileCoins('red'), -3);
  assert.equal(tileCoins('tree'), null);
  assert.equal(tileCoins('event'), null);
});

test('the mango tree: rare mango, some coconuts, mostly coins', () => {
  assert.equal(treeOutcome(0.05), 'mango');
  assert.equal(treeOutcome(0.2), 'coconut');
  assert.equal(treeOutcome(0.9), 'coins');
});

test('steps follow the board graph, shortcut included', () => {
  assert.equal(stepsTo(loop, 0, 0), 0);
  assert.equal(stepsTo(loop, 2, 6), 3);           // 2 → 10 → 11 → 6
  assert.equal(stepsTo(loop, 7, 1), 4);           // around the loop
  assert.equal(stepsTo(loop, 10, 3), 9);          // the shortcut only goes forward
});

test('bots take the hill when it pays, or on a whim', () => {
  const base = { toll: 5, viaHill: 3, viaShore: 6, whim: 0.9 };
  assert.equal(botTakesHill({ ...base, coins: PRICE + 5 }), true);
  assert.equal(botTakesHill({ ...base, coins: PRICE + 4 }), false);
  assert.equal(botTakesHill({ ...base, coins: 0, whim: 0.1 }), true);
});

test('the stand moves to a free tile, never under a pana', () => {
  const ring = Array.from({ length: 40 }, (_, i) => ({ next: [(i + 1) % 40] }));
  const players = [pana(0, 0, 0, 0), pana(1, 0, 0, 2)];
  const spots = standCandidates({ tileCount: 40, standTile: 12, tiles: ring, players, isBad: i => i === 13 });
  assert.ok(spots.length > 0);
  for (const i of spots) {
    assert.ok(![0, 2, 12, 13].includes(i));
    assert.ok(Math.min(...players.map(p => stepsTo(ring, p.tile, i))) >= 4);
  }
  const crowded = standCandidates({ tileCount: 3, standTile: 0, tiles: ring, players: [pana(0, 0, 0, 1)], isBad: () => false });
  assert.deepEqual(crowded, [2]);                 // nothing ideal: any free tile
});

test('brindis: each pana gives up to two coins', () => {
  const ps = [pana(0, 0), pana(1, 10), pana(2, 1), pana(3, 0)];
  assert.equal(brindis(ps, ps[0]), 3);
  assert.deepEqual(ps.map(p => p.coins), [3, 8, 0, 0]);
});

test('minigames come shuffled, each once per pass, never twice in a row', () => {
  const ids = ['a', 'b', 'c', 'd'];
  for (let seed = 1; seed <= 50; seed++) {
    let s = seed;
    const random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const draw = minigameBag(ids, random);
    const seq = Array.from({ length: 40 }, draw);
    for (let k = 0; k < 40; k += 4) assert.deepEqual([...seq.slice(k, k + 4)].sort(), ids);
    for (let k = 1; k < 40; k++) assert.notEqual(seq[k], seq[k - 1]);
  }
  const one = minigameBag(['solo']);
  assert.deepEqual([one(), one()], ['solo', 'solo']);
});

test('a saved minigame bag continues the same pass after a host change', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const host = minigameBag(ids, () => 0.37);
  const first = [host(), host()];
  const resumed = minigameBag(ids, () => 0.37, host.save());
  const rest = [resumed(), resumed(), resumed()];
  assert.deepEqual([...first, ...rest].sort(), ids, 'every minigame once per pass, none repeated');
  assert.notEqual(resumed(), rest[2], 'the next pass never repeats the last one');
});
