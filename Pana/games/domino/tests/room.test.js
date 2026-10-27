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
