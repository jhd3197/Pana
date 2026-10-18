import test from 'node:test';
import assert from 'node:assert/strict';
import { Poker, evaluateHand } from '../public/rules.js';
import { OPTION_FIELDS, DEFAULT_OPTIONS } from '../public/options.js';
import { rng } from '../../../engine/random.js';

const card = (rank, suit = 0) => suit * 13 + rank - 2;
function table(options = {}, count = 2) {
  const game = new Poker(); game.configure(options);
  for (let i = 1; i <= count; i++) game.add(i, { name: `Pana ${i}`, avatar: {}, bot: false });
  return game;
}
function checkDown(game) { for (let i = 0; i < 100 && game.phase !== 'finished'; i++) assert(game.act(game.turn, 'call')); assert.equal(game.phase, 'finished'); }

test('reset applies room options and the adopted map atomically at one revision', () => {
  const game = table({ variant: 'omaha', stack: 5000 }); game.setMap('puerto');
  const revision = game.revision;
  assert.equal(game.configure(DEFAULT_OPTIONS, 'invalid-map'), false);
  assert.equal(game.configure({ ...DEFAULT_OPTIONS, stack: -1 }, 'plaza'), false);
  assert.equal(game.revision, revision); assert.equal(game.mapId, 'puerto'); assert.equal(game.options.variant, 'omaha');
  assert.equal(game.configure(DEFAULT_OPTIONS, 'plaza'), true);
  assert.equal(game.revision, revision + 1); assert.equal(game.mapId, 'plaza'); assert.deepEqual(game.options, DEFAULT_OPTIONS);
  game.start(); assert.equal(game.configure(DEFAULT_OPTIONS, 'puerto'), false); assert.equal(game.mapId, 'plaza');
});

test('every prototype option validates atomically and freezes during a hand', () => {
  const game = table();
  for (const field of OPTION_FIELDS) for (const [value] of field.choices) assert(game.configure({ [field.id]: value }));
  const before = { ...game.options };
  assert.equal(game.configure({ stack: 5000, turnSeconds: 0 }), false);
  assert.equal(game.configure({ deck: [] }), false);
  assert.deepEqual(game.options, before);
  game.start(); assert.equal(game.configure({ variant: 'texas' }), false);
});

test('Omaha deals four unique private cards to all six players with the selected buy-in and blinds', () => {
  const game = table({ variant: 'omaha', stack: 5000, blinds: 100 }, 6); game.start(rng(65));
  assert.equal(new Set(game.players.flatMap(p => p.hole)).size, 24);
  assert(game.players.every(p => p.hole.length === 4));
  assert.equal(game.players.reduce((n, p) => n + p.chips + p.total, 0), 30000);
  assert.equal(game.view(1).pot, 150); assert.equal(game.bigBlind, 100);
  assert(game.view(1).players.filter(p => p.id !== 1).every(p => p.hole.every(c => c === null)));
});

test('Omaha uses exactly two hole cards and three board cards, never a board-only royal flush', () => {
  const board = [10, 11, 12, 13, 14].map(r => card(r, 2));
  const hole = [card(2, 2), card(3, 0), card(4, 1), card(5, 3)];
  assert.equal(evaluateHand(hole, board, 'texas')[0], 8);
  assert.equal(evaluateHand(hole, board, 'omaha')[0], 0);
  hole[1] = card(3, 2);
  assert.deepEqual(evaluateHand(hole, board, 'omaha'), [5, 14, 13, 12, 3, 2]);
});

test('pot-limit caps a raise at the pot after calling, while no-limit keeps the full stack', () => {
  const pot = table({ limit: 'pot' }); pot.start();
  assert.equal(pot.legal(pot.turn).max, 60);
  assert.equal(pot.act(pot.turn, 'raise', 61), false);
  assert(pot.act(pot.turn, 'raise', 60));
  const noLimit = table({ limit: 'none' }); noLimit.start();
  assert.equal(noLimit.legal(noLimit.turn).max, 1000);
});

