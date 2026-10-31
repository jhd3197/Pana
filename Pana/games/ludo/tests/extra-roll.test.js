import test from 'node:test';
import assert from 'node:assert/strict';
import { LudoGame, EXTRA_ONE_CAP, legalMoves } from '../public/rules.js';
import { defaultLudoOptions, ludoOptions } from '../public/options.js';
// Seat 0 to play with a die already showing; ¿Quién empieza? skipped.
const game = (options = {}) => {
  const g = new LudoGame(123); g.addPlayer(1, 'Juan'); g.addPlayer(2, 'Ana'); g.start();
  g.phase = 'playing'; g.starter = null; g.turn = 0; Object.assign(g.options, options);
  return g;
};
const play = (g, die, piece = 0) => { g.die = die; assert(g.move(piece), `move with ${die}`); };
function seedFor(values) {
  for (let seed = 1; ; seed++) {
    let rng = seed; const out = values.map(() => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return 1 + Math.floor(rng / 4294967296 * 6); });
    if (out.every((v, i) => v === values[i])) return seed;
  }
}

test('extraOnOne is on by default and validated like the other options', () => {
  assert.equal(defaultLudoOptions().extraOnOne, true);
  assert.equal(new LudoGame(1).options.extraOnOne, true);
  assert.equal(ludoOptions(defaultLudoOptions(), { extraOnOne: 'no' }), null);
  assert.equal(ludoOptions(defaultLudoOptions(), { extraOnOne: false }).extraOnOne, false);
});

test('a 1 that moves rolls again; off, the turn passes', () => {
  const on = game(); on.players[0].pieces[0] = 10;
  play(on, 1);
  assert.equal(on.players[0].pieces[0], 11); assert.equal(on.turn, 0); assert.equal(on.die, 0); assert.equal(on.extraRolls, 1);
  const off = game({ extraOnOne: false }); off.players[0].pieces[0] = 10;
  play(off, 1);
  assert.equal(off.turn, 1); assert.equal(off.extraRolls, 0);
});

test('a 6 still rolls again either way, and 1s do not count towards three sixes', () => {
  for (const extraOnOne of [true, false]) {
    const g = game({ extraOnOne }); g.players[0].pieces[0] = 10;
    play(g, 6); assert.equal(g.turn, 0); assert.equal(g.die, 0);
  }
  // Two 6s, then a 1: the sixes streak restarts.
  const g = game({ entry: 'one-six' }); g.players[0].pieces[0] = 10; g.sixes = 2;
  g.rng = seedFor([1]); g.roll(); assert.equal(g.lastDie, 1); assert.equal(g.sixes, 0); assert.equal(g.turn, 0);
  // The third 6 still forfeits, streak or not.
  const third = game(); third.players[0].pieces[0] = 10; third.sixes = 2; third.extraRolls = 2;
  third.rng = seedFor([6]); third.roll();
  assert.equal(third.lastDie, 6); assert.equal(third.turn, 1); assert.equal(third.extraRolls, 0);
  // 6s are never capped by the 1s streak.
  const many = game({ threeSixes: false }); many.players[0].pieces[0] = 0; many.extraRolls = EXTRA_ONE_CAP + 2;
  play(many, 6); assert.equal(many.turn, 0);
});

test('capture bonus still re-rolls, with the option off or the 1s cap reached', () => {
  const g = game({ extraOnOne: false, captureBonus: true });
  g.players[0].pieces[0] = 14; g.players[1].pieces[0] = 5; play(g, 4);
  assert.equal(g.players[1].pieces[0], -1); assert.equal(g.turn, 0); assert.equal(g.die, 0);
  const capped = game({ captureBonus: true }); capped.extraRolls = EXTRA_ONE_CAP;
  capped.players[0].pieces[0] = 17; capped.players[1].pieces[0] = 5; play(capped, 1);
  assert.equal(capped.players[1].pieces[0], -1); assert.equal(capped.turn, 0);
  // Without captureBonus, a capture on a 1 re-rolls through the 1 itself.
  const plain = game(); plain.players[0].pieces[0] = 17; plain.players[1].pieces[0] = 5; play(plain, 1);
  assert.equal(plain.turn, 0); assert.equal(plain.extraRolls, 1);
});

test('the streak resets when the turn changes', () => {
  const g = game(); g.players[0].pieces[0] = 10; g.extraRolls = 2;
  play(g, 3); assert.equal(g.turn, 1); assert.equal(g.extraRolls, 0);
  g.extraRolls = 2; g.nextTurn(); assert.equal(g.extraRolls, 0);
});

test(`1s chain at most ${EXTRA_ONE_CAP} extra rolls in a turn`, () => {
  const g = game(); g.players[0].pieces[0] = 10;
  for (let i = 1; i <= EXTRA_ONE_CAP; i++) { play(g, 1); assert.equal(g.turn, 0); assert.equal(g.extraRolls, i); }
  play(g, 1); assert.equal(g.turn, 1, 'the capped 1 still moves, then the turn passes'); assert.equal(g.extraRolls, 0);
  assert.equal(g.players[0].pieces[0], 10 + EXTRA_ONE_CAP + 1);
  // Mixed with 6s: two 6s and a 1 already make three extra rolls.
  const mixed = game(); mixed.players[0].pieces[0] = 0;
  play(mixed, 6); play(mixed, 6); play(mixed, 1); assert.equal(mixed.turn, 0);
  play(mixed, 1); assert.equal(mixed.turn, 1);
});

test('with one-six entry a 1 leaves the yard and rolls again; with no move it passes', () => {
  const g = game({ entry: 'one-six' }); g.die = 1; assert.deepEqual(legalMoves(g), [0, 1, 2, 3]);
  g.move(0); assert.equal(g.players[0].pieces[0], 0); assert.equal(g.turn, 0); assert.equal(g.die, 0);
  const stuck = game({ entry: 'six', assistedEntry: false }); stuck.rng = seedFor([1]); stuck.roll();
  assert.equal(stuck.lastDie, 1); assert.equal(stuck.turn, 1);
});

test('rooms and snapshots from before the option play with it on', () => {
  const g = game(); delete g.options.extraOnOne; g.players[0].pieces[0] = 10;
  play(g, 1); assert.equal(g.turn, 0);
  const old = game().snapshot(); delete old.options.extraOnOne; delete old.extraRolls;
  const restored = LudoGame.restore(old, new Map());
  assert.equal(restored.options.extraOnOne, true); assert.equal(restored.extraRolls, 0);
  // A streak field missing on a live game still counts from 0.
  delete restored.extraRolls; restored.players[0].pieces[0] = 10; play(restored, 1);
  assert.equal(restored.extraRolls, 1);
});
