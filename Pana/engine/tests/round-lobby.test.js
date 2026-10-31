import test from 'node:test';
import assert from 'node:assert/strict';
import { returnToLobby } from '../play/round-lobby.js';

test('returnToLobby moves only a finished game, drops bots and runs the reset', () => {
  const game = { phase: 'playing', players: [{ id: 1 }, { id: 2, bot: true }], round: 3 };
  assert.equal(returnToLobby(game), false); assert.equal(game.phase, 'playing');
  game.phase = 'finished';
  assert.equal(returnToLobby(game, { reset: g => { g.round = 0; } }), true);
  assert.equal(game.phase, 'lobby'); assert.deepEqual(game.players, [{ id: 1 }]); assert.equal(game.round, 0);
  assert.equal(returnToLobby(game), false, 'already in the lobby');
});

test('returnToLobby keeps bots when asked and accepts other phases', () => {
  const game = { phase: 'results', players: [{ id: 1 }, { id: 2, bot: true }] };
  assert.equal(returnToLobby(game), false);
  assert.equal(returnToLobby(game, { from: ['results'], keepBots: true }), true);
  assert.equal(game.players.length, 2);
  assert.equal(returnToLobby(null), false);
});