test('fixed-limit uses one bet size, caps a street at four bets, and doubles on turn and river', () => {
  const game = table({ limit: 'fixed' }); game.start();
  assert.deepEqual([game.legal(game.turn).min, game.legal(game.turn).max], [40, 40]);
  assert.equal(game.act(game.turn, 'raise', 1000), false);
  for (const amount of [40, 60, 80]) assert(game.act(game.turn, 'raise', amount));
  assert.equal(game.legal(game.turn).raise, false);
  assert(game.act(game.turn, 'call')); assert.equal(game.phase, 'flop');
  assert.equal(game.legal(game.turn).min, 20); assert.equal(game.legal(game.turn).max, 20);
  game.act(game.turn, 'call'); game.act(game.turn, 'call');
  assert.equal(game.phase, 'turn'); assert.equal(game.legal(game.turn).min, 40);
  game.act(game.turn, 'call'); game.act(game.turn, 'call');
  assert.equal(game.phase, 'river'); assert.equal(game.legal(game.turn).max, 40);
});

test('blinds double at the selected time interval only when another hand is dealt', () => {
  for (const minutes of [0, 5, 10]) {
    const game = table({ blindMinutes: minutes }); game.start(rng(4), 1000);
    game.act(game.turn, 'fold');
    game.start(rng(5), 301000);
    assert.equal(game.bigBlind, minutes === 5 ? 40 : 20);
    game.act(game.turn, 'fold'); game.start(rng(6), 601000);
    const expected = minutes === 0 ? 20 : minutes === 5 ? 80 : 40;
    assert.equal(game.bigBlind, expected);
    game.act(game.turn, 'fold'); assert(game.setup());
    assert(game.configure({ variant: 'omaha' }));
    assert.equal(game.bigBlind, expected, 'unrelated lobby choices preserve the current blind level');
    assert(game.start(rng(7), 601001)); assert.equal(game.bigBlind, expected);
  }
});

test('disabled recompras leave busted players out; enabled recompras use the selected stack', () => {
  const off = table({ rebuy: false }, 3); off.players[0].chips = 0;
  assert(off.start()); assert.equal(off.players[0].chips, 0); assert.deepEqual(off.players[0].hole, []);
  off.act(off.turn, 'fold'); off.players[1].chips = 0; assert.equal(off.start(), false);
  const on = table({ rebuy: true, stack: 5000 }); on.players[0].chips = 0;
  assert(on.start()); assert.equal(on.players[0].chips + on.players[0].total, 5000);
});

test('hidden showdown still settles correctly but never sends opponents cards or hand names', () => {
  const game = table({ variant: 'omaha', showCards: false }); game.start(rng(13)); checkDown(game);
  const own = game.view(1), remote = own.players.find(p => p.id === 2);
  assert.deepEqual(remote.hole, [null, null, null, null]); assert.equal(remote.handName, '');
  assert(own.players.find(p => p.id === 1).hole.every(Number.isInteger));
  assert.equal(own.players.reduce((n, p) => n + p.chips, 0), 2000);
  assert.equal('deck' in own, false);
});

test('six-player Texas/Omaha hands across all limits settle side pots and conserve every chip', () => {
  const random = rng(102);
  for (const variant of ['texas', 'omaha']) for (const limit of ['none', 'pot', 'fixed']) for (let run = 0; run < 25; run++) {
    const game = table({ variant, limit }, 6);
    game.players.forEach(p => { p.chips = 40 + Math.floor(random() * 600); });
    const total = game.players.reduce((n, p) => n + p.chips, 0); game.start(random);
    for (let step = 0; game.phase !== 'finished' && step < 200; step++) {
      const legal = game.legal(game.turn), n = random();
      const action = n < .15 ? 'fold' : n > .6 && legal.raise ? 'raise' : 'call';
      assert(game.act(game.turn, action, action === 'raise' ? legal.max : undefined), `${variant}/${limit}/${action}`);
    }
    assert.equal(game.phase, 'finished'); assert.equal(game.players.reduce((n, p) => n + p.chips, 0), total);
  }
});
