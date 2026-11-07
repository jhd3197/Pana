// Dominó's server room: each pana sees only their own tiles, and the room
// numbers actions itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import DominoRoom from '../server/room.js';
import { createTestRoom } from '../../../server/tests/harness.js';

const lastView = sent => sent.filter(m => m.type === 'view').at(-1).payload;

test('a seat sees its own hand; rivals, the boneyard and the seed stay on the server', () => {
  const t = createTestRoom(DominoRoom, { code: 'domino-view' });
  const ana = t.join('ana'), beto = t.join('beto');
  t.send(ana.client, 'action', { action: 'options', patch: { starter: 'regla' }, revision: t.room.game.revision });
  t.send(ana.client, 'action', { action: 'start', revision: t.room.game.revision });
  assert.equal(t.room.game.phase, 'playing');
  const view = lastView(beto.sent), mine = view.players.findIndex(p => p.id === 2);
  assert.ok(view.players[mine].hand.every(tile => tile.id));
  for (const p of view.players) if (p.seat !== mine) assert.ok(p.hand.length && p.hand.every(tile => tile.id === null), `seat ${p.seat} is face down`);
  assert.equal(view.rng, undefined); assert.equal(view.ledger, undefined);
  assert.ok(view.reserve.every(tile => tile.id === null));
  t.room.onDispose();
});

test('only the host deals; a dropped pana plays as a bot and gets their seat back', () => {
  const t = createTestRoom(DominoRoom, { code: 'domino-seat' });
  const ana = t.join('ana'), beto = t.join('beto');
  t.send(beto.client, 'action', { action: 'start', revision: t.room.game.revision });
  assert.equal(t.room.game.phase, 'lobby', 'a guest cannot deal');
  const place = t.room.game.players.findIndex(p => p.id === 2);
  t.drop(beto.client);
  assert.equal(t.room.game.players[place].id, null);
  t.join('cora');
  t.reconnect(beto.client);
  assert.equal(t.room.game.players[place].id, 2, 'back in the same chair');
  assert.ok(ana);
  t.room.onDispose();
});

test('a table flip goes to the others on your turn, and the game never hears of it', () => {
  const t = createTestRoom(DominoRoom, { code: 'domino-flip' });
  const ana = t.join('ana'), beto = t.join('beto');
  const flips = () => t.broadcasts.filter(b => b.type === 'flip');
  t.send(ana.client, 'flip', { seed: 1 });
  assert.equal(flips().length, 0, 'not in the lobby');
  t.send(ana.client, 'action', { action: 'options', patch: { starter: 'regla' }, revision: t.room.game.revision });
  t.send(ana.client, 'action', { action: 'start', revision: t.room.game.revision });
  for (let i = 0; i < 400 && ![1, 2].includes(t.room.game.players[t.room.game.turn].id); i++) t.tick();
  const turn = t.room.game.players[t.room.game.turn].id;
  assert.ok([1, 2].includes(turn), 'the bots hand a pana the turn');
  const [mine, other] = turn === 1 ? [ana, beto] : [beto, ana];
  const before = JSON.stringify(t.room.game.snapshot?.() ?? t.room.game.view(0)), sent = mine.sent.length;
  t.send(other.client, 'flip', { seed: 2 });
  assert.equal(flips().length, 0, 'out of turn');
  t.send(mine.client, 'flip', { seed: 77 });
  t.send(mine.client, 'flip', { seed: 78 });
  assert.equal(flips().length, 1, 'the cooldown holds');
  assert.deepEqual(flips()[0].msg, { seat: turn, seed: 77 });
  assert.equal(flips()[0].opts.except, mine.client);
  assert.equal(JSON.stringify(t.room.game.snapshot?.() ?? t.room.game.view(0)), before, 'the game is untouched');
  assert.equal(mine.sent.length, sent, 'no new view: nothing happened to the game');
  t.room.onDispose();
});
