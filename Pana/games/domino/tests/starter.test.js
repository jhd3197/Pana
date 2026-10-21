import test from 'node:test';
import assert from 'node:assert/strict';
import { DominoGame, legalMoves } from '../public/rules.js';
import { starterResult } from '../../../engine/play/quien-empieza-rules.js';

const cachos = g => { for (let i = 0; i < 400 && g.phase === 'starter'; i++) g.stepCachos(.1); };
const send = (g, id, extra, seq) => g.accept(id, { action: 'starter', seq, revision: -1, ...extra }, 1);

test('by default the first mano keeps Salida: the double six opens, no cachos', () => {
  const g = new DominoGame(3); g.start();
  assert.equal(g.options.starter, 'regla'); assert.equal(g.phase, 'playing'); assert.equal(g.cachos, null);
  assert.deepEqual(legalMoves(g), [{ tile: '6-6', end: 'right' }]);
});

test('cacho: the first mano opens with the cachos, the highest opens with any tile', () => {
  const g = new DominoGame(5); g.addPlayer(1, 'Juan'); g.configure({ starter: 'cacho' }); g.start();
  assert.equal(g.phase, 'starter'); assert.ok(g.players.every(p => p.hand.length === 7), 'the hands are dealt');
  assert.equal(g.accept(1, { action: 'play', tile: g.players[0].hand[0].id, end: 'right', seq: 1, revision: g.revision }, 1), false, 'nobody plays during the cachos');
  assert.ok(send(g, 1, { cacho: 'shake' }, 1), 'a cacho never waits for the latest revision');
  assert.ok(send(g, 1, { cacho: 'slam', power: .7 }, 2));
  assert.equal(send(g, 1, { cacho: 'slam', power: .7 }, 3), false, 'one slam a round');
  assert.equal(send(g, 2, { cacho: 'slam' }, 1), false, 'not at the table');
  assert.equal(g.start(), false, 'no new deal mid-roll');
  cachos(g);
  const { order } = starterResult(g.cachos);
  assert.equal(g.phase, 'playing'); assert.equal(g.turn, order[0]); assert.equal(g.starter, order[0]);
  assert.equal(g.openingTile, null); assert.equal(legalMoves(g).length, 7, 'any tile opens the mano');
});

test('only the first mano uses the cachos; later manos follow Salida', () => {
  const g = new DominoGame(8); g.configure({ starter: 'cacho', opener: 'winner' }); g.start(); cachos(g);
  g.finish(1, 'out', 3); g.start();
  assert.equal(g.phase, 'playing'); assert.equal(g.cachos, null); assert.equal(g.turn, 3);
});

test('al azar starts at once; revancha puts the last place of the match first', () => {
  const azar = new DominoGame(4); azar.configure({ starter: 'azar' }); azar.start();
  assert.equal(azar.phase, 'playing'); assert.equal(azar.cachos.note, 'Orden al azar'); assert.equal(legalMoves(azar).length, 7);
  const g = new DominoGame(9); g.configure({ starter: 'revancha', mode: 'individual' }); g.start(); cachos(g);
  g.scores = [99, 40, 10, 60]; g.players.forEach(p => { p.hand = [{ id: '1-1', a: 1, b: 1 }]; }); g.finish(0, 'out', 0);
  assert.equal(g.phase, 'finished'); assert.equal(g.lastPlace, 2);
  g.setup(); assert.equal(g.lastPlace, 2, 'a new table keeps who lost');
  g.start(); cachos(g); assert.equal(g.turn, 2);
});

test('teams: the revancha goes to the losing team, the pana with most points left', () => {
  const g = new DominoGame(2); g.configure({ starter: 'revancha' }); g.start(); cachos(g);
  g.scores = [95, 30]; g.players.forEach((p, i) => { p.hand = [{ id: `${i}-${i}`, a: i, b: i }]; });
  g.finish(0, 'out', 0); assert.equal(g.lastPlace, 3);
});

test('the cachos survive a host change mid-roll', () => {
  const g = new DominoGame(11); g.configure({ starter: 'cacho' }); g.start(); g.stepCachos(1);
  const copy = DominoGame.restore(g.snapshot(), new Map());
  cachos(g); cachos(copy);
  assert.deepEqual(starterResult(copy.cachos), starterResult(g.cachos)); assert.equal(copy.turn, g.turn);
});
